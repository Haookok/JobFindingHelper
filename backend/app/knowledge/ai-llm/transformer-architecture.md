# Transformer 架构详解

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [Transformer, Self-Attention, Multi-Head, 位置编码, Encoder-Decoder, Pre-LN]

## 核心概念

你可以把 **Transformer** 想象成一台超级高效的"阅读理解机器"。它的核心技能只有一个——**注意力（Attention）**。

传统的 RNN 读句子就像你一个字一个字念课文，念到后面就忘了前面说啥了。而 Transformer 不一样，它就像**同时把一整页纸摊开看**，每个词都能一眼看到所有其他词，然后自己判断"我应该重点关注哪几个词"。

具体来说，Transformer 靠**自注意力（Self-Attention）** 让每个词去"打听"其他所有词跟自己的关系，再靠 **前馈网络（FFN）** 对每个词做独立的深加工。把这两步叠很多层，就能理解非常复杂的语言。

## 详细解析

### 注意力到底在干嘛？——Q、K、V 的大白话

想象你在图书馆找书：你脑子里有个**问题（Query）**——"我想找关于猫的书"；书架上每本书有个**标签（Key）**——"动物""烹饪""历史"；标签匹配上了，你就把那本书的**内容（Value）** 拿来读。

Self-Attention 就是这个过程：每个词同时扮演"提问者"和"被查的书"。它会把自己变成 Q、K、V 三个向量（通过三个不同的线性变换），然后用 Q 去跟所有词的 K 算"匹配分数"，分数高的词的 V 就会被更多地关注。

**为啥要除以 √d_k？** 因为向量维度高了之后，点积的数值会特别大，softmax 就会变成"非 0 即 1"的极端状态，梯度几乎为零学不动。除以 √d_k 就是把数值拉回到温和的范围，好比考试分数太高了做个开根号让分布更合理。

### Multi-Head：多个角度同时看

一个注意力头可能只关注"语法关系"，另一个关注"语义相似"，再一个关注"距离远近"。**Multi-Head Attention** 就是开多个"视角"并行工作，最后把各视角的发现拼起来综合。具体做法是把 d_model 维度切成 h 份，每份独立做注意力，最后拼接再过一个线性层融合。

### 位置编码：告诉模型"谁在前谁在后"

Attention 本身是无序的——"猫吃鱼"和"鱼吃猫"在它眼里一样。所以需要额外注入位置信息：
- **正弦/余弦编码**：用不同频率的波形表示位置，像音乐里不同频率的音符叠加
- **RoPE（旋转位置编码）**：把位置信息"旋转"进 Q 和 K，让相对距离自然体现，目前主流大模型最常用
- **ALiBi**：简单粗暴——离得越远，注意力分数扣分越多，不需要专门的位置向量

### 三种架构风格

| 架构 | 代表 | 特点 | 适合场景 |
|------|------|------|----------|
| Encoder-Only | BERT | 双向看全文，做填空题训练 | 分类、检索、语义理解 |
| Decoder-Only | GPT | 只能看前面的词，一个接一个往后写 | 文本生成、对话（当前主流） |
| Encoder-Decoder | T5 | 先读完原文再翻译/改写 | 翻译、摘要 |

### Pre-LN vs Post-LN

原版 Transformer 是"先算子层，再做归一化"（Post-LN），但层数一多容易训练不稳。现在大多数大模型用 **Pre-LN**——"先归一化，再算子层"，就像每次干活前先整理下工具，干起来更顺。很多模型还用 **RMSNorm** 替代 LayerNorm，计算更快，效果差不多。

### FFN 和掩码

**FFN** 就是两层全连接网络，对每个词独立做"深加工"。可以理解为 Attention 负责"词之间互相交流"，FFN 负责"每个词自己消化吸收"。目前大模型常用 **SwiGLU** 激活函数，效果更好。

**因果掩码（Causal Mask）**：在 Decoder 里，生成第 5 个词时不能偷看第 6、7、8 个词（那还没生成呢），所以用一个下三角矩阵把"未来"遮住。**Padding Mask** 则是把填充符的位置遮住，防止它们参与注意力计算。

## 示例代码

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class ScaledDotProductAttention(nn.Module):
    """单头缩放点积注意力"""

    def __init__(self, d_model: int, d_k: int):
        super().__init__()
        self.d_k = d_k
        # 三个线性变换：把输入分别映射成 Q、K、V
        self.w_q = nn.Linear(d_model, d_k, bias=False)
        self.w_k = nn.Linear(d_model, d_k, bias=False)
        self.w_v = nn.Linear(d_model, d_k, bias=False)

    def forward(self, x: torch.Tensor, attn_mask: torch.Tensor | None = None):
        # x: [batch, seq_len, d_model]
        q, k, v = self.w_q(x), self.w_k(x), self.w_v(x)
        # Q 和 K 算匹配分数，再除以 √d_k 防止数值爆炸
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_k)
        if attn_mask is not None:
            # 被遮住的位置设成负无穷，softmax 后变成 0
            scores = scores.masked_fill(attn_mask == 0, float("-inf"))
        attn = F.softmax(scores, dim=-1)
        # 用注意力权重对 V 加权求和，得到最终输出
        return torch.matmul(attn, v), attn


def causal_mask(seq_len: int, device):
    """因果掩码：下三角为 1，上三角（未来位置）为 0"""
    return torch.tril(torch.ones(seq_len, seq_len, device=device))


batch, seq, d_model, d_k = 2, 8, 64, 16
x = torch.randn(batch, seq, d_model)
# PyTorch 内置的 Multi-Head Attention，已封装好多头拆分和拼接
mha = nn.MultiheadAttention(d_model, num_heads=4, batch_first=True)
out, _ = mha(x, x, x, attn_mask=None, is_causal=True)
```

**运行说明**：需安装 `torch`；`is_causal=True` 自动生成因果掩码，适用于 Decoder 场景。

## 面试追问

- **面试官可能会这样问你**：为啥缩放因子偏偏是 √d_k？跟 Xavier 初始化"控制激活尺度"的思路有什么联系？
- **面试官可能会这样问你**：Pre-LN 和 Post-LN 在深层模型训练时表现有啥区别？为啥现在大模型几乎都用 Pre-LN？
- **面试官可能会这样问你**：RoPE 和 ALiBi 在处理超长文本（比训练时更长）时各有什么问题？
- **面试官可能会这样问你**：GPT 这种 Decoder-Only 模型也能做分类任务吗？跟 BERT 比有什么取舍？
- **面试官可能会这样问你**：Cross-Attention 里 Q、K、V 分别从哪来？跟 Self-Attention 有啥区别？

## 常见误区

- **很多人会搞混的地方**：把 Self-Attention 说成"每个词跟所有词做全连接"——其实权重是动态算出来的（取决于 Q 和 K 的相似度），跟固定权重的全连接层完全不一样。
- **很多人会搞混的地方**：以为 Multi-Head 就是"同一个注意力算好几遍"——每个头的 Q/K/V 参数完全不同，看的是不同"角度"的信息。
- **很多人会搞混的地方**：以为 Decoder 也能像 BERT 一样双向看全文——不行，因果掩码保证它只能看已生成的部分。
- **很多人会搞混的地方**：觉得位置编码就是"加个向量"这么简单——RoPE 是融入旋转几何的，ALiBi 是直接改注意力分数的，外推能力差很多。
- **很多人会搞混的地方**：把 LayerNorm 和 BatchNorm 当成可以互换的——在 NLP 变长序列场景下，LN 按每个样本归一化，更稳定；BN 依赖 batch 统计量，效果通常不好。
