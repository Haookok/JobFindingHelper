# Transformer 深度拆解手册

这是一份从零开始、用大白话把 Transformer 拆碎讲透的完整教程。六篇文章按学习顺序编排：从整体架构与 Encoder/Decoder 流程，到 Self-Attention 与 Q/K/V、缩放点积与掩码，再到多头注意力与 MHA/MQA/GQA，接着是位置编码（正弦、RoPE、ALiBi），然后是 FFN、归一化与 Pre-LN/Post-LN，最后落到训练、推理、KV Cache 与解码策略；文中配以 PyTorch 示例，便于把公式和每一行代码对应起来。

## 目录

1. （一）整体架构——这台机器长什么样
2. （二）Self-Attention——每行代码都在干嘛
3. （三）Multi-Head Attention——为什么要从多个角度看
4. （四）位置编码——怎么告诉模型"谁在前谁在后"
5. （五）FFN 和归一化——每个词的"独立深加工"
6. （六）训练和推理——模型是怎么学会的，又是怎么用的

---

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

# Transformer 深度拆解（二）：Self-Attention——每行代码都在干嘛

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [Self-Attention, Q/K/V, Scaled Dot-Product, Softmax, Causal Mask, Padding Mask]

## 一、Q、K、V 的直觉——用三个比喻彻底搞懂

Self-Attention 的核心就是 **Query（查询）、Key（键）、Value（值）** 三个向量。概念不难，但很多人一到数学公式就晕。我们用多个比喻来反复强化直觉。

### 比喻一：图书馆找书

你走进图书馆，脑子里有个**问题（Query）**——"我想找关于深度学习的书"。书架上每本书有个**标签（Key）**——"机器学习""烹饪""历史"……你把自己的问题跟每个标签比对，**匹配度最高的标签对应的书的内容（Value）** 就是你最终带走的。

对应到 Self-Attention：每个词同时是"找书的人"和"书架上的书"。它把自己变成 Q 去找其他词，同时也把自己变成 K 和 V 被其他词查找。

### 比喻二：谷歌搜索

你输入搜索词（Query），Google 把你的搜索词跟每个网页的标题/关键词（Key）做匹配，匹配度高的网页排在前面，最终你看到的是这些网页的正文内容（Value）。

### 比喻三：课堂提问

老师提了个问题（Query），班里每个同学都举手，手上有个"标签牌"（Key）写着自己擅长什么。老师扫一圈，根据标签牌的匹配度决定让哪些同学回答（权重分配），最终听到的是这些同学的发言内容（Value）。

**三个比喻的共同模式：** Q 是"我想要什么"，K 是"我有什么"，V 是"我的实际内容"。Q 和 K 决定了**关注谁**，V 提供**被关注者的信息**。

## 二、线性映射 W_Q、W_K、W_V 在干嘛

一个自然的疑问：为什么不直接用原始词向量算相似度，非要先乘一个矩阵变成 Q、K、V？

### "戴不同颜色的眼镜"比喻

你可以这样理解：原始词向量就像"这个人的全部信息"——长相、性格、专业、爱好混在一起。但不同的任务需要从不同角度看同一个人：

- **W_Q 是一副红色眼镜**：看到的是"这个词在提什么问题、在找什么信息"
- **W_K 是一副蓝色眼镜**：看到的是"这个词能提供什么信息、有什么特征"
- **W_V 是一副绿色眼镜**：看到的是"这个词要传递的实际内容"

三个线性映射把同一个词投影到三个不同的"子空间"，让模型能从不同角度提取信息。

技术层面的原因：如果直接用同一个向量既当 Q 又当 K，那一个词跟自己的相似度永远最高（向量跟自身的点积最大），注意力就会退化成"每个词只关注自己"，失去了上下文交互的意义。有了 W_Q 和 W_K，模型可以**学到**什么样的查询应该关注什么样的键。

## 三、点积注意力的逐步计算——手把手带你算一遍

我们用一个最简单的例子：4 个词，每个词用 3 维向量表示。

假设经过线性映射后（即乘过 W_Q、W_K、W_V 之后）：

```
Q = [[1, 0, 1],   ← 词1的查询向量
     [0, 1, 0],   ← 词2的查询向量
     [1, 1, 0],   ← 词3的查询向量
     [0, 0, 1]]   ← 词4的查询向量

K = [[1, 0, 0],   ← 词1的键向量
     [0, 1, 1],   ← 词2的键向量
     [1, 1, 0],   ← 词3的键向量
     [0, 0, 1]]   ← 词4的键向量
```

### 第一步：Q × K^T，算"原始匹配分数"

每个 Q 跟每个 K 做点积——本质上就是算两个向量有多相似：

```
scores = Q × K^T

          K1   K2   K3   K4
Q1 →   [ 1    1    1    1  ]   ← 词1跟所有词的匹配分
Q2 →   [ 0    1    1    0  ]   ← 词2跟所有词的匹配分
Q3 →   [ 1    1    1    0  ]   ← 词3跟所有词的匹配分
Q4 →   [ 0    1    0    1  ]   ← 词4跟所有词的匹配分
```

以 Q1 = [1,0,1] 为例：
- Q1·K1 = 1×1 + 0×0 + 1×0 = **1**（词1 觉得词1 跟自己有点相关）
- Q1·K2 = 1×0 + 0×1 + 1×1 = **1**（词1 觉得词2 也有点相关）
- Q1·K3 = 1×1 + 0×1 + 1×0 = **1**（词1 觉得词3 也有点相关）
- Q1·K4 = 1×0 + 0×0 + 1×1 = **1**（词1 觉得词4 也有点相关）

这个例子比较特殊——分数都一样，说明词1 对所有词的关注度均等。实际训练后，分数会有明显差异。

### 第二步：除以 √d_k

这里 d_k = 3，所以 √d_k ≈ 1.73。所有分数除以 1.73：

```
scaled_scores ≈ [[0.58, 0.58, 0.58, 0.58],
                  [0,    0.58, 0.58, 0   ],
                  [0.58, 0.58, 0.58, 0   ],
                  [0,    0.58, 0,    0.58]]
```

### 第三步：Softmax → 概率分布

对每一行做 Softmax（保证每行加起来等于 1）。

### 第四步：乘 V → 加权求和

用 Softmax 后的权重去对 V 做加权平均，得到最终输出。

## 四、缩放因子 √d_k 的深入理解——不只是"防止数值太大"

很多教程讲到缩放因子就一句话带过："防止点积太大让 softmax 梯度消失"。这是对的，但不够深。我们来彻底搞清楚**为什么方差会随维度增长，为什么开根号刚好能校正**。

### 数学推导

假设 Q 和 K 的每个元素都是**独立的、均值为 0、方差为 1** 的随机变量（这在合理初始化下近似成立）。

Q·K 的点积 = q₁k₁ + q₂k₂ + ... + q_d k_d

- 每个 qᵢkᵢ 的期望 E[qᵢkᵢ] = E[qᵢ]E[kᵢ] = 0 × 0 = 0
- 每个 qᵢkᵢ 的方差 Var(qᵢkᵢ) = E[qᵢ²]E[kᵢ²] = 1 × 1 = 1
- d_k 个独立项求和后，总方差 = d_k

所以**点积的方差 = d_k**，标准差 = √d_k。

当 d_k = 64 时，点积的标准差是 8；当 d_k = 512 时，标准差是 ~22.6。维度越大，点积的绝对值越大，softmax 的输入就越极端。

**Softmax 的问题**：当输入的值差距很大时，softmax 会趋向 one-hot（最大的→1，其他→0），梯度几乎为零，训练停滞。

**除以 √d_k 之后**，点积的方差被校正回 1（因为 Var(X/c) = Var(X)/c²，除以 √d_k 后方差 = d_k/d_k = 1），无论 d_k 多大，softmax 的输入都在合理范围内。

换句话说，√d_k 不是随便选的——它是从**让点积方差归一**的数学需求直接推出来的。这跟 Xavier 初始化的思想异曲同工：都是在控制信号的数值尺度。

## 五、Softmax 的作用——从"分数"到"概率"

Softmax 把原始分数变成一个**概率分布**（所有值非负且加和为 1）。

为什么不直接用原始分数？因为原始分数可能是负数、可能很大很小。Softmax 做了两件事：

1. **归一化**：让权重加起来等于 1，变成"百分比"——词 A 占 60% 的注意力，词 B 占 30%，词 C 占 10%
2. **软选择（Soft Selection）**：不是非此即彼地只选一个词（hard attention），而是按比例混合所有词的信息。这让模型可微分、可训练

你可以这样理解：Softmax 就像投票后的"票数统计"——把原始打分变成"谁占多大比重"。

**温度（Temperature）** 的概念也来自这里：Softmax(x/T)。T 大时分布平坦（各词权重接近均匀），T 小时分布尖锐（接近只选最高分的词）。T→0 就退化为 hard attention。

## 六、加权求和的含义——最终输出是什么

Softmax 算出的权重矩阵乘以 V，得到最终输出：

```
output = attention_weights × V
```

每个词的输出向量 = **根据注意力权重，把所有词的 V 混合起来**。

你可以这样理解：这就像"鸡尾酒调配"。每个词是一种基酒（V），注意力权重就是配方比例——"取 60% 的词 A + 30% 的词 B + 10% 的词 C"，调出的鸡尾酒就是这个词融合了上下文信息后的新表示。

这个过程让每个词不再是"孤立的"——"bank" 这个词在经过 Self-Attention 后，如果上下文是 "river bank"，它的输出向量会更偏向"河岸"的含义；如果上下文是 "bank account"，就更偏向"银行"。

## 七、因果掩码（Causal Mask）——考试不能偷看后面的题

### 为什么 Decoder 需要、Encoder 不需要？

**Encoder** 的任务是理解全文。就像做阅读理解，你当然要把整篇文章从头到尾读完再答题。所以 Encoder 的每个词可以看到所有其他词——**双向注意力**。

**Decoder** 的任务是逐步生成。就像考试写作文，你写第 3 句的时候，第 4 句还没写出来——你不能偷看还不存在的内容。所以 Decoder 的每个词只能看到自己和前面的词——**单向注意力**。

### 掩码长什么样？

因果掩码是一个**下三角矩阵**。假设序列长度为 4：

