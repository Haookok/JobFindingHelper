# Transformer 深度拆解（一）：整体架构——这台机器长什么样

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [Transformer, Encoder, Decoder, 残差连接, LayerNorm, FFN, BERT, GPT, T5]

## 一、从 RNN 的痛点说起：为什么我们需要 Transformer？

### 传话游戏：RNN 的致命缺陷

你可以这样理解 RNN 的工作方式——它就像一个**传话游戏**。

想象 20 个人排成一排，第一个人看到一段话，然后小声转述给第二个人，第二个人再转述给第三个人……到最后一个人时，原始信息已经面目全非了。这就是 RNN 处理长序列时的核心问题：**信息在一步步传递中不断衰减**。

技术上讲，这叫**长程依赖问题（Long-Range Dependency）**。虽然 LSTM 和 GRU 加了"门控"机制来缓解（相当于允许部分信息"插队"直接传到后面），但本质上信息还是要一步一步传，越远衰减越严重。

还有一个更致命的问题：**无法并行**。传话游戏里第 5 个人必须等第 4 个人说完才能说，RNN 也一样——位置 t 的计算必须等位置 t-1 算完。GPU 那么多核心，全在干等，浪费极了。

### 圆桌会议：Attention 的全局视野

现在换个场景：20 个人不排队了，**围坐在一张圆桌旁**。任何人想了解信息，直接扭头看对面就行——第 1 个人和第 20 个人之间的距离跟第 1 个人和第 2 个人一样，都是"一扭头"的事。

这就是 **Attention 机制**的核心思想：**每个位置都能直接访问所有其他位置**，不需要中间人传话。

换句话说，Transformer 把 O(n) 的"传话链"变成了 O(1) 的"圆桌会议"——任意两个词之间的信息传递只需要一步。并且所有人可以同时说话（并行计算），不用排队。

## 二、整体架构的白话解读

原版 Transformer（Vaswani et al., 2017）是一个 **Encoder-Decoder** 结构，你可以把它想象成一个考试场景：

- **Encoder = 阅读理解**：拿到一段原文（比如英文句子），反复读、反复琢磨，直到完全理解每个词的含义和它们之间的关系。输出的是一组"理解后的表示"。
- **Decoder = 写作文**：拿着 Encoder 给的理解，一个词一个词地写出答案（比如中文翻译）。写每个词时，一边参考自己已经写了的内容，一边回头查阅 Encoder 的理解。

关键要点：Encoder 可以双向看全文（"猫追狗"里的"追"能同时看到"猫"和"狗"），而 Decoder 只能看已经生成的部分（写到第 3 个字时不能偷看第 4 个字）。

## 三、一个 Encoder Layer 的完整流程

一个 Encoder Layer 干了这么几件事，按顺序来：

```
Input → Self-Attention → Add & Norm → FFN → Add & Norm → Output
```

**第一步：Self-Attention（词与词互相交流）**

每个词去"打听"其他所有词跟自己的关系。比如在 "the cat sat on the mat" 中，"sat" 会发现自己跟 "cat"（谁坐）和 "mat"（坐哪）关系最密切。

**为什么需要这一步？** 因为单独看一个词是没有上下文信息的。"bank" 到底是银行还是河岸？得看周围的词才知道。Self-Attention 就是帮每个词**收集上下文信息**的机制。

**第二步：Add & Norm（残差连接 + 层归一化）**

把 Self-Attention 的输出跟原始输入相加（残差连接），然后做 LayerNorm。这一步后面单独讲为什么重要。

**第三步：FFN（独立深加工）**

一个两层的全连接网络，对每个词**独立地**做进一步处理。你可以这样理解：Self-Attention 是"开会讨论"，FFN 是"会后各自消化总结"。

**为什么 Attention 后面要跟一个 FFN？** 因为 Attention 本质上是在做**加权平均**——信息的线性组合。FFN 引入非线性变换，让模型能学到更复杂的特征映射。

**第四步：又一次 Add & Norm**

跟第二步一样，对 FFN 的输出再做一次残差连接 + 层归一化。

## 四、一个 Decoder Layer 的完整流程

Decoder Layer 比 Encoder Layer 多了一个步骤：

