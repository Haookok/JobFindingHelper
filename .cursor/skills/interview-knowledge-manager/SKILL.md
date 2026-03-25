---
name: interview-knowledge-manager
description: 管理秋招面试知识库内容。按标准格式创建和编辑八股文知识点 Markdown 文件，覆盖 15 大技术方向。当用户提到添加面试题、知识点、八股文、复习材料时使用此技能。
---

# 面试知识库管理

## 触发场景
- 用户要求添加/编辑面试知识点
- 用户提到八股文、面试题、技术知识点
- 用户要求整理某个技术方向的内容

## 知识库位置与分类

`backend/app/knowledge/` 下按分类存放，当前 **15 个方向**：

### AI 与算法
| 目录 | 内容 |
|------|------|
| `ai-llm/` | Transformer、Attention、RAG、Agent、微调、推理优化、MoE |
| `machine-learning/` | 损失函数、优化器、经典ML模型、深度学习基础、评估指标 |

### 计算机基础
| 目录 | 内容 |
|------|------|
| `algorithms/` | 排序、搜索、DP、图、贪心、回溯 |
| `os/` | 进程线程、内存、IO 模型、死锁 |
| `network/` | TCP/IP、HTTP/HTTPS、DNS、WebSocket |
| `database/` | MySQL、Redis、索引、事务、分库分表 |

### 后端开发
| 目录 | 内容 |
|------|------|
| `java/` | JVM、并发、集合、Spring 生态 |
| `python/` | GIL、装饰器、异步、框架 |
| `go/` | Goroutine、Channel、GC、微服务框架 |

### 前端开发
| 目录 | 内容 |
|------|------|
| `frontend/` | JS 核心、React/Vue、浏览器原理、工程化 |

### 架构与工程
| 目录 | 内容 |
|------|------|
| `system-design/` | 分布式、微服务、MQ、缓存、限流 |
| `cloud-native/` | Docker、K8s、CI/CD、服务网格 |
| `security/` | Web安全、认证授权、加密算法 |

### 求职软实力
| 目录 | 内容 |
|------|------|
| `project-experience/` | STAR 法则、技术选型论述 |
| `soft-skills/` | 自我介绍、薪资谈判、反问技巧 |

## 知识点模板

文件名用英文短横线命名（如 `transformer-architecture.md`）：

```markdown
# 知识点标题

- **难度**: 基础 | 进阶 | 深入
- **分类**: 具体分类
- **标签**: [标签1, 标签2]

## 核心概念
用 1-3 段话解释清楚原理。

## 详细解析
深入剖析，必要时用图表辅助说明。

## 示例代码
可直接运行的代码，附带注释。

## 面试追问
- 追问 1：考察更深层原理
- 追问 2：考察实际应用
- 追问 3：考察与其他知识的关联
- 追问 4：考察边界情况或最新发展

## 常见误区
面试者容易犯错的点。
```

## 搜索索引

添加/修改知识点后需重建搜索索引：
```bash
curl -X POST http://localhost:8000/api/search/reindex
```

## 质量检查
- 概念是否准确无误
- 代码示例是否可运行
- 追问是否覆盖原理/应用/对比/边界四个层面
- 难度标记是否恰当
- AI/ML 方向代码优先用 PyTorch
