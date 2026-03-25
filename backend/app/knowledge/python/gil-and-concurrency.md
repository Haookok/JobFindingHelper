# Python GIL 与并发编程

- **难度**: 进阶
- **分类**: Python 运行时 / 并发
- **标签**: [GIL, 多线程, 多进程, asyncio, 协程, concurrent.futures]

## 核心概念

GIL（全局解释器锁）就像一扇**只有一把钥匙的大门**。CPython 解释器规定：同一时刻只有一个线程能拿到这把钥匙进门执行 Python 代码。其他线程必须在门外排队等着。

这意味着：**Python 的多线程在 CPU 密集型任务上几乎没有加速效果**——因为同时只有一个线程在干活。但对于 **I/O 密集型任务**（网络请求、读写文件），线程在等数据的时候会自动交出钥匙让别人进，所以多线程还是有用的。

## 详细解析

### 三种并发方案——什么时候用什么？

**多线程**（threading）：I/O 密集型任务的好帮手。比如同时请求 10 个网页——一个线程在等网页响应时，其他线程可以继续工作。但 CPU 密集型（纯计算）就别指望了，GIL 会让你的多线程变成"轮流干活"。

**多进程**（multiprocessing）：CPU 密集型的正确选择。每个进程有自己独立的解释器和 GIL，真正能利用多核。代价是进程创建开销大，进程间通信要靠队列/管道。

**asyncio**（协程）：I/O 密集型的另一个好选择。单线程里跑成千上万个协程，遇到 `await`（等数据）就切到别的协程去干活。比多线程更轻量，但要求用异步库（`aiohttp`），不能混用阻塞式的 `requests`。

**选型口诀**：CPU 密集 → 多进程；I/O 密集 → 多线程或 asyncio；要统一接口 → `concurrent.futures`。

### GIL 不代表不用加锁！

虽然 GIL 保证同一时刻只有一个线程执行字节码，但 Python 的一行代码可能对应多条字节码。比如 `balance -= amount` 可能分成"读余额"、"减去金额"、"写回余额"三步——两个线程在这三步之间切换，余额就可能算错。所以共享可变数据**还是要加锁**。

### asyncio 的注意事项

asyncio 是单线程的事件循环，如果你在协程里调用了阻塞式 API（比如 `requests.get`），整个循环就会卡住——其他所有协程都得等。解决方案：要么换成异步库（`httpx`/`aiohttp`），要么用 `loop.run_in_executor` 把阻塞调用扔到线程池里。

## 示例代码

```python
import asyncio
import concurrent.futures
import time

# CPU 密集型任务：用多进程
def cpu_bound(n: int) -> int:
    return sum(i * i for i in range(n))

async def main():
    loop = asyncio.get_running_loop()
    # 把 CPU 密集任务扔到进程池，不阻塞事件循环
    with concurrent.futures.ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, cpu_bound, 50_000)
    print(result)

# I/O 密集型任务：用线程池
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    # 8 个"等待任务"，4 个线程并发处理
    futures = [pool.submit(time.sleep, 0.01) for _ in range(8)]
    concurrent.futures.wait(futures)
```

## 面试追问

- **面试官可能会这样问你**：GIL 和引用计数有什么关系？为什么移除 GIL 这么难？（CPython 用引用计数做内存管理，多线程下引用计数加减不加锁就会出错；移除 GIL 要重写整个引用计数机制，还得兼顾 C 扩展）
- **面试官可能会这样问你**：asyncio 和 gevent 有什么区别？（asyncio 是显式协作——你主动 await；gevent 是"monkey patching"把标准库偷偷换成异步版，对程序员透明但可能有兼容性问题）
- **面试官可能会这样问你**：有没有不受 GIL 影响的 Python 实现？（Jython 和 IronPython 没有 GIL；PyPy 也有 GIL 但在优化上更激进）
- **面试官可能会这样问你**：在 async 函数里调用 `time.sleep(10)` 会怎样？（整个事件循环卡 10 秒！应该用 `await asyncio.sleep(10)`）

## 常见误区

- **很多人会搞混的地方**：以为"Python 不能多线程"——可以！I/O 密集型下多线程照样有效，只是 CPU 密集的纯 Python 代码不行。
- **很多人会搞混的地方**：在 async 函数里直接调用 `requests.get` 等阻塞 API——会卡死整个事件循环，必须用异步库或 `run_in_executor`。
- **很多人会搞混的地方**：用 multiprocessing 时忘了 `if __name__ == "__main__"` 守卫——Windows 上子进程会重新 import 主模块，导致递归创建进程。
- **很多人会搞混的地方**：以为有了 GIL 就不需要加锁了——多线程共享可变数据时，仍然可能在字节码间隙出现竞态条件。
