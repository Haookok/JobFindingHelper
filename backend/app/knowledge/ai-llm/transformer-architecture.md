# Transformer 架构详解

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [Transformer, Self-Attention, Multi-Head, 位置编码, Encoder-Decoder, Pre-LN]

## 核心概念

**Transformer** 完全基于注意力机制，摒弃 RNN/CNN 的序列归纳偏置，通过堆叠 **Self-Attention** 与 **前馈网络（FFN）** 建模 token 间依赖。经典 **Encoder-Decoder** 中：Encoder 对源序列双向编码；Decoder 自回归生成目标序列，并通过 **Cross-Attention** 读取 Encoder 输出。**Scaled Dot-Product Attention** 用查询 **Q**、键 **K**、值 **V** 计算加权组合；**Multi-Head Attention（MHA）** 在子空间并行多组 Q/K/V 再拼接投影，增强表达能力。

训练时常对注意力权重或残差路径施加 **Dropout** 防过拟合；推理阶段关闭 Dropout。归一化除 **LayerNorm** 外，许多 LLM 采用 **RMSNorm**（仅按均方根缩放，无 mean center），计算更省且实践中常与 Pre-LN 搭配稳定深层训练。

## 详细解析

**Encoder 单层**：`Self-Attention → 残差+Norm → FFN → 残差+Norm`。**Decoder 单层**：`Masked Self-Attention`（禁止看到未来位置）→ 残差+Norm → `Encoder-Decoder Attention`（Q 来自 Decoder，K/V 来自 Encoder）→ 残差+Norm → FFN → 残差+Norm。原始论文为 **Post-LN**（子层后 LayerNorm）；许多大模型采用 **Pre-LN**（子层前 Norm），训练更稳定。

**Self-Attention 计算**：对输入 \(X\) 做线性映射得 \(Q=XW^Q, K=XW^K, V=XW^V\)。注意力权重 \(\text{softmax}(QK^\top/\sqrt{d_k})V\)。**除以 \(\sqrt{d_k}\)** 的原因：\(d_k\) 增大时 \(q\cdot k\) 方差近似线性增长，softmax 进入极端区域梯度变小；缩放使内积分布更温和，与方差归一化直觉一致。

**Multi-Head**：将 \(d_{\text{model}}\) 拆成 \(h\) 个头，每头维度 \(d_k=d_{\text{model}}/h\)，各头独立注意力后 **Concat** 再经 \(W^O\) 融合。等价于在多个表示子空间中捕获不同关系（语法、指代、长距依赖等）。

**位置编码**：（1）**正弦/余弦固定编码**：不同频率正弦函数，使模型能外推相对距离；不可学习但可泛化长度。（2）**RoPE（旋转位置编码）**：将 Q/K 在复数/二维旋转意义上乘以位置相关相位，相对位置体现为旋转差，利于外推与相对位置归纳偏置。（3）**ALiBi**：在注意力 logits 上按距离加 **线性负偏置**，无显式位置嵌入即可抑制远端注意力，常配合外推训练。

**FFN**：通常两层线性，中间 **ReLU/GELU/SwiGLU**，隐层维度常为 \(4d_{\text{model}}\)。对每个 token 独立作用，提供非线性与通道混合。

**架构对比**：**Encoder-Only**（如 BERT）双向上下文，适合分类、检索、表示学习，不原生自回归生成。**Decoder-Only**（如 GPT）因果掩码，适合生成与统一「下一 token」目标，是当前 LLM 主流。**Encoder-Decoder**（如 T5、BART）显式区分源/目标，适合翻译、摘要等 seq2seq；部分任务也可用 Decoder-Only + 指令格式替代。

**复杂度**：Self-Attention 对序列长度 \(n\) 为 \(O(n^2)\)（相对全连接仍有结构先验）；长上下文需稀疏注意力、线性注意力或硬件友好内核等折中。

**与推理实现的衔接（口述）**：Decoder 自回归生成时，历史 token 的 K/V 可 **缓存** 避免重复计算；Cross-Attention 中 Encoder 侧 K/V 在 Encoder 只跑一遍后亦可复用。 Encoder-Only 做整段编码时常一次前向，缓存策略与生成式 Decoder 不同。面试若被追问「Attention \(O(n^2)\) 为何仍比 RNN 长依赖好」，可答：并行度、任意位置一步可达、梯度路径更短，但代价是二次方内存与算力。

**FFN 变体**：**SwiGLU** 等门控结构（带门控线性单元）在大模型中常见，相比单激活函数两层 MLP，能以略高参数换更好拟合与非线性路径；与 Attention 形成「稀疏交互 + 逐 token 通道混合」分工。

**初始化与深度**：残差连接使信号可沿捷径传播，配合 Norm 与合理初始化，数百层仍可训练。口述题可强调 **Attention 负责 token 间路由，FFN 负责存储与变换特征** 的极简分工。

