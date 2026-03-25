# 浏览器渲染原理

- **难度**: 进阶
- **分类**: 前端 / 浏览器
- **标签**: [CRP, 重排, 重绘, 合成层, 性能优化]

## 核心概念

浏览器把 **HTML** 解析成 **DOM 树**，把 **CSS** 解析成 **CSSOM**；二者结合生成 **渲染树（Render Tree）**——只包含需要绘制的节点（如 `display:none` 不在树内）。接着进行 **布局（Layout/Reflow）** 计算几何信息，再 **绘制（Paint）** 填充像素，最后 **合成（Composite）** 各层交由 GPU 显示。

**关键渲染路径（CRP）** 指从收到 HTML/CSS 到首屏可见的关键步骤；阻塞资源（同步 JS、头部 CSS）会延长 **First Paint** / **FCP**。

## 详细解析

**DOM 构建**：词法分析 → Token → 节点树；遇到 `<script>` 默认**阻塞解析**（除非 `defer`/`async`/`module` 等策略）。

**CSSOM**：样式具有层叠与继承，必须解析完相关 CSS 才能确定最终样式；故 CSS 常被视为渲染阻塞。

**渲染树**：与 DOM 不完全一一对应（如 `head` 一般不绘制）；每个节点带样式与几何需求。

**布局**：计算盒模型与位置；宽度依赖包含块，高度可能依赖子元素（文档流）。

**绘制**：生成绘制记录（文本、颜色、边框、阴影等）；可分层。

**合成层**：某些属性（如 `transform`、`opacity`、有 `will-change` 提示等）可能提升为 **Compositor Layer**，后续改动可走合成线程，减少主线程重绘范围。**注意**：滥用 `will-change` 会占显存。

**重排（Reflow）**：布局相关属性变化导致几何重算，代价高。**重绘（Repaint）**：外观变但布局不变（如 `color`）可能只需重绘。`transform`/`opacity` 常可走合成，避开完整布局。

**CRP 优化**：压缩与内联关键 CSS、异步/延后 JS、预加载关键资源、减少关键路径深度、字体与图片策略等。

**主线程 vs 合成线程**：布局与绘制多在主线程；合成层更新可由 **Compositor Thread** 与 GPU 完成，故动画用 `transform`/`opacity` 更易保持流畅（仍要注意层数量与内存）。

**容易触发重排的典型读写**：`offset*`、`client*`、`scroll*`、`getComputedStyle` 等可能迫使浏览器先完成布局再返回值；若在循环里读布局再写样式，会形成 **layout thrashing**。

**资源优先级**：`preload`/`prefetch`/`preconnect` 影响发现与握手时机，与 CRP 协同；图片 `loading="lazy"` 降低首屏竞争。

**面试表达顺序**：DOM/CSSOM → Render Tree → Layout → Paint → Composite；再举 **重排 vs 重绘** 与 **合成层**；最后落到 **CRP 与性能指标**，并各说一条优化手段。

## 示例代码

```html
<!-- 关键 CSS 内联或优先加载，非关键延后 -->
<link rel="preload" href="/fonts.woff2" as="font" crossorigin />
<style>
  /* 首屏关键样式 */
  .hero { font-size: 2rem; }
</style>
<script defer src="/app.js"></script>
```

```css
/* 动画优先用合成友好属性，减少重排 */
.card {
  will-change: transform;
  transition: transform 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
}
```

## 面试追问

- **追问 1**：`display:none` 与 `visibility:hidden` 对渲染树与布局的影响有何不同？
- **追问 2**：为什么修改 `offsetTop` 的读取与写入顺序会引发「强制同步布局（forced reflow）」？
- **追问 3**：合成层一定更快吗？什么情况下层过多反而伤性能？
- **追问 4**：`requestIdleCallback` / `requestAnimationFrame` 与渲染帧的关系？

## 常见误区

- 认为「所有样式改动都只触发重绘」——改宽高、边距、`display`、字体等会触发布局乃至重排连锁；单纯改 `color` 通常影响较小但仍可能触发绘制。
- 把 `will-change` 长期挂在大量元素上——应短期提示、用后移除。
- 忽略 **JS 执行** 与解析阻塞：长任务同样推迟首屏与交互响应（需结合 Performance 面板分析）。
- 认为「`opacity: 0` 与 `visibility` 一样」——不参与点击、可合成行为仍有差异，SEO/无障碍也要单独考虑。
- 只优化 CSS 不拆分 **长任务**：主线程仍可能被 `while` 或大 JSON 阻塞，需 `scheduler`、Web Worker 等配合。
- **GPU 层不是免费午餐**：过大纹理、过多层合成会带来内存与合成开销，移动端尤其明显。
- 混淆 **FP/FCP/LCP**：首屏优化要分别看首次绘制、首次内容绘制、最大内容绘制，指标对应优化手段不同（字体、图片、SSR 等）。

**延伸阅读**：Chrome DevTools **Performance** 里 Main、Raster、GPU 轨道；**Lighthouse** 与 Web Vitals 报告解读。能结合一次真实录屏说瓶颈点，面试说服力更强。
同一页面在低端机与省电模式下的帧率差异，也可作为「渲染与合成成本」的延伸回答。