```
mask = [[1, 0, 0, 0],    ← 词1只能看词1
        [1, 1, 0, 0],    ← 词2可以看词1、词2
        [1, 1, 1, 0],    ← 词3可以看词1、词2、词3
        [1, 1, 1, 1]]    ← 词4可以看所有
```

在计算注意力分数后、Softmax 之前，把 mask=0 的位置填成 **-∞**。这样 Softmax 后这些位置的权重就变成 0——彻底屏蔽"未来"的信息。

### 训练 vs 推理

**训练时**：整个目标序列一次性输入，用因果掩码模拟逐步生成的效果。这样可以**并行**计算所有位置的损失——大大加快训练速度。

**推理时**：真的是一个词一个词生成。但因果掩码让训练和推理时看到的信息范围一致，保证行为不会"跑偏"。

## 八、Padding Mask——为什么填充符需要被屏蔽

实际训练时，一个 batch 里的句子长度不同。短的句子需要用 **padding token（填充符，通常是 0）** 补齐到相同长度。

但这些填充符是无意义的——你不会希望模型在理解 "I love cats [PAD] [PAD]" 时，"cats" 居然在关注 "[PAD]"。所以需要用 **Padding Mask** 把填充位置的注意力分数设为 -∞。

```python
# 例如 batch 中两个句子，长度分别为 3 和 5，补齐到 5
padding_mask = [[1, 1, 1, 0, 0],   # 前3个是真实词，后2个是padding
                [1, 1, 1, 1, 1]]   # 全是真实词
```

注意：因果掩码和 Padding Mask 可以**叠加使用**——Decoder 端需要同时屏蔽"未来的词"和"填充符"。

## 九、完整代码：从零实现 Scaled Dot-Product Attention

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


