# 模型微调与对齐

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [LoRA, QLoRA, SFT, RLHF, DPO, GRPO, PEFT, 对齐]

## 核心概念

**微调** 指在预训练权重上继续训练以适应下游任务或风格。**Full Fine-Tuning** 更新全部参数，显存与存储成本高；**PEFT（参数高效微调）** 冻结大部分权重，仅训练少量适配参数（如 **LoRA** 在低秩子空间学习增量 \(\Delta W\)）。**对齐** 指使模型行为符合人类意图与安全偏好，常见路径包括 **SFT**（示范数据模仿）、**RLHF**（奖励模型 + PPO）、**DPO**（直接用偏好对优化策略，无需显式奖励模型）及 **GRPO** 等变体。

面试常问「为何不全靠预训练」：预训练优化的是 **下一词似然**，与 **遵循指令、拒答有害请求、格式约束** 等目标不对齐，需后训练阶段显式塑造行为边界。

## 详细解析

**LoRA 原理**：对线性层 \(W \in \mathbb{R}^{d\times k}\)，冻结 \(W\)，训练 \(A \in \mathbb{R}^{d\times r}, B \in \mathbb{R}^{r\times k}\)（\(r \ll \min(d,k)\)），前向用 \(W + AB\)。直觉：大矩阵的有效更新往往 **低秩**。**QLoRA**：基座权重量化到 **4-bit（NF4 等）**，LoRA 适配器仍 FP16/BF16，显著降显存，精度通过 **双量化** 与 **分页优化器** 缓解损失。

**SFT 流程**：收集高质量 **指令-回答** 对（可多轮），构造 chat 模板，最小化 **交叉熵**（通常只对 assistant 段计算 loss）。数据 **多样性、正确性、格式统一** 直接影响通用指令遵循能力；过量单一风格可能 **过拟合** 模板。

**RLHF（PPO 路线）**：(1) SFT 得 \(\pi_{\text{SFT}}\)；(2) 人类排序训练 **奖励模型** \(r_\phi(x,y)\)；(3) 以 \(r\) 为信号，用 **PPO** 优化策略 \(\pi_\theta\)，加 **KL 惩罚** 约束勿偏离参考模型 \(\pi_{\text{ref}}\) 太远，避免模式崩塌与胡编。工程复杂：需稳定 **优势估计**、**裁剪**、**熵 bonus** 等。

**DPO（简化推导思路）**：设隐式奖励 \(r(x,y)=\beta \log\frac{\pi_\theta(y|x)}{\pi_{\text{ref}}(y|x)}+\beta\log Z(x)\)，Bradley–Terry 模型下偏好概率 \(\mathbb{P}(y_w \succ y_l|x)\propto \sigma(r(x,y_w)-r(x,y_l))\)。代入并取负对数似然，得到对 **策略对数比** 的对比项；直观上 **拉高 \(y_w\) 相对 \(\pi_{\text{ref}}\) 的概率、压低 \(y_l\)**。**β** 控制偏离参考模型的强度：过大易僵化，过小对齐不足。实现上 **无需单独训练奖励模型再 PPO**，训练更稳、更省算力；代价是对 **偏好数据质量** 极度敏感。

**其它偏好优化（了解）**：**IPO、ORPO、SimPO** 等在损失形式或参考项上改进，面试可一句「同属偏好学习族，细节在是否保留显式 ref、是否合 SFT」带过即可。

**GRPO（Group Relative Policy Optimization）**：一组采样回答上 **相对排名/归一化优势** 更新策略，减少 critic 依赖、利于大规模 GRPO 类训练流程（具体形式因实现而异，面试能说「组内相对优势、简化价值估计」即可）。

**数据质量影响**：错误标签会 **巩固幻觉**；重复模板导致 **捷径学习**；长尾领域覆盖不足则 **泛化差**。清洗、去重、难度分层、与评测集 **泄漏防护** 是基线工程能力。

**Full FT 风险**： catastrophic forgetting、存储每个任务全量权重副本成本高；**LoRA 合并**：部署可将 \(AB\) 合并进 \(W\) 或保持旁路热插拔。**学习率**：全参微调通常更小；LoRA 可对适配器略大但仍需调参。**多轮对话 SFT**：须与真实推理 **chat template** 一致（特殊 token、角色标签），否则上线格式漂移。

**RM 训练要点**：人类排序数据需 **一致性**；损失常为 pairwise ranking；RM 过拟合会导致 PPO **过度优化 RM 漏洞**（reward hacking）。**PPO 超参**：clip range、KL coef、价值网络估计方差等均影响稳定性。