```
Input → Masked Self-Attention → Add & Norm → Cross-Attention → Add & Norm → FFN → Add & Norm → Output
```

**多出来的两个东西：**

**1. Masked Self-Attention（掩码自注意力）**

跟 Encoder 的 Self-Attention 几乎一样，但加了一个**因果掩码**：生成第 t 个词时，只能看到位置 1 到 t 的词，看不到后面的。就像考试时只能看自己已经写过的答案，不能偷看后面的题。

**为什么要这样？** 因为 Decoder 是自回归的——一个词一个词生成。训练时虽然整个目标序列一起输入（为了并行），但必须用掩码模拟"逐步生成"的过程，否则就相当于考试时已经看到了标准答案。

**2. Cross-Attention（交叉注意力）**

这是 Decoder "回头查阅 Encoder 的理解"的地方。具体来说：
- **Q 来自 Decoder**（"我想知道什么"）
- **K 和 V 来自 Encoder**（"原文理解里有什么"）

就好比你在写翻译时，脑子里想着"下一个该写什么"（Q），然后翻回原文（K 和 V）找对应的内容。

## 五、残差连接（Add）的直觉——为什么要"走捷径"？

残差连接的公式很简单：`output = LayerNorm(x + SubLayer(x))`。

你可以这样理解：这就像**考试有保底分**。

假设你考了一门试（SubLayer 的输出），考得好就加分，考砸了也不会比进考场前（原始输入 x）更差——因为最差的情况是 SubLayer 学到的东西全是 0，那输出就等于输入，原封不动地过去。

技术角度讲，残差连接解决的是**深层网络的梯度消失问题**。梯度在反向传播时可以通过"捷径"直接流到浅层，不用穿越每一层的变换，训练深层网络变得可行。

**LayerNorm** 的作用是把每一层的输出归一化到稳定的数值范围，防止数值越来越大或越来越小（训练不稳定）。就像每次运算后"整理一下桌面"，保持工作环境整洁。

## 六、完整 PyTorch 代码：从零搭建 Encoder 和 Decoder

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class EncoderLayer(nn.Module):
    """Transformer Encoder 的单层实现"""

    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        # ---- 架构图里的 "Multi-Head Attention" 方块 ----
        self.self_attn = nn.MultiheadAttention(
            embed_dim=d_model,           # 每个词的向量维度
            num_heads=n_heads,           # 注意力头数
            dropout=dropout,             # 注意力权重的 dropout
            batch_first=True,            # 输入格式为 [batch, seq_len, d_model]
        )

        # ---- 架构图里的 "Feed Forward" 方块 ----
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff),    # 第一层：升维到 d_ff（通常是 d_model 的 4 倍）
            nn.ReLU(),                   # 非线性激活（实际大模型常用 SwiGLU）
            nn.Dropout(dropout),         # 随机丢弃，防止过拟合
            nn.Linear(d_ff, d_model),    # 第二层：降回 d_model 维
        )

        # ---- 两次 "Add & Norm"，各需要一个 LayerNorm ----
        self.norm1 = nn.LayerNorm(d_model)  # 第一次 Add & Norm（在 Self-Attention 后）
        self.norm2 = nn.LayerNorm(d_model)  # 第二次 Add & Norm（在 FFN 后）
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, src_mask: torch.Tensor = None):
        # x 的形状: [batch_size, seq_len, d_model]

        # ===== 第一步：Self-Attention =====
        # Q、K、V 全部来自同一个输入 x（这就是"Self"的含义）
        attn_out, _ = self.self_attn(x, x, x, attn_mask=src_mask)

        # ===== 第二步：Add & Norm（残差连接 + 层归一化）=====
        # x + attn_out 就是残差连接——"走捷径"
        x = self.norm1(x + self.dropout(attn_out))

        # ===== 第三步：FFN（前馈网络，独立处理每个词）=====
        ffn_out = self.ffn(x)

        # ===== 第四步：又一次 Add & Norm =====
        x = self.norm2(x + self.dropout(ffn_out))

        return x  # 形状不变，还是 [batch_size, seq_len, d_model]