**掩码细节**：padding mask 将 pad 位置 logits 置为 \(-\infty\)，softmax 后权重为 0；因果 mask 保留下三角。实现时需注意 **半精度下 -inf 与 nan**（可用大负数替代）。**注意力 dropout** 在训练时对 softmax 后权重随机丢弃，推理关闭。

**长度外推实践**：训练 4k、推理 8k 时，绝对位置嵌入易崩；RoPE/ALiBi 相对更稳但仍可能 **困惑度上升**，常配合 **NTK-aware 插值**、**位置截断微调** 等工程手段（具体名称为社区经验，面试提「需二次微调或插值」即可）。

**对比 CNN/RNN（精简）**：CNN 局部感受野，扩张卷积才可扩大范围；RNN 顺序计算难并行；Attention 一步全局依赖但 \(O(n^2)\)。口述时一句「并行度与全局依赖的代价是二次复杂度」收尾。

**BERT vs GPT 训练目标**：BERT **MLM/NSP**（NSP 现较少用）学双向填空；GPT **CLM** 学因果生成。影响：同样规模下 Encoder-Only 更擅判别式中间表示，Decoder-Only 更擅续写与统一 chat。

## 示例代码

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class ScaledDotProductAttention(nn.Module):
    """单头缩放点积注意力（教学用）。"""

    def __init__(self, d_model: int, d_k: int):
        super().__init__()
        self.d_k = d_k
        self.w_q = nn.Linear(d_model, d_k, bias=False)
        self.w_k = nn.Linear(d_model, d_k, bias=False)
        self.w_v = nn.Linear(d_model, d_k, bias=False)

    def forward(self, x: torch.Tensor, attn_mask: torch.Tensor | None = None):
        # x: [batch, seq, d_model]
        q, k, v = self.w_q(x), self.w_k(x), self.w_v(x)
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_k)
        if attn_mask is not None:
            scores = scores.masked_fill(attn_mask == 0, float("-inf"))
        attn = F.softmax(scores, dim=-1)
        return torch.matmul(attn, v), attn


# 因果掩码示例：下三角为 1，禁止看见未来 token
def causal_mask(seq_len: int, device):
    return torch.tril(torch.ones(seq_len, seq_len, device=device))


batch, seq, d_model, d_k = 2, 8, 64, 16
x = torch.randn(batch, seq, d_model)
mha_placeholder = nn.MultiheadAttention(d_model, num_heads=4, batch_first=True)
# PyTorch MHA 内部已实现缩放与多头拼接
out, _ = mha_placeholder(x, x, x, attn_mask=None, is_causal=True)
```

**运行说明**：需安装 `torch`；`is_causal=True` 适用于 Decoder 自注意力场景。若需显式 padding mask，可构造 `attn_mask` 与 `key_padding_mask`（以文档为准）。

## 面试追问

- **追问 1**：为什么用 \(\sqrt{d_k}\) 而不是别的常数？与 LayerNorm、Xavier 初始化在「控制激活尺度」上如何联系起来口述？
- **追问 2**：Pre-LN 与 Post-LN 在梯度流、深层堆叠稳定性上的差异？哪些大模型系列典型采用 Pre-LN？
- **追问 3**：RoPE 与绝对位置嵌入、ALiBi 在长文本外推上的异同？推理时序列长于训练时各自可能出什么问题？
- **追问 4**：Decoder-Only 模型如何做「理解类」任务（分类、相似度）？与 Encoder-Only 在 inductive bias 上的取舍？
- **追问 5**：Cross-Attention 中 Q、K、V 分别来自哪里？若 Encoder 输出加池化做「句子向量」，和 CLS 表征相比各适用什么场景？

## 常见误区

- 把 **Self-Attention** 说成「每个词和所有词做全连接」而忽略 **Q/K/V 线性投影** 与 **缩放**——权重由相似度动态产生，不是固定全连接。
- 认为 **Multi-Head** 只是「算多次同样的 attention」——头之间参数不共享，且通过 \(W^O\) 融合子空间信息。
- 混淆 **Encoder-Decoder** 与 **仅用 Decoder 做 seq2seq**（如前缀作为 prompt）——训练目标与对齐方式不同，不能简单等同。
- 忽略 **因果掩码** 在 Decoder 中的必要性，误以为 Decoder 也能像 BERT 一样双向看全句。
- 将 **位置编码** 仅理解为「加一个向量」——RoPE/ALiBi 是融入注意力几何的不同机制，外推行为差异很大。
- 认为 **LayerNorm 与 BatchNorm** 在 Transformer 里可互换——NLP 变长序列与 token 维度上，LN 更自然；BN 在序列模型中易因 batch 统计不稳而效果差（早期也有工作探讨，但非主流）。
- 忽略 **padding mask 与因果 mask 同时存在** 时的合并方式——错误掩码会导致注意力看见 pad 或看见未来 token。