def scaled_dot_product_attention(
    query: torch.Tensor,           # Q 矩阵, 形状 [batch, seq_q, d_k]
    key: torch.Tensor,             # K 矩阵, 形状 [batch, seq_k, d_k]
    value: torch.Tensor,           # V 矩阵, 形状 [batch, seq_k, d_v]
    mask: torch.Tensor = None,     # 可选掩码（因果掩码或 padding 掩码）
    dropout: nn.Dropout = None,    # 可选 dropout 层
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    注意力公式: Attention(Q, K, V) = softmax(Q K^T / √d_k) V

    对应原论文 "Scaled Dot-Product Attention" 方块。
    """

    # d_k = Q 和 K 的最后一个维度（每个头的维度）
    # 这个值决定了缩放因子的大小
    d_k = query.size(-1)

    # ===== 第一步：Q × K^T —— 计算原始匹配分数 =====
    # query:                [batch, seq_q, d_k]
    # key.transpose(-2,-1): [batch, d_k, seq_k]
    # 矩阵乘法后:           [batch, seq_q, seq_k]
    # scores[i][j] 表示"第 i 个查询词跟第 j 个键词的匹配程度"
    scores = torch.matmul(query, key.transpose(-2, -1))

    # ===== 第二步：除以 √d_k —— 缩放，防止方差随维度膨胀 =====
    # 原因：点积的方差 = d_k，除以 √d_k 后方差归一为 1
    # 这保证 softmax 的输入始终在合理范围，梯度不会消失
    scores = scores / math.sqrt(d_k)

    # ===== 第三步：应用掩码（如果有的话）=====
    # mask=0 的位置填 -inf，softmax 后这些位置的权重变成 0
    # 用途1：因果掩码 —— 屏蔽未来位置，对应 Decoder
    # 用途2：padding掩码 —— 屏蔽填充符，对应变长输入
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))

    # ===== 第四步：Softmax —— 把原始分数变成概率分布 =====
    # 对最后一个维度（seq_k）做 softmax
    # 每行加起来 = 1，表示"这个查询词把注意力怎么分配给所有键词"
    attn_weights = F.softmax(scores, dim=-1)

    # 可选：对注意力权重做 dropout（训练时的正则化手段）
    if dropout is not None:
        attn_weights = dropout(attn_weights)

    # ===== 第五步：加权求和 —— 用注意力权重混合 V =====
    # attn_weights: [batch, seq_q, seq_k]
    # value:        [batch, seq_k, d_v]
    # 矩阵乘法后:   [batch, seq_q, d_v]
    # 每个查询词的输出 = 所有值向量按注意力权重的加权平均
    output = torch.matmul(attn_weights, value)

    # 返回：(注意力输出, 注意力权重矩阵)
    # 权重矩阵在可视化注意力模式时非常有用
    return output, attn_weights


class SingleHeadSelfAttention(nn.Module):
    """
    单头自注意力的完整实现。
    包含 W_Q、W_K、W_V 三个线性映射 + Scaled Dot-Product Attention。
    """

    def __init__(self, d_model: int, d_k: int):
        super().__init__()
        self.d_k = d_k

        # ===== 三个线性映射：从 d_model 维投影到 d_k 维 =====
        # W_Q："红色眼镜"——从输入中提取"要查询什么"
        self.w_q = nn.Linear(d_model, d_k, bias=False)
        # W_K："蓝色眼镜"——从输入中提取"能提供什么"
        self.w_k = nn.Linear(d_model, d_k, bias=False)
        # W_V："绿色眼镜"——从输入中提取"实际内容"
        self.w_v = nn.Linear(d_model, d_k, bias=False)

    def forward(
        self,
        x: torch.Tensor,                 # 输入, [batch, seq_len, d_model]
        mask: torch.Tensor = None,        # 可选掩码
    ) -> tuple[torch.Tensor, torch.Tensor]:
        # ===== 线性映射：生成 Q、K、V =====
        # 同一个输入 x 分别过三个不同的线性层
        # 这就是 "Self" Attention 的含义——Q、K、V 全来自自身
        q = self.w_q(x)   # [batch, seq_len, d_k]
        k = self.w_k(x)   # [batch, seq_len, d_k]
        v = self.w_v(x)   # [batch, seq_len, d_k]

        # ===== 调用缩放点积注意力 =====
        output, attn_weights = scaled_dot_product_attention(q, k, v, mask=mask)

        return output, attn_weights


def make_causal_mask(seq_len: int, device: torch.device = None) -> torch.Tensor:
    """
    生成因果掩码（下三角矩阵）。

    mask[i][j] = 1 表示位置 i 可以看到位置 j
    mask[i][j] = 0 表示位置 i 不能看到位置 j（未来位置）
    """
    return torch.tril(torch.ones(seq_len, seq_len, device=device))


def make_padding_mask(lengths: torch.Tensor, max_len: int) -> torch.Tensor:
    """
    根据每个样本的真实长度生成 padding 掩码。

    lengths: [batch_size]，每个样本的实际长度
    max_len: 补齐后的最大长度

    返回: [batch_size, 1, max_len]，可以广播到 [batch, seq_q, seq_k]
    """
    # arange 生成 [0, 1, 2, ..., max_len-1]
    # 跟每个样本的长度比较，小于长度的位置为 True（真实词），否则为 False（padding）
    mask = torch.arange(max_len).unsqueeze(0) < lengths.unsqueeze(1)
    # 增加一个维度以便广播
    return mask.unsqueeze(1).float()  # [batch, 1, max_len]


# ==================== 运行示例 ====================
if __name__ == "__main__":

    # ----- 超参数 -----
    batch_size = 2
    seq_len = 5        # 序列长度（5 个词）
    d_model = 16       # 词向量维度
    d_k = 8            # 注意力头的维度

    # ----- 构造模拟输入 -----
    x = torch.randn(batch_size, seq_len, d_model)
    print(f"输入 x 的形状:    {x.shape}")
    # → [2, 5, 16]  含义：2个样本，每个5个词，每个词16维

    # ----- 初始化单头自注意力 -----
    attention = SingleHeadSelfAttention(d_model, d_k)

    # ===== 示例1：无掩码（Encoder 场景）=====
    out, weights = attention(x, mask=None)
    print(f"\n【无掩码 - Encoder 场景】")
    print(f"输出形状:          {out.shape}")
    # → [2, 5, 8]   含义：2个样本，每个5个词，每个词变成8维（d_k）
    print(f"注意力权重形状:    {weights.shape}")
    # → [2, 5, 5]   含义：每个词对其他5个词的注意力分配
    print(f"权重每行之和:      {weights[0].sum(dim=-1)}")
    # → 全是 1.0，因为 softmax 保证了归一化

    # ===== 示例2：因果掩码（Decoder 场景）=====
    causal = make_causal_mask(seq_len)
    print(f"\n因果掩码:\n{causal}")
    # → 下三角矩阵，1 表示能看到，0 表示被遮住

    out_causal, weights_causal = attention(x, mask=causal)
    print(f"\n【因果掩码 - Decoder 场景】")
    print(f"输出形状:          {out_causal.shape}")
    print(f"注意力权重（样本1）:\n{weights_causal[0].detach()}")
    # 观察：第1行只有第1个位置有权重，第2行只有前2个位置有权重……

    # ===== 示例3：Padding 掩码 =====
    lengths = torch.tensor([3, 5])   # 第1个样本真实长度3，第2个样本长度5
    pad_mask = make_padding_mask(lengths, seq_len)
    print(f"\nPadding 掩码:\n{pad_mask}")
    # → 第1个样本: [1,1,1,0,0]  后两个位置是padding
    # → 第2个样本: [1,1,1,1,1]  没有padding

    out_pad, weights_pad = attention(x, mask=pad_mask)
    print(f"\n【Padding 掩码】")
    print(f"输出形状:          {out_pad.shape}")
    print(f"注意力权重（样本1）:\n{weights_pad[0].detach()}")
    # 观察：第1个样本的所有词都不会关注位置4和5（padding位置权重为0）

    # ===== Shape 变化全流程总结 =====
    print("\n" + "=" * 50)
    print("Shape 变化全流程:")
    print(f"  输入 x:         {x.shape}")                   # [2, 5, 16]
    print(f"  → W_Q(x) = Q:  {attention.w_q(x).shape}")    # [2, 5, 8]
    print(f"  → W_K(x) = K:  {attention.w_k(x).shape}")    # [2, 5, 8]
    print(f"  → W_V(x) = V:  {attention.w_v(x).shape}")    # [2, 5, 8]
    q_demo = attention.w_q(x)
    k_demo = attention.w_k(x)
    scores_demo = torch.matmul(q_demo, k_demo.transpose(-2, -1))
    print(f"  → Q × K^T:     {scores_demo.shape}")         # [2, 5, 5]
    print(f"  → / √d_k:      {scores_demo.shape}")         # [2, 5, 5] 形状不变，值变小
    print(f"  → softmax:      {scores_demo.shape}")         # [2, 5, 5] 形状不变，每行和=1
    v_demo = attention.w_v(x)
    out_demo = torch.matmul(F.softmax(scores_demo / math.sqrt(d_k), dim=-1), v_demo)
    print(f"  → × V = output: {out_demo.shape}")            # [2, 5, 8]
    print("=" * 50)
```

## 面试追问

- **为什么 Q 和 K 的维度必须相同，但 V 的维度可以不同？** 因为 Q 和 K 要做点积算相似度，维度必须匹配；V 只参与加权求和，维度可以任意设定（不过实践中通常 d_k = d_v）。
- **Attention 的计算复杂度是多少？为什么长序列会很慢？** O(n²·d)，因为每对 (query, key) 都要算点积。序列长度 n 翻倍，计算量翻 4 倍。这也是 Flash Attention、稀疏注意力等优化方向的动力。
- **如果不做缩放（不除以 √d_k），实际训练时会观察到什么现象？** 训练初期注意力权重接近 one-hot（一个词的权重接近 1，其他接近 0），梯度极小，模型学不动或收敛极慢。维度越大现象越严重。
- **Self-Attention 和 Cross-Attention 在 Q/K/V 的来源上有什么区别？** Self-Attention 的 Q、K、V 全来自同一个输入；Cross-Attention 的 Q 来自 Decoder，K 和 V 来自 Encoder 的输出。
- **因果掩码在训练和推理时的使用方式有什么不同？** 训练时一次性输入整个序列，用掩码模拟自回归；推理时真的是逐 token 生成，每步只比上一步多一个 token，但注意力计算等价于用掩码的效果。

## 常见误区

- **以为 Q、K、V 是三种不同类型的输入**——在 Self-Attention 中它们全来自同一个输入 x，只是经过了不同的线性变换。它们是同一个词的三个"视角"。
- **以为 √d_k 是超参数或者可以调的**——它是从数学推导（让点积方差归一）直接得出的，不需要调，也不应该改。
- **以为因果掩码是把矩阵元素设为 0**——实际是设为 **-∞**（代码中是 `-inf`），这样 softmax 后才会变成 0。如果只设为 0，softmax 后还是有非零权重。
- **把 Attention 权重当成"重要性排名"**——权重表示的是"信息混合比例"，不是简单的重要性。一个词的权重低不代表它不重要，可能它的信息已经通过其他路径传递了。
- **以为 Padding Mask 只在 Encoder 端需要**——Decoder 端也需要，而且往往要跟因果掩码组合使用。

# Transformer 深度拆解（三）：Multi-Head Attention——为什么要从多个角度看

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [Multi-Head Attention, MQA, GQA, KV Cache, 注意力机制]

## 核心概念

上一篇我们搞懂了单头注意力：一个 Query 去跟所有 Key 算匹配分数，加权求和 Value。那一个头就够了呗？不够。

**盲人摸象**——一个盲人摸到腿说"大象像柱子"，摸到耳朵的说"大象像扇子"，摸到鼻子的说"大象像绳子"。每个人都没错，但每个人都只抓住了一部分真相。只有把所有人的发现**汇总**，才能拼出一头完整的大象。

Multi-Head Attention 就是**同时派出多个"观察员"，每人从不同角度看同一段文本**，最后把各自的发现拼起来，交给一个"裁判"做综合判断。

## 详细解析

### 一、为什么一个注意力头不够？

单头注意力只有一组 Q/K/V 参数，它被迫把所有信息——语法关系、语义关联、位置远近——全塞进同一次"打分"里。就好比让一个人同时当语文老师、数学老师和体育老师，啥都干但啥都干不精。

实验也证实了这一点：如果你可视化单头注意力的权重矩阵，会发现它倾向于只关注某一种模式（比如总是盯着前一个词），而忽略其他重要关系。

**所以核心动机是**：让不同的参数组专注于不同类型的关系，分工合作。

### 二、多头是怎么实现的？——不是"跑多遍"，而是"切开跑"

很多人第一反应是：多头 = 把同样的注意力运算跑 8 遍？那岂不是 8 倍计算量？

不是的。真正的做法是**把维度切开**：

假设 `d_model = 512`，`num_heads = 8`：
- 每个头分到 `d_k = d_v = 512 / 8 = 64` 维
- 对应的 W_Q、W_K、W_V 矩阵分别是 `512 × 64`（每个头各一套，共 8 套）
- 等价于一个大矩阵 `512 × 512` 做完投影后 reshape 成 8 个 64 维的小向量

**关键理解**：总计算量和单头 512 维几乎一样！只是把"一个 512 维的大注意力"拆成了"8 个 64 维的小注意力"。每个小注意力用不同的参数，所以能学到不同的东西。

### 三、每个头到底学到了什么不同的东西？

研究者们可视化了训练好的 Transformer 各头的注意力权重（参考 Attention Is All You Need 原论文附录，以及后续 Clark et al. 2019 的分析），发现：

| 头的类型 | 关注什么 | 具体表现 |
|---------|---------|---------|
| **语法头** | 主谓搭配、修饰关系 | "小猫**吃**了鱼"中，"吃"会强烈关注"小猫"（主语）和"鱼"（宾语） |
| **语义头** | 近义词、共指关系 | "他很**开心**，心情非常**好**"中，"开心"和"好"互相关注 |
| **位置头** | 相邻词、固定距离 | 几乎总是关注前一个词或后一个词，像个"局部窗口" |
| **全局头** | 特殊 token | 总是盯着 [CLS] 或句号等"汇总位置" |

这就是多头的魅力：**不是人为设计每个头该干嘛，而是模型自己学出了分工**。

### 四、Concat + W_O：把"各抒己见"变成"统一结论"

8 个头各自算出一个 `[seq_len, 64]` 的结果，拼接（Concat）起来变回 `[seq_len, 512]`——维度回到 d_model。

但直接拼接只是"各说各的"。后面接的线性投影 W_O（`512 × 512`）起到了**"融合裁判"**的作用：

- 它可以决定哪个头的发现更重要（给更大权重）
- 它可以把不同头发现的信息交叉组合（比如语法头和语义头的发现融合）
- 它保证最终输出的维度和输入一致，方便残差连接

**一句话总结**：Concat 只是物理拼接，W_O 才是真正的"综合研判"。

### 五、MQA 和 GQA：后来为什么要"共享 K/V"？

标准 Multi-Head Attention 每个头各有一套 Q、K、V。但在**推理阶段**，K 和 V 需要缓存起来（KV Cache），8 个头就要存 8 份。当模型大到 70B、序列长到 32K 时，KV Cache 直接吃掉几十 GB 显存。

这就好比**8 个人开会，每人各带一份会议纪要**——重复且浪费。于是就有人提出：

| 方案 | 全称 | 核心思想 | 比喻 |
|------|------|---------|------|
| **MHA** | Multi-Head Attention | 每个头独立的 Q/K/V | 每人自己记笔记 |
| **MQA** | Multi-Query Attention | 所有头共享同一份 K/V，只有 Q 不同 | 大家只看同一份会议纪要，但各自提不同的问题 |
| **GQA** | Grouped-Query Attention | 把头分成几组，每组共享一份 K/V | 每个小组共用一份纪要，组间不同 |

**MQA**（Shazeer 2019）把 KV Cache 缩小到 1/h，推理速度飙升，但质量有轻微下降。**GQA**（Ainslie et al. 2023）是折中方案——比如 8 个头分 2 组，每组 4 个头共享 K/V，Cache 缩小到 1/4，质量几乎无损。LLaMA 2/3、Mistral 等主流模型都采用了 GQA。

### 六、从零实现完整的 MultiHeadAttention

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class MultiHeadAttention(nn.Module):
    """
    从零实现 Multi-Head Attention（含 MHA / MQA / GQA 三种模式）
    """

    def __init__(self, d_model: int, num_heads: int, num_kv_heads: int | None = None):
        """
        d_model:      模型总维度，比如 512
        num_heads:    Query 的头数，比如 8
        num_kv_heads: K/V 的头数（None=MHA, 1=MQA, 其他=GQA）
        """
        super().__init__()
        self.d_model = d_model        # 总维度：512
        self.num_heads = num_heads     # Q 的头数：8
        # 如果没指定 KV 头数，默认和 Q 一样（标准 MHA）
        self.num_kv_heads = num_kv_heads or num_heads
        self.d_k = d_model // num_heads  # 每个头的维度：512 // 8 = 64
        # 每个 KV 头要服务几个 Q 头（GQA 的关键参数）
        self.num_queries_per_kv = num_heads // self.num_kv_heads

        # ──── 架构图第①步：线性投影，生成 Q/K/V ────
        # W_Q: [512, 512]  每个头 64 维 × 8 个头
        self.w_q = nn.Linear(d_model, num_heads * self.d_k, bias=False)
        # W_K: [512, num_kv_heads × 64]  MHA 时是 512，MQA 时只有 64
        self.w_k = nn.Linear(d_model, self.num_kv_heads * self.d_k, bias=False)
        # W_V: 和 W_K 同样大小
        self.w_v = nn.Linear(d_model, self.num_kv_heads * self.d_k, bias=False)
        # ──── 架构图第⑤步：输出投影 W_O ────
        # 把拼接后的 512 维映射回 512 维
        self.w_o = nn.Linear(num_heads * self.d_k, d_model, bias=False)

    def forward(
        self,
        x: torch.Tensor,
        mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        batch, seq_len, _ = x.shape  # 比如 [2, 10, 512]

        # ──── 架构图第①步：线性投影 ────
        # q: [2, 10, 512] -> [2, 10, 512]（8 个头 × 64 维）
        q = self.w_q(x)
        # k: [2, 10, 512] -> [2, 10, num_kv_heads×64]
        k = self.w_k(x)
        # v: 和 k 同 shape
        v = self.w_v(x)

        # ──── 架构图第②步：reshape 拆出多个头 ────
        # q: [2, 10, 512] -> [2, 10, 8, 64] -> [2, 8, 10, 64]
        #    含义：batch × 头数 × 序列长度 × 每头维度
        q = q.view(batch, seq_len, self.num_heads, self.d_k).transpose(1, 2)
        # k: [2, 10, kv_heads×64] -> [2, 10, kv_heads, 64] -> [2, kv_heads, 10, 64]
        k = k.view(batch, seq_len, self.num_kv_heads, self.d_k).transpose(1, 2)
        v = v.view(batch, seq_len, self.num_kv_heads, self.d_k).transpose(1, 2)

        # ──── GQA/MQA 时：把 K/V 扩展到和 Q 一样的头数 ────
        # 比如 GQA: kv_heads=2, num_heads=8, 每份 KV 要复制给 4 个 Q 头
        if self.num_kv_heads != self.num_heads:
            # [2, 2, 10, 64] -> [2, 2, 1, 10, 64] -> [2, 2, 4, 10, 64] -> [2, 8, 10, 64]
            k = k.unsqueeze(2).expand(
                -1, -1, self.num_queries_per_kv, -1, -1
            ).reshape(batch, self.num_heads, seq_len, self.d_k)
            v = v.unsqueeze(2).expand(
                -1, -1, self.num_queries_per_kv, -1, -1
            ).reshape(batch, self.num_heads, seq_len, self.d_k)

        # ──── 架构图第③步：计算缩放点积注意力 ────
        # scores: [2, 8, 10, 64] × [2, 8, 64, 10] -> [2, 8, 10, 10]
        #         每个头内，每对词之间的匹配分数
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_k)

        # 如果有掩码（比如因果掩码），把不该看到的位置设成 -inf
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))

        # softmax 归一化：每行的分数加起来 = 1
        attn_weights = F.softmax(scores, dim=-1)  # [2, 8, 10, 10]

        # ──── 架构图第④步：加权求和 Value ────
        # [2, 8, 10, 10] × [2, 8, 10, 64] -> [2, 8, 10, 64]
        attn_output = torch.matmul(attn_weights, v)

        # ──── 架构图第⑤步：拼接所有头 + 输出投影 ────
        # [2, 8, 10, 64] -> [2, 10, 8, 64] -> [2, 10, 512]  （8头×64维 = 512维）
        attn_output = attn_output.transpose(1, 2).contiguous().view(
            batch, seq_len, self.d_model
        )
        # W_O 做融合投影：[2, 10, 512] -> [2, 10, 512]
        return self.w_o(attn_output)


# ──────────── 验证三种模式 ────────────
if __name__ == "__main__":
    batch, seq_len, d_model = 2, 10, 512

    x = torch.randn(batch, seq_len, d_model)

    # 标准 MHA：8 个头，每个头独立的 K/V
    mha = MultiHeadAttention(d_model=512, num_heads=8)
    out_mha = mha(x)
    print(f"MHA  输出: {out_mha.shape}")   # [2, 10, 512]

    # MQA：8 个 Q 头共享 1 份 K/V，KV Cache 缩小 8 倍
    mqa = MultiHeadAttention(d_model=512, num_heads=8, num_kv_heads=1)
    out_mqa = mqa(x)
    print(f"MQA  输出: {out_mqa.shape}")   # [2, 10, 512]

    # GQA：8 个 Q 头分 2 组，每组共享 1 份 K/V，Cache 缩小 4 倍
    gqa = MultiHeadAttention(d_model=512, num_heads=8, num_kv_heads=2)
    out_gqa = gqa(x)
    print(f"GQA  输出: {out_gqa.shape}")   # [2, 10, 512]

    # 对比参数量：MQA 和 GQA 的 K/V 参数明显更少
    for name, model in [("MHA", mha), ("MQA", mqa), ("GQA", gqa)]:
        total = sum(p.numel() for p in model.parameters())
        print(f"{name} 参数量: {total:,}")
```

**运行说明**：`pip install torch` 后直接运行，会打印三种模式的输出 shape 和参数量对比。

## 面试追问

- **追问 1（原理）**：Multi-Head Attention 的计算量比单头 Attention 大吗？为什么？——答：几乎一样。每个头只操作 d_k = d_model/h 维，h 个头加起来等价于操作 d_model 维。多头不增加计算量，只增加"表达能力"。
- **追问 2（应用）**：实际部署时 GQA 比 MHA 能快多少？主要省在哪？——答：GQA 主要省 KV Cache 的显存。比如 LLaMA-2 70B 用 GQA（8 组共 64 头），KV Cache 缩小到 MHA 的 1/8，长序列推理吞吐量提升 30-50%。
- **追问 3（对比）**：MQA 质量为啥会下降？GQA 怎么缓解的？——答：MQA 所有头共享同一份 K/V，相当于"所有观察员看同一份资料"，表达能力受限。GQA 让每组有不同的 K/V，在显存和质量之间取得平衡。
- **追问 4（边界）**：如果 num_heads 设得特别大（比如 128）而 d_model 不变，会怎样？——答：每个头的 d_k 会变得很小（比如 4 维），导致每个头的表达能力不足，注意力分数的区分度下降，整体效果反而变差。

## 常见误区

- **误区 1**：以为多头注意力计算量是单头的 h 倍——错。每个头只处理 d_model/h 维，总量不变。
- **误区 2**：以为每个头"被分配了"具体任务（比如"你负责语法"）——错。分工是模型自己学出来的，不是人为指定的。
- **误区 3**：把 MQA 理解成"只有一个头"——错。Q 仍然有 h 个头（保持多样性），只是 K/V 共享了。
- **误区 4**：忘了 W_O 的存在——很多人讲多头注意力只说到 Concat 就结束了，但 W_O 才是把各头信息"融合"的关键步骤。
- **误区 5**：以为 GQA 只是"MHA 和 MQA 的折中"——GQA 实际上是一个统一框架：`num_kv_heads = num_heads` 就是 MHA，`num_kv_heads = 1` 就是 MQA。

# Transformer 深度拆解（四）：位置编码——怎么告诉模型"谁在前谁在后"

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [位置编码, Sinusoidal, RoPE, ALiBi, 旋转位置编码]

## 核心概念

"猫吃鱼"和"鱼吃猫"，对人类来说意思完全不同。但是对于 Self-Attention 来说——它只看每对词之间的**相似度**，完全不关心**谁先谁后**。把输入打乱顺序，注意力的结果一模一样。

这就好比你把一副扑克牌摊在桌上，不管你怎么排列，只要牌是那几张，每张牌之间的"花色差异"不会变。Attention 天生就是一个**集合运算**，不是**序列运算**。

所以必须额外注入位置信息。怎么注入？这就是位置编码要解决的问题。三种主流方案：**正弦余弦（经典）**、**RoPE（当前主流）**、**ALiBi（最简约）**。

## 详细解析

### 一、正弦/余弦位置编码——"时钟指针"方案

这是 Transformer 原论文提出的方法。核心思想用一句话概括：**用不同频率的正弦波叠加来表示位置，就像用时针、分针、秒针叠加来唯一表示时间**。

秒针转一圈 = 1 分钟（高频），分针转一圈 = 1 小时（中频），时针转一圈 = 12 小时（低频）。虽然每根指针都只是在 0~360° 转圈，但三根指针的组合可以唯一确定任何一个时间点。

**公式拆解**：

$$PE(pos, 2i) = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$
$$PE(pos, 2i+1) = \cos\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

- `pos`：词在序列中的位置（0, 1, 2, ...）
- `i`：维度的编号（0, 1, 2, ... d_model/2-1）
- `10000^(2i/d_model)`：频率控制项。i 越大，分母越大，频率越低

**为什么这么设计？**

1. **每个位置的编码唯一**：不同频率的 sin/cos 叠加，像"指纹"一样不会重复
2. **相对位置可以通过线性变换得到**：`PE(pos+k)` 可以写成 `PE(pos)` 的线性组合（三角函数和角公式），这意味着模型有可能学会"往前/往后看 k 步"
3. **值域有界**：sin/cos 的值永远在 [-1, 1]，不会随位置增大而爆炸

**缺点**：是加在输入上的固定值，训练时位置最多到 512，推理时遇到 1024 长度就没见过，**外推能力差**。

### 二、RoPE 旋转位置编码——"转盘"方案

RoPE（Rotary Position Embedding，Su et al. 2021）是当前大模型的主流选择。GPT-NeoX、LLaMA 1/2/3、Qwen、Mistral 全都用它。

**核心思想**：不在输入上加位置信息，而是**在计算 Q·K 的时候，把位置信息"旋转"进去**。

#### "转盘"比喻

想象一个巨大的转盘，上面标着刻度。第 1 个词站在 0° 的位置，第 2 个词站在 θ° 的位置，第 3 个词站在 2θ° 的位置……以此类推。

两个词的"相对距离"就等于它们之间的"旋转角度差"。无论第 1 个词站在 0° 还是 100°，只要两个词之间隔了 3 个位置，角度差就是 3θ——**相对位置只取决于距离，不取决于绝对位置**。

#### 数学直觉

RoPE 把每个向量的相邻两维看成一个二维平面上的点 (x₁, x₂)，然后用位置 pos 对应的角度 θ·pos 做旋转：

$$\begin{pmatrix} x_1' \\ x_2' \end{pmatrix} = \begin{pmatrix} \cos(m\theta) & -\sin(m\theta) \\ \sin(m\theta) & \cos(m\theta) \end{pmatrix} \begin{pmatrix} x_1 \\ x_2 \end{pmatrix}$$

其中 m 是位置编号，θ 跟维度相关（低维转得快，高维转得慢，和正弦编码的频率分布思路一致）。

**关键性质**：旋转后的 Q 和 K 做点积，结果**只依赖相对位置 (m-n)**，不依赖绝对位置 m 和 n。这就是 RoPE 的"旋转不变性"。

**为什么比绝对位置编码更好？**
1. **天然编码相对位置**：点积结果自动只跟距离有关
2. **外推能力更强**：训练时见过 4096 长度，推理时 8192 也能相对平稳（再配合 NTK-aware scaling 或 YaRN 可以外推到更长）
3. **不占额外参数**：旋转角度是预计算的常量，不需要可学习参数

### 三、ALiBi——"距离罚分"方案

ALiBi（Attention with Linear Biases，Press et al. 2022）是三种方案中最简单的。

**核心思想一句话**：离得越远，注意力分数扣分越多。

$$\text{Attention}(Q, K) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}} + m \cdot \text{bias}\right)$$

其中 bias 是一个预定义的矩阵，`bias[i][j] = -|i - j|`（两个位置之间的距离取负），m 是每个头不同的斜率系数。

**举个直白的例子**：假设有 4 个词，某个头的斜率 m = 0.5

|  | 词0 | 词1 | 词2 | 词3 |
|--|-----|-----|-----|-----|
| 词0 | 0 | -0.5 | -1.0 | -1.5 |
| 词1 | -0.5 | 0 | -0.5 | -1.0 |
| 词2 | -1.0 | -0.5 | 0 | -0.5 |
| 词3 | -1.5 | -1.0 | -0.5 | 0 |

距离越远，罚分越重。不同头用不同的斜率——有的头"视力好"（斜率小，远处也能看到），有的头"近视"（斜率大，只关注附近的词）。

**优点**：实现极其简单，不需要额外的位置向量，不占参数；外推能力在一定范围内不错。

**缺点**：对相对位置的建模是线性衰减，不够灵活；在特别长的序列上表现不如 RoPE + 长度扩展。

### 四、三种方案对比

| 特性 | 正弦/余弦 | RoPE | ALiBi |
|------|----------|------|-------|
| **编码方式** | 加在输入 embedding 上 | 旋转 Q 和 K 向量 | 在注意力分数上加偏置 |
| **可学习参数** | 无 | 无 | 无（斜率是预设的） |
| **相对位置建模** | 间接（需模型自己学） | 天然（点积只含相对位置） | 天然（偏置就是距离） |
| **外推能力** | 差（超过训练长度崩坏） | 较好（配合 scaling 更强） | 较好（线性衰减天然可推） |
| **计算开销** | 低（预计算一次） | 低（逐元素旋转） | 极低（加一个常量矩阵） |
| **代表模型** | 原版 Transformer、BERT | LLaMA、Qwen、Mistral | BLOOM、MPT |
| **当前主流度** | ★☆☆ 经典但已淘汰 | ★★★ 绝对主流 | ★★☆ 小众但仍有采用 |

### 五、完整代码实现

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ════════════════════════════════════════
# 方案一：正弦/余弦位置编码（Vaswani et al. 2017）
# ════════════════════════════════════════

class SinusoidalPositionalEncoding(nn.Module):
    """
    经典正弦余弦位置编码，直接加到 token embedding 上。
    """

    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        # pe: [max_len, d_model]，预计算所有位置的编码
        pe = torch.zeros(max_len, d_model)

        # position: [max_len, 1]，每个位置的编号 0,1,2,...
        position = torch.arange(0, max_len).unsqueeze(1).float()

        # div_term: 频率控制项，对应公式里的 10000^(2i/d_model)
        # 用 exp + log 计算避免大数溢出
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )

        # 偶数维度用 sin，奇数维度用 cos
        pe[:, 0::2] = torch.sin(position * div_term)  # "秒针"到"时针"，频率从高到低
        pe[:, 1::2] = torch.cos(position * div_term)

        # 注册为 buffer（不参与梯度更新，但会随模型保存/加载）
        # 增加 batch 维度：[1, max_len, d_model]
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [batch, seq_len, d_model]
        seq_len = x.size(1)
        # 直接加上对应长度的位置编码
        return x + self.pe[:, :seq_len, :]


# ════════════════════════════════════════
# 方案二：RoPE 旋转位置编码（Su et al. 2021）
# ════════════════════════════════════════

def precompute_rope_freqs(d_k: int, max_len: int = 4096, base: float = 10000.0):
    """
    预计算 RoPE 所需的旋转频率。
    返回 cos 和 sin 缓存，shape: [max_len, d_k]
    """
    # 每对维度的频率：θ_i = 1 / (base^(2i/d_k))
    # 低维频率高（转得快），高维频率低（转得慢）
    freqs = 1.0 / (base ** (torch.arange(0, d_k, 2).float() / d_k))
    # 每个位置乘以对应频率得到旋转角度
    # positions: [max_len]，freqs: [d_k/2]
    # outer product -> [max_len, d_k/2]
    positions = torch.arange(max_len).float()
    angles = torch.outer(positions, freqs)  # 位置 m × 频率 θ = 旋转角度
    # 每对维度的 cos 和 sin，重复一次凑齐 d_k 维
    cos_cached = torch.cos(angles).repeat(1, 2)  # [max_len, d_k]
    sin_cached = torch.sin(angles).repeat(1, 2)  # [max_len, d_k]
    return cos_cached, sin_cached


def rotate_half(x: torch.Tensor) -> torch.Tensor:
    """
    把向量的前半和后半交换并取负，实现二维旋转的核心操作。
    [x1, x2, x3, x4] -> [-x3, -x4, x1, x2]
    """
    d = x.shape[-1]
    x1 = x[..., : d // 2]   # 前半部分
    x2 = x[..., d // 2 :]   # 后半部分
    return torch.cat([-x2, x1], dim=-1)


def apply_rope(
    q: torch.Tensor,
    k: torch.Tensor,
    cos: torch.Tensor,
    sin: torch.Tensor,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    对 Q 和 K 施加旋转位置编码。
    q, k: [batch, num_heads, seq_len, d_k]
    cos, sin: [seq_len, d_k]（从预计算缓存中截取）

    旋转公式：q' = q * cos + rotate_half(q) * sin
    """
    seq_len = q.size(2)
    # 截取对应长度的 cos/sin，并广播到 [1, 1, seq_len, d_k]
    cos = cos[:seq_len].unsqueeze(0).unsqueeze(0)
    sin = sin[:seq_len].unsqueeze(0).unsqueeze(0)
    # 对 Q 旋转：原向量 × cos + 旋转交换向量 × sin
    q_rotated = q * cos + rotate_half(q) * sin
    # 对 K 做同样的旋转
    k_rotated = k * cos + rotate_half(k) * sin
    return q_rotated, k_rotated


# ════════════════════════════════════════
# 方案三：ALiBi（Press et al. 2022）
# ════════════════════════════════════════

def build_alibi_bias(num_heads: int, max_len: int) -> torch.Tensor:
    """
    构建 ALiBi 偏置矩阵。
    返回: [num_heads, max_len, max_len]
    """
    # 每个头的斜率：几何级数，从 2^(-8/n) 到 2^(-8)
    # 头越多，斜率分布越密；不同头"视野距离"不同
    slopes = torch.tensor([
        2 ** (-8 * i / num_heads) for i in range(1, num_heads + 1)
    ])

    # 距离矩阵：|i - j|
    positions = torch.arange(max_len)
    # [max_len, max_len]，每个元素是两个位置之间的距离
    distance = (positions.unsqueeze(0) - positions.unsqueeze(1)).abs().float()

    # 距离取负（越远惩罚越大），乘以每个头各自的斜率
    # slopes: [num_heads, 1, 1]  distance: [1, max_len, max_len]
    bias = -distance.unsqueeze(0) * slopes.view(-1, 1, 1)
    return bias  # [num_heads, max_len, max_len]


# ════════════════════════════════════════
# 完整验证：三种编码各跑一遍
# ════════════════════════════════════════

if __name__ == "__main__":
    batch, seq_len, d_model, num_heads = 2, 10, 64, 4
    d_k = d_model // num_heads  # 每个头 16 维

    x = torch.randn(batch, seq_len, d_model)

    # ---- 测试正弦余弦编码 ----
    sin_pe = SinusoidalPositionalEncoding(d_model, max_len=100)
    x_with_pos = sin_pe(x)
    print(f"正弦余弦编码后: {x_with_pos.shape}")  # [2, 10, 64]
    # 验证不同位置的编码确实不同
    print(f"位置0和位置1的编码差异: {(sin_pe.pe[0, 0] - sin_pe.pe[0, 1]).norm():.4f}")

    # ---- 测试 RoPE ----
    cos_cache, sin_cache = precompute_rope_freqs(d_k, max_len=100)
    # 模拟已经投影好的 Q 和 K
    q = torch.randn(batch, num_heads, seq_len, d_k)
    k = torch.randn(batch, num_heads, seq_len, d_k)
    q_rot, k_rot = apply_rope(q, k, cos_cache, sin_cache)
    print(f"RoPE 旋转后 Q: {q_rot.shape}")  # [2, 4, 10, 16]
    # 验证旋转不改变向量的模长（旋转矩阵是正交的）
    print(f"旋转前后 Q 模长变化: {(q.norm(dim=-1) - q_rot.norm(dim=-1)).abs().max():.6f}")

    # ---- 测试 ALiBi ----
    alibi = build_alibi_bias(num_heads, seq_len)
    print(f"ALiBi 偏置矩阵: {alibi.shape}")  # [4, 10, 10]
    print(f"ALiBi 第1个头，位置0看位置9的惩罚: {alibi[0, 0, 9]:.4f}")

    # ---- 展示 ALiBi 如何融入注意力计算 ----
    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)
    # ALiBi：直接把距离惩罚加到注意力分数上
    scores_with_alibi = scores + alibi.unsqueeze(0)  # 广播 batch 维
    attn = F.softmax(scores_with_alibi, dim=-1)
    print(f"带 ALiBi 的注意力权重: {attn.shape}")  # [2, 4, 10, 10]
