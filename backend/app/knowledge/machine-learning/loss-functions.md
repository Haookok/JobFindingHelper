# 损失函数详解

- **难度**: 进阶
- **分类**: 机器学习
- **标签**: [损失函数, 交叉熵, 对比学习, 类别不均衡, 面试]

## 核心概念

损失函数衡量模型预测与真实目标之间的差异，训练过程即最小化期望损失。不同任务（回归、分类、排序、表征学习）对应不同损失形态；同一任务也可能有多种可选损失，需在可优化性、鲁棒性、对数据分布与类别比例的敏感性之间权衡。

面试中常考：各损失的数学形式、梯度性质、适用场景，以及为何交叉熵配 Softmax 是分类标配、Focal Loss 与对比学习损失解决了什么问题。

## 详细解析

### 回归：MSE、MAE、Huber

- **MSE** \(L=\frac{1}{n}\sum (y-\hat{y})^2\)：处处可导，对大误差惩罚更重，易受离群点主导；最优预测在期望意义下与条件期望相关。
- **MAE** \(L=\frac{1}{n}\sum |y-\hat{y}|\)：对离群点更鲁棒，但在 0 处次可导，优化时可能不如 MSE 平滑。
- **Huber**：在误差小于阈值 \(\delta\) 时像 MSE，大于 \(\delta\) 时像 MAE，兼顾平滑与鲁棒，\(\delta\) 需调参。

### 分类：交叉熵

二分类常用 **二元交叉熵**（配合 Sigmoid）；多分类用 **多类交叉熵**（配合 Softmax）。Softmax 将 logits 转为概率分布，与 one-hot 或软标签的交叉熵等价于最大化正确类别的对数概率。标签平滑是在硬标签上混入均匀分布，减轻过拟合与过度自信。

### 类别不均衡：Focal Loss

标准 CE 在前景/背景极度不均衡时，易由易分类样本主导梯度。**Focal Loss** 在 CE 上乘 \((1-p_t)^\gamma\)，降低易样本权重、突出难样本；可再乘 \(\alpha_t\) 做类别平衡。目标检测等场景中常用。

### 度量学习与对比：对比损失、三元组损失

- **对比损失**（如 Siamese）：同类样本距离小、异类距离大，常带 margin，使异类对超过 margin 后不再惩罚。
- **三元组损失**：anchor 与 positive 近、与 negative 远，\(L=\max(0, d(a,p)-d(a,n)+m)\)，对难负样本 mining 敏感。

### KL 散度与 InfoNCE

- **KL 散度** \(D_{KL}(P\|Q)\)：衡量两分布差异，非对称；在 VAE 中常出现，与重构损失联合训练。
- **InfoNCE**（对比学习）：在一批样本中把正样本对拉近、负样本推远，与互信息下界相关；SimCLR、MoCo 等框架的核心损失形式。

### 选择策略

回归看离群点比例选 MSE/MAE/Huber；分类看类别数与是否不均衡（CE、加权 CE、Focal）；表征与检索看 InfoNCE、三元组等；知识蒸馏常用 KL 匹配教师与学生分布。还需考虑数值稳定（log-sum-exp）、与输出层（Sigmoid/Softmax）的配对。

### 面试速记表（口头表达用）

| 场景 | 常用损失 | 一句话理由 |
|------|----------|------------|
| 回归、误差近似高斯 | MSE | 可导、与极大似然一致 |
| 回归、离群点多 | MAE / Huber | 鲁棒或折中 |
| 二分类 | BCE + Sigmoid | 概率校准、梯度清晰 |
| 多分类 | CE + Softmax | 多类互斥、数值稳定实现成熟 |
| 检测/不均衡分类 | Focal / 加权 CE | 抑制易负样本主导 |
| 对比学习 | InfoNCE | 拉近正对、推远负对，互信息视角 |
| 蒸馏 | KL + CE | 匹配软标签与硬标签 |

## 示例代码

```python
import numpy as np

def mse(y_true, y_pred):
    return np.mean((y_true - y_pred) ** 2)

def binary_cross_entropy(y_true, p_pred, eps=1e-7):
    p_pred = np.clip(p_pred, eps, 1 - eps)
    return -np.mean(y_true * np.log(p_pred) + (1 - y_true) * np.log(1 - p_pred))

def focal_loss_binary(y_true, p_pred, gamma=2.0, alpha=0.25, eps=1e-7):
    p_pred = np.clip(p_pred, eps, 1 - eps)
    ce = -(y_true * np.log(p_pred) + (1 - y_true) * np.log(1 - p_pred))
    p_t = np.where(y_true == 1, p_pred, 1 - p_pred)
    mod = (1 - p_t) ** gamma
    a_t = np.where(y_true == 1, alpha, 1 - alpha)
    return np.mean(a_t * mod * ce)

# 多类交叉熵（一行 logits，配合 softmax 在训练框架中更常见）
def softmax(logits):
    z = logits - np.max(logits, axis=-1, keepdims=True)
    e = np.exp(z)
    return e / np.sum(e, axis=-1, keepdims=True)

def cross_entropy_multiclass(y_onehot, logits):
    p = softmax(logits)
    return -np.mean(np.sum(y_onehot * np.log(p + 1e-7), axis=-1))


def huber_loss(y_true, y_pred, delta=1.0):
    err = y_true - y_pred
    abs_err = np.abs(err)
    quad = 0.5 * err**2
    linear = delta * (abs_err - 0.5 * delta)
    return np.mean(np.where(abs_err <= delta, quad, linear))
```

## 面试追问

- 追问 1：为什么分类里 Softmax + 交叉熵的梯度对 logits 有简洁形式？从推导角度说明。
- 追问 2：Focal Loss 中 \(\gamma\) 和 \(\alpha\) 分别起什么作用？若 \(\gamma=0\) 退化成什么？
- 追问 3：对比损失与三元组损失在难样本挖掘上的区别是什么？InfoNCE 与「多分类 CE」在形式上如何统一理解？
- 追问 4：KL(P||Q) 与 KL(Q||P) 不对称，在变分推断里通常用哪一种近似？为什么？
- 追问 5：回归任务若标签长尾或含大量噪声，你会如何改损失或训练流程？

## 常见误区

- 把 **BCE** 与 **多类 CE** 混用：二分类可用单 logit+Sigmoid+BCE，或多二选一 Softmax+CE，但接口与标签编码要一致。
- 认为 **Focal Loss** 万能：极度稀疏时仍需采样策略、类别权重或两阶段检测等配合。
- 忽略 **数值稳定**：手写 log(softmax) 应使用 log-softmax 或框架内置实现，避免 exp 溢出。
- **对比学习** 只背 InfoNCE 公式却不理解温度系数 \(\tau\)：\(\tau\) 过小梯度尖锐、过大则区分度弱。
- **多标签**（标签可同时为 1）误用 Softmax+CE：应独立 Sigmoid+BCE 或基于排序的损失，否则互斥假设错误。
- 回归任务盲目上 **MSE** 而不看残差分布：重尾或异方差时可试分位数损失、或对输入输出做变换。
