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