```

**运行说明**：`pip install torch` 后直接运行。会依次演示三种位置编码的效果，验证 shape 正确性、RoPE 的模长守恒性质和 ALiBi 的距离惩罚机制。

## 面试追问

- **追问 1（原理）**：正弦余弦编码为什么能表示"相对位置"？——答：因为 sin(a+b) 可以用 sin(a)cos(b) + cos(a)sin(b) 展开，所以 PE(pos+k) 是 PE(pos) 的线性组合，系数只跟 k 有关。模型可以通过学习线性变换来提取相对位置。
- **追问 2（应用）**：LLaMA 用 RoPE 训练了 4K 长度，怎么推理 32K？——答：用长度外推技术。常见方案有 NTK-aware 插值（调整 base 频率）和 YaRN（同时调频率和缩放注意力 softmax 的温度），在不重新训练的情况下将 RoPE 扩展到更长序列。
- **追问 3（对比）**：ALiBi 和 RoPE 在超长序列上谁更好？——答：RoPE + 长度扩展通常更好，因为它编码了更丰富的相对位置信息（通过旋转几何）。ALiBi 的线性衰减过于简单，在极长序列上区分度不够。但 ALiBi 胜在实现简单、零额外开销。
- **追问 4（边界）**：如果把位置编码去掉会怎样？——答：对于纯分类任务（如情感分析）影响不大，因为语义信息比顺序更重要。但对于生成任务和需要理解语序的任务（如翻译、问答），性能会严重下降——"猫吃鱼"和"鱼吃猫"就分不清了。

## 常见误区

- **误区 1**：以为正弦余弦编码是"可学习的"——错。它是预计算的固定值，不参与梯度更新。（BERT 那种是可学习的位置 embedding，和正弦方案不同。）
- **误区 2**：以为 RoPE 是加在 embedding 上的——错。RoPE 作用在 Q 和 K 上（经过线性投影之后），不改变输入 embedding，也不影响 V。
- **误区 3**：以为 ALiBi 给每个头用一样的斜率——错。ALiBi 的精髓就在于不同头用不同斜率，让模型同时拥有"近视眼"和"远视眼"。
- **误区 4**：认为 RoPE 天然能处理无限长序列——错。虽然 RoPE 比绝对位置编码外推能力强，但直接外推到远超训练长度时性能仍会下降，需要配合 NTK scaling 或 YaRN 等技术。
- **误区 5**：混淆"位置编码"和"位置嵌入"——正弦余弦和 ALiBi 都不需要可学习参数（是编码/偏置），而 BERT 的位置嵌入是可学习的参数矩阵，两者机制不同。

# Transformer 深度拆解（五）：FFN 和归一化——每个词的"独立深加工"

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [FFN, SwiGLU, LayerNorm, RMSNorm, Pre-LN, Post-LN, 残差连接, 激活函数]

## 核心概念

如果说 Attention 是"开会"，那 FFN 就是"回工位干活"。

Attention 解决的是 token 之间的通信问题——"我应该关注谁？"。但光开会不干活没用，每个 token 还需要**独立地**对收集到的信息做深度加工。这就是 FFN（Feed-Forward Network，前馈网络）的活。

归一化（Normalization）和残差连接则是让这台"深加工机器"能稳定运行几十上百层的关键零件。没有它们，深层 Transformer 根本训不动。

## 详细解析

### 一、FFN 在 Transformer 里扮演什么角色？

打个比方：你参加一个头脑风暴会议（Attention），大家各抒己见，你收集了一大堆信息。然后你回到自己的工位（FFN），独立消化、归纳、整理这些信息，形成自己的结论。

关键点：**FFN 对每个 token 独立施加完全相同的操作**。也就是说，位置 1 的 token 和位置 100 的 token 用的是同一套网络参数，但彼此之间完全不交流。这跟 Attention 恰好互补：

| | Attention | FFN |
|--|-----------|-----|
| 作用 | token 间信息路由 | token 自身特征变换 |
| 比喻 | 开会交流 | 回工位独立干活 |
| 交互范围 | 所有 token | 仅当前 token |
| 参数共享 | 同一层内 Q/K/V 共享 | 同一层内对所有位置共享 |

有研究表明，FFN 层实际上承担了"知识记忆"的角色——模型在训练中学到的事实性知识，很大一部分存储在 FFN 的权重里。Attention 更像是"检索机制"，FFN 更像是"知识库"。

### 二、FFN 的结构：升维→激活→降维

标准 FFN 结构非常简洁：两层线性变换，中间夹一个激活函数。

```
输入 (d_model) → 线性层1 (d_model → d_ff) → 激活函数 → 线性层2 (d_ff → d_model) → 输出
```

其中 `d_ff` 通常是 `d_model` 的 4 倍。比如 `d_model=768`，那 `d_ff=3072`。

**为什么要先升维再降维？**

把它想象成"解压缩-处理-再压缩"：

- `d_model` 维度是信息的**压缩表示**，方便在层间传递
- 升维到 `d_ff` 相当于把压缩包解压开，在更大的空间里做非线性变换，能捕捉更复杂的特征模式
- 降维回 `d_model` 相当于重新压缩，保持维度一致以便残差连接和下一层处理

如果不升维，就好比你在一张小纸条上做复杂运算——空间不够，表达能力受限。

### 三、激活函数的演进：从 ReLU 到 SwiGLU

激活函数是 FFN 的灵魂——没有它，两层线性变换叠加还是线性变换，等于白叠。

**ReLU：简单粗暴的"门卫"**

```
ReLU(x) = max(0, x)
```

负数直接归零，正数原样放过。问题：负数区域梯度直接为 0（"神经元死亡"），一旦某个神经元落入负区域，就永远学不回来了。

**GELU：更温柔的"概率门卫"**

```
GELU(x) = x · Φ(x)    # Φ 是标准正态分布的累积分布函数
```

不再是非 0 即 1 的硬切，而是用概率来决定"放行多少"。负数不完全归零，而是保留一小部分——就像门卫不把人直接轰走，而是说"你可以进来，但只能在门口站着"。BERT 和早期 GPT 使用。

**SiLU / Swish：平滑的"弹性门卫"**

```
SiLU(x) = x · σ(x)    # σ 是 sigmoid 函数
```

跟 GELU 思路类似，但计算更简单。处处可微，负值区域有一个小小的负峰值，这对优化有帮助。

**SwiGLU：目前大模型的主流选择**

```
SwiGLU(x) = SiLU(W₁x) ⊙ (W₃x)    # ⊙ 是逐元素乘法
```

SwiGLU 引入了**门控机制**——它用两组权重分别计算一个"信号"和一个"门"，然后让门来控制信号哪些部分可以通过。就像你写邮件时：一个版本是正文内容（信号），另一个版本标出"哪些该发、哪些该删"（门），最终发出去的是两者的结合。

为什么 SwiGLU 成为主流（LLaMA、PaLM、Qwen 等都在用）：
- 门控让模型可以**选择性地激活特征**，比固定的激活函数更灵活
- 虽然多了一组参数 W₃，但效果提升明显
- 实际中为了保持计算量不变，会把 `d_ff` 从 `4 × d_model` 调整为 `8/3 × d_model`

### 四、LayerNorm vs BatchNorm："自己跟自己比"vs"全班统一标准"

**BatchNorm（BN）：全班统一评分标准**

BN 的逻辑是：一个 mini-batch 里所有样本的同一个特征维度做归一化。好比老师把全班同学的数学成绩收上来，算个平均分和标准差，然后每个人的分数减去平均分再除以标准差。

问题：NLP 任务中每个句子长度不同，batch 里的 token 数量参差不齐，BN 统计不稳定。而且推理时 batch size 可能为 1，BN 需要的"全班统计量"根本没法算。

**LayerNorm（LN）：每个人自己跟自己比**

LN 的逻辑完全不同：**不管别的样本，只看自己这一个 token 的所有特征维度**。就像每个学生不跟别人比，而是把自己的语数英物化生成绩统一拉到"均值 0、标准差 1"的标准。

为什么 NLP 用 LN 更好：
- 不依赖 batch 大小，推理时 batch=1 也完全没问题
- 序列长度可变也不影响——每个 token 独立归一化
- 训练更稳定，Transformer 全靠它

### 五、RMSNorm：只看波动，不管平均水平

LayerNorm 做两件事：减均值（中心化）+ 除标准差（缩放）。

RMSNorm 的想法很激进：**减均值这一步其实没那么重要，去掉它！** 只保留除以 RMS（均方根）的操作。

```
RMSNorm(x) = x / RMS(x) · γ

