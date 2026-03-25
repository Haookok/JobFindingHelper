# 优化器详解

- **难度**: 进阶
- **分类**: 机器学习
- **标签**: [优化器, Adam, AdamW, 学习率, 大模型训练, 面试]

## 核心概念

优化器决定如何根据损失对参数的梯度更新权重。从朴素 SGD 到自适应学习率方法，核心矛盾是：**收敛速度、泛化能力、内存与计算开销、超参敏感度**。深度学习与大模型训练中，**Adam 系**使用广泛，但 **AdamW**（解耦权重衰减）在 Transformer 等场景上常优于原版 Adam；再配合 **学习率调度** 与 **梯度裁剪** 稳定训练。

## 详细解析

### SGD 与动量

**SGD**：\(\theta \leftarrow \theta - \eta g\)。噪声有助于跳出尖锐极小值，但收敛慢、对 \(\eta\) 敏感。

**动量（Momentum）**：累积速度 \(v \leftarrow \beta v + g\)，\(\theta \leftarrow \theta - \eta v\)，加速一致方向、抑制振荡。

**Nesterov**：先用「lookahead」梯度（近似为在 \(\theta - \beta v\) 处求梯度）再更新，对凸问题有更优界，实践中常与动量写法等价变形实现。

### 自适应学习率：AdaGrad / RMSProp / Adam

- **AdaGrad**：对历史梯度平方累加，分母增大使稀疏特征获得更大有效步长；后期学习率可能过小。
- **RMSProp**：用指数移动平均替代 AdaGrad 的单调累加，缓解学习率过快衰减。
- **Adam**：一阶矩 \(m\)、二阶矩 \(v\) 的偏差修正后组合，默认 \(\beta_1=0.9,\beta_2=0.999\)，收敛快、对缩放相对不敏感。

### AdamW：为何常优于 Adam

原版 Adam 把 **L2 正则**与自适应步长混在一起，**权重衰减**效果与理论 L2 不等价。**AdamW** 将衰减显式作用在参数上：先算 Adam 的更新量，再 \(\theta \leftarrow \theta - \eta \lambda \theta\)（或与框架约定一致的解耦形式）。这样正则与梯度更新分离，在视觉与 NLP 预训练中报告泛化更好。

### 学习率调度

- **Warmup**：前期小学习率再增大，避免一开始二阶估计不准导致不稳定；大 batch、大模型几乎标配。
- **Cosine decay**：按余弦曲线从峰值降到接近 0，无突变，Fine-tune 常用。
- **StepLR / MultiStep**：固定步长衰减，简单可预期，需调 decay 步长与因子。

### 梯度裁剪

将梯度范数限制在阈值内：\(\text{if } \|g\| > c,\ g \leftarrow g \cdot c/\|g\|\)。用于 **RNN、大语言模型** 等缓解梯度爆炸，一般不解决消失问题（需架构或初始化配合）。

### 大模型训练常用策略

混合精度（FP16/BF16）、ZeRO 分片、梯度累积模拟大 batch、**AdamW + Warmup + Cosine**、有时配合 **Muon** 或 **Sophia** 等新优化器做研究；生产仍以 AdamW + 稳定调度为主流。

### SGD vs Adam（口头对比）

- **SGD+Momentum**：单位步长更「可信」的噪声、有时测试集更好，但要调学习率与 schedule，收敛慢。
- **Adam**：默认超参即能用，收敛快，适合稀疏梯度与非稳目标；泛化争议主要来自「自适应步长 + 尖锐极小值」讨论，实践上 **AdamW + 合适 WD** 大幅缓解。
- **选型**：表格小模型可试 SGD；Transformer、扩散、LLM 预训练几乎统一 Adam 系；微调学习率通常比预训练小一个量级以上。

## 示例代码

```python
import numpy as np

def sgd_momentum(params, grads, velocity, lr, beta=0.9):
    """params、grads、velocity 为同形状数组列表"""
    new_v = []
    new_p = []
    for p, g, v in zip(params, grads, velocity):
        v_new = beta * v + g
        p_new = p - lr * v_new
        new_v.append(v_new)
        new_p.append(p_new)
    return new_p, new_v

def clip_grad_norm(grads, max_norm):
    total = np.sqrt(sum(np.sum(g * g) for g in grads))
    if total > max_norm:
        scale = max_norm / (total + 1e-6)
        grads = [g * scale for g in grads]
    return grads

def cosine_lr(step, total_steps, base_lr, min_lr=0.0):
    """线性 warmup 可在外层前几个 step 覆盖 base_lr"""
    t = min(step, total_steps) / max(total_steps, 1)
    return min_lr + 0.5 * (base_lr - min_lr) * (1 + np.cos(np.pi * t))


def linear_warmup_lr(step, warmup_steps, base_lr):
    if step < warmup_steps:
        return base_lr * (step + 1) / max(warmup_steps, 1)
    return base_lr
```

## 面试追问

- 追问 1：Adam 中偏差修正（bias correction）解决什么问题？训练初期 \(m,v\) 为何偏小？
- 追问 2：从优化角度解释 AdamW 与「Adam + L2」在参数更新式上的差异。
- 追问 3：Warmup 为什么能稳定 Transformer 训练？与 LayerNorm、残差尺度有何关系？
- 追问 4：梯度裁剪改变的是梯度方向还是仅尺度？对收敛性有何直观影响？
- 追问 5：大 batch 训练往往需要放大学习率（线性缩放规则），原因与局限是什么？

## 常见误区

- 认为 **Adam 一定比 SGD 泛化好**：部分视觉任务上精心调参的 SGD+Momentum 仍具竞争力。
- **权重衰减与学习率解耦** 混为一谈：在 PyTorch 中应优先用 `AdamW` 的 `weight_decay`，而非在 loss 里重复加 L2 又用错优化器行为。
- **学习率调度** 与 **Warmup** 脱节：Warmup 结束瞬间跳到过大的 peak 仍可能发散，需平滑衔接。
- 把 **梯度裁剪** 当万能药：消失问题要靠门控、残差、Norm、好的初始化等解决。
- **\(\beta_2\) 过小**：二阶矩衰减太快，Adam 接近 RMSProp，对长期尺度估计不稳；一般保持默认除非有明确消融。
- **不同参数组同一学习率**：预训练 backbone 与随机头常用不同 lr（如差 10 倍），否则易破坏已学特征或头欠拟合。
