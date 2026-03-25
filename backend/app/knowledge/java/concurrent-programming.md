# Java 并发编程

- **难度**: 进阶
- **分类**: Java 并发 / JUC
- **标签**: [synchronized, ReentrantLock, volatile, CAS, AQS, 线程池, ThreadLocal]

## 核心概念

**synchronized** 是 JVM 内置监视器锁：字节码层 `monitorenter/exit`，可重入，锁升级路径（偏向 → 轻量 → 重量）由 JVM 优化。**ReentrantLock** 是 API 级显式锁，支持**公平/非公平**、可中断、`tryLock`、条件变量 `Condition`，基于 **AQS** 实现。

**volatile** 保证**可见性**与**有序性**（禁止部分重排序），不保证复合操作的原子性。**CAS**（Compare-And-Swap）由 CPU 指令支持，是乐观无锁的基础；ABA 问题可用版本号/`AtomicStampedReference` 缓解。

**AQS**（AbstractQueuedSynchronizer）用 **CLH 变体队列**管理阻塞线程，`state` 表示资源状态，`ReentrantLock`、`Semaphore`、`CountDownLatch` 等均在其上扩展。

## 详细解析

**线程池**（`ThreadPoolExecutor`）核心参数：`corePoolSize`、`maximumPoolSize`、`keepAliveTime`、`workQueue`、`threadFactory`、`handler`。任务提交流程：核心线程 → 队列 → 最大线程 → 拒绝策略。`Executors` 便捷工厂创建的固定/单线程池若用**无界队列**可能堆积任务导致 OOM，生产环境常自定义队列与边界。

**ThreadLocal** 为每个线程提供独立副本，底层是 `Thread` 的 `ThreadLocalMap`（弱引用 key）。**内存泄漏**风险：线程池中长期存活的线程若未 `remove()`，可能持有已失效 ThreadLocal 的条目；用完应 `remove()`。

`synchronized` vs `ReentrantLock`：语法糖 vs 灵活 API；锁升级后两者性能差距在多数场景已缩小，选型看是否需要中断、超时、公平、多条件。

**CAS 与自旋**：`Atomic*` 类在竞争不激烈时自旋成功避免阻塞；高竞争下自旋浪费 CPU，退化为系统调用或队列（因具体实现与 JVM 而异）。**伪共享**（cache line）在极致性能场景需 `@Contended` 或填充字段缓解。

**读写场景**：`ReadWriteLock` / `StampedLock` 在读多写少时可提高并发度；写锁与读锁的升降级规则需说清楚避免死锁。

**JUC 工具**：`CountDownLatch` 一次计数、`CyclicBarrier` 可重用栅栏、`Semaphore` 限流，均建立在 AQS 或类似同步语义上，面试常考「适用场景」。

**happens-before 速记**：解锁先于后续加锁同监视器；`volatile` 写先于后续读；线程 `start` 先于子线程动作；线程内代码顺序在单线程语义下保持**as-if-serial**。

**阻塞队列与线程池**：`ThreadPoolExecutor` 常配**有界** `BlockingQueue`，背压清晰；无界队列 + 固定线程数可能导致队列无限增长拖垮内存。

**`ForkJoinPool`**：工作窃取适合**可分解**任务；与固定线程池相比在 CPU 密集分治（如并行 Stream 底层）更常见，需避免在任务中再嵌套阻塞式外部调用。

**`java.util.concurrent` 包设计思想**：基于 CAS + 队列减少内核态切换；高层工具类隐藏 AQS 细节，面试可从「共享资源 state + CLH 队列」串起 `ReentrantLock` 与 `Semaphore`。

**中断协作式语义**：`interrupt()` 只设标志，需在任务中检查 `isInterrupted` 或对可中断阻塞方法响应；吞掉中断应恢复 `interrupt` 状态以便上层处理。

## 示例代码

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class ConcurrentDemo {
    private static final AtomicInteger n = new AtomicInteger(0);

    public static void main(String[] args) throws Exception {
        ExecutorService pool = new ThreadPoolExecutor(
            2, 4, 60L, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(100),
            Executors.defaultThreadFactory(),
            new ThreadPoolExecutor.CallerRunsPolicy());
        for (int i = 0; i < 10; i++) {
            pool.submit(() -> n.incrementAndGet());
        }
        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println(n.get());
    }
}
```

补充：`volatile boolean stop` 作线程协作停止标志时，工作线程需定期检查；若长时间卡在非响应中断的逻辑，仍需结合中断或任务拆解。

**双检锁单例（了解）**：实例字段需 `volatile` 防止重排序看到未构造完成的对象；现代 JVM 有优化但仍属高频考点。

## 面试追问

- **追问 1**：AQS 中 `acquire` / `release` 与 `state` 的关系？公平锁与非公平锁在队列上的差异（插队）？
- **追问 2**：`volatile` 与 `synchronized` 在 JMM 下的内存语义（happens-before）分别是什么？
- **追问 3**：`ThreadLocal` 父子线程如何传递上下文？`InheritableThreadLocal` 与线程池结合时的坑？
- **追问 4**：`synchronized` 锁升级的触发条件与撤销？`ReentrantLock` 的 `Condition.await` 为什么要先持有锁？

## 常见误区

- 用 `volatile` 修饰 `i++` 以为线程安全——**非原子**，需 `AtomicInteger` 或锁。
- 线程池用 `shutdown()` 后仍提交任务会抛异常；应区分 `shutdown` 与 `shutdownNow`，并合理设置拒绝策略。
- ThreadLocal 用完不 `remove`，在线程池场景下易导致**隐性内存泄漏**与错误数据复用。
- `corePoolSize` 设为 0 且队列无界时误以为「不会创建线程」——提交流程仍会按需创建线程直至队列饱和策略生效，需对照源码理解。
- 把 `submit` 返回的 `Future` **从不 get**，吞掉异常——应处理 `ExecutionException` 或改用 `execute`+明确异常处理。
