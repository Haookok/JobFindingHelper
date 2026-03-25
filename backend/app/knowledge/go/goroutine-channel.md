# Goroutine 与 Channel

- **难度**: 进阶
- **分类**: Go / 并发
- **标签**: [Goroutine, GMP, Channel, Select, Context, 并发模式, 泄漏]

## 核心概念

**Goroutine** 是 Go 运行时管理的轻量级协程，栈初始很小并可动态伸缩，由调度器在用户态切换，成本远低于 OS 线程。**GMP 模型**中：`G` 表示 goroutine，`M` 表示 OS 线程（Machine），`P` 表示逻辑处理器（Processor），持有本地可运行队列并与 M 绑定执行 G；全局队列与 **work stealing** 平衡负载。

**Channel** 是类型安全的通信原语，贯彻「通过通信共享内存」。无缓冲 channel 发送与接收同步配对（handoff）；有缓冲 channel 在缓冲区未满时可异步发送，满则阻塞。**`select`** 在多个 channel 操作上多路复用，随机公平选择一个就绪分支，可配合 `default` 实现非阻塞。**`context.Context`** 用于取消与超时在调用链上向下传播，应只向下传、不存结构体长期持有。

## 详细解析

**调度要点**：阻塞 syscall 或长时间运行可能 **M 与 P 分离**（handoff），避免占满 P；`runtime.GOMAXPROCS` 控制可同时执行用户代码的 P 数量，默认接近 CPU 核数。抢占在较新版本通过 **异步抢占** 等机制改善长时间循环饿死其他 G 的问题。

**Channel 语义**：无缓冲强调「同步交付」，常用于信号与握手；有缓冲适合削峰、固定并发度。**关闭 channel** 后仍可接收剩余元素，再收得零值与 `false`；**仅发送方应关闭**，向已关闭 channel 发送会 panic。

**`select` 与超时**：`case <-ctx.Done()` 与 `time.After` 结合实现超时；注意 `time.After` 在循环内会泄漏 timer，长寿命场景优先 `time.NewTimer` 并复用或 `Stop`。

**Context 规范**：`context.WithCancel` / `WithTimeout` / `WithDeadline` 返回的 `cancel` 必须调用以防泄漏；不要把 `context` 放全局或当可选参数用 `nil` 混用，应显式传递。

**常见模式**：**fan-out** 一源多消费者并行；**fan-in** 多路结果汇聚到单一 channel；**worker pool** 固定 worker 从 job channel 取任务，控制并行度。**pipeline** 用 channel 链式阶段解耦。

**Goroutine 泄漏**：向无消费者 channel 永久阻塞发送、在 select 中遗漏 `ctx.Done()`、`http.Client` 未读尽 Body 导致连接与相关 goroutine 挂起、自引用闭包等。排查可用 **pprof goroutine**、`runtime.NumGoroutine()` 与代码审查 channel 生命周期。

**`sync.WaitGroup` 与 `errgroup`**：`WaitGroup` 适合「等一组 goroutine 结束」，注意 `Add` 要在启动前、`Done` 在 defer 中成对；`golang.org/x/sync/errgroup` 在带 `context` 的子任务出错时可取消兄弟任务，常与 **fan-in** 结合收集首个错误或全部结果。

**同步原语选型**：保护小临界区用 `Mutex`/`RWMutex`；**一次性** 初始化用 `sync.Once`；限流除 channel 外可看 **semaphore**（如 `x/sync/semaphore`）。避免在持锁时向可能阻塞的 channel 发送，防止死锁。

**与 HTTP/下游服务**：出站请求应传 `req.WithContext(ctx)`，服务端 `ListenAndServe` 宜用 `http.Server` + `Shutdown` 配合 context 优雅退出，避免 goroutine 在进程退出时仍向已关闭资源写。

## 示例代码

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	ch := make(chan int, 2)
	go func() {
		for i := 0; i < 3; i++ {
			select {
			case <-ctx.Done():
				return
			case ch <- i:
			}
		}
		close(ch)
	}()

	for v := range ch {
		fmt.Println(v)
	}
}
```

说明：`buffer` 为 2 时前两次发送非阻塞；超时后发送侧通过 `ctx.Done()` 退出，避免无限阻塞。生产代码应处理 `ctx.Err()` 与资源清理。

## 面试追问

- **追问 1**：G、M、P 各自职责是什么？M 阻塞时 P 如何被其他 M 接管？
- **追问 2**：无缓冲与有缓冲 channel 在内存与调度上的差异？何时会触发 goroutine 阻塞？
- **追问 3**：`select` 多个 case 同时就绪时语义是什么？如何实现「优先处理某一 channel」？
- **追问 4**：`context.WithValue` 适用场景与反模式？为何不建议用 string 作为 key？
- **追问 5**：如何用 worker pool 限制 QPS 与最大并发？与 errgroup 如何配合错误传播？

## 常见误区

- 认为 **goroutine 极便宜** 就无限创建，忽视 channel、timer、HTTP 连接等配套资源导致 **泄漏与 FD 耗尽**。
- **重复关闭 channel** 或 **多个发送方关闭** 引发 panic；应用 `sync.Once` 或单一 owner 关闭。
- 在库函数内部 **`context.Background()` 盖掉调用方取消**，导致无法超时与级联取消。
- **`select` 里用 `default` 忙等** 空转占满 CPU；应配合阻塞、backoff 或事件驱动。
- 把 **mutex 与 channel 混用** 过度复杂化；简单共享状态用 `sync.Mutex`，消息传递用 channel，按场景选型。
- **`WaitGroup.Add` 在 goroutine 内部才调用**——与并发启动竞态，可能 `Wait` 提前返回；应在父 goroutine 在 `go` 前 `Add`。
- 认为 **`close(ch)` 会唤醒所有阻塞接收方并清空队列**——关闭只表示「不会再发送」，已缓冲数据仍可读完；向 nil channel 收发都会永久阻塞。