**计算与显存**：Full FT 需优化器状态存动量等，显存 **≈ 模型参数数倍**；LoRA 只优化 \(2dr\) 级参数，主流量化+LoRA 可单卡训 7B 级（视序列与 batch 而定，口述留余量）。**合并部署**：推理可将 LoRA 权重合并进基座或动态加载。

**偏好数据构造**：同一 prompt 多采样、人工排序、AI 排序（需防偏见放大）；**拒绝采样** 筛选 SFT 数据也常见。**安全对齐**：除 helpful 外需 harmlessness 维度，DPO 负样本常选 **违规回答** 作 \(y_l\)。

**评测**：MT-Bench、AlpacaEval 等 **模型裁判** 有偏差；应辅以 **规则集、红队用例、领域测试集**。**过对齐**：过度拒绝、复读免责声明，损害可用性，需在奖励或 DPO 权重上折中。

**课程学习**：先易后难、先短后长上下文，可稳定 SFT；对齐阶段 **β/KL** 也可 warmup。**Checkpoints**：保留中间 ckpt 以便回滚灾难性漂移。

**面试串联**：可答「预训练 → SFT 学格式与指令 → 偏好优化学人类偏好 → 线上监控与红队迭代」；**开源对齐栈** 常是 SFT + DPO 因工程简单，闭源大厂仍可能用 **大规模 RLHF**。

**法律与隐私**：微调数据含 PII 会进权重记忆，需 **脱敏与合规审查**；版权争议数据可能带来 **合规风险**（口述 awareness）。

## 示例代码

```python
import torch
import torch.nn as nn

class LinearWithLoRA(nn.Module):
    """单一线性层 + LoRA 旁路（教学示意）。"""

    def __init__(self, in_features: int, out_features: int, rank: int = 8, alpha: float = 16.0):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features, bias=True)
        self.r = rank
        self.scale = alpha / rank
        self.lora_a = nn.Linear(in_features, rank, bias=False)
        self.lora_b = nn.Linear(rank, out_features, bias=False)
        nn.init.kaiming_uniform_(self.lora_a.weight, a=5**0.5)
        nn.init.zeros_(self.lora_b.weight)
        for p in self.linear.parameters():
            p.requires_grad = False

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.linear(x) + self.scale * self.lora_b(self.lora_a(x))


# SFT：仅对 labels != -100 的位置算 loss（与 HF Trainer 一致）
def sft_loss(logits: torch.Tensor, labels: torch.Tensor):
    shift_logits = logits[..., :-1, :].contiguous()
    shift_labels = labels[..., 1:].contiguous()
    loss = nn.functional.cross_entropy(
        shift_logits.view(-1, shift_logits.size(-1)),
        shift_labels.view(-1),
        ignore_index=-100,
    )
    return loss
```

**说明**：`labels` 中用户与 system 段常置为 `-100` 以屏蔽 loss；与 Hugging Face `DataCollatorForCompletionOnlyLM` 思路一致。

## 面试追问

- **追问 1**：LoRA 通常加在哪些层（q/v、全部线性）？rank 与 alpha 的缩放关系对容量与过拟合有何影响？
- **追问 2**：DPO 相对 PPO+RM 的 **训练稳定性** 与 **离线数据分布偏移** 风险各是什么？
- **追问 3**：KL 惩罚在 RLHF 中的作用？若 KL 系数过小/过大分别会怎样？
- **追问 4**：QLoRA 中 **4-bit NormalFloat** 与 **双量化** 各解决什么问题？
- **追问 5**：偏好数据若存在 **标注不一致**（不同标注者标准），对齐目标会如何受损？如何缓解？

## 常见误区

- 认为 **LoRA 参数量少 = 一定比 Full FT 差**——许多任务低秩适配足够，且全参微调更易 **灾难性遗忘**。
- 把 **SFT** 当成 **安全对齐** 唯一手段——有害请求仍可能需 RLHF/DPO/规则层配合。
- **DPO 实现忽略参考模型 \(\pi_{\text{ref}}\)** 或 **β 设置随意**——易导致过拟合偏好或欠对齐。
- 认为 **RLHF 奖励越高越好**——奖励黑客（reward hacking）与 **OOD 上的 RM 误判** 是真实风险。
- 忽视 **数据泄漏**：评测题出现在 SFT 里会虚高指标，面试应能说出划分与去重流程。
- **DPO 与 SFT 顺序/混合** 搞混——常见先 SFT 再 DPO，且 DPO 数据需与 ref 模型分布别太离谱（否则隐式假设弱）。
- 认为 **GRPO 可完全替代 PPO 场景**——需看任务是否适合组采样与相对优势估计，不可一概而论。
