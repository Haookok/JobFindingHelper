# 深度学习基础

- **难度**: 进阶
- **分类**: 机器学习
- **标签**: [反向传播, 归一化, 激活函数, 残差, 梯度消失, 面试]

## 核心概念

神经网络由可微模块堆叠，**前向**计算输出与损失，**反向传播**按链式法则从输出层向输入层逐层求梯度。实践上，**激活函数**引入非线性；**归一化**稳定分布、加速训练；**Dropout** 正则；**初始化**决定早期梯度尺度；**残差连接**缓解极深网络的优化困难与信号衰减。

## 详细解析

### 反向传播

对损失 \(L\)，某层权重 \(W\) 的梯度通过上游梯度 \(\frac{\partial L}{\partial z}\) 与本地雅可比相乘得到。矩阵形式下注意维度与转置。**计算图**视角：每个算子实现 `forward` 与 `backward`，自动微分框架构建图并反向执行。面试常考：Sigmoid 在饱和区导数小导致梯度消失、ReLU 在负半轴为 0 导致「死神经元」。

### 激活函数

- **ReLU**：\(\max(0,x)\)，稀疏激活、计算快；变体 Leaky ReLU、PReLU 缓解死区。
- **GELU**：平滑门控，Transformer 常用，近似高斯 CDF 与 \(x\) 的组合。
- **SiLU / Swish**：\(x \cdot \sigma(x)\)，自门控、平滑，深度网络中有时优于 ReLU。

选择：CNN 传统上 ReLU 系；**Transformer/BERT** 常见 GELU；需可微、平滑时可试 SiLU/Swish。

### BatchNorm、LayerNorm、RMSNorm

- **BatchNorm**：沿 batch 维统计均值方差，训练时用 batch、推理用滑动平均；依赖 batch 大小，对 RNN 不自然。
- **LayerNorm**：沿特征维归一化，样本独立，适合变长序列与 Transformer。
- **RMSNorm**：仅除以均方根缩放，不算均值，计算更省；在部分 LLM 中替代 LN 以提速。

三者都含可学习缩放平移（RMSNorm 常仅 scale），缓解纯归一化表达能力损失。

### Dropout

训练时以概率 \(p\) 随机置零神经元输出，推理时输出乘以 \(1-p\) 或训练时用 inverted dropout。等价于模型平均的近似，减轻共适应过拟合。

### 权重初始化

- **Xavier / Glorot**：适配合适范围的 tanh、Sigmoid，使各层方差大致稳定。
- **Kaiming / He**：针对 ReLU 族，考虑负半轴为 0 的方差折半，深层 CNN 标配。

不当初始化会导致前向激活爆炸/消失，反向同理。

### 梯度消失与爆炸

链式相乘中若每层雅可比范数持续小于/大于 1，则梯度指数衰减/增长。**缓解**：ReLU、残差、Norm、合理初始化、梯度裁剪（针对爆炸）、门控结构（LSTM）。

### 残差连接

\(y = F(x) + x\)，默认学习残差 \(F\)，恒等映射提供梯度捷径，使极深网络可训练；是 ResNet 与现代深层网络的基础构件。

### Pre-LN 与 Post-LN（Transformer 常考点）

- **Post-LN**：子层输出后再 LayerNorm，原始 Transformer 论文采用；深层时训练有时更敏感。
- **Pre-LN**：Norm 放在子层输入侧，梯度路径更直接，许多现代实现默认 Pre-LN 以提升稳定性。
- 面试能说出「何处在加、残差加在 Norm 前还是后」即可，不必死记所有变体（如 DeepNorm）。

### 激活函数选型速记

| 函数 | 特点 | 典型场景 |
|------|------|----------|
| ReLU | 简单、快、有死区 | CNN 传统默认 |
| Leaky ReLU | 负轴小斜率 | 减轻死神经元 |
| GELU | 平滑、非单调 | Transformer |
| SiLU/Swish | 自门控平滑 | 部分 ConvNet/搜索结构 |

## 示例代码

```python
import numpy as np

def relu(x):
    return np.maximum(0, x)

def relu_grad(x):
    return (x > 0).astype(np.float64)

def gelu_approx(x):
    # tanh 近似，面试写公式即可，此处示意
    return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))

def layer_norm(x, gamma, beta, eps=1e-5):
    # x: (batch, dim)
    mean = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    x_hat = (x - mean) / np.sqrt(var + eps)
    return gamma * x_hat + beta

def xavier_uniform(fan_in, fan_out):
    limit = np.sqrt(6 / (fan_in + fan_out))
    return np.random.uniform(-limit, limit, size=(fan_in, fan_out))


def kaiming_uniform(fan_in, fan_out):
    # ReLU 常用 He uniform：方差与 2/fan_in 同量级
    limit = np.sqrt(6 / fan_in)
    return np.random.uniform(-limit, limit, size=(fan_in, fan_out))


def dropout_mask(x, p, train=True, rng=None):
    if not train or p <= 0:
        return x
    rng = rng or np.random.default_rng()
    keep = rng.binomial(1, 1 - p, size=x.shape) / (1 - p)
    return x * keep
```

## 面试追问

- 追问 1：推导一层线性+Sigmoid 下对权重的梯度，并说明饱和区问题。
- 追问 2：BatchNorm 训练与推理行为差异是什么？为何推理不能用 batch 统计？
- 追问 3：残差块若把 \(F(x)\) 缩放为 \(0.1 F(x)\) 或去掉 BN，训练通常会发生什么？
- 追问 4：LayerNorm 与 BatchNorm 在 Transformer 里为何选 LayerNorm？
- 追问 5：Dropout 与 L2 正则、数据增强在「正则化机制」上有何不同？

## 常见误区

- 认为 **BN 总能加速**：极小 batch 或分布式 per-device BN 时统计噪声大，效果变差。
- **GELU** 与 **SiLU** 混为一谈：形式相近但定义与常用场景不同，回答时要说清。
- 把 **梯度裁剪** 当成解决消失的手段。
- **零初始化权重**：对称破坏不了，隐层学不到多样特征，几乎总错误。
- **推理时忘记关闭 Dropout** 或未切换 `eval()`：Dropout 仍在随机丢神经元，指标崩溃。
- **Pre-LN / Post-LN** 只背名字：应能画出一层 block 里 Add 与 Norm 的先后顺序。
