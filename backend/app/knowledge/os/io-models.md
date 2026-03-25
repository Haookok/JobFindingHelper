# IO 模型

- **难度**: 进阶
- **分类**: 操作系统 / 网络编程
- **标签**: [阻塞IO, epoll, IO多路复用, Reactor]

## 核心概念

Unix 下 **IO 分两段**：数据从设备到达内核缓冲区、再从内核缓冲区拷贝到用户空间。所谓「同步/异步」常指 **用户进程在发起 IO 后，是否需亲自等待数据就绪或拷贝完成**；「阻塞/非阻塞」指 **调用在数据未就绪时是否立刻返回**。

**IO 多路复用** 用一个阻塞点同时监视多个描述符的就绪状态，避免「每连接一线程」的阻塞等待浪费。

## 详细解析

### 五种模型（POSIX 经典划分）

1. **阻塞 IO**：调用一直阻塞到数据就绪并完成拷贝（或出错）。
2. **非阻塞 IO**：轮询 `read`，未就绪立即返回 `EAGAIN` 等，CPU 空转需节制。
3. **IO 多路复用**：`select` / `poll` / `epoll` 等阻塞在「多路等待」，返回后再对就绪 fd 读写。
4. **信号驱动 IO**：数据就绪时内核发信号，用户再读；实际工程较少作为主模型。
5. **异步 IO（真异步）**：提交请求后内核完成拷贝再通知用户（如 aio）；与「异步」一词在框架层的混用需分清。

Linux 上高并发网络服务最常见组合：**非阻塞 socket + epoll + 线程池**。

### select / poll / epoll

| 能力 | select | poll | epoll |
|------|--------|------|-------|
| fd 上限 | 受 `FD_SETSIZE` 限制 | 链表，理论上受系统限制 | 高并发友好 |
| 就绪通知 | 返回后需遍历全部 fd | 同上 | `epoll_wait` 只返回就绪集合 |
| 内核机制 | 位图扫描 | 链表扫描 | 红黑树 + 就绪链表，边缘/水平触发 |

**epoll LT（水平触发）**：只要可读/可写未处理完会持续通知；**ET（边缘触发）**：状态变化时通知一次，需 **一次性读写到 `EAGAIN`**，编程要求高但减少唤醒次数。

### Reactor 与 Proactor（对比记忆）

- **Reactor**：「就绪通知」——多路复用告知可读/可写，**应用线程** 执行 `read/write`。Nginx、Netty（NIO）、Redis 网络部分等属此类思路。
- **Proactor**：「完成通知」——由系统或线程完成 IO 拷贝后回调；Windows IOCP 更接近此形态。

单线程 Reactor 适合 I/O 密集；CPU 密集或 SSL 等可配合 **多 Reactor** 或 worker 池。

### 与语言运行时常见对应关系

- **Java NIO / Netty**：`Selector` + 非阻塞 Channel，典型主从 Reactor 或单 Reactor 多线程。
- **Go**：`netpoller` 把 epoll/kqueue 与 goroutine 结合，阻塞 `Read` 时挂起 G 而非占 OS 线程。
- **Node.js**：libuv 统一封装多路复用；单线程事件循环 + 线程池做部分阻塞/CPU 任务。

理解「**内核多路复用 + 用户态调度**」的分工，有助于回答「为什么高并发服务不采用纯阻塞多线程」类问题。

## 示例代码

```c
// epoll 极简骨架（边缘触发需循环读到 EAGAIN，此处略）
int epfd = epoll_create1(0);
struct epoll_event ev = { .events = EPOLLIN, .data.fd = listen_fd };
epoll_ctl(epfd, EPOLL_CTL_ADD, listen_fd, &ev);

struct epoll_event events[64];
for (;;) {
    int n = epoll_wait(epfd, events, 64, -1);
    for (int i = 0; i < n; i++) {
        int fd = events[i].data.fd;
        if (fd == listen_fd) {
            // accept 新连接并 epoll_ctl ADD, 设非阻塞
        } else if (events[i].events & EPOLLIN) {
            // read(fd, ...) 业务处理
        }
    }
}
```

## 面试追问

- **追问 1**：为什么说「异步 IO」在 Linux 上与 `epoll` 的语义不同？libuv / Node 的异步文件 IO 大致如何实现？
- **追问 2**：ET 模式下为何必须配合非阻塞 fd？若只 `read` 一次会有什么问题？
- **追问 3**：`epoll_wait` 返回后，监听集合里某个 fd 已关闭，可能产生什么现象？应如何避免？

## 常见误区

- 把 **`epoll` 等同异步 IO**：`epoll` 仍是 **就绪通知**，读数据常仍是同步拷贝。
- **惊群**：多进程 `accept` 同一 listen fd 时旧版内核可能唤醒过多进程；现代内核与 `SO_REUSEPORT` 等可缓解，面试需提「曾经问题与演进」。
- 认为 **多路复用一定优于阻塞 IO**：连接数极少、逻辑极简单时，模型复杂度可能得不偿失。
- 忽略 **写事件**：高流量下需关注 **发送缓冲区满** 时的 `EPOLLOUT` 与可写再续写，否则可能丢发送或阻塞。