class DecoderLayer(nn.Module):
    """Transformer Decoder 的单层实现，比 Encoder 多了 Cross-Attention"""

    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        # ---- Masked Self-Attention：Decoder 自己跟自己交流，但不能看未来 ----
        self.masked_self_attn = nn.MultiheadAttention(
            embed_dim=d_model, num_heads=n_heads,
            dropout=dropout, batch_first=True,
        )

        # ---- Cross-Attention：Decoder 回头查阅 Encoder 的理解 ----
        self.cross_attn = nn.MultiheadAttention(
            embed_dim=d_model, num_heads=n_heads,
            dropout=dropout, batch_first=True,
        )

        # ---- 跟 Encoder 一样的 FFN ----
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff),    # 升维
            nn.ReLU(),                   # 激活
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),    # 降维
        )

        # ---- 三次 Add & Norm（比 Encoder 多一次）----
        self.norm1 = nn.LayerNorm(d_model)  # Masked Self-Attention 后
        self.norm2 = nn.LayerNorm(d_model)  # Cross-Attention 后
        self.norm3 = nn.LayerNorm(d_model)  # FFN 后
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        tgt: torch.Tensor,           # Decoder 的输入（已生成的部分）
        memory: torch.Tensor,         # Encoder 的输出（对原文的理解）
        tgt_mask: torch.Tensor = None,   # 因果掩码，遮住未来
        memory_mask: torch.Tensor = None # Encoder 端的 padding 掩码
    ):
        # ===== 第一步：Masked Self-Attention =====
        # Q、K、V 都来自 tgt，但 tgt_mask 保证看不到后面的词
        # is_causal=True 时 PyTorch 自动生成因果掩码（也可手动传 tgt_mask）
        attn_out, _ = self.masked_self_attn(
            tgt, tgt, tgt, attn_mask=tgt_mask, is_causal=(tgt_mask is None)
        )

        # ===== 第二步：Add & Norm =====
        tgt = self.norm1(tgt + self.dropout(attn_out))

        # ===== 第三步：Cross-Attention =====
        # 关键：Q 来自 Decoder（tgt），K 和 V 来自 Encoder（memory）
        cross_out, _ = self.cross_attn(
            tgt,        # Query: "我想知道什么"
            memory,     # Key:   "原文里有什么"
            memory,     # Value: "原文里的内容"
            attn_mask=memory_mask,
        )

        # ===== 第四步：Add & Norm =====
        tgt = self.norm2(tgt + self.dropout(cross_out))

        # ===== 第五步：FFN =====
        ffn_out = self.ffn(tgt)

        # ===== 第六步：Add & Norm =====
        tgt = self.norm3(tgt + self.dropout(ffn_out))

        return tgt  # 形状: [batch_size, tgt_seq_len, d_model]


# ===== 运行示例 =====
if __name__ == "__main__":
    batch_size = 2       # 一次处理 2 个样本
    src_len = 10         # 原文 10 个词
    tgt_len = 8          # 译文 8 个词
    d_model = 64         # 每个词用 64 维向量表示
    n_heads = 4          # 4 个注意力头（每个头 64/4=16 维）
    d_ff = 256           # FFN 中间层维度（通常 4 × d_model）

    src = torch.randn(batch_size, src_len, d_model)   # 模拟 Encoder 输入
    tgt = torch.randn(batch_size, tgt_len, d_model)   # 模拟 Decoder 输入

    encoder_layer = EncoderLayer(d_model, n_heads, d_ff)
    decoder_layer = DecoderLayer(d_model, n_heads, d_ff)

    enc_out = encoder_layer(src)                       # Encoder 处理原文
    dec_out = decoder_layer(tgt, memory=enc_out)       # Decoder 参考 Encoder 输出来生成

    print(f"Encoder 输入:  {src.shape}")    # [2, 10, 64]
    print(f"Encoder 输出:  {enc_out.shape}")# [2, 10, 64]  — 形状不变，含义变了
    print(f"Decoder 输入:  {tgt.shape}")    # [2, 8, 64]
    print(f"Decoder 输出:  {dec_out.shape}")# [2, 8, 64]   — 形状不变，含义变了
