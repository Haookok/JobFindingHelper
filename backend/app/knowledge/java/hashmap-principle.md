# HashMap 底层原理

- **难度**: 进阶
- **分类**: Java 集合 / 数据结构
- **标签**: [HashMap, JDK8, 红黑树, 扩容, 并发]

## 核心概念

`HashMap` 基于**哈希表**：底层是 **Node 数组**，每个桶（bucket）存放键值对节点。当哈希冲突导致同一桶内元素过多时，JDK8 在链表长度超过阈值（默认 8）且数组长度 ≥ 64 时，将链表**树化为红黑树**；在删除或 resize 后若树节点过少会**退化为链表**，以兼顾平均 O(1) 与最坏情况下的对数级查找。

`put` 时先对 key 做**扰动后的哈希**（高 16 位与低 16 位异或），再 `(n - 1) & hash` 定位下标（`n` 为 2 的幂，等价于取模且更快）。桶为空则直接放入；否则比较 key 是否相等或 `equals`，链表则尾插（JDK8），树则按比较器/Comparable 走树查找。

## 详细解析

**扩容（resize）**：当 `size > capacity * loadFactor`（默认负载因子 0.75）时触发。新容量为旧容量的 **2 倍**，节点重新分布。JDK8 优化：根据 `hash & oldCap` 判断元素落在**原索引**还是 **原索引 + oldCap**，避免重新计算全部哈希，提高效率。

**哈希冲突**：开放寻址法 vs 链地址法；`HashMap` 采用**链地址法**（链表/红黑树）。**负载因子**权衡空间与冲突概率：0.75 在统计上较均衡。

**JDK7 vs JDK8**：JDK7 头插法在并发 resize 时可能形成**环形链表**导致死循环；JDK8 改为尾插，并引入红黑树缓解长链表。JDK8 仍**非线程安全**；`ConcurrentHashMap` 等用于并发场景。

**线程安全**：多线程同时 `put`/扩容可能导致数据丢失、死循环（JDK7）或读写不一致；应用层可用 `Collections.synchronizedMap`、`ConcurrentHashMap` 或外部锁。

**`get` 流程**：对 key 计算与 `put` 相同的哈希与下标；桶空返回 `null`；否则在链表或红黑树中按 `equals`（及 `compareTo`）查找。`containsKey` 与 `get` 逻辑一致，不依赖 `value`。

**null 键值**：`HashMap` 允许 **一个 null 键**（固定放在下标 0 的桶或特殊处理）与**多个 null 值**；`ConcurrentHashMap`（JDK8+）不允许 null 键值，避免并发下二义性（无法区分「不存在」与「值为 null」）。

**与 `equals`/`hashCode` 契约**：相等对象必须同哈希；可变对象作 key 并在哈希相关字段被改后会**找不到条目**，属于设计层面的坑。

**时间复杂度**：平均 `get/put` 为 O(1)；最坏情况下（哈希碰撞极端或全落同桶且未树化前）链表为 O(n)，树化后为 O(log n)。面试可强调「工程实现通过扩容与树化控制最坏情况」。

**与 `IdentityHashMap` 对比**：后者用 `System.identityHashCode` 与引用相等，语义与业务 `equals` 不同，用于序列化、图算法等少数场景。

**快速复述 put 八步（口述版）**：算 hash → 定位下标 → 桶空则新建节点 → 否则首元素 key 命中则替换 value → 否则链表/树查找 → 插入并检查树化 → 检查扩容 → 返回旧 value 或 null。

**`LinkedHashMap` 补充**：在 `HashMap` 基础上维护**双向链表**顺序，支持插入顺序或访问顺序（LRU 常用后者重写 `removeEldestEntry`）。底层仍依赖哈希表定位，只是额外维护链表指针。

**`computeIfAbsent` 等**：JDK8+ 提供的原子语义方法在实现上使用 `synchronized` 锁住单个桶或内部锁（因版本与实现细节而异），面试可答「减少重复计算但仍需理解并发 Map 选 `ConcurrentHashMap`」。

**序列化与 `table` 不序列化**：反序列化后按需懒扩容；面试若问「为何反序列化后结构可能不同」，可答懒初始化与阈值重新计算。

## 示例代码

```java
import java.util.HashMap;
import java.util.Map;

public class HashMapDemo {
    public static void main(String[] args) {
        Map<String, Integer> map = new HashMap<>(16, 0.75f);
        map.put("a", 1);
        map.put("a", 2); // 覆盖同 key
        int h = map.getOrDefault("b", 0);
        System.out.println(map.size() + " " + h);
    }
}
```

面试时可口述：`hashCode` → 扰动 → 下标；equals 契约与 `hashCode` 一致性的重要性。

可手写简化版：自定义 `Student` 作 key 时，`hashCode` 用 `id+name` 稳定字段，`equals` 比较相同字段，并说明**不要**把可变 `List` 放进 `hashCode`。

**`remove` 与 `replace`**：同样先定位桶再在链表/树中查找；返回被删 value 或 boolean 取决于 API；树节点过少时退链需满足 `UNTREEIFY_THRESHOLD`。

**`clear`**：遍历桶置空并 `size=0`，不保证缩容；若需释放大数组引用，可重新 `new HashMap` 替换原引用。

## 面试追问

- **追问 1**：为什么容量必须是 2 的幂？`(n-1)&hash` 与取模的关系、扩容时重哈希如何只依赖 `hash & oldCap`？
- **追问 2**：红黑树阈值为什么是 8、链表阈值为什么是 6（泊松分布与树化/反树化）？`TREEIFY_THRESHOLD` 与 `UNTREEIFY_THRESHOLD` 为何不同？
- **追问 3**：`HashMap` 与 `Hashtable`、`LinkedHashMap`、`ConcurrentHashMap` 在迭代、null 键值、并发上的差异？
- **追问 4**：`resize` 时为何可能死循环（JDK7）？`modCount` 与 `fail-fast` 迭代器在什么情况下抛 `ConcurrentModificationException`？

## 常见误区

- 认为 JDK8 头插改尾插后 `HashMap` 就**线程安全**了——仍非线程安全，只是避免了 JDK7 的典型死循环场景。
- 自定义 key 只重写 `equals` 不重写 `hashCode`，导致**相同逻辑对象**落到不同桶，表现为「找不到已 put 的键」。
- 把「负载因子调很小」当成万能药：会降低冲突但**浪费内存**、更频繁扩容；默认 0.75 有统计学依据。
- 在 foreach 中**边遍历边非迭代器安全地修改**结构，误以为偶尔不报错就是安全——应使用迭代器 `remove` 或换并发集合。
- 初始容量传「预期元素个数」却忽略负载因子：`threshold = capacity * loadFactor`，仅按元素个数设 cap 仍会频繁扩容。
- 误以为 `keySet()`/`values()` 返回独立集合副本——实为**视图**，底层仍指向同一 `HashMap`，修改会相互影响。
