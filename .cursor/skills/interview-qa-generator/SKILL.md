---
name: interview-qa-generator
description: 根据知识点自动生成面试问答对和题库。当用户提到生成面试题、出题、题库、练习题时使用此技能。
---

# 面试题生成器

## 触发场景
- 用户要求生成某个方向的面试题
- 用户要求扩充题库
- 用户要求为知识点生成练习题

## 题目生成流程

1. **确定范围** — 技术方向 + 难度
2. **读取知识库** — 从 `backend/app/knowledge/{category}/` 读取相关知识点
3. **生成问答对** — 按模板输出

## 问答对模板

```json
{
  "id": "java-001",
  "category": "java",
  "subcategory": "jvm",
  "difficulty": "进阶",
  "question": "请解释 JVM 的垃圾回收机制",
  "key_points": [
    "可达性分析",
    "GC Roots",
    "分代回收",
    "CMS/G1/ZGC"
  ],
  "reference_answer": "...",
  "follow_ups": [
    {
      "trigger": "提到了分代回收",
      "question": "为什么要分代？新生代和老年代的回收策略有什么区别？"
    },
    {
      "trigger": "没有提到 GC Roots",
      "question": "JVM 是如何判断一个对象是否可以被回收的？"
    }
  ],
  "common_mistakes": [
    "混淆引用计数和可达性分析",
    "不了解 STW（Stop The World）的影响"
  ],
  "tags": ["JVM", "GC", "内存管理"]
}
```

## 难度分级标准

| 难度 | 要求 | 示例 |
|------|------|------|
| 基础 | 能说出概念和基本用法 | HashMap 的底层数据结构 |
| 进阶 | 能解释原理和设计思路 | HashMap 扩容机制和哈希冲突解决 |
| 深入 | 能分析源码和对比不同方案 | ConcurrentHashMap 在 JDK 7/8 的实现差异 |

## 追问链设计

每个题目生成 3 层追问链：
1. **基础追问** — 确认基本概念理解
2. **原理追问** — 深入底层实现
3. **应用追问** — 结合实际场景

## 批量生成

按分类批量生成时，存储到 `backend/app/knowledge/{category}/questions/` 目录：
- 文件命名：`{category}-{subcategory}-{序号}.json`
- 每个分类至少 20 道基础、10 道进阶、5 道深入
