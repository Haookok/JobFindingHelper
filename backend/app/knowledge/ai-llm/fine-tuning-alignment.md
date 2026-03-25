# 模型微调与对齐

- **难度**: 深入
- **分类**: AI / LLM
- **标签**: [LoRA, QLoRA, SFT, RLHF, DPO, GRPO, PEFT, 对齐]

## 核心概念

想象一下：预训练好的大模型就像一个**博学但没礼貌的天才**——什么都知道一点，但你问它问题它可能跑题、说废话、甚至说有害内容。它毕竟只学了"预测下一个词"，没有人教过它"怎么好好回答问题"。

**微调（Fine-tuning）** 就是给这个天才做**专业培训**——比如教它当客服、写代码、做医疗问答。

**对齐（Alignment）** 就是教它**说人话、做好事**——遵循指令、拒绝有害请求、输出格式规范。

为什么不能只靠预训练？因为预训练的目标是"给一段文字接着写"，而我们需要的是"听懂问题、回答正确、不乱说"。这两个目标之间有鸿沟，微调和对齐就是来填这个沟的。

## 详细解析

### LoRA：省钱版微调

**全参数微调（Full Fine-tuning）** 要更新模型所有参数，一个 7B 模型光优化器状态就要占好几十 GB 显存——普通人根本玩不起。

**LoRA** 的核心思路特别巧妙：大矩阵的更新量其实是**低秩的**（有效信息维度远低于矩阵本身维度）。好比你改一篇万字论文，实际改动的可能就几百字。

具体做法：冻结原始权重 W 不动，旁边接两个小矩阵 A 和 B（一个把维度降下来，一个升回去），只训练这两个小矩阵。推理时 W + A×B 就是微调后的效果。参数量从几十亿降到几百万，**单卡就能训 7B 模型**。

**QLoRA** 更进一步：把基座模型权重压缩到 4-bit，LoRA 部分保持 16-bit 精度。显存再砍一大截，精度靠"双量化"技术兜住。

### SFT：教模型"听话"

**SFT（Supervised Fine-Tuning，监督微调）** 是对齐的第一步。收集一批高质量的"指令-回答"对（比如"请用 200 字总结这篇文章" → 高质量摘要），让模型模仿学习。

关键细节：计算 loss 时**只算模型回答的部分**，用户的提问部分标记为 -100 跳过。道理很简单——你教学生写作文，打分只看他写的内容，不会给题目打分。

数据质量极其重要：错误答案会让模型"把错的记得更牢"；格式不统一会让模型无所适从；数据太单一会让模型只会一种腔调。

### RLHF：让人类当裁判

SFT 之后模型会"听话"了，但回答质量参差不齐。**RLHF（人类反馈强化学习）** 的思路是让人类来打分：

1. 同一个问题让模型生成多个答案
2. 人类排序：这个答案比那个好
3. 用排序数据训练一个**奖励模型（RM）**——它学会了"什么样的回答人类觉得好"
4. 用奖励模型的评分做信号，通过 **PPO 算法**优化模型，让它学会生成得分更高的回答

同时有一个 **KL 惩罚** 拴住模型——不让它为了讨好打分器而跑偏太远（否则可能学会"说好听的废话"来骗高分）。

### DPO：更简单的对齐方式

RLHF 工程上太复杂了（要训奖励模型、跑 PPO、调一堆超参）。**DPO（Direct Preference Optimization）** 换了个思路：**直接用偏好数据训练策略模型，不需要单独训奖励模型**。

直觉上就是：给模型看一对回答（一个好的 y_w，一个差的 y_l），让模型学会"好回答的概率要比参考模型更高，差回答的概率要更低"。**β 参数**控制偏离参考模型的幅度——太大模型僵化，太小对齐不够。

DPO 训练更稳、更省算力，开源社区主流用 SFT + DPO。代价是对**偏好数据质量极度敏感**——标注不一致会直接带崩。

### GRPO：组内相对排名

**GRPO** 的做法是对同一个问题采样一组回答，在组内做相对排名来估计优势，减少对额外价值网络的依赖。面试能说"组内相对优势、简化价值估计"就够了。

