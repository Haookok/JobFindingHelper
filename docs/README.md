# 秋招面试知识手册

> 系统覆盖 15 个技术方向、42 个核心知识点，助你高效备战秋招。

## 文档目录

| 编号 | 领域 | 文件 | 知识点数 |
|------|------|------|---------|
| 01 | AI 与算法 | [01-AI与算法.md](01-AI与算法.md) | 11 |
| 02 | 计算机基础 | [02-计算机基础.md](02-计算机基础.md) | 10 |
| 03 | 后端开发 | [03-后端开发.md](03-后端开发.md) | 7 |
| 04 | 前端开发 | [04-前端开发.md](04-前端开发.md) | 3 |
| 05 | 架构与工程 | [05-架构与工程.md](05-架构与工程.md) | 7 |
| 06 | 求职软实力 | [06-求职软实力.md](06-求职软实力.md) | 4 |

## 完整知识点清单

### 01 — AI 与算法（11 篇）

**AI / LLM 大模型**
1. Transformer 架构详解 — Self-Attention、Multi-Head、位置编码、架构对比
2. RAG 检索增强生成 — 向量检索、Chunk 策略、混合检索、GraphRAG
3. LLM Agent 智能体 — ReAct、Tool Use、LangChain、MCP、Multi-Agent
4. 模型微调与对齐 — LoRA/QLoRA、SFT、RLHF/PPO、DPO、GRPO
5. 大模型推理优化 — KV Cache、量化、Flash Attention、vLLM、解码策略
6. MoE 与模型扩展 — 稀疏专家、门控网络、Scaling Laws、涌现能力

**机器学习**
7. 损失函数详解 — 交叉熵、Focal Loss、对比损失、KL 散度
8. 优化器详解 — SGD、Adam/AdamW、学习率调度、梯度裁剪
9. 经典机器学习模型 — SVM、决策树、XGBoost、K-Means、PCA
10. 深度学习基础 — 反向传播、激活函数、BatchNorm/LayerNorm、残差连接
11. 模型评估指标 — Precision/Recall/F1、AUC-ROC、BLEU/ROUGE

### 02 — 计算机基础（10 篇）

**数据结构与算法**
1. 排序算法 — 冒泡/快排/归并/堆排序、时间复杂度、稳定性
2. 动态规划 — 最优子结构、状态转移、背包问题、LCS

**操作系统**
3. 进程与线程 — PCB、IPC、线程同步、死锁
4. IO 模型 — 阻塞/非阻塞/多路复用、select/poll/epoll、Reactor

**计算机网络**
5. TCP 三次握手与四次挥手 — SYN Flood、TIME_WAIT、半连接队列
6. HTTP 与 HTTPS — HTTP/1.1~3.0 对比、TLS 握手、状态码
7. DNS 解析原理 — 递归/迭代查询、缓存层级、HTTPDNS

**数据库**
8. MySQL 索引原理 — B+ 树、聚簇索引、最左前缀、索引失效
9. Redis 数据结构与应用 — 跳表、SDS、缓存穿透/击穿/雪崩
10. 数据库事务与隔离级别 — ACID、MVCC、锁机制

### 03 — 后端开发（7 篇）

**Java**
1. HashMap 底层原理 — 数组+链表+红黑树、扩容、线程安全
2. JVM 内存模型与垃圾回收 — GC Roots、分代回收、G1/ZGC
3. Java 并发编程 — synchronized/ReentrantLock、CAS、AQS、线程池

**Python**
4. Python GIL 与并发编程 — 多线程/多进程、asyncio、协程
5. Python 装饰器与元类 — 函数/类装饰器、__new__、元类

**Go**
6. Goroutine 与 Channel — GMP 调度、select、Context、并发模式
7. Go 内存管理与 GC — 三色标记、逃逸分析、sync.Pool

### 04 — 前端开发（3 篇）

1. JavaScript 事件循环 — 调用栈、宏任务/微任务、async/await
2. React 生命周期与 Hooks — Fiber 架构、虚拟 DOM diff、Hooks
3. 浏览器渲染原理 — DOM/CSSOM、重排重绘、合成层、关键渲染路径

### 05 — 架构与工程（7 篇）

**系统设计**
1. 分布式一致性 — CAP/BASE、Paxos/Raft、2PC/3PC
2. 缓存架构设计 — 缓存穿透/击穿/雪崩、更新策略、热点 Key
3. 消息队列 — Kafka/RabbitMQ/RocketMQ 对比、消息可靠性

**云原生**
4. Docker 核心原理 — Namespace/Cgroups、镜像分层、多阶段构建
5. Kubernetes 架构 — Master/Node 组件、Pod/Service、HPA

**安全**
6. Web 安全基础 — XSS/CSRF/SQL注入、CSP、OWASP Top 10
7. 认证授权与加密 — JWT/OAuth2.0、TLS、对称/非对称加密

### 06 — 求职软实力（4 篇）

**项目经验**
1. STAR 法则讲项目 — 结构化表达、成果量化、追问预判
2. 技术选型与决策 — 选型论述框架、常见对比、架构演进

**软技能**
3. 自我介绍技巧 — 30秒/1分钟/3分钟版本、技术面 vs HR面
4. 薪资谈判与 Offer 选择 — 薪资构成、谈判策略、多 Offer 对比

## 使用建议

1. **系统复习**：按领域顺序通读，每天 1-2 个领域
2. **重点突击**：根据目标岗位选择对应领域重点复习
3. **搜索查阅**：启动系统后使用全文搜索快速定位知识点
4. **面试前冲刺**：重点看每篇的「面试追问」和「常见误区」部分
