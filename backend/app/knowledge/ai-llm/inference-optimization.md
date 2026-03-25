# 大模型推理优化

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [KV Cache, 量化, Speculative Decoding, FlashAttention, vLLM, Continuous Batching, 解码策略]

## 核心概念

**自回归解码** 每步生成一个 token，若不缓存历史 Key/Value，将重复计算前面所有 token 的注意力，复杂度与延迟爆炸。**KV Cache** 存储每层每头已见 token 的 K、V，新步仅计算当前 token 的 Q 并与缓存 K 做点积。**推理优化** 从算法（FlashAttention）、系统（PagedAttention、连续批处理）、数值（量化）与解码（投机采样）多维度降低 **延迟、吞吐与显存**。

服务侧常区分 **首包（time to first token）** 与 **逐 token 延迟**：前者受 **prefill** 阶段整段 prompt 的一次性注意力影响；后者进入 **decode** 阶段后，每步算子规模小、往往 **内存带宽** 受限（memory-bound），优化重点与训练不同。

## 详细解析

**KV Cache 显存（直觉公式）**：对 batch \(B\)、层数 \(L\)、头数 \(H\)、每头维度 \(D\)、已生成长度 \(T\)，缓存每个 token 存 K 与 V 各 \(H \times D\) 个元素；总量约与 **\(2 \times B \times L \times H \times D \times T\)** 成正比（精度为 FP16/BF16 时再乘 2 字节）。长上下文、大 batch 时 KV 常为主存瓶颈。

**量化**：**INT8/INT4** 权重（及可选激活）降低带宽与占用；**GPTQ** 等 **训练后量化** 用 Hessian 近似减小每层误差；**AWQ** 强调保护 **salient weights**（对激活敏感权重），常比粗暴 PTQ 更稳。量化可作用于 **仅权重** 或 **KV cache**，需区分 **W4A16** 等命名含义。

**投机解码（Speculative Decoding）**：小 **草稿模型** 快速提出多个 token，大模型 **并行验证**；接受前缀可一次推进多步，在 **接受率** 高时显著降延迟且 **不改变输出分布**（标准验证接受算法下）。变体含 **投机树**、**EAGLE** 等。

**FlashAttention**：IO-aware 的注意力实现，通过 **分块** 与 **重计算** 减少 HBM 读写，在 **长序列** 上加速并降显存峰值；FlashAttention-2 进一步优化并行与工作划分。

**PagedAttention（vLLM）**：KV 按 **非连续块** 分配，类似虚拟内存分页，减少 **变长序列** 批处理中的显存碎片与预留浪费，提高 **GPU 利用率**。

**连续批处理（Continuous Batching）**：请求 **动态进出**，新请求插入、已完成序列移除，避免「等最长序列」的 padding 浪费，提升 **吞吐**。

**解码策略**：**Greedy** 每步取 argmax，快但易重复；**Beam Search** 维护多条假设，适合机器翻译等传统任务，开放域生成常用较窄 beam 或不用。**Top-K** 仅从概率前 K 采样；**Top-P（nucleus）** 从累积概率达 p 的最小集合采样。**Temperature** 缩放 logits：\(>1\) 更随机，\(<1\) 更尖锐。实际服务常 **Top-P + Temperature** 组合。

**MQA / GQA**：**Multi-Query Attention** 多查询头共享一组 K/V；**Grouped-Query Attention** 介于 MHA 与 MQA 之间，多查询共享一组 K/V。效果：**KV Cache 随头数近似线性缩减**，decode 更省显存与带宽；可能略损质量，大模型常可接受。

**静态批处理痛点**：同一 batch 内序列长度不一需 **pad 到 max**，短序列浪费算力；连续批处理配合 **分页 KV** 可显著缓解。**CUDA Graph**：decode 步形状固定时可降低内核启动开销，对低延迟场景有帮助（实现依赖框架版本）。

## 示例代码

```python
import torch
import torch.nn.functional as F

# 解码策略演示：从 logits 采样（单步）
def sample_token(logits: torch.Tensor, temperature: float = 0.8, top_p: float = 0.9):
    logits = logits / max(temperature, 1e-6)
    probs = F.softmax(logits, dim=-1)
    sorted_probs, sorted_idx = torch.sort(probs, descending=True)
    cumsum = torch.cumsum(sorted_probs, dim=-1)
    mask = cumsum <= top_p
    mask[..., 0] = True  # 至少保留一个
    filtered = sorted_probs * mask
    filtered = filtered / filtered.sum(dim=-1, keepdim=True)
    choice = torch.multinomial(filtered, num_samples=1)
    return sorted_idx.gather(-1, choice).squeeze(-1)


logits = torch.randn(4, 50000)  # [batch, vocab]
tok = sample_token(logits[0])
print(int(tok))
```

