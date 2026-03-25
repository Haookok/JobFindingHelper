# React 生命周期与 Hooks

- **难度**: 进阶
- **分类**: 前端 / React
- **标签**: [生命周期, Hooks, Fiber, 虚拟 DOM, diff]

## 核心概念

把一个 React 组件想象成**一个人的一天**：起床（挂载）→ 上班处理各种事（更新）→ 下班回家（卸载）。在每个阶段，你都有机会做特定的事——起床时刷牙洗脸（初始化数据），上班时根据新需求调整工作（响应 props/state 变化），下班前收拾桌面（清理定时器、取消请求）。

**类组件**用生命周期方法来描述这些阶段（`componentDidMount` = 起床完毕、`componentDidUpdate` = 工作内容变了、`componentWillUnmount` = 下班收拾）。**函数组件**用 Hooks 做同样的事，但写法更简洁：`useState` 管状态，`useEffect` 处理副作用。

**虚拟 DOM** 就像一份"草稿"——React 先在草稿上画好 UI 该长什么样，然后跟上一版草稿对比（diff），只把**真正变了的部分**更新到真实页面上，省去了重画整张画的成本。

## 详细解析

**类组件生命周期脉络**：构造函数 → render（画草稿）→ 挂载到页面 → DidMount。之后每次 props 或 state 变了，重新 render → DidUpdate。组件要被移除时，WillUnmount 做清理。记住：render 必须是"纯函数"，别在里面发请求或改状态。

**Hooks 的规矩**：只能在函数组件**最顶层**调用，不能写在 if 或 for 里。为什么？因为 React 内部用一个**链表**按顺序记住每个 Hook 的状态。你一旦在条件里跳过某个 Hook，链表顺序就乱了，状态就张冠李戴了。

**useEffect 的依赖数组**：这是新手最容易踩坑的地方。空数组 `[]` 表示"只在起床时（挂载）执行一次"；写了具体变量就是"这些变量变了才执行"；什么都不写就是"每次渲染都执行"。`useLayoutEffect` 比 `useEffect` 执行得更早——页面画出来之前就跑了，适合量尺寸之类的事。

**Fiber——React 的"分时工作法"**：React 16 之前更新是一口气干完的，像一个人加班到天亮不休息。Fiber 把工作切成小块，可以中途暂停让浏览器先画个画面，再回来继续。这就是为什么 React 18 能做"并发特性"——高优先级的更新（比如用户输入）可以打断低优先级的（比如列表重渲染）。

**Diff 算法要点**：不同类型的元素直接整棵子树换掉；同类型的比属性；列表一定要用稳定的 **key**（别用 index），不然 React 会搞混谁是谁，就像点名时用"第一排第二个"而不是用姓名。

**Strict Mode 的坑**：开发环境下 React 会故意把 useEffect 跑两次，用来帮你发现不纯的副作用。别慌，生产环境只跑一次。

## 示例代码

```jsx
function Profile({ userId }) {
  const [data, setData] = useState(null);

  // useCallback：userId 不变时，fetchUser 引用不变，避免 useEffect 白跑
  const fetchUser = useCallback(() => {
    return fetch(`/api/user/${userId}`).then((r) => r.json());
  }, [userId]);

  useEffect(() => {
    let cancelled = false;  // 防止组件卸载后还 setState（竞态问题）
    fetchUser().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;  // "下班收拾"：组件卸载或 userId 变了，取消旧请求的回调
    };
  }, [fetchUser]);

  // useMemo：只有 data 变了才重新计算 label，省点力气
  const label = useMemo(() => (data ? data.name : '加载中'), [data]);
  return <div>{label}</div>;
}
```

## 面试追问

- **面试官可能会这样问你**：useEffect 和 useLayoutEffect 到底差在哪？什么情况下非用 useLayoutEffect 不可？
- **面试官可能会这样问你**：为什么 Hooks 不能写在 if 里？React 内部是怎么用链表记住状态的？
- **面试官可能会这样问你**：Fiber 的"可中断更新"是怎么减少页面卡顿的？和 Scheduler 什么关系？
- **面试官可能会这样问你**：useMemo 和 useCallback 什么时候反而是浪费？怎么跟 React.memo 配合？

## 常见误区

- **很多人会搞混的地方**：以为 `useEffect(fn, [])` 和类组件的 DidMount 完全一样——函数组件有"闭包陷阱"，如果 effect 里用了某个 state 但没放进依赖数组，你拿到的永远是初始值，就像时钟停了一样。
- **很多人会搞混的地方**：把 useMemo 当万能加速器——它本身也有比较成本，如果计算本来就很便宜，加了 useMemo 反而多此一举。
- **很多人会搞混的地方**：列表用 index 当 key——增删或重排时，React 会把状态搞混。比如你删了第一项，第二项的状态却跑到第一项上了。
- **很多人会搞混的地方**：说"虚拟 DOM 比真实 DOM 快"——不准确。虚拟 DOM 的价值是让你**声明式**地写 UI，React 帮你算出最小更新量，但它不一定比手写 DOM 操作快。
- **很多人会搞混的地方**：在 useEffect 里发请求但不做清理——如果用户快速切换页面，旧请求的结果可能覆盖新数据。一定要在 cleanup 里取消或标记。
- **很多人会搞混的地方**：改了 `ref.current` 以为页面会更新——ref 是"暗箱操作"，改它不会触发重渲染，想让页面变就得用 useState。
