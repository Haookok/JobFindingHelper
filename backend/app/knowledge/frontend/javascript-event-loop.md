# JavaScript 事件循环

- **难度**: 进阶
- **分类**: 前端 / JavaScript 运行时
- **标签**: [事件循环, 微任务, Promise, async-await, Node.js]

## 核心概念

想象一个只有一双手的厨师（JS 引擎），他同一时间只能切一道菜。但厨房里有洗碗机、烤箱、微波炉这些"帮手"（浏览器 API / Node API）——厨师把碗放进洗碗机就去切菜了，洗碗机洗完会"叮"一声，厨师忙完手头活再去拿碗。

这就是**事件循环**的本质：JS 是**单线程**的（一双手），但它有很多帮手来处理耗时操作（网络请求、定时器、文件读写），帮手做完了就把结果排进**任务队列**，等厨师（主线程）空闲了再来处理。

## 详细解析

**调用栈——厨师的砧板**：函数调用就是往砧板上堆盘子，执行完就拿走。堆太多（递归过深）砧板会塌——也就是"栈溢出"。

**宏任务 vs 微任务——两条不同优先级的传送带**：帮手们完成任务后，结果会放到两条传送带上。**微任务传送带**（Promise.then、queueMicrotask）优先级更高，厨师每做完一道菜，会先把微任务传送带上的**全部**拿完，才去宏任务传送带（setTimeout、I/O）上拿下一个。

**一轮事件循环的顺序**：执行一个宏任务 → 清空所有微任务 → 浏览器可能渲染一帧画面 → 再拿下一个宏任务。

**Promise 和 async/await**：`Promise.then` 的回调是微任务。`async/await` 只是语法糖——`await` 后面的代码相当于被塞进了 `.then()` 里，所以也是微任务。说白了，`await` 就是告诉厨师"这个先放一边，等结果回来了再继续"。

**Node.js 有自己的一套**：Node 用 libuv 处理异步，事件循环分好几个阶段（timers → poll → check 等）。最大的坑是 `process.nextTick`，它的优先级比 Promise 微任务还高，而且如果你在 nextTick 里不停注册 nextTick，其他任务就永远排不上——相当于厨师被一条传送带困住了。

**requestAnimationFrame**：这是浏览器专属的，回调在"下一次画面刷新前"执行。做动画用它比 setTimeout 靠谱，因为它跟屏幕刷新率对齐，不会出现"该画的时候没画"的问题。

**面试回答骨架**：先说"单线程 + 事件循环 + 队列"，再说"宏任务一轮一个、微任务清空再下一轮"，然后 Promise/async 归微任务，最后提一句 Node 的差异。

## 示例代码

```javascript
console.log('1');          // 同步，直接执行
setTimeout(() => console.log('2'), 0);  // 宏任务，排队等着
Promise.resolve().then(() => console.log('3'));  // 微任务，优先
queueMicrotask(() => console.log('4'));  // 微任务，优先
console.log('5');          // 同步，直接执行
// 输出：1, 5, 3, 4, 2（同步先跑完 → 微任务全清 → 才轮到宏任务）
```

```javascript
async function f() {
  console.log('A');        // 同步部分，立刻执行
  await Promise.resolve(); // 到这里"让出"，后面变成微任务
  console.log('B');        // 微任务阶段才执行
}
f();
console.log('C');          // 同步，比 B 先执行
// 输出：A, C, B
```

```javascript
// 微任务里套微任务：同一轮会连续清空
Promise.resolve()
  .then(() => {
    console.log('p1');
    return Promise.resolve().then(() => console.log('p1-inner'));
  })
  .then(() => console.log('p2'));
// 输出：p1 → p1-inner → p2
```

## 面试追问

- **面试官可能会这样问你**：JS 说是单线程，那为什么还能"同时"做好多事？Web Worker 和 Node 线程池又是怎么回事？
- **面试官可能会这样问你**：requestAnimationFrame、setTimeout、微任务，这三个在一帧里是什么顺序？
- **面试官可能会这样问你**：Node 里 `process.nextTick`、`Promise.then`、`setImmediate` 谁先谁后？为什么官方说少用 nextTick？
- **面试官可能会这样问你**：如果在微任务里不断 queueMicrotask 套娃，页面会怎样？

## 常见误区

- **很多人会搞混的地方**：以为 `setTimeout(fn, 0)` 会立刻执行——不会，它只是"尽快排进宏任务队列"，得等同步代码和微任务都跑完才轮到它。而且浏览器有最小 4ms 的限制。
- **很多人会搞混的地方**：把 async/await 当成"开了新线程"——并没有，它只是 Promise 的语法糖，还是在同一个线程里排队。
- **很多人会搞混的地方**：用浏览器的事件循环模型去解释 Node 的行为——两者的实现细节不同，尤其是 nextTick 和 libuv 的阶段模型。
- **很多人会搞混的地方**：忘了微任务会"饿死"渲染——如果你在微任务里疯狂套娃，页面会卡住，因为浏览器没机会去画画面。
- **很多人会搞混的地方**：`await 0` 不是同步的，即使 await 后面不是 Promise，它也会包装成 Promise，后续代码照样变成微任务。
