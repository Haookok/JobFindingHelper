# 大模型推理优化

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [KV Cache, 量化, Speculative Decoding, FlashAttention, vLLM, Continuous Batching, 解码策略]

## 核心概念

大模型训练完了只是万里长征第一步，**让它跑起来、跑得快、跑得省钱** 才是真正的工程挑战。这就是推理优化要做的事。

大模型生成文字是一个字一个字蹦出来的（自回归解码），每生成一个字都要"回头看"前面所有的字。如果不做优化，生成第 100 个字时要重新算前 99 个字的注意力——纯纯的重复劳动。

**KV Cache** 就是为了解决这个问题：把前面算过的 Key 和 Value 缓存起来，下一步只需要算新字的 Q，跟缓存的 K 做点积就行。好比你写论文时把参考文献都存在笔记里，不用每次引用都重新去找原文。

推理优化是个系统工程，从算法（FlashAttention）、系统（连续批处理）、数值（量化）到解码策略（投机采样）全方位降本增效。

## 详细解析

### KV Cache：空间换时间的核心

KV Cache 的显存占用跟这几个东西成正比：**批次大小 × 层数 × 注意力头数 × 每头维度 × 已生成长度**。长对话、大 batch 时，KV Cache 经常比模型权重本身还吃显存。

优化方向三板斧：
- **MQA / GQA**：多个查询头共享一组 K/V。MQA（Multi-Query）是最极端的——所有头共享一组 K/V，GQA（Grouped-Query）折中。好比原来每个员工一台打印机，改成几个人共用一台，省了一大笔钱。
- **KV 量化**：把缓存从 FP16 压到 INT8，显存直接减半。
- **PagedAttention**：KV 不再预分配连续显存，而是像操作系统的虚拟内存一样按页分配，大幅减少碎片浪费。

### 量化：让模型"减肥"

量化就是把模型权重从 32 位/16 位浮点数压缩到 8 位甚至 4 位整数。好比把一本精装大字版词典换成口袋本——内容差不多，但体积和重量大幅缩减。

- **GPTQ**：训练后量化，用少量校准数据最小化每层的量化误差
- **AWQ**：重点保护"重要权重"（对输出影响大的那些），比粗暴地一刀切量化效果更好
- **W4A16**：权重 4 位，激活值保持 16 位——实现简单，最常见
- **W8A8**：权重和激活都 8 位——加速更明显，但需要校准和专用内核

**注意**：量化不是免费午餐。如果不做校准就直接量化部署，遇到激活值动态范围大的情况，误差会很明显。

### FlashAttention：不是近似，是更聪明的算法

很多人以为 FlashAttention 是"近似注意力"——**大错特错**，它算出来的结果跟标准注意力**数值完全一样**。

它的优化在于**减少 GPU 内存读写**：把注意力计算拆成小块，每块在高速缓存（SRAM）里算完，避免反复搬运数据到慢速显存（HBM）。就像你做菜时把所有食材先摆到灶台上（SRAM），而不是每切一刀就跑一趟冰箱（HBM）。

序列越长，FlashAttention 的加速效果越明显。极短序列时收益有限。

### 连续批处理（Continuous Batching）

传统的静态批处理有个蠢问题：一个 batch 里如果有个请求需要生成 500 字，另一个只需要 10 字，生成 10 字的那个做完了只能干等着。**连续批处理**允许请求随时加入和退出——做完的走、新来的插进来，GPU 时刻保持满载。vLLM 就是靠这个 + PagedAttention 成为推理框架的标杆。

### 投机解码（Speculative Decoding）：小模型打草稿，大模型审核

核心思路很有意思：用一个**小而快的"草稿模型"**先快速生成好几个 token，然后大模型**一次性并行验证**这些 token 对不对。如果草稿大部分都对，就省了很多步；错的地方由大模型纠正。

关键点：在标准验证算法下，**输出分布和直接用大模型生成完全一致**——不是近似，是数学上等价的。效果取决于小模型和大模型的"一致率"——越一致加速越明显。

### 解码策略：控制模型怎么"选字"

