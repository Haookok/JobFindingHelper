# Redis 数据结构与应用

- **难度**: 进阶
- **分类**: 数据库 / Redis
- **标签**: [Redis, 底层结构, 缓存, 淘汰策略]

## 核心概念

Redis 对外提供 String、List、Hash、Set、Sorted Set 等类型，底层通过 **编码（encoding）** 在 **空间与性能** 间折中：小对象常用紧凑结构（如压缩列表、listpack），数据变大或操作需求变化时再 **编码升级** 为哈希表、跳表、双向链表等。

**缓存穿透** 指查询不存在的数据，流量直达存储；**击穿** 指热点 key 过期瞬间大量请求压垮 DB；**雪崩** 指大量 key 同时过期或 Redis 宕机导致 DB 压力陡增。**淘汰策略** 在内存达 `maxmemory` 时决定逐出哪些 key。

## 详细解析

### String

- 底层可为 **SDS（简单动态字符串）**：记录长度，`O(1)` 取长度；预分配与惰性释放减少频繁重分配；二进制安全。
- 小整型/短字符串可能走 **embstr** 等优化（实现随版本演进，面试答「对象封装 + SDS」即可）。

### List

- Redis 3.2 后常用 **quicklist**：双向链表 + 压缩列表/listpack 片段，兼顾插入与内存。
- 典型场景：消息队列（需知与专业 MQ 的可靠性差异）、最新 N 条、栈/队列。

### Hash

- 字段少且短时可用 listpack 等紧凑编码；字段多则为 **哈希表**。
- 适合对象属性存储，减少 key 数量与网络往返（对比多个 String key）。

### Set

- 整数集合 **intset** 或 **哈希表**；无序唯一成员。
- 场景：标签、共同关注（与 Sorted Set 选型看是否需要排序/分值）。

### ZSet（Sorted Set）

- 需 **按 score 排序** 的成员集合；经典底层为 **跳表 + 哈希表**：哈希保证 `O(1)` 查成员分值，跳表支持范围与排序 `O(log N)`。
- **跳表**：多层索引链表，概率平衡，实现比红黑树更简单，范围遍历友好。

### 压缩列表 / listpack（演进）

- 连续内存、紧凑存储小元素；缺点是修改可能连锁更新（历史 ziplist 更明显）。新版本倾向 listpack 降低边界风险。面试强调「小对象省内存、大对象升级」逻辑即可。

### 穿透 / 击穿 / 雪崩（应对思路）

- **穿透**：布隆过滤器、缓存空值（短 TTL）、接口校验。
- **击穿**：互斥锁重建、逻辑过期、热点永不过期 + 异步刷新。
- **雪崩**：过期时间加随机抖动、多级缓存、熔断限流、高可用集群。

### 淘汰策略（maxmemory-policy 常见值）

- `volatile-lru` / `allkeys-lru`、`volatile-lfu` / `allkeys-lfu`、`volatile-ttl`、`volatile-random`、`allkeys-random`、`noeviction`（写满报错）。根据访问模式选择 LRU 或 LFU。

## 示例代码

```bash
# String：计数、短缓存
SET page:view:1001 1 EX 3600 NX
INCR page:view:1001

# Hash：对象字段
HSET user:1 name alice age 20
HGETALL user:1

# ZSet：排行榜
ZADD rank:game 100.5 user:alice 99.2 user:bob
ZREVRANGE rank:game 0 9 WITHSCORES

# 空值防穿透（业务允许时）
SET user:notexist:999 "" EX 60 NX
```

## 面试追问

- **追问 1**：跳表的时间复杂度与红黑树对比，Redis 为何选跳表实现 ZSet 的有序部分？
- **追问 2**：`DEL` 大 key 或 `HGETALL` 大 Hash 会有什么问题？如何拆分与监控？
- **追问 3**：LRU 在 Redis 中的实现是严格 LRU 吗？LFU 解决了什么问题？

## 常见误区

- 把 Redis 当可靠消息队列默认方案：无消费组语义与强持久化保证时需自行权衡。
- 认为 ZSet 只有跳表一种实现：需说明 **编码可切换**、小集合时可能更省内存的实现。
- 雪崩只想到「加随机 TTL」：忽略 **集群故障、冷启动、热点 key** 等综合因素。
- 淘汰策略选错：例如希望保留热点却使用 `volatile-*` 且 key 无 TTL，导致无法淘汰或行为不符合预期。
