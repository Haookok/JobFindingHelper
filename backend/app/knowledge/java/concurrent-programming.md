# Java 并发编程

- **难度**: 进阶
- **分类**: Java 并发 / JUC
- **标签**: [synchronized, ReentrantLock, volatile, CAS, AQS, 线程池, ThreadLocal]

## 核心概念

Java 并发编程就像**多人同时用一个厨房做饭**。厨房就那么大，灶台就那么几个，如果不协调好谁用哪个灶台、谁先用菜板，轻则菜做乱了（数据不一致），重则两人互相等对方让开谁都动不了（死锁）。

Java 提供了两套"协调方案"：**synchronized**（厨房自带的规矩——进来就锁门）和 **ReentrantLock**（你自己带的高级锁——可以设超时、可以排队、可以分读写）。还有 **volatile**（在灶台上贴个便签"我改了温度"让所有人看到），以及 **CAS**（乐观派：先做了再说，发现被人改了就重试）。

## 详细解析

### synchronized vs ReentrantLock

- **synchronized**：JVM 内置的锁，写起来简单（直接加在方法或代码块上）。JVM 会自动做锁升级：偏向锁→轻量级锁→重量级锁，性能已经不错了
- **ReentrantLock**：手动加锁解锁，但功能更强——可以设超时（`tryLock`）、可以响应中断、可以选公平/非公平、可以绑多个条件变量

怎么选？简单场景用 synchronized；需要超时、中断、公平锁或多条件变量时用 ReentrantLock。

### volatile——"便签条"

volatile 保证两件事：**可见性**（一个线程改了值，其他线程立刻看到）和**有序性**（禁止指令重排序）。但它**不保证原子性**！`i++` 用 volatile 修饰是不安全的——因为 `i++` 实际上是"读-改-写"三步，中间可能被打断。

### CAS——乐观锁

CAS 的思路是：我想把值从 A 改成 B，改之前先看一眼是不是还是 A——是的话就改，不是就重试。`AtomicInteger` 等原子类就是基于 CAS 实现的。竞争不激烈时比加锁快得多，但竞争激烈时一直重试会浪费 CPU。

### 线程池——别让厨房里人满为患

`ThreadPoolExecutor` 的参数就像管理厨房人手：
- **corePoolSize**：常驻厨师数量
- **maximumPoolSize**：最忙的时候最多请几个厨师
- **workQueue**：排队等灶台的订单队列
- **handler**：队列也满了怎么办（拒绝策略）

任务来了先看常驻厨师有没有空 → 没空就排队 → 队列也满了就临时请人 → 人也请满了就执行拒绝策略。**注意**：`Executors.newFixedThreadPool` 用的是无界队列，任务堆积可能导致 OOM！

### ThreadLocal——每人一个调料瓶

ThreadLocal 给每个线程一个独立的变量副本，互不干扰。但在**线程池里要小心**：线程会被复用，上一个任务留下的 ThreadLocal 值可能被下一个任务读到。用完一定要 `remove()`！

## 示例代码

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class ConcurrentDemo {
    private static final AtomicInteger count = new AtomicInteger(0);  // CAS 实现的原子计数器

    public static void main(String[] args) throws Exception {
        // 自定义线程池：2 个常驻、最多 4 个、队列容量 100、满了让调用者自己跑
        ExecutorService pool = new ThreadPoolExecutor(
            2, 4, 60L, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(100),               // 有界队列！防止 OOM
            Executors.defaultThreadFactory(),
            new ThreadPoolExecutor.CallerRunsPolicy());  // 拒绝策略：谁提交谁执行

        for (int i = 0; i < 10; i++) {
            pool.submit(() -> count.incrementAndGet());  // 原子加 1
        }
        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println(count.get());  // 10
    }
}
```

## 面试追问

- **面试官可能会这样问你**：AQS 是什么？ReentrantLock 底层怎么实现的？（AQS 用一个 state 变量表示锁状态，用 CLH 队列管理等待线程；ReentrantLock 的 lock 就是尝试 CAS 改 state）
- **面试官可能会这样问你**：volatile 和 synchronized 在 JMM 下的区别？（volatile 保证可见性和有序性但不保证原子性；synchronized 三者都保证）
- **面试官可能会这样问你**：ThreadLocal 为什么会内存泄漏？（线程池里线程长期存活，ThreadLocalMap 的 key 是弱引用会被回收，但 value 是强引用不会——用完必须 remove）
- **面试官可能会这样问你**：synchronized 的锁升级过程？（无锁→偏向锁（只有一个线程）→轻量级锁（短时间竞争，CAS 自旋）→重量级锁（竞争激烈，线程挂起））

## 常见误区

- **很多人会搞混的地方**：用 volatile 修饰 `i++` 以为线程安全——`i++` 不是原子操作，要用 `AtomicInteger`。
- **很多人会搞混的地方**：线程池用完不 shutdown——线程一直活着，程序无法正常退出。
- **很多人会搞混的地方**：ThreadLocal 用完不 remove——在线程池场景下会导致内存泄漏和数据串台。
- **很多人会搞混的地方**：`submit` 的返回值 `Future` 从来不 get——异常被静默吞掉了，Bug 排查时一头雾水。
