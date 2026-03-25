# JavaScript 事件循环

- **难度**: 进阶
- **分类**: 前端 / JavaScript 运行时
- **标签**: [事件循环, 微任务, Promise, async-await, Node.js]

## 核心概念

JavaScript 是单线程语言，通过**事件循环（Event Loop）**把「执行同步代码」与「调度异步回调」串起来：同步代码在**调用栈**里执行；异步 API（定时器、网络、DOM 等）由宿主（浏览器或 Node）在适当时机把回调放进**任务队列**；栈空时，事件循环取出队列中的任务继续执行。

浏览器里任务通常分为**宏任务**（如 `setTimeout`、`setInterval`、I/O、UI 渲染相关）与**微任务**（如 `Promise.then`、`queueMicrotask`、`MutationObserver`）。**一轮 tick** 的典型顺序是：执行一个宏任务 → 清空当前微任务队列 → 可能进行渲染（视浏览器策略）→ 再取下一个宏任务。

## 详细解析

**调用栈**：函数调用压栈，返回出栈；栈溢出即递归过深或同步调用链过长。

**任务队列**：多个宏任务源可能对应多个队列，规范层面可理解为「先就绪的先处理」；微任务在**当前宏任务结束后、下一个宏任务前**全部执行完，因此微任务优先级高于宏任务。

**Promise 与 async/await**：`Promise.then/catch/finally` 的回调是微任务。`async` 函数返回的 Promise 在 `await` 处「让出」执行权：`await` 右侧表达式同步求值，随后对结果「包装」成 Promise，其**后续代码**作为微任务（或继续用 then 链）在微任务阶段执行。因此 `await 1` 后面的代码也会晚于同步代码、但早于下一个宏任务（在典型浏览器模型下）。

**Node.js 差异**：Node 使用 **libuv** 处理异步 I/O，事件循环阶段与浏览器不完全相同（如 `process.nextTick` 队列优先级高于微任务；`setImmediate` 与 `setTimeout(fn, 0)` 在不同上下文下顺序可能不同）。面试需强调：**不要死记浏览器口诀硬套 Node**，应区分「规范/浏览器」与「Node 阶段模型」。

**Node 阶段（面试常考点，记大意即可）**：timers → pending callbacks → idle/prepare → poll（取 I/O）→ check（`setImmediate`）→ close callbacks。`nextTick` 与微任务会在**各阶段之间**穿插：`nextTick` 优先于 Promise 微任务，且若递归注册可「饿死」I/O。

**`requestAnimationFrame`**：回调排在**下一次重绘前**，与宏任务、微任务的相对顺序不要硬背一句口诀；可理解为：在事件循环与渲染管线配合下，rAF 更适合与帧率对齐的动画，而 `setTimeout` 精度受任务队列与节流影响。

**调试建议**：Chrome Performance、断点配合 `console.log` 理清顺序；复杂场景可临时用注释标出「同步 / 微任务 / 宏任务」三段。

**面试小结（可背诵骨架）**：先答「单线程 + 事件循环 + 队列」；再答「宏任务一轮一个、微任务清空再下一个宏任务」；Promise/async 归到微任务；最后点出 Node 与 `nextTick` 差异，体现你知道**宿主不同实现不同**。

## 示例代码

```javascript
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
queueMicrotask(() => console.log('4'));
console.log('5');
// 典型输出：1, 5, 3, 4, 2（同步 → 微任务 → 宏任务）
```

```javascript
async function f() {
  console.log('A');
  await Promise.resolve();
  console.log('B');
}
f();
console.log('C');
// 常见输出：A, C, B（await 之后进入微任务）
```

```javascript
// 微任务嵌套：同一轮内会连续清空微任务队列
Promise.resolve()
  .then(() => {
    console.log('p1');
    return Promise.resolve().then(() => console.log('p1-inner'));
  })
  .then(() => console.log('p2'));
// 输出：p1 → p1-inner → p2
```

## 面试追问

- **追问 1**：为什么说「JS 单线程」但还能并发？事件循环与线程池（如 Worker、Node 线程池）分别负责什么？
- **追问 2**：`requestAnimationFrame` 与 `setTimeout`、`微任务` 的执行顺序在渲染一帧内如何理解？
- **追问 3**：Node 中 `process.nextTick`、`Promise.then`、`setImmediate` 的典型执行顺序是什么？为什么文档建议谨慎使用 `nextTick`？
- **追问 4**：如果微任务里不断 `queueMicrotask` 嵌套，会造成什么现象？对页面有什么影响？

## 常见误区

- 认为「`setTimeout(0)` 立刻执行」——实际是尽快排进宏任务队列，需等栈空且排在它前面的任务跑完；最小延迟在浏览器中还有 **4ms 钳制**（嵌套层级过深时），与 HTML 规范相关。
- 把 `async/await` 当成新开线程；实际是语法糖 + Promise + 微任务调度。
- 用浏览器事件循环模型解释所有 Node 行为，忽略 `nextTick` 与 libuv 阶段。
- 忽略 **UI 渲染** 与任务的关系：长时间同步任务或微任务饿死会卡顿页面。
- **`await` 非 Promise 值**：`await 0` 仍会包装成 resolved Promise，后续同样异步；与「只有 Promise 才排队」的直觉不符。
- **`MutationObserver` 与微任务**：其回调为微任务，适合观察 DOM 变化且避免同步布局抖动；不要与宏任务定时器混为一谈。

**延伸阅读（面试加分）**：HTML 规范中的 **agent**、WHATWG 对事件循环的说明；V8 与 Web API 如何把任务入队。答到「规范/实现分离」即可，不必背阶段名逐字。