### 完整的对齐流水线

**预训练** → **SFT**（学格式和指令遵循）→ **偏好优化 DPO/RLHF**（学人类偏好）→ **线上监控 + 红队迭代**（持续改进）

## 示例代码

```python
import torch
import torch.nn as nn


class LinearWithLoRA(nn.Module):
    """LoRA 旁路：冻结原始权重，只训练两个小矩阵 A 和 B"""

    def __init__(self, in_features: int, out_features: int, rank: int = 8, alpha: float = 16.0):
        super().__init__()
        self.linear = nn.Linear(in_features, out_features, bias=True)
        self.scale = alpha / rank  # 缩放因子，控制 LoRA 更新的幅度
        # A 矩阵：把高维降到低维（rank）
        self.lora_a = nn.Linear(in_features, rank, bias=False)
        # B 矩阵：再从低维升回高维。初始化为 0，训练开始时 LoRA 不改变原始行为
        self.lora_b = nn.Linear(rank, out_features, bias=False)
        nn.init.kaiming_uniform_(self.lora_a.weight, a=5**0.5)
        nn.init.zeros_(self.lora_b.weight)
        # 冻结原始权重——这是 LoRA 的灵魂
        for p in self.linear.parameters():
            p.requires_grad = False

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 原始输出 + LoRA 旁路输出
        return self.linear(x) + self.scale * self.lora_b(self.lora_a(x))


def sft_loss(logits: torch.Tensor, labels: torch.Tensor):
    """
    SFT 损失：只对模型回答的部分算 loss
    labels 中用户提问部分设为 -100，cross_entropy 会自动跳过
    """
    shift_logits = logits[..., :-1, :].contiguous()
    shift_labels = labels[..., 1:].contiguous()
    return nn.functional.cross_entropy(
        shift_logits.view(-1, shift_logits.size(-1)),
        shift_labels.view(-1),
        ignore_index=-100,
    )
```

**运行说明**：需安装 `torch`。实际项目中推荐用 Hugging Face 的 `peft` 库和 `trl` 库，几行代码就能完成 LoRA + SFT + DPO 全流程。

## 面试追问

- **面试官可能会这样问你**：LoRA 一般加在模型的哪些层？rank 和 alpha 怎么影响效果和过拟合风险？
- **面试官可能会这样问你**：DPO 比 RLHF+PPO 简单，但有什么不好的地方？比如数据分布偏移的问题。
- **面试官可能会这样问你**：RLHF 里的 KL 惩罚是干嘛的？系数设太大或太小分别会怎样？
- **面试官可能会这样问你**：QLoRA 里的 4-bit NormalFloat 和双量化分别解决什么问题？
- **面试官可能会这样问你**：如果偏好标注数据的标注者之间标准不一致，对齐结果会怎样？怎么缓解？

## 常见误区

- **很多人会搞混的地方**：认为 LoRA 参数少 = 效果一定比全参数微调差——大多数任务低秩适配就够了，全参微调反而更容易"灾难性遗忘"（把原来会的东西忘了）。
- **很多人会搞混的地方**：以为做完 SFT 就对齐好了——SFT 只是教模型格式和基本指令遵循，面对"教我做炸弹"这种有害请求，还需要 RLHF/DPO 来建立拒绝能力。
- **很多人会搞混的地方**：DPO 实现时忘了参考模型 π_ref 或者 β 随便设——这会导致过拟合偏好或者对齐不足。
- **很多人会搞混的地方**：追求奖励模型评分越高越好——分数太高可能是"reward hacking"，模型学会了说好听的废话骗高分，但实际回答质量下降。
- **很多人会搞混的地方**：评测集的数据出现在了 SFT 训练数据里——这叫数据泄漏，指标虚高但实际能力没提升，面试时要能说出如何做数据划分和去重。
- **很多人会搞混的地方**：搞不清 SFT 和 DPO 的先后顺序——一般是先 SFT 再 DPO，且 DPO 的偏好数据要和参考模型的分布不能差太远。
