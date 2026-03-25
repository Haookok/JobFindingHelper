# MoE 与模型扩展

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [MoE, 门控, 负载均衡, DeepSeek, Scaling Laws, 涌现, Dense]

## 核心概念

**MoE（Mixture of Experts）** 将 FFN 拆为多个 **专家网络**，由 **门控（Router）** 按当前 token 表示选出 **Top-K 个专家** 参与计算，其余专家跳过。这样 **总参数量** 可很大而 **每 token 激活参数** 远小于同等总参数的 Dense 模型，在固定算力预算下提高 **容量**。挑战包括 **负载均衡**（避免少数专家吃满、其余闲置）、**通信**（专家并行）与 **训练稳定性**。

从系统视角，MoE 是 **用稀疏激活换容量**：同样 FLOPs/token 下可堆更多「知识」在参数里，但 **显存占用**（存放全部专家权重）与 **跨设备 shuffle** 仍可能吃紧，需 **EP（Expert Parallelism）** 与 **ZeRO** 等配合。

## 详细解析

**门控与路由**：常见 **Softmax 门控** 得专家概率，取 Top-1 或 Top-2；可加 **噪声** 促探索。**负载均衡损失**：鼓励各专家分配均匀（如 Switch Transformer 的 auxiliary load balancing loss），否则 **专家坍塌** 浪费容量。**容量因子**：限制每批次每专家最大 token 数，溢出 token 需 **二次路由** 或丢弃策略（实现相关）。

**DeepSeek-MoE（面试常考点）**：通过 **细粒度专家划分**、**共享专家（shared experts）** 捕获稳定共性模式，**专门化路由** 提升专家利用；与 **通信优化、训练配方** 结合，在 **激活参数量可控** 下拉高模型能力。具体模块名与版本以论文/技术报告为准，口述强调「共享+路由细化+均衡」即可。

**Scaling Laws（Chinchilla）**：在固定 **算力预算** 下，**模型参数量** 与 **训练 token 数** 应协调增长；早期偏大模型少训数据会 **欠训练**。MoE 使「大参数量」与「每步算力」解耦，但 **总训练 token** 与 **路由质量** 仍决定上限。

**涌现能力（Emergent Abilities）**：规模到某阈值后 **下游指标突然跃升** 的现象；存在度量与 **基准敏感性** 争议。面试可答：与 **规模、数据、指令微调** 均相关，不宜单一归因「只有参数变大」。

**MoE vs Dense**：MoE **训练** 可更高效利用固定 FLOPs（更多参数见多识广）；**推理** 若 Top-K 小，**延迟与显存** 可能优于同等总参 Dense，但 **路由与 all-to-all 通信** 在集群上可能成为瓶颈。Dense **实现简单、延迟稳定**，小 batch 场景有时更友好。

**训练效率 vs 推理效率**：MoE 提高 **参数效率** 不一定等价于 **wall-clock 训练更快**（取决于实现、并行策略）；推理侧 **批大小、序列长度、专家放置** 决定是否能吃满 GPU。

**Dense 何时仍更好**：极小 batch、低延迟单请求、强依赖 **确定性延迟** 或 **实现简单** 的边缘场景；研究与 ablation 也常先 Dense 验证再 MoE 化。

**专家特化**：理想情况下不同专家捕获 **语法、事实、代码、多语** 等不同子模式；监控 **专家熵**、**路由分布** 可诊断是否坍塌。**Dropout / 随机深度** 在部分架构中与 MoE 协同防过拟合（因实现而异，口述点到为止）。

**数据与 MoE**：数据混合比例影响路由学习；**领域不平衡** 可能导致某些专家永远闲置或过度使用，需要 **loss 设计与数据重平衡**。

## 示例代码

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MoELayer(nn.Module):
    """Top-1 路由 MoE FFN（教学极简版）。"""

    def __init__(self, d_model: int, d_ff: int, num_experts: int):
        super().__init__()
        self.num_experts = num_experts
        self.gate = nn.Linear(d_model, num_experts, bias=False)
        self.experts = nn.ModuleList(
            [
                nn.Sequential(
                    nn.Linear(d_model, d_ff),
                    nn.GELU(),
                    nn.Linear(d_ff, d_model),
                )
                for _ in range(num_experts)
            ]
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [batch, seq, d]
        b, s, d = x.shape
        flat = x.view(-1, d)
        logits = self.gate(flat)
        probs = F.softmax(logits, dim=-1)
        idx = torch.argmax(probs, dim=-1)  # Top-1
        out = torch.zeros_like(flat)
        for e in range(self.num_experts):
            mask = idx == e
            if mask.any():
                out[mask] = self.experts[e](flat[mask])
        return out.view(b, s, d)
```

真实系统需 **批量专家计算（group by expert）**、**aux loss**、**容量因子**，上述仅为概念对齐。

**面试话术**：「MoE 不是免费午餐：参数多、通信与负载均衡难，但激活少，适合大模型扩容量。」

**与蒸馏/剪枝对比**：蒸馏把大模型能力压入小 Dense；MoE 保持大容量但稀疏激活；剪枝永久删通道。选型看 **部署约束**（显存上限、延迟方差容忍度）。

**推理 batch 效应**：batch 大时路由可将 **同专家 token 拼 batch** 提高 GPU 利用率；batch 小时易出现 **专家空转** 与通信占比上升。

**Chinchilla 之后**：后续工作讨论 **数据质量、合成数据、多模态** 对最优配比的修正；面试答「定律给直觉，实际需实验」较稳妥。

**监控指标**：训练看 **router z-loss**、**专家利用率直方图**、**梯度范数**；推理看 **P99 延迟** 与 **专家热点** 是否导致排队。

**合规与可解释**：MoE 路由决策 **难解释**，若监管要求「可说明推理路径」，需额外日志或改用更可审计结构（口述点到为止）。

## 面试追问

- **追问 1**：Top-2 相对 Top-1 的利弊？为何训练早期常加 **路由噪声**？
- **追问 2**：专家负载不均衡时，训练会出现什么现象？auxiliary loss 如何缓解？
- **追问 3**：Chinchilla 结论对 MoE 训练的启示是什么（同算力下数据与专家利用）？
- **追问 4**：推理时 **专家并行** 跨卡通信开销主要来源？什么 workload 下 MoE 不如 Dense 划算？
- **追问 5**：「涌现」有哪些 **批评观点**（如指标非线性、小模型也可通过提示触发）？如何客观表述？

## 常见误区

- 认为 MoE **总参数 = 实际算力**——应以 **激活参数 / token FLOPs** 与 **通信** 为准。
- 忽略 **All-to-All** 与 **负载倾斜**——论文指标与实际集群延迟可能差距大。
- 把 **DeepSeek-MoE** 说成「只有专家多」——**共享专家与路由设计** 是关键点。
- **Scaling Law** 背成「越大越好」——同等算力下 **数据量** 与 **最优配比** 才是核心。
- 将 **涌现** 描述为神秘「意识」——面试应保持 **能力随规模与数据跃迁** 的工程化表述。
- 认为 **专家数越多越好**——路由更难、通信更重，边际收益递减，需与 **总预算** 平衡。
- 混淆 **总 FLOPs** 与 **每 token 激活 FLOPs**——比较 MoE 与 Dense 时必须对齐指标再谈性价比。
