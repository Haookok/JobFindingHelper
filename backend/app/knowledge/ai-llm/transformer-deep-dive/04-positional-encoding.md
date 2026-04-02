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