其中 RMS(x) = √(mean(x²))
```

比喻：LayerNorm 是"先把所有人的成绩调到以 0 分为中心，再统一缩放"；RMSNorm 是"不管平均分是多少，只看大家成绩的波动幅度，然后缩放"。

为什么大模型爱用 RMSNorm：
- 省掉了计算均值和减均值的步骤，**计算量少了约 20-30%**
- 实验表明效果跟 LayerNorm 几乎一样
- LLaMA、Qwen、Mistral 等主流模型全在用

### 六、Pre-LN vs Post-LN：归一化放在哪里？

这是 Transformer 架构中一个关键的设计选择。

**Post-LN（原始 Transformer 的做法）**：

```
x → Attention → Add(x, ·) → LayerNorm → FFN → Add(·, ·) → LayerNorm → 输出
     子层计算       残差连接     后归一化
```

**Pre-LN（现代模型的主流做法）**：

```
x → LayerNorm → Attention → Add(x, ·) → LayerNorm → FFN → Add(·, ·) → 输出
     先归一化      子层计算      残差连接
```

**为什么 Pre-LN 训练更稳定？**

Post-LN 的问题：残差连接加的是未归一化的输出，随着层数加深，数值范围可能越来越大，导致靠近输入的层梯度爆炸或消失。原始论文需要精心设计 learning rate warmup 才能训起来。

Pre-LN 的优势：先归一化再做子层计算，确保每一层的输入都在合理范围内。残差连接的通路是"干净的"——梯度可以无阻碍地直接回传。代价是最终输出可能需要额外加一层 LayerNorm。

现在几乎所有大模型都用 Pre-LN（或 Pre-RMSNorm）。

### 七、残差连接的数学直觉

残差连接的公式简单得令人起疑：`output = x + sublayer(x)`

**为什么这么有效？看梯度！**

假设第 L 层的输出是 `x_L = x_{L-1} + F(x_{L-1})`，那么损失对 `x_{L-1}` 的梯度是：

```
∂Loss/∂x_{L-1} = ∂Loss/∂x_L · (1 + ∂F/∂x_{L-1})
```

那个 **"1"** 就是残差连接的魔法！不管 `∂F/∂x_{L-1}` 多小甚至趋近于 0，梯度都至少有个 "1" 保底——相当于给梯度开了一条**高速公路**，可以直通几十层毫无障碍。

没有残差连接时，梯度要经过每一层的链式乘法，稍有一层梯度小于 1，连乘下来就指数衰减（梯度消失）。残差连接把乘法变成了加法——这就是为什么 100 多层的 Transformer 能训得动。

## 示例代码

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class SwiGLU(nn.Module):
    """SwiGLU 激活函数——目前大模型 FFN 的主流选择"""

    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        # W1: 生成"信号"的权重
        self.w1 = nn.Linear(d_model, d_ff, bias=False)
        # W3: 生成"门控"的权重
        self.w3 = nn.Linear(d_model, d_ff, bias=False)
        # W2: 降维回 d_model
        self.w2 = nn.Linear(d_ff, d_model, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # SiLU(W1·x) ⊙ (W3·x)：信号经过 SiLU 激活后与门控相乘
        gate = F.silu(self.w1(x))  # 信号分支：过 SiLU 激活
        up = self.w3(x)            # 门控分支：线性变换
        return self.w2(gate * up)  # 逐元素相乘后降维


class StandardFFN(nn.Module):
    """标准 FFN（用于对比）：升维 → ReLU → 降维"""

    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        self.w1 = nn.Linear(d_model, d_ff)    # 升维：d_model → d_ff
        self.w2 = nn.Linear(d_ff, d_model)    # 降维：d_ff → d_model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.w2(F.relu(self.w1(x)))    # 升维 → ReLU → 降维


class RMSNorm(nn.Module):
    """RMSNorm：只看波动大小的归一化，比 LayerNorm 更快"""

    def __init__(self, d_model: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps                             # 防止除零的小常数
        self.weight = nn.Parameter(torch.ones(d_model))  # 可学习的缩放参数 γ

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 计算 RMS：所有特征维度上的均方根
        rms = torch.sqrt(x.pow(2).mean(dim=-1, keepdim=True) + self.eps)
        # x / RMS(x) * γ：缩放到标准范围后乘以可学习参数
        return x / rms * self.weight


class TransformerBlock(nn.Module):
    """
    完整的 Transformer Block（Pre-RMSNorm 风格）

    数据流向：
    x → RMSNorm → MultiHeadAttention → 残差连接(+x)
      → RMSNorm → SwiGLU FFN         → 残差连接(+x)
      → 输出
    """

    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        # 两个 RMSNorm 分别用于 Attention 和 FFN 之前
        self.norm1 = RMSNorm(d_model)
        self.norm2 = RMSNorm(d_model)
        # 标准多头注意力
        self.attn = nn.MultiheadAttention(
            embed_dim=d_model,
            num_heads=n_heads,
            dropout=dropout,
            batch_first=True,  # 输入形状 (batch, seq_len, d_model)
        )
        # SwiGLU FFN
        self.ffn = SwiGLU(d_model, d_ff)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x: torch.Tensor,
        attn_mask: torch.Tensor = None,
    ) -> torch.Tensor:
        # ===== Pre-Norm + Attention + 残差连接 =====
        normed = self.norm1(x)                 # 先归一化
        attn_out, _ = self.attn(               # 多头注意力
            normed, normed, normed,
            attn_mask=attn_mask,
        )
        x = x + self.dropout(attn_out)        # 残差连接：x + Attention(Norm(x))

        # ===== Pre-Norm + FFN + 残差连接 =====
        normed = self.norm2(x)                 # 先归一化
        ffn_out = self.ffn(normed)             # SwiGLU FFN
        x = x + self.dropout(ffn_out)         # 残差连接：x + FFN(Norm(x))

        return x


# ===== 快速验证 =====
if __name__ == "__main__":
    batch_size, seq_len, d_model = 2, 16, 512
    n_heads, d_ff = 8, int(512 * 8 / 3)  # SwiGLU 常用 8/3 倍

    block = TransformerBlock(d_model, n_heads, d_ff)
    x = torch.randn(batch_size, seq_len, d_model)

    out = block(x)
    print(f"输入形状: {x.shape}")        # [2, 16, 512]
    print(f"输出形状: {out.shape}")       # [2, 16, 512]
    print(f"残差验证: 输出≠输入, 但形状不变 ✓")

    # 参数量统计
    total = sum(p.numel() for p in block.parameters())
    print(f"TransformerBlock 参数量: {total:,}")
```

