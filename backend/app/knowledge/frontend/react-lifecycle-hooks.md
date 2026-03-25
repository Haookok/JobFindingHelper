# React 生命周期与 Hooks

- **难度**: 进阶
- **分类**: 前端 / React
- **标签**: [生命周期, Hooks, Fiber, 虚拟 DOM, diff]

## 核心概念

**类组件**通过生命周期方法响应挂载、更新、卸载（如 `componentDidMount`、`componentDidUpdate`、`componentWillUnmount`）。React 16.3+ 推荐使用 `getDerivedStateFromProps`、`getSnapshotBeforeUpdate` 等替代部分不安全的老生命周期。

**函数组件**无实例，用 **Hooks** 表达状态与副作用：`useState` 管理状态，`useEffect` 对接副作用（含「类组件里 DidMount + DidUpdate」的语义，通过依赖数组控制），`useMemo`/`useCallback` 缓存计算与函数引用以配合子组件 `memo` 优化。**Fiber** 是 React 16 起的协调引擎：把更新拆成可中断的工作单元，支持优先级与并发特性。

**虚拟 DOM** 是 JS 对象描述的 UI 树；**diff** 在 Fiber 上通过「同层比较、key 标识可移动子节点」等启发式，尽量复用 DOM，减少真实更新。

## 详细解析

**类生命周期脉络**：挂载（constructor → render → commit → DidMount）→ 更新（New props/state → render → commit → DidUpdate）→ 卸载（WillUnmount）。`render` 须纯函数；副作用放 DidMount/DidUpdate 或 Hooks 的 effect。

**Hooks 规则**：只在函数顶层调用；不在循环/条件里调用（保证 Hook 调用顺序稳定，与内部链表对应）。

**useEffect 依赖**：依赖数组缺失时每次渲染后都执行；空数组近似 DidMount；依赖变化才执行。`useLayoutEffect` 在 DOM 变更后、浏览器绘制前同步执行，适合测量布局。

**Fiber 与更新**：每次更新从根或优先级起点遍历 Fiber 树，可打断与恢复；`Concurrent Mode` 下低优先级更新可被高优先级打断。

**Diff 要点**：不同类型元素整子树替换；同类型比较属性；列表用稳定 **key** 避免错误复用；这是 O(n) 启发式而非最优树编辑。

**并发与过渡 API（React 18+）**：`startTransition` 将更新标为低优先级，避免输入等高优更新被大数据列表重渲染阻塞；`useDeferredValue` 延迟提交昂贵子树的 props。与 Fiber 的优先级调度一脉相承。

**Strict Mode（开发环境）**：可能**故意双重调用**部分函数与 effect，用于暴露不纯副作用；与生产行为不同，面试时要能解释「为何本地 effect 跑两次」。

**错误边界**：类组件 `componentDidCatch` / `getDerivedStateFromError` 捕获子树渲染错误；Hooks 组件需用边界组件包裹，错误边界本身不能用 Hooks 写（历史 API 限制，面试提一句即可）。

**渲染流程（简述）**：触发更新 → **Render 阶段**（可打断，构建 Fiber 子树，纯计算）→ **Commit 阶段**（应用 DOM、执行 layout effect、浏览器绘制相关）。Hooks 的 `useState` 在 render 中执行，`useEffect` 在 commit 后异步刷出。

**面试串联**：从「类生命周期」说到「Hooks 等价语义」，再说到「Fiber 为何需要」与「diff + key」，最后提并发特性，体现体系感。

## 示例代码

```jsx
function Profile({ userId }) {
  const [data, setData] = useState(null);
  const fetchUser = useCallback(() => {
    return fetch(`/api/user/${userId}`).then((r) => r.json());
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    fetchUser().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchUser]);

  const label = useMemo(() => (data ? data.name : '加载中'), [data]);
  return <div>{label}</div>;
}
```

## 面试追问

- **追问 1**：`useEffect` 与 `useLayoutEffect` 在提交阶段的时间点差异？什么场景必须用 `useLayoutEffect`？
- **追问 2**：为什么 Hooks 不能写在 if 里？React 如何用链表保存 Hook 状态？
- **追问 3**：Fiber 的「可中断更新」如何减少长任务阻塞？与 `Scheduler` 的关系？
- **追问 4**：`useMemo` 和 `useCallback` 何时反而浪费？和 `React.memo` 如何配合？

## 常见误区

- 认为 `useEffect(fn, [])` 与类组件 DidMount **完全等价**——函数组件无「只挂载一次」的闭包陷阱需注意，遗漏依赖会导致陈旧闭包；props/state 在 effect 内若未列入依赖，易出现「点击计数永远用初值」类 bug。
- 把 `useMemo` 当万能性能药——比较成本与缓存收益要权衡。
- 列表用 **index 作 key** 在重排/插入时导致错误复用与状态错乱。
- 混淆「虚拟 DOM 更快」——价值主要在声明式 UI 与批量更新，不等于比原生 DOM 手写一定快。
- 在 effect 里发请求却不做 **cleanup / abort**，导致竞态下旧请求覆盖新数据。
- 把 `key` 设在非列表根或随意拼接字符串，破坏复用与性能诊断。
- **`useRef` 与渲染**：改 `ref.current` 不触发重渲染，适合保存定时器 id、上一次的值；需要 UI 反映变化仍要用 `useState`。
- **自定义 Hooks**：只是函数复用，不自带「额外渲染隔离」；错误仍沿调用栈传播，需遵守同样 Hooks 规则。

**延伸阅读**：官方文档 Rules of Hooks、`useSyncExternalStore`（外部 store 订阅）、`useId`（SSR 与可访问性）。进阶岗位可准备 **React Compiler** 与自动 memo 方向。
可与状态管理（Redux/Zustand）对比：库是否在 React 外存状态、如何用订阅触发渲染。
