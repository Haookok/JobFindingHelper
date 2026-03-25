# Goroutine 与 Channel

- **难度**: 进阶
- **分类**: Go / 并发
- **标签**: [Goroutine, GMP, Channel, Select, Context, 并发模式, 泄漏]

## 核心概念

**Goroutine 就是超轻量的小助手**。你有个任务要干，一句 `go doSomething()` 就派了一个小助手去做，成本极低——一个 goroutine 初始只占几 KB 栈内存，创建一百万个也没问题。而操作系统线程通常要几 MB。Go 的运行时用 **GMP 模型**调度这些小助手：G（goroutine）是任务，M（Machine）是 OS 线程，P（Processor）是调度器——P 从自己的任务队列里取 G 交给 M 执行，忙不过来还会去别的 P 那里"偷任务"（work stealing）。

**Channel 是小助手之间的传话筒**——Go 的设计哲学是"别通过共享内存来通信，要通过通信来共享内存"。Channel 就是类型安全的消息管道。无缓冲 channel 是"面对面交接"——发送方必须等接收方到了才能交；有缓冲 channel 是"放进信箱"——信箱没满就能发，满了才等。

## 详细解析

### GMP 调度——为什么 goroutine 这么快？

操作系统线程切换要进内核态，成本高。goroutine 的切换完全在用户态，Go 运行时自己管理。当一个 goroutine 遇到 I/O 阻塞时，P 会把它挂起，去执行其他 goroutine——OS 线程不会被浪费。这就是为什么 Go 能轻松处理百万级并发连接。

### Channel 使用要点

- **无缓冲 channel**：发送和接收必须同步配对，常用于信号通知和握手
- **有缓冲 channel**：适合削峰填谷、控制并发度
- **关闭 channel**：只有发送方应该关闭！接收方用 `for range ch` 或 `v, ok := <-ch` 判断是否关闭。向已关闭的 channel 发送数据会 **panic**

### select——同时盯多个传话筒

`select` 就像一个人同时盯着好几部电话，哪个先响就接哪个。多个 case 同时就绪时**随机选一个**（公平）。配合 `ctx.Done()` 可以实现超时和取消。

### Context——取消信号的传递链

`context.WithTimeout` 就像设了个闹钟："5 秒内完成不了就别干了"。这个取消信号会沿着调用链往下传递。**规范**：context 作为第一个参数传递，不存结构体，cancel 函数必须调用（通常 `defer cancel()`）。

### Goroutine 泄漏——最常见的坑

goroutine 创建了但永远无法退出，越积越多最终耗尽资源。常见原因：
- 向一个没人接收的 channel 发送，永久阻塞
- select 里忘了处理 `ctx.Done()`
- HTTP Body 没读完/没关闭，底层连接和 goroutine 挂起

## 示例代码

```go
package main

import (
	"context"
	"fmt"
	"time"
)

func main() {
	// 设个 2 秒的"闹钟"，超时自动取消
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()  // 不管怎样，最后都要释放资源

	ch := make(chan int, 2)  // 缓冲为 2 的"信箱"
	go func() {
		for i := 0; i < 3; i++ {
			select {
			case <-ctx.Done():   // 闹钟响了，别发了
				return
			case ch <- i:        // 往信箱里放数据
			}
		}
		close(ch)  // 发完了，关掉信箱
	}()

	for v := range ch {  // 从信箱里取，直到信箱关闭
		fmt.Println(v)
	}
}
```

## 面试追问

- **面试官可能会这样问你**：G、M、P 各是什么？M 被系统调用阻塞了会怎样？（P 会和 M 解绑，找另一个空闲的 M 继续执行其他 G，不会浪费 P）
- **面试官可能会这样问你**：无缓冲和有缓冲 channel 的区别？什么时候用哪个？（无缓冲=同步交接，用于信号和握手；有缓冲=异步队列，用于削峰和限流）
- **面试官可能会这样问你**：select 多个 case 同时就绪时会怎样？怎么实现"优先处理某个 channel"？（随机选一个；如果要优先级，可以嵌套 select 或先用非阻塞尝试）
- **面试官可能会这样问你**：怎么防止 goroutine 泄漏？（所有 goroutine 都要有退出路径，用 context 传递取消信号，用 pprof 监控 goroutine 数量）
- **面试官可能会这样问你**：`WaitGroup.Add` 应该在哪里调用？（在启动 goroutine 之前！在 goroutine 内部 Add 可能导致 Wait 提前返回）

## 常见误区

- **很多人会搞混的地方**：以为 goroutine 不要钱就无限创建——goroutine 本身轻量，但配套的 channel、timer、HTTP 连接等资源不轻量，泄漏后果严重。
- **很多人会搞混的地方**：多个发送方同时关闭 channel——会 panic！应该用 `sync.Once` 或保证只有一个 owner 关闭。
- **很多人会搞混的地方**：在 select 里用 `default` 分支忙等——没有就绪的 case 时 default 会立刻执行，如果在循环里会疯狂空转吃满 CPU。
- **很多人会搞混的地方**：在库函数里 `context.Background()` 覆盖了调用方传入的 ctx——这会让上层的超时和取消机制完全失效。
