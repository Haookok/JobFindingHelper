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