```

## 七、三种架构变体：BERT / GPT / T5 各砍了什么？

理解了完整的 Encoder-Decoder 之后，你会发现后来的大模型基本都在做"减法"：

### Encoder-Only：BERT

**保留了什么？** 只保留 Encoder 部分，去掉整个 Decoder。

**为什么能这样做？** BERT 不需要"逐词生成"，它的任务是**理解**——给一段文本打标签、判断情感、做问答匹配。就像阅读理解考试只要选 ABCD，不需要写作文。

**训练方式：** 随机遮住 15% 的词让模型猜（Masked Language Model），因为没有掩码限制，所以是**双向的**——每个词能同时看到左边和右边的上下文。

### Decoder-Only：GPT

**保留了什么？** 只保留 Decoder 部分，去掉 Encoder 和 Cross-Attention。

**为什么能这样做？** GPT 的哲学是：**一切任务都可以转化为"给前文续写"**。翻译？"Translate to Chinese: Hello → " 后面续写就行。分类？"This movie is → positive/negative" 续写就行。

**为什么它成了主流？** 因为自回归生成天然适合对话、写作这些场景，而且扩展性极好——模型越大、数据越多，能力涨得越明显。

**关键差异：** Decoder-Only 的 Self-Attention 永远带因果掩码，每个词只能看左边。

### Encoder-Decoder：T5

**保留了什么？** 完整的 Encoder + Decoder，一个也没砍。

**适合什么？** 需要"先理解再生成"的任务——翻译、摘要、改写。T5 把所有 NLP 任务都统一成了 "text-to-text" 格式。

### 一张表总结

| 维度 | Encoder-Only (BERT) | Decoder-Only (GPT) | Encoder-Decoder (T5) |
|------|---------------------|---------------------|----------------------|
| 注意力方向 | 双向 | 单向（因果掩码） | Encoder 双向，Decoder 单向 |
| 训练目标 | 完形填空（MLM） | 下一个词预测 | 序列到序列 |
| 强项 | 理解、分类、检索 | 生成、对话、推理 | 翻译、摘要、改写 |
| 代表模型 | BERT, RoBERTa | GPT, LLaMA, Qwen | T5, BART, mT5 |
| 当前趋势 | 仍用于嵌入模型 | **绝对主流** | 特定场景仍有优势 |

## 面试追问

- **为什么 Decoder-Only 架构能"一统天下"，Encoder-Decoder 不行？** Scaling Law 表明大力出奇迹时 Decoder-Only 更高效；Encoder-Decoder 的参数分配不如全部堆在 Decoder 里划算。
- **Pre-LN 和 Post-LN 有什么区别？为什么大模型几乎都用 Pre-LN？** Post-LN 在深层时梯度不稳定，需要 warmup 等技巧；Pre-LN 从第一步就归一化，训练更平滑，但理论上最终性能可能略低。
- **残差连接是"免费午餐"吗？有什么局限？** 不完全免费——它要求子层的输入和输出维度相同，所以 Transformer 每一层的维度必须固定为 d_model。
- **FFN 的中间维度为什么通常是 d_model 的 4 倍？** 经验值。更大的中间维度意味着更强的表达能力，但计算量也更大。4 倍是原版论文的选择，现在的模型（如 LLaMA 用 SwiGLU）中间维度会调整为其他比例。
- **如果把 BERT 的双向 Attention 加到 GPT 上会怎样？** 那就没法做自回归生成了——训练时会"泄露答案"。有人尝试用 Prefix LM（前缀部分双向、生成部分单向）来折中，如 PaLM、GLM。

## 常见误区

- **以为 Encoder 和 Decoder 的 Self-Attention 一模一样**——不对，Decoder 多了因果掩码。即使用了相同的 `nn.MultiheadAttention`，传参不同（`is_causal=True`）。
- **以为 Cross-Attention 的 Q、K、V 全来自 Decoder**——不对，Q 来自 Decoder，K 和 V 来自 Encoder。这是 Decoder "提问"、Encoder "回答"的过程。
- **以为残差连接是可选的优化技巧**——在深层 Transformer 里它是必需的，去掉基本训不动。
- **以为 GPT 不能做理解任务**——可以，只是方式不同：把理解任务包装成生成任务（in-context learning）。GPT-4 的阅读理解能力已经超过很多 BERT 变体。
- **以为 Encoder-Decoder 架构已经过时**——在翻译、语音识别（Whisper）等场景，Encoder-Decoder 仍然是很好的选择。