## 面试追问

- **追问 1**：FFN 的两层线性变换如果去掉激活函数会怎样？——等价于一个线性变换 `W2·W1·x`，失去非线性表达能力，多层叠加也没有意义。
- **追问 2**：SwiGLU 的门控机制和 LSTM 的门控有什么异同？——思想类似（选择性通过信息），但 LSTM 的门是 sigmoid 输出 0-1 之间的值用于时序控制，SwiGLU 的门是在隐层维度上做特征选择。
- **追问 3**：Pre-LN 有没有什么缺点？——最终输出的尺度可能偏小，需要额外加 Final Norm；也有论文指出 Pre-LN 在某些任务上最终性能略低于精心调参的 Post-LN。
- **追问 4**：RMSNorm 去掉了中心化（减均值），为什么效果不受影响？——因为在 Transformer 的实际训练中，经过残差连接和多层变换后，特征的均值本身就不太稳定，减均值带来的收益有限，反而增加了计算成本。

## 常见误区

1. **"FFN 就是个简单的全连接层，不重要"**——大错。FFN 的参数量通常占 Transformer 总参数的 2/3，是存储知识的主要载体。
2. **"LayerNorm 和 BatchNorm 只是归一化维度不同"**——不只如此。BN 依赖 batch 统计量，推理时需要维护 running mean/var；LN 完全独立于 batch，实现更简洁。
3. **"Pre-LN 和 Post-LN 效果一样"**——训练稳定性差异很大。Post-LN 需要精心的 warmup 策略，Pre-LN 几乎即插即用。
4. **"残差连接只是防止梯度消失"**——它还提供了一种"模型集成"效果：每一层可以选择"什么都不做"（F(x)≈0），让信息直通，这让模型可以自适应地选择需要多少层处理。

