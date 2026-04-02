# Transformer 架构详解

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [Transformer, Self-Attention, Multi-Head, 位置编码, Encoder-Decoder, Pre-LN]

## 核心概念

你可以把 **Transformer** 想象成一台超级高效的"阅读理解机器"。它的核心技能只有一个——**注意力（Attention）**。

传统的 RNN 读句子就像你一个字一个字念课文，念到后面就忘了前面说啥了。而 Transformer 不一样，它就像**同时把一整页纸摊开看**，每个词都能一眼看到所有其他词，然后自己判断"我应该重点关注哪几个词"。

这个知识点内容非常丰富，已拆成 **6 篇深度系列文章**，从整体架构到每行代码全部讲透：

## Transformer 深度拆解系列

| 篇章 | 标题 | 核心内容 |
|------|------|----------|
| 第一篇 | [整体架构——这台机器长什么样](transformer-deep-dive/01-overview-and-architecture.md) | Encoder/Decoder 结构、残差连接、三种架构风格对比 |
| 第二篇 | [Self-Attention——每行代码都在干嘛](transformer-deep-dive/02-self-attention-deep-dive.md) | Q/K/V 完整推导、缩放因子、因果掩码、Padding Mask |
| 第三篇 | [Multi-Head Attention——为什么要从多个角度看](transformer-deep-dive/03-multi-head-attention.md) | 多头拆分、MQA/GQA、每个头学到了什么 |
| 第四篇 | [位置编码——怎么告诉模型谁在前谁在后](transformer-deep-dive/04-positional-encoding.md) | 正弦编码、RoPE、ALiBi 三种方案对比 |
| 第五篇 | [FFN 和归一化——每个词的独立深加工](transformer-deep-dive/05-ffn-and-normalization.md) | FFN/SwiGLU、LayerNorm/RMSNorm、Pre-LN vs Post-LN |
| 第六篇 | [训练和推理——模型怎么学会的，又怎么用](transformer-deep-dive/06-training-and-inference.md) | 训练流程、KV Cache、显存计算、解码策略全家桶 |

## 建议阅读顺序

1. 先读**第一篇**建立全局印象
2. 然后**第二篇**深入理解核心的 Attention 机制
3. **第三篇**理解多头的设计思路
4. **第四篇**理解位置信息怎么注入
5. **第五篇**理解 FFN 和归一化的角色
6. 最后**第六篇**理解训练和推理的全流程，特别是 KV Cache

每篇都有**完整可运行的 PyTorch 代码**，每行代码都标注了对应架构图的哪个部分。

## 快速回忆要点

- **Attention 就是**：每个词去"打听"其他词跟自己的关系（Q 提问、K 被匹配、V 提供内容）
- **Multi-Head 就是**：从多个角度同时看（盲人摸象 → 多人协作拼出完整的象）
- **位置编码就是**：告诉模型"谁在前谁在后"（RoPE 是当前主流）
- **FFN 就是**：每个词独立做深加工（Attention 负责交流，FFN 负责消化）
- **残差连接就是**：给梯度开高速公路，防止深层网络训练崩掉
- **KV Cache 就是**：推理时把查过的资料存下来不重复翻
