# 排序算法

- **难度**: 基础
- **分类**: 算法 / 排序
- **标签**: [冒泡, 快排, 归并, 堆排序, 稳定性, 复杂度]

## 核心概念

排序将序列按关键字非降序（或非增序）重排。**时间复杂度**描述随 n 增长的趋势；**空间复杂度**指额外辅助空间。**稳定性**：相等元素排序后相对顺序不变——对多关键字排序或需要稳定语义时重要。

## 详细解析

| 算法 | 平均时间 | 最坏时间 | 空间 | 稳定性 |
|------|----------|----------|------|--------|
| 冒泡 | O(n²) | O(n²) | O(1) | 稳定 |
| 选择 | O(n²) | O(n²) | O(1) | 不稳定 |
| 插入 | O(n²) | O(n²) | O(1) | 稳定 |
| 归并 | O(n log n) | O(n log n) | O(n) | 稳定 |
| 快排 | O(n log n) | O(n²) | O(log n) 栈均摊 | 不稳定 |
| 堆排序 | O(n log n) | O(n log n) | O(1) | 不稳定 |

**冒泡**：相邻比较交换，每轮最大「沉底」；可提前无交换则结束。

**选择**：每轮选最小放到前面；交换可能跨过相等元素 → 不稳定。

**插入**：维护有序前缀，逐个插入；近乎有序时接近 O(n)。

**归并**：分治合并两个有序数组；需 O(n) 辅助数组，适合**链表**或**外排序**多路归并。

**快排**：选 pivot 划分；随机 pivot 或三数取中缓解最坏；小区间可换插入排序。**TimSort**（Python、Java `Arrays.sort` 对象）是归并+插入的混合工业实现。

**堆排序**：建最大堆，反复弹出堆顶；原地、最坏 O(n log n)，但常数因子与缓存友好性通常不如快排。

**实际应用场景**：

- **标准库**：C++ `std::sort` 多为内省排序（快排 + 堆排序防退化）；Go `sort.Slice` 为快排；Python `list.sort` 为 Timsort。
- **稳定性需求**：电商订单按金额排序后再按下单时间稳定排序，需稳定算法或一次复合键排序。
- **链表**：归并可 O(1) 辅助实现原地归并思路（面试常考）；快排链表需小心 pivot 选择。
- **海量数据**：外排序 = 分块排序 + k 路归并，归并思想是核心。

**计数排序 / 桶排序 / 基数排序**：在关键字范围有限或可分解为位/桶时可达 O(n) 级别，需额外空间或数据分布假设，与比较排序下界 O(n log n) 不矛盾。

## 示例代码

```python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + mid + quick_sort(right)


def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    m = len(arr) // 2
    left, right = merge_sort(arr[:m]), merge_sort(arr[m:])
    return merge(left, right)


def merge(a, b):
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i])
            i += 1
        else:
            out.append(b[j])
            j += 1
    return out + a[i:] + b[j:]


# 插入排序：近乎有序时性能好，可作快排小区间 fallback
def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr
```

## 面试追问

- **追问 1**：快排最坏 O(n²) 何时发生？如何工程上避免？
- **追问 2**：归并排序链表为什么可以做到 O(1) 辅助空间思路？（拆半递归合并）
- **追问 3**：哪些排序是稳定的？不稳定排序举例说明「相等元素顺序改变」的场景危害。
- **追问 4**：Java `Arrays.sort` 对基本类型与引用类型为何策略不同？

## 常见误区

- 背复杂度却说不清**递归栈**算不算空间（快排平均 O(log n) 栈深）。
- 认为「快排一定比堆排序快」——与数据分布、实现、常数有关；堆排序最坏更稳。
- 忽略 **n 很小** 时 O(n²) 插入/希尔可能更优（小区间优化）。
- 认为 **原地排序** 空间一定是 O(1)——递归实现快排仍占调用栈空间。
- 混淆 **比较次数与赋值次数**——面试手写时要能说清主要代价来自比较还是移动元素。