| 策略 | 原理 | 适用场景 |
|------|------|----------|
| Greedy | 每步选概率最高的 | 快，但容易重复 |
| Top-K | 从前 K 个高概率候选里采样 | 通用 |
| Top-P (Nucleus) | 从累积概率达到 p 的最小集合里采样 | 目前最常用 |
| Temperature | < 1 更确定，> 1 更随机 | 配合 Top-P 使用 |

实际服务中通常 **Top-P + Temperature** 组合使用。事实问答用低温（0.1-0.3），创意写作用高温（0.7-1.0）。

### Prefill vs Decode：两个阶段的瓶颈不同

- **Prefill（预填充）**：一次性处理整段输入 prompt，是计算密集型——影响"首字延迟"
- **Decode（生成）**：一个字一个字生成，每步计算量很小但要读 KV Cache——是内存带宽瓶颈

优化策略也不同：Prefill 靠并行度和算力，Decode 靠减少内存访问和量化。

## 示例代码

```python
import torch
import torch.nn.functional as F


def sample_token(logits: torch.Tensor, temperature: float = 0.8, top_p: float = 0.9):
    """Top-P + Temperature 采样：从模型输出的 logits 中选出下一个 token"""
    # 先用 temperature 缩放——温度越低分布越尖锐（更确定）
    logits = logits / max(temperature, 1e-6)
    probs = F.softmax(logits, dim=-1)
    # 按概率从大到小排序
    sorted_probs, sorted_idx = torch.sort(probs, descending=True)
    # 找到累积概率刚好超过 top_p 的位置，后面的全砍掉
    cumsum = torch.cumsum(sorted_probs, dim=-1)
    mask = cumsum <= top_p
    mask[..., 0] = True  # 至少保留概率最高的那个
    filtered = sorted_probs * mask
    filtered = filtered / filtered.sum(dim=-1, keepdim=True)
    # 从筛选后的候选里随机采样
    choice = torch.multinomial(filtered, num_samples=1)
    return sorted_idx.gather(-1, choice).squeeze(-1)


logits = torch.randn(4, 50000)  # 模拟 [batch=4, vocab=50000]
tok = sample_token(logits[0])
print(f"采样到的 token id: {int(tok)}")
```

**运行说明**：需安装 `torch`。这段代码演示了单步解码策略，实际生成需要循环调用并维护 KV Cache。

## 面试追问

- **面试官可能会这样问你**：MQA 和 GQA 怎么减少 KV Cache 的？跟标准 MHA 比在表达能力上有什么损失？
- **面试官可能会这样问你**：投机解码被拒绝后为什么还能保持跟原模型一样的输出分布？大致讲讲直觉。
- **面试官可能会这样问你**：连续批处理在什么样的请求负载下收益最大？什么时候不如静态批处理？
- **面试官可能会这样问你**：INT4 量化后，为什么内核实现和反量化的数据布局对实际加速影响很大？
- **面试官可能会这样问你**：Beam Search 在开放域对话里为什么不常用？会有什么"退化"问题？

## 常见误区

- **很多人会搞混的地方**：以为 KV Cache 只存 Key——实际上 K 和 V 都要存，V 是用来做加权求和的。
- **很多人会搞混的地方**：把 FlashAttention 说成"近似注意力"——它是数值精确的，优化的是 IO 不是计算。
- **很多人会搞混的地方**：觉得量化了速度就一定翻倍——如果 batch 小或者没用对内核布局，加速可能很有限。
- **很多人会搞混的地方**：忽略 Prefill 和 Decode 是两个不同阶段——首字慢是 Prefill 的锅（计算密集），后面慢是 Decode 的锅（内存带宽瓶颈）。
- **很多人会搞混的地方**：量化模型不做校准就部署——激活值动态范围大时 INT8/INT4 误差会很大，必须用 GPTQ/AWQ 等流程做校准。
- **很多人会搞混的地方**：以为 Temperature=0 就是 Greedy——部分框架在 T=0 时有 epsilon 采样的 tie-break 机制，实现上不完全一样。
