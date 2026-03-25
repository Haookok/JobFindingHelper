# 模型评估指标

- **难度**: 基础
- **分类**: 机器学习
- **标签**: [指标, AUC, 混淆矩阵, NLP, 目标检测, 交叉验证, 面试]

## 核心概念

评估指标就像**体检报告**——你不能只看一个数字就判断一个人健不健康。

血压正常不代表血糖也没问题，体重达标不代表心脏健康。模型也一样：准确率高不一定代表模型好，可能只是因为大部分数据本来就是同一类。你需要从多个角度去看，才能得到全面的"健康状况"。

不同的业务关心不同的"体检项"：医疗诊断最怕漏诊（关心召回率），垃圾邮件过滤最怕误杀好邮件（关心精确率），风控系统关心排序能力（看 AUC）。

## 详细解析

### Accuracy / Precision / Recall / F1——四大基础体检项

先用一个例子：你做了一个"判断邮件是否是垃圾邮件"的模型。

- **Accuracy（准确率）**：所有邮件里，判断对了多少比例。听起来很好对吧？但如果 100 封邮件里只有 1 封垃圾邮件，你全判成"正常"也有 99% 准确率——这就是准确率的坑。
- **Precision（精确率）**：你说是垃圾的邮件里，真正是垃圾的有多少。关注的是"报得准不准"——误报多不多。
- **Recall（召回率）**：所有真正的垃圾邮件里，你找出了多少。关注的是"有没有漏"——漏网之鱼多不多。
- **F1**：Precision 和 Recall 的调和平均，用一个数字平衡"准"和"全"。

多分类时有三种算法：macro（每个类别平等对待）、micro（全局统计）、weighted（按类别数量加权）。

### AUC-ROC 与 PR 曲线——"排名能力"体检

模型输出的是一个分数（比如 0.7），我们需要设定一个阈值（比如 0.5 以上算正类）。不同阈值会得到不同的 Precision 和 Recall。

- **ROC 曲线**：画出不同阈值下"真阳性率"和"假阳性率"的关系。**AUC** 就是这条曲线下的面积，可以理解为"随机拿一个正样本和一个负样本，模型给正样本打的分更高的概率"。
- **PR 曲线**：画出不同阈值下 Precision 和 Recall 的关系。正类很少时，PR 曲线比 ROC 更诚实。

体检类比：ROC-AUC 像"综合体质评分"，PR-AUC 像"针对某个高危疾病的专项检查"。

### 混淆矩阵——体检的"原始数据表"

一个 2×2 的表格，记录了四种情况：真正例(TP)、假正例(FP)、真负例(TN)、假负例(FN)。所有分类指标都是从这个表格算出来的。多分类扩展为 K×K 矩阵，可以看出哪两个类别最容易搞混。

**面试小技巧：回答前先声明你的行列约定（行是真实标签还是预测标签），避免读反了所有指标都算错。**

### BLEU 与 ROUGE——文本生成的"批改作文"

- **BLEU**：看生成的文本和参考答案有多少共同的 n-gram（连续 n 个词），偏向"精确率"——你生成的内容有多少是靠谱的。机器翻译常用。
- **ROUGE**：看参考答案里有多少内容被你的生成结果覆盖了，偏向"召回率"——参考答案的要点你覆盖了多少。文本摘要常用。

两者都是自动指标，跟人类判断不完全一致。重要任务还得配人工评估或用 LLM 打分。

### mAP——目标检测的"全面体检"

检测任务要同时判断"框画得准不准"（IoU）和"类别判对没"。先按置信度排序，在不同 IoU 阈值下算 PR 曲线得到 AP，再对所有类别取平均就是 mAP。COCO 数据集用 IoU 从 0.5 到 0.95 取多个阈值，要求很严格。

### 过拟合判断——"体检异常"信号

训练集上的指标远好于验证集？这就像"平时模考 90 分，正式考试只有 60 分"——典型的过拟合。解决办法：更多数据、数据增强、Dropout、权重衰减、早停、简化模型。

### 交叉验证——多做几次体检取平均

只做一次体检可能有偶然性。**K-Fold 交叉验证**把数据分成 K 份，轮流用其中一份做测试、其余做训练，最后取平均。**Stratified K-Fold** 还保持每折里的类别比例一致。

**时间序列数据不能用随机 K-Fold！** 必须用"前向链式验证"，否则就像用下周的数据预测上周——作弊了。

### 怎么选指标？看业务场景

1. **类别均衡、关心整体对错**：Accuracy + 混淆矩阵足够。
2. **不均衡、关心正类**：Recall + PR 曲线 + F1，根据业务定阈值。
3. **排序/风控**：AUC-ROC；正类极少时看 PR-AUC。
4. **文本生成**：BLEU/ROUGE 做自动参考，配合人工抽检。
5. **目标检测**：COCO mAP 标准。

## 示例代码

```python
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    roc_auc_score, average_precision_score, confusion_matrix,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score

# 二分类全套"体检报告"：准确率、精确率、召回率、F1、AUC、AP、混淆矩阵
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

# 分层 K-Fold 交叉验证：保持每折类别比例一致，结果更可靠
def stratified_cv_score(model, X, y, k=5):
    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=42)
    return cross_val_score(model, X, y, cv=skf, scoring="f1_macro")

# MCC（马修斯相关系数）：类别极不均衡时比 Accuracy 靠谱得多
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

- 面试官可能会这样问你：Precision 和 Recall 的权衡在调阈值时怎么体现？什么业务更在乎哪个？
- 面试官可能会这样问你：为什么在类别极不均衡时，AUC-ROC 可能看起来很好，但 PR-AUC 很差？
- 面试官可能会这样问你：目标检测的 mAP 是怎么从检测框匹配和排序中算出来的？和二分类的 AP 有什么关系？
- 面试官可能会这样问你：K-Fold 里 K 越大方差越小吗？K 取太大有什么代价？
- 面试官可能会这样问你：BLEU 只看 n-gram 重叠，能举一个它明显"失灵"的例子吗？

## 常见误区

- 很多人会搞混的地方：**准确率高 = 好模型**。类别不均衡时，全判多数类也能 Accuracy 90%+，必须看 F1、MCC 或 AUC-PR。
- 很多人会搞混的地方：把 **AUC 当成概率校准指标**。AUC 只衡量排序能力，概率准不准要看 reliability diagram 和 Brier score。
- 很多人会搞混的地方：**混淆矩阵行列读反**。不同库的约定不同（有的行是真实标签，有的是预测标签），读反了所有指标全错。
- 很多人会搞混的地方：在时间序列上用**随机 K-Fold**，用了未来数据预测过去，验证分数虚高。
- 很多人会搞混的地方：**macro-F1 和 micro-F1 不分**。macro 对每个类别平等对待，micro 按全局样本计数——类别不均衡时差异可以很大。
- 很多人会搞混的地方：以为 **BLEU 分高就是翻译好**。模型可能只是重复了一些高频 n-gram，语义可能完全跑偏。