**KV 无代码公式记忆**：面试口述「每层缓存过去所有位置的 K/V，随长度线性增长；优化方向是分页、量化 KV、MQA/GQA 减头」。

**Speculative 接受机制（直觉）**：草稿模型提出一串 token；大模型一次前向校验前缀；接受长度服从几何分布类行为，**接受率** 由大小模型一致性决定。拒绝时从正确分布 **重采样** 以保证等价性（具体算法见原论文）。

**KV 量化**：对缓存 K/V 做 INT8 等可降低长上下文显存，但需留意 **与 FP16 权重相乘** 的混合精度路径与误差累积；部分框架提供 **KV cache int8** 开关与校准。

**批服务与 SLA**：高吞吐场景增大 batch 换更低 **每 token 成本**；低延迟场景 batch=1 或 **micro-batching**。**Prefix caching**：相同系统提示前缀可共享 KV（依赖引擎支持），降低多轮对话成本。

**RoPE 与推理内核**：部分加速库对 **长上下文 RoPE** 有融合 kernel；改动位置编码需确认 **与导出 ONNX/TensorRT 等兼容**。

**解码重复与惩罚**：**repetition penalty**、**frequency penalty** 在工程上抑制循环复读，与纯 Top-P 采样正交；面试可提「推理侧启发式，非训练目标」。

**能量与碳（了解）**：吞吐优化（连续批、量化）降低 **每 query 焦耳**；口述一句体现系统思维即可。

**W4A16 vs W8A8**：仅权重量化激活仍 FP16 实现简单；权活皆量化需 **校准** 与 **融合内核** 才吃到加速。**SmoothQuant** 等通过平滑激活异常通道改善 INT8 推理（了解名词即可）。

**长上下文推理**：KV 线性增长下，**上下文并行、Ring Attention** 等多卡切分序列是另一维度优化，与单卡 FlashAttention 互补。

**服务降级**：高负载时可 **降低 max tokens**、关闭投机解码、切换更小 draft 模型，用 **SLO 驱动** 动态策略。

**确定性推理**：部分场景需 **可复现**（调试、评测），可 **固定随机种子**、Greedy 或固定采样序列；注意 **GPU 非确定性算子** 仍可能带来微小差异。

**算子融合**：推理引擎将 **LayerNorm+GEMM+激活** 等融合为单 kernel，减少访存；与 FlashAttention 同属 **系统协同优化**。

**动态插入（了解）**：部分框架支持 **LoRA 热插拔** 或 **多 LoRA 批处理**，推理路径需 **额外内存与调度**；与纯静态权重相比延迟方差可能增大。

## 面试追问

- **追问 1**：MQA / GQA 如何减少 KV Cache？与 MHA 在表达能力上的 trade-off？
- **追问 2**：投机解码为何在「接受被拒绝」时仍能保持与朴素采样一致的目标分布（高层直觉）？
- **追问 3**：连续批处理与 **静态 padding batch** 相比，在什么负载下收益最大？
- **追问 4**：INT4 权重量化后，为何 **GEMM 内核** 与 **反量化** 布局对实际加速比影响巨大？
- **追问 5**：Beam Search 在 **开放域对话** 中为何不如采样常用？会有哪些路径退化问题？

## 常见误区

- 认为 **KV Cache 只存 Key**——实际 K 与 V 都要存（V 用于加权和）。
- 把 **FlashAttention** 说成「近似注意力」——它是 **精确** 的数值等价实现，主要优化 IO。
- **量化后速度一定翻倍**——若未用 Tensor Core 友好布局或 batch 小，可能 **加速不明显**。
- **Temperature=0** 与 **Greedy** 在实现上需区分（有的框架用 epsilon 采样 tie-break）。
- 忽略 **prefill vs decode** 两阶段：首包延迟受 prefill 计算影响，持续生成受 **decode 内存带宽** 限制更明显。
- **量化模型未校准（calibration）** 就部署——激活动态范围大时 INT8/INT4 误差显著，需代表性数据或 GPTQ/AWQ 等流程。
- 认为 **FlashAttention 一定加速短序列**——极短 seq 时内核启动与分块开销可能使收益有限，收益随长度上升更明显。