# Transformer 深度拆解（六）：训练和推理——模型是怎么学会的，又是怎么用的

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [训练, 推理, Teacher Forcing, 交叉熵, KV Cache, 解码策略, 自回归, Temperature]

## 核心概念

训练和推理是模型生命周期的两大阶段。训练像"上学"——不断做题、对答案、改进；推理像"考试"——独立答题、没有参考答案。

这两个阶段的计算方式差异巨大：训练可以"一整句话同时处理"，推理却只能"一个字一个字往外蹦"。理解这个差异，是理解大模型工程挑战的钥匙。

## 详细解析

### 一、训练过程：做完形填空 vs 预测下一个词

大语言模型的训练本质上就是**做语言题**，但出题方式有两种主流路线。

**路线一：完形填空（BERT 的 MLM）**——随机挖掉 15% 的词让模型猜：`今天天气[MASK]好` → 猜"真"。模型同时看前后文，双向理解能力强，但天然不适合生成任务。

**路线二：预测下一个词（GPT 的自回归方式）**——给前文，猜下一个：`今天 天气 真` → 猜"好"。一个字接一个字地写，只能看前面。目前所有主流大模型（GPT、LLaMA、Qwen）都用这种方式。

**Teacher Forcing：训练时永远喂正确答案**

模型第 3 步猜错了怎么办？不管，第 4 步的输入照样用正确 token。就像老师在旁边盯着做题，写错了立刻纠正，不让错误滚雪球。

这也是训练能**并行**的关键：每一步的输入都是确定的（正确答案），所以整个序列可以一次性喂进去，用 Causal Mask 遮住"未来的词"，一次前向传播算出所有位置的预测。

### 二、损失函数：交叉熵——"模型猜对了多少"

模型输出词表上的概率分布（比如 50000 维的向量），交叉熵就是衡量这个分布跟正确答案差多远。

白话：正确答案是"好"，模型给"好"概率 0.8，则损失 = -log(0.8) = 0.22（很小，猜得准）；概率只有 0.01，则损失 = -log(0.01) = 4.6（很大，猜得离谱）。公式：`Loss = -1/T × Σ log P(正确token_t)`。

**Perplexity（困惑度）**：`PPL = e^Loss`，PPL=10 意味着模型平均在 10 个词之间犹豫。PPL 越低越好。

### 三、推理过程：一个字一个字往外蹦

推理时没有正确答案，模型只能用自己的预测作为下一步输入——**自回归生成**：`[BOS]` → "今" → "天" → ... → `[EOS]`。

**为什么推理比训练慢？** 训练时整句一次性输入，所有位置并行计算，1 次前向传播；推理时严格串行，生成 100 个 token 就要跑 100 次前向传播，且 GPU 利用率极低（每次只算 1 个 token）。如果不做优化，每次还要重新算前面所有 token 的 Attention——这就是 KV Cache 要解决的问题。

### 四、KV Cache：写论文做笔记

**问题**：在第 N 步生成时，Attention 需要用当前 token 的 Q 去和前面所有 token 的 K 做点积、再和它们的 V 加权求和。如果不缓存，每一步都要重新算前面所有 token 的 K 和 V——纯粹的重复劳动。

**KV Cache 的思路**：已经算过的 K 和 V，存下来不丢。下一步只需要算新 token 的 Q、K、V，然后把新 K、V 追加到缓存里。

用"写论文做笔记"来比喻：

- **没有 KV Cache**：每写一段新论文，都要把所有参考文献从头翻一遍，重新做笔记。写到第 100 段时，前面 99 篇文献你已经翻了 99 遍了。
- **有 KV Cache**：第一次查阅时就把笔记记好，后面只需要翻阅笔记本（缓存），只对新文献做笔记。

**缓存了什么？** 每一层每个头的 K 矩阵 `(已生成长度, head_dim)` 和 V 矩阵（同形状）。每生成一个新 token，只算它自己的 Q/K/V，然后把新 K/V 追加到缓存末尾，用新 Q 和完整缓存做 Attention。

**省了多少？** 无缓存时总计算量 ∝ N²，有缓存时 ∝ N。生成 1000 token 加速约 **500 倍**。这就是 KV Cache 是推理优化第一步的原因。

### 五、KV Cache 的显存计算：具体要占多少？

用一个 **7B 模型**举例，假设架构参数如下：
- 层数 `n_layers` = 32
- 注意力头数 `n_heads` = 32
- 每头维度 `head_dim` = 128（总 `d_model` = 4096）
- 数据类型：FP16（每个数占 2 字节）
- 序列长度 `seq_len` = 2048
- Batch size = 1

公式一步到位：
```
KV Cache 显存 = 2 × n_layers × n_heads × head_dim × seq_len × dtype_size
             = 2 × 32 × 32 × 128 × 2048 × 2 字节
             ≈ 1 GB（batch=1）
```

batch_size=8 时就是 **8 GB**，接近模型权重的一半（7B × 2B ≈ 14 GB）。序列翻倍、KV Cache 翻倍——这就是 PagedAttention、GQA/MQA 等优化手段存在的原因。

### 六、解码策略：写作文时怎么选下一个词

模型输出的是一个概率分布，怎么从里面选出下一个 token？不同策略对生成质量影响巨大。

