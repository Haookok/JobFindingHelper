# Python GIL 与并发编程

- **难度**: 进阶
- **分类**: Python 运行时 / 并发
- **标签**: [GIL, 多线程, 多进程, asyncio, 协程, concurrent.futures]

## 核心概念

**GIL（Global Interpreter Lock）** 是 CPython 中的**全局互斥锁**，同一时刻只有一个线程执行 Python 字节码，从而简化 C 扩展与引用计数实现。GIL 在 **I/O** 或部分 C 扩展释放时会让出，因此多线程对 **I/O 密集型** 仍可能提升吞吐；对 **CPU 密集型** 纯 Python 代码，多线程往往**无法并行利用多核**，甚至因上下文切换更慢。

**多进程**（`multiprocessing`）每个进程独立解释器，无共享 GIL，适合 CPU 密集。**asyncio** 基于**单线程协作式**调度：协程在 `await` 处让出，由事件循环驱动，适合高并发 I/O。

## 详细解析

**多线程 vs 多进程**：线程共享地址空间、切换轻，但受 GIL 限制；进程隔离、开销大，通信需 IPC（队列、管道）。**协程**非操作系统线程，是用户态任务单元，避免锁竞争与大量线程栈内存。

**asyncio**：`async def` 定义协程，`await` 挂起等待 Future；`asyncio.gather` 并发等待多个任务。需使用**异步库**（如 `aiohttp`），阻塞式 `requests.get` 会卡住整个循环。

**concurrent.futures**：`ThreadPoolExecutor` 适合 I/O 边界包装同步 API；`ProcessPoolExecutor` 将可 pickle 的函数丢到子进程执行，接口统一 `submit` / `map`。

**GIL 与 `time.sleep`**：CPython 中 `time.sleep` 在等待期间会**释放 GIL**，其他线程可执行字节码；与长时间占用 GIL 的**纯 Python CPU 循环**不同，后者难以在多线程下并行加速。

**全局解释器状态**：导入模块、GC 等也可能短暂交互 GIL；高并发下可结合 `queue`、`asyncio.Queue` 做生产者消费者，避免共享可变状态。

**性能选型口诀**：CPU 密集且纯 Python → **多进程**或原生/C 扩展；I/O 密集 → **多线程**或 **asyncio**；要统一接口 → **`concurrent.futures`**；已有异步生态 → **async/await**。

**`threading` 与 GIL**：`Lock`、`RLock` 仍用于保护**共享可变状态**；即便有 GIL，多线程下若存在**字节码交错**（如 check-then-act），仍需锁或原子数据结构保证逻辑正确。

**子解释器与 nogil（了解向）**：PEP 554 等讨论子解释器隔离；社区对移除 GIL 的实验影响单线程性能与 C 扩展兼容，面试可答「CPython 默认有 GIL，选型依赖 workload」。

**调试并发**：`threading` 用日志与 `traceback`；`asyncio` 打开 **debug 模式**、关注「协程未 await」与**死锁在 Future 链**上的案例。

**`asyncio` 与线程**：`loop.run_in_executor` 把阻塞调用丢进线程池，避免阻塞事件循环；默认 executor 线程数有限，高并发需自建池。

**生成器与协程演进**：旧式生成器协程（`yield`）已被 `async/await` 取代；理解「协程是可在挂起点保存栈帧的对象」有助于读旧代码与第三方库。

**标准库边界**：`socket` 默认同步；要用 asyncio 需 `asyncio.open_connection` 或非阻塞套接字 + `loop.add_reader` 等，面试常考「为何不能混用阻塞 API」。

## 示例代码

```python
import asyncio
import concurrent.futures
import time

def cpu_bound(n: int) -> int:
    return sum(i * i for i in range(n))

async def main():
    loop = asyncio.get_running_loop()
    with concurrent.futures.ProcessPoolExecutor() as ex:
        r = await loop.run_in_executor(ex, cpu_bound, 50_000)
    print(r)

# asyncio.run(main())

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    futs = [ex.submit(time.sleep, 0.01) for _ in range(8)]
    concurrent.futures.wait(futs)
```

说明：示例中 `asyncio.run(main())` 注释掉是为了文件可被同步上下文直接 import；单测或脚本入口可取消注释独立运行 `main`。

**库选型提示**：HTTP 客户端在 asyncio 下优先 `httpx`/`aiohttp`；数据库用对应 async driver，避免在协程里用阻塞驱动占满事件循环。

**上下文变量**：`contextvars` 在 asyncio 任务间传递请求级上下文，替代有隐患的全局变量或粗粒度 ThreadLocal。

## 面试追问

- **追问 1**：GIL 与引用计数、竞态条件的关系？为何移除 GIL 困难？
- **追问 2**：`asyncio` 与 `gevent`/`eventlet` 绿色线程模型有何异同？
- **追问 3**：PyPy、Jython 是否都有 GIL？无 GIL 的 Python 实现（如 nogil 分支）对生态的影响？
- **追问 4**：`asyncio.create_task` 与 `ensure_future` 区别？事件循环单线程下如何避免 CPU 密集协程饿死其他任务？

## 常见误区

- 认为「Python 不能多线程」——能，只是**CPU 密集纯 Python** 难以并行；I/O 与 C 扩展释放 GIL 时仍可并发。
- 在 `async` 函数里直接调用**阻塞**磁盘/网络 API 却期望高并发——应 `run_in_executor` 或换异步库。
- 把 `multiprocessing` 当多线程用却忽略 **Windows spawn** 与 **pickle** 限制、`if __name__ == "__main__"` 守卫。
- 认为 **`asyncio.run` 可嵌套调用**——应在已有循环内用 `await`，嵌套 `run` 会报错；Jupyter 等环境需注意已有事件循环。
- 默认 **`fork` 后多线程 + CUDA/OpenMP** 等组合在 Linux 上可能死锁——Python 3.14+ 等版本对子进程启动方式有演进，需读发行说明。
