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