**Greedy Decoding（贪心）：永远选概率最大的**

```
下一个词 = argmax(概率分布)
```

就像写作文永远选"最安全"的下一个词。结果：流畅但无聊，容易重复（"今天天气好好好好好..."）。

**Beam Search**：同时维护 k 条候选路径，每步展开、保留最优的 k 条，最后选总分最高的。适合翻译、摘要，不适合开放对话（太保守）。

**Top-K Sampling**：取概率最高的 K 个词，在其中按概率采样。问题：K 固定，分布集中时引入噪音，分散时候选不够。

**Top-P / Nucleus Sampling**：按概率从大到小累加到 P（如 0.9），只从这个"核"里采样。候选集大小**自动适配**概率分布的集中/分散程度。这是目前最常用的策略。

**Temperature**：采样前的"创意旋钮"——`probs = softmax(logits / T)`。T<1 更确定保守，T>1 更随机"有创意"，T→0 退化为贪心。写报告调低（0.2-0.5），写诗歌调高（0.8-1.2）。

**实际应用**：Temperature + Top-P 组合最常见，先调尖锐程度再截断尾部噪音。

## 示例代码

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional, Tuple


class CausalSelfAttention(nn.Module):
    """带 KV Cache 的因果自注意力"""

    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        assert d_model % n_heads == 0
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads

        # Q/K/V 投影矩阵，一次性投影然后拆分
        self.q_proj = nn.Linear(d_model, d_model, bias=False)
        self.k_proj = nn.Linear(d_model, d_model, bias=False)
        self.v_proj = nn.Linear(d_model, d_model, bias=False)
        # 输出投影
        self.o_proj = nn.Linear(d_model, d_model, bias=False)

    def forward(
        self,
        x: torch.Tensor,                              # (batch, seq_len, d_model)
        kv_cache: Optional[Tuple[torch.Tensor, torch.Tensor]] = None,
    ) -> Tuple[torch.Tensor, Tuple[torch.Tensor, torch.Tensor]]:
        B, L, _ = x.shape  # L: 当前输入长度（推理时通常为 1）

        # 投影得到 Q/K/V，然后重塑成多头形状
        q = self.q_proj(x).view(B, L, self.n_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(B, L, self.n_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(B, L, self.n_heads, self.head_dim).transpose(1, 2)
        # 形状: (batch, n_heads, seq_len, head_dim)

        # ===== KV Cache 核心逻辑 =====
        if kv_cache is not None:
            # 把新算出的 K/V 追加到缓存后面
            cached_k, cached_v = kv_cache
            k = torch.cat([cached_k, k], dim=2)  # (B, H, old_len+1, D)
            v = torch.cat([cached_v, v], dim=2)
        # 更新缓存：包含了从第一个 token 到当前 token 的所有 K/V
        new_kv_cache = (k, v)

        # Scaled Dot-Product Attention
        scale = self.head_dim ** 0.5
        attn_weights = torch.matmul(q, k.transpose(-2, -1)) / scale

        # 因果遮罩：只看前面的 token（仅在 prefill 阶段需要）
        total_len = k.size(2)
        if L > 1:
            causal_mask = torch.triu(
                torch.full((L, total_len), float("-inf"), device=x.device),
                diagonal=total_len - L + 1,
            )
            attn_weights = attn_weights + causal_mask.unsqueeze(0).unsqueeze(0)

        attn_weights = F.softmax(attn_weights, dim=-1)
        output = torch.matmul(attn_weights, v)  # (B, H, L, D)

        # 合并多头，过输出投影
        output = output.transpose(1, 2).contiguous().view(B, L, -1)
        return self.o_proj(output), new_kv_cache


class RMSNorm(nn.Module):
    """RMSNorm（同第五篇）"""

    def __init__(self, d_model: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(d_model))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        rms = torch.sqrt(x.pow(2).mean(dim=-1, keepdim=True) + self.eps)
        return x / rms * self.weight


class SimpleLM(nn.Module):
    """
    一个简化的语言模型，用于演示带 KV Cache 的自回归生成。
    只包含一层 Transformer Block + LM Head。
    """

    def __init__(self, vocab_size: int, d_model: int, n_heads: int):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.norm1 = RMSNorm(d_model)
        self.attn = CausalSelfAttention(d_model, n_heads)
        self.norm2 = RMSNorm(d_model)
        # 简化的 FFN
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_model * 4),
            nn.GELU(),
            nn.Linear(d_model * 4, d_model),
        )
        self.final_norm = RMSNorm(d_model)
        # 语言模型头：把隐藏状态映射到词表大小的 logits
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)

    def forward(
        self,
        input_ids: torch.Tensor,        # (batch, seq_len) 输入 token ids
        kv_cache: Optional[Tuple] = None,
    ) -> Tuple[torch.Tensor, Tuple]:
        x = self.embedding(input_ids)    # token ids → 向量

        # Attention + 残差
        normed = self.norm1(x)
        attn_out, new_kv_cache = self.attn(normed, kv_cache)
        x = x + attn_out

        # FFN + 残差
        x = x + self.ffn(self.norm2(x))

        # 输出 logits
        logits = self.lm_head(self.final_norm(x))
        return logits, new_kv_cache


@torch.no_grad()
def generate(
    model: SimpleLM,
    prompt_ids: torch.Tensor,            # (1, prompt_len) 初始 prompt
    max_new_tokens: int = 50,
    temperature: float = 0.8,
    top_p: float = 0.9,
) -> list[int]:
    """
    带 KV Cache 的自回归生成主循环。

    流程：
    1. Prefill 阶段：一次性处理整个 prompt，建立 KV Cache
    2. Decode 阶段：每次只输入 1 个 token，利用 KV Cache 加速
    """
    model.eval()
    generated_ids = prompt_ids[0].tolist()  # 记录已生成的所有 token

    # ===== 阶段一：Prefill =====
    # 把整个 prompt 一次性喂进去，建立初始 KV Cache
    logits, kv_cache = model(prompt_ids, kv_cache=None)
    # 只需要最后一个位置的 logits（预测 prompt 之后的第一个词）
    next_logits = logits[:, -1, :]

    for _ in range(max_new_tokens):
        # ===== Temperature 调节 =====
        scaled_logits = next_logits / temperature

        # ===== Top-P (Nucleus) Sampling =====
        sorted_logits, sorted_indices = torch.sort(scaled_logits, descending=True)
        cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
        # 把累积概率超过 top_p 的部分遮掉
        mask = cumulative_probs - F.softmax(sorted_logits, dim=-1) >= top_p
        sorted_logits[mask] = float("-inf")
        # 还原到原始顺序
        restored_logits = sorted_logits.scatter(1, sorted_indices, sorted_logits)

        # 从调整后的分布中采样
        probs = F.softmax(restored_logits, dim=-1)
        next_token = torch.multinomial(probs, num_samples=1)  # (1, 1)

        generated_ids.append(next_token.item())

        # 遇到 EOS 就停
        # (这里用 token_id=2 作为 EOS 的示例)
        if next_token.item() == 2:
            break

        # ===== 阶段二：Decode（每次只输入新 token）=====
        # 只把新 token 喂进模型，KV Cache 帮我们记住了前面所有信息
        logits, kv_cache = model(next_token, kv_cache=kv_cache)
        next_logits = logits[:, -1, :]

    return generated_ids


# ===== 快速验证 =====
if __name__ == "__main__":
    vocab_size, d_model, n_heads = 1000, 256, 4

    model = SimpleLM(vocab_size, d_model, n_heads)

    # 模拟一个 prompt：[1, 42, 100, 7]（4 个 token）
    prompt = torch.tensor([[1, 42, 100, 7]])

    result = generate(model, prompt, max_new_tokens=20, temperature=0.8, top_p=0.9)
    print(f"Prompt 长度: {prompt.shape[1]}")
    print(f"生成结果 (token ids): {result}")
    print(f"新生成 token 数: {len(result) - prompt.shape[1]}")

    # KV Cache 显存估算
    seq_len = 2048
    n_layers, n_kv_heads, head_dim = 32, 32, 128
    dtype_bytes = 2  # FP16
    kv_mem = 2 * n_layers * n_kv_heads * head_dim * seq_len * dtype_bytes
    print(f"\n7B 模型 KV Cache 显存估算:")
    print(f"  seq_len={seq_len}, batch=1: {kv_mem / 1024**3:.2f} GB")
    print(f"  seq_len={seq_len}, batch=8: {kv_mem * 8 / 1024**3:.2f} GB")
```

## 面试追问

- **追问 1**：Teacher Forcing 有什么缺点？——训练时模型永远看到正确上文，但推理时看到的是自己的预测（可能有错）。这种训练-推理不一致叫 exposure bias。缓解方法包括 Scheduled Sampling（逐步从 Teacher Forcing 过渡到自回归）。
- **追问 2**：KV Cache 在 Prefill 阶段和 Decode 阶段各有什么特点？——Prefill 是计算密集型（大矩阵乘法，GPU 利用率高），Decode 是访存密集型（每次只算一个 token，瓶颈在读取 KV Cache）。两个阶段的优化策略完全不同。
- **追问 3**：Top-P 和 Top-K 能同时用吗？——可以，实际中经常同时设置。两者取交集：先按 Top-K 截断，再按 Top-P 截断，取更严格的那个。
- **追问 4**：KV Cache 有哪些优化方案？——GQA/MQA 减少 KV 头数、KV 量化到 INT8/INT4、PagedAttention 减少显存碎片、滑动窗口注意力限制缓存长度、Token Dropping 丢弃不重要的 KV。

## 常见误区

1. **"训练和推理的计算量差不多"**——差距巨大。训练一个序列只需要 1 次前向 + 1 次反向，推理要跑 N 次前向。但训练的总量大是因为要看海量数据。
2. **"KV Cache 是一种近似计算"**——不是。KV Cache 的结果与不使用缓存完全数值一致，它只是避免了重复计算，属于精确优化。
3. **"Temperature 越高生成质量越好"**——Temperature 太高会导致采样到低概率的离谱 token，输出变成胡言乱语。太低则重复无聊。好的设置取决于任务。
4. **"Beam Search 一定比 Sampling 好"**——不一定。Beam Search 倾向于选择"安全"但平庸的输出，对开放式生成任务（聊天、创意写作），Sampling 效果反而更好。
