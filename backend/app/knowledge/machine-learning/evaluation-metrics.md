# 模型评估指标

- **难度**: 基础
- **分类**: 机器学习
- **标签**: [指标, AUC, 混淆矩阵, NLP, 目标检测, 交叉验证, 面试]

## 核心概念

评估指标将模型输出与标注比对，量化「有多好」。**分类**常用 Accuracy、Precision、Recall、F1、AUC-ROC、PR 曲线；**NLP** 生成与摘要用 BLEU、ROUGE；**目标检测**用 mAP。**过拟合**通过训练/验证差距与交叉验证判断；缓解靠正则、数据、早停等。**交叉验证**降低单次划分的偶然性，小数据尤其重要。

## 详细解析

### Accuracy / Precision / Recall / F1

- **Accuracy**：正确比例；类别极不均衡时误导（全判负也可能很高）。
- **Precision**：预测为正中真正为正的比例，关注「报的准不准」。
- **Recall**：真正为正中被找出的比例，关注「漏没漏」。
- **F1**：Precision 与 Recall 的调和平均，单一标量平衡二者。

多分类可用 macro（每类平等）、micro（全局计数）、weighted（按支持度加权）。

### AUC-ROC 与 PR 曲线

**ROC**：横轴 FPR、纵轴 TPR，不同阈值下曲线；**AUC** 为随机正样本得分高于负样本的概率，对排序能力敏感。类别极不均衡时 ROC 可能乐观。

**PR 曲线**：横轴 Recall、纵轴 Precision，更关注正类稀少场景；**AP**（PR 下面积）常与业务「宁可少报不要错报」等目标对照阅读。

### 混淆矩阵

行/列为真实/预测（约定因库而异），读出 TP、FP、TN、FN，是一切二分类指标的基础；多分类可扩展为 \(K\times K\) 看哪两类易混。

### BLEU 与 ROUGE（NLP）

- **BLEU**：n-gram 精确率 + 短句惩罚，机器翻译常用；对流畅度与语义覆盖有限。
- **ROUGE**：召回导向的 n-gram 重叠，摘要评测常用 ROUGE-L 等。

二者都是自动指标，与人类判断不完全一致；生成任务还需人工或 LLM-as-judge 辅助。

### mAP（目标检测）

在不同 IoU 阈值（如 COCO 0.5:0.95）下，各类别 **AP** 再平均。**IoU** 衡量框重叠；先按置信度排序算 PR 曲线得 AP。面试需能说清：为何要多个 IoU、AP 与 AUC 的相似性。

### 过拟合判断与解决

**现象**：训练指标远好于验证/测试，或 CV 方差大。**手段**：更多数据、增强、Dropout/权重衰减、早停、简化模型、集成、标签噪声清洗。

### 交叉验证

**K-Fold**：数据分 K 份轮流做验证；**Stratified** 保持类别比例；**Leave-One-Out** 极费算力仅小样本。**时间序列**需用前向链式验证，避免泄露未来信息。

### 指标选择决策（面试表述）

1. **类别均衡、关心整体对错**：Accuracy + 混淆矩阵。
2. **不均衡、关心正类检出**：Recall + PR 曲线 + F1；业务定阈值时用 **代价敏感** 混淆矩阵解读。
3. **排序/风控评分**：AUC-ROC；若负样本极多再看 PR-AUC。
4. **生成/摘要**：BLEU/ROUGE 作自动参考，辅以抽样人工评审。
5. **检测**：COCO 风格 mAP；单类任务可报告 AP@0.5。

### MCC 与 Cohen's Kappa（补充）

**马修斯相关系数 MCC** 在类别极不均衡时比 Accuracy 更均衡地综合 TP/TN/FP/FN。**Kappa** 衡量与随机一致相比的提升，适合标注一致性评估；面试提到「不均衡别看单一 Accuracy」时顺带一句即可加分。

## 示例代码

```python
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score

def binary_report(y_true, y_score, threshold=0.5):
    y_pred = (y_score >= threshold).astype(int)
    acc = accuracy_score(y_true, y_pred)
    p, r, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="binary", zero_division=0
    )
    auc = roc_auc_score(y_true, y_score)
    ap = average_precision_score(y_true, y_score)
    cm = confusion_matrix(y_true, y_pred)
    return {"acc": acc, "p": p, "r": r, "f1": f1, "auc": auc, "ap": ap, "cm": cm.tolist()}

def stratified_cv_score(model, X, y, k=5):
    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=42)
    return cross_val_score(model, X, y, cv=skf, scoring="f1_macro")


def matthews_corrcoef_binary(y_true, y_pred):
    tn = np.sum((y_true == 0) & (y_pred == 0))
    tp = np.sum((y_true == 1) & (y_pred == 1))
    fn = np.sum((y_true == 1) & (y_pred == 0))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    num = tp * tn - fp * fn
    den = np.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)) + 1e-12
    return num / den
```

## 面试追问

- 追问 1：Precision 与 Recall 的权衡在阈值调整上如何体现？什么业务更在乎哪一个？
- 追问 2：为何不均衡数据下 AUC-ROC 可能「看起来很好」但 PR-AUC 很差？
- 追问 3：mAP 中 AP 如何从检测框匹配与排序得到？与二分类 PR 的 AP 有何联系？
- 追问 4：K-Fold 交叉验证的方差随 K 变化有什么趋势？过大 K 有何代价？
- 追问 5：BLEU 只基于 n-gram 会有哪些典型失效案例？

## 常见误区

- **高 Accuracy** 即好模型：不均衡时必看 **MCC**、F1、AUC-PR 等。
- 把 **AUC** 当成「概率校准」：AUC 只关心排序，校准要看 reliability diagram、Brier score。
- **混淆矩阵** 行列读反导致指标全错，答题前先声明约定。
- 在时间序列上用 **随机 K-Fold** 造成标签泄露，验证分数虚高。
- **macro-F1** 与 **micro-F1** 不分：macro 每类平等，micro 等价全局计数，不均衡时二者可差异很大。
- **BLEU 高** 等于人类觉得好：可能存在流畅但错误语义或重复 n-gram 投机。
- **mAP** 与 **mean AP over classes** 在数据集定义上混用：先说清是单类 AP 还是多类平均。
