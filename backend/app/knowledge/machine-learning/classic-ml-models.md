# 经典机器学习模型

- **难度**: 基础
- **分类**: 机器学习
- **标签**: [线性模型, SVM, 树模型, 聚类, PCA, 偏差方差, 面试]

## 核心概念

经典机器学习在深度学习方法流行前已形成完整工具链：**线性模型**解释性强；**SVM** 通过核处理非线性；**树与集成**（RF、GBDT 系）在表格数据上仍常胜；**无监督**包括聚类与降维。**偏差-方差权衡**贯穿模型复杂度与正则的选择。

面试重点：假设形式、损失与优化、核与间隔、树的分裂准则、Boosting 与 Bagging 差异、聚类假设、PCA 的方差解释与线性假设。

## 详细解析

### 线性回归与逻辑回归

**线性回归**：最小化 MSE，闭式解或梯度下降；可带 L1（Lasso 稀疏）、L2（Ridge 稳定）弹性网络。

**逻辑回归**：线性打分 + Sigmoid，最大化对数似然（等价 BCE）；多分类用 Softmax；仍是广义线性模型，概率校准可用 Platt/Isotonic。

### SVM 与核函数

**硬/软间隔**：最大化 margin，松弛变量处理不可分；**对偶形式**引入核技巧，无需显式高维映射。**常用核**：线性、多项式、RBF（高斯）。RBF 的 \(\gamma\) 控制局部性：过大易过拟合。SVM 曾是小样本高维利器；大规模时常用线性 SVM 或近似方法。

### 决策树、随机森林、XGBoost、LightGBM

**决策树**：贪心分裂（Gini/信息增益/方差减少），易过拟合，需剪枝或深度限制。

**随机森林**：Bagging + 特征子采样，降低方差，鲁棒，可给特征重要性（需注意偏置）。

**XGBoost / LightGBM**：梯度提升树，串行拟合残差；正则（叶子数、L1/L2）、子采样、直方图近似。**LightGBM** _leaf-wise_ 生长、GOSS/EFB 等，大数据更快；**XGBoost** 生态成熟。表格竞赛与工业界仍首选 GBDT 系处理结构化数据。

### K-Means 与 DBSCAN

**K-Means**：最小化簇内平方和，需指定 K，对初始中心与球形簇敏感；可用肘部法、轮廓系数辅助选 K。

**DBSCAN**：基于密度，可发现任意形状簇与噪声点；参数 \(\varepsilon\)、MinPts 敏感，密度不均时效果受限。

### PCA 降维

对中心化数据求协方差矩阵特征分解（或 SVD），取前 \(k\) 个主成分；线性、无监督，用于去相关、可视化、降噪。**解释方差比**衡量保留信息量；非线性场景可考虑 Kernel PCA、t-SNE（可视化为主，不保全局距离）。

### 偏差-方差与模型选择

**偏差高**：欠拟合，模型太简单；**方差高**：过拟合，对训练集敏感。增加复杂度降偏差但升方差，需交叉验证、正则、集成平衡。

**模型选择**：看数据规模、特征类型（表格优先树模型）、是否需要概率与解释性、延迟与资源；深度学习适合感知与非结构化数据，表格仍常试 GBDT。

### 树模型调参面试要点（概括）

- **学习率 / 树数**：低学习率 + 更多树常更稳，训练时间换精度。
- **max_depth / num_leaves**：控制容量，过大易过拟合；LightGBM 的 leaves 与 XGBoost 的 depth 不可直接等同比较数值。
- **min_child_samples / min_data_in_leaf**：叶子最小样本，增大可抑过拟合。
- **subsample、colsample**：行/列采样，类 Bagging 正则；与随机森林思想一致。
- **early stopping**：验证集监控迭代轮数，工业训练几乎必用。

## 示例代码

```python
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.model_selection import cross_val_score

# 逻辑回归 + 5 折交叉验证示意
def quick_eval(X, y):
    lr = LogisticRegression(max_iter=1000)
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    s_lr = cross_val_score(lr, X, y, cv=5).mean()
    s_rf = cross_val_score(rf, X, y, cv=5).mean()
    return {"logreg_cv": s_lr, "rf_cv": s_rf}

# PCA 保留 95% 方差
def pca_95(X):
    pca = PCA(n_components=0.95)
    return pca.fit_transform(X), pca


# 层次聚类（与 K-Means 的「需指定 K、球形」假设对比记忆）
def hierarchical_labels(X, n_clusters):
    model = AgglomerativeClustering(n_clusters=n_clusters, linkage="ward")
    return model.fit_predict(X)
```

## 面试追问

- 追问 1：从对偶与 KKT 角度说明 SVM 为何只有少数支持向量决定决策边界？
- 追问 2：Bagging 与 Boosting 在偏差、方差上的作用有何不同？
- 追问 3：XGBoost 的二阶泰勒展开在目标函数里起什么作用？
- 追问 4：K-Means 与 GMM（若你熟悉）在「硬分配 vs 软分配」上如何对比？
- 追问 5：PCA 主成分是否等价于原特征空间的旋转？第一主成分如何定义？

## 常见误区

- **逻辑回归** 名字带「回归」却是分类；不要与线性回归混用损失。
- **随机森林「特征重要性」** 对高基数类别或相关特征有偏，解释需谨慎。
- **DBSCAN** 不是「自动最优簇数」：参数调不好全盘皆输。
- 把 **t-SNE** 二维距离当作可度量距离做聚类或下游任务依据。
- **SVM 的「支持向量」** 与软间隔松弛混谈：软间隔允许部分点进间隔带甚至错分，支持向量仍由对偶系数界定。
- **XGBoost vs LightGBM** 只背「快」：应能说出 leaf-wise、直方图、数据并行与精度—速度权衡。
- 线性模型前不做 **特征尺度统一**：若用带正则的线性模型或基于距离的 K-Means/SVM，量纲会影响结果。
