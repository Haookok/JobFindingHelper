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
