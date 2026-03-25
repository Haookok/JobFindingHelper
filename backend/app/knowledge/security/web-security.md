# Web 安全基础

- **难度**: 进阶
- **分类**: 安全 / Web
- **标签**: [XSS, CSRF, SQL注入, SSRF, 文件上传, CSP, CORS, OWASP]

## 核心概念

Web 安全围绕 **输入不可信**、**最小权限** 与 **纵深防御**。**XSS** 将恶意脚本注入页面被浏览器执行，分反射型（一次性 URL/输入回显）、存储型（入库后多人受害）、DOM 型（纯前端拼接 DOM 导致）。**CSRF** 利用已登录用户浏览器**自动带 Cookie** 发起非本意请求。

**SQL 注入** 将数据与命令边界破坏，执行任意 SQL。**SSRF** 诱导服务端请求内网或元数据服务。**文件上传** 若类型与路径失控可导致 WebShell 或路径穿越。**CSP** 限制脚本与资源来源；**同源策略**隔离不同源的 DOM/数据，**CORS** 是有条件的跨源读放宽。**OWASP Top 10** 汇总常见风险类别（版本会更新，面试答「注入、失效访问控制、加密失败」等大类即可）。

## 详细解析

**XSS 防御**：默认 **HTML 转义** 输出上下文敏感（属性/JS/CSS 规则不同）；`Content-Type` 与 charset 正确；`httpOnly` Cookie 降低窃 Cookie 后危害；**CSP** `default-src 'self'`、`script-src` Nonce/Hash 禁内联；框架自动转义与 **DOMPurify** 等清洗富文本。**模板与 `v-html`/innerHTML** 是高风险点。

**CSRF 防御**：**SameSite Cookie**（Lax/Strict）、**CSRF Token**（表单/Header 双提交）、关键操作 **二次验证**（密码、OTP）；校验 **Origin/Referer**（可缺失需兜底）。**JWT 放 localStorage** 不受同源 Cookie 自动发送保护，CSRF 形态变化但需防 XSS 窃 token。

**SQL 注入**：**参数化查询/预编译** 为根本；ORM 仍可能 raw SQL 注入。**最小权限** DB 账号、禁多语句（视引擎）与危险存储过程暴露。

**SSRF**：对内网 IP、元数据 URL（如 `169.254.169.254`）做 **白名单** 与 **禁用协议**（file、gopher）；解析后 **二次校验** IP 段；异步任务与 PDF 渲染等「用户可控 URL」是高频入口。

**文件上传**：白名单扩展与 **魔数** 校验、重命名、隔离存储（对象存储 + 无执行权限）、图片 **二次处理**、限制大小与扫描病毒；禁止上传路径用户可控拼接。

**CSP 与 CORS**：CSP 防数据外泄与脚本执行；CORS `Access-Control-Allow-Origin: *` 配 `credentials` 无效且易误配。**CORS 不是安全机制**——不能替代鉴权，仅放宽浏览器读响应。

**OWASP Top 10（典型）**：Broken Access Control、Cryptographic Failures、Injection、Insecure Design、Security Misconfiguration、Vulnerable Components、Authentication Failures、Software and Data Integrity、Logging Failures、SSRF（以官方当年版本为准）。

**失效访问控制与 IDOR**：**水平越权**（改 URL 或 ID 访问他人资源）、**垂直越权**（普通用户调管理接口）。应在服务端 **每次** 按会话身份做 **对象级授权**，勿仅依赖前端隐藏按钮。

**XXE**：XML 解析器允许外部实体可导致内网探测与文件读取；禁用外部实体、用 JSON 或安全解析配置。

**反序列化**：Java、Python pickle、部分 JSON 库的不安全反序列化可导致 RCE；使用 **类型白名单**、避免信任用户输入的类名。

**点击劫持**：`X-Frame-Options` 或 CSP `frame-ancestors` 禁止被恶意站点 iframe 嵌套诱导点击。

**开放重定向与钓鱼**：登录 `redirect` 参数未校验可导致钓鱼；应 **白名单** 目标 URL。

**安全响应头**：除 CSP 外，`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy` 等降低浏览器侧攻击面。

**日志与监控**：登录失败、管理操作、SSRF 可疑目标应 **审计**；注意日志中 **勿记录密码与完整卡号**，并防日志注入（换行符污染格式）。

**速率限制与账户枚举**：登录、短信、优惠券接口需 **限流与锁定策略**，防止撞库与资源耗尽；错误提示勿区分「用户不存在」与「密码错误」以免 **用户枚举**。

**依赖与供应链**：第三方 JS、npm 包、CI 插件均可能成为攻击面；使用 **SRI**（Subresource Integrity）固定 CDN 脚本哈希，并定期 **依赖扫描**。

**GraphQL 特有风险**：**深度/复杂度限制** 防 DoS；**字段级授权** 防越权 introspection 泄露内部模式；批量查询需 **成本分析**。

**WebSocket 与 SSE**：鉴权需在 **握手** 校验 Token/Cookie，勿仅靠首包后无状态；防 **跨站 WebSocket 劫持** 与消息注入。

**子域接管**：废弃 CNAME 指向可被注册的第三方服务时，攻击者可托管恶意内容于「可信子域」；应清理 DNS 与证书。

## 示例代码

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'
Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax; Path=/
```

说明：CSP 需按站点实际脚本拆分策略；Cookie 同时 **Secure**（HTTPS）与 **HttpOnly**。

## 面试追问

- **追问 1**：存储型 XSS 与反射型在利用链与日志留存上的差异？CSP Nonce 如何与 SSR 配合？
- **追问 2**：双重 Cookie 提交与 Synchronizer Token 模式各适用什么架构？
- **追问 3**：预编译为何能防 SQL 注入？ORM 的 `order by` 动态拼接如何安全实现？
- **追问 4**：SSRF 绕过常见手法（DNS 重绑定、302、IPv6、内网别名）如何防护？
- **追问 5**：`Access-Control-Allow-Origin` 反射任意 Origin 的风险？与 JSONP 对比？
- **追问 6**：IDOR 与「业务逻辑漏洞」在测试用例上如何覆盖？API 网关能否单独解决？

## 常见误区

- 仅前端校验输入即认为安全——**服务端必须校验**。
- 认为 **CORS 关闭** 就能防攻击——攻击者可用 **非浏览器客户端** 直接请求。
- **黑名单过滤 XSS**（关键字替换）易被编码与变形绕过；应 **上下文编码 + CSP**。
- **JWT 长期无刷新** 与 **密钥放前端**；或把 CSRF 防护简单等同于「用了 JWT」。
- 文件上传只校验 **扩展名** 忽视 **内容与存储路径**，导致解析器漏洞与 RCE。
- **仅依赖前端路由隐藏管理页**——直接请求 API 仍可越权；授权必须在服务端。
- **CSP 配 `unsafe-inline` 与 `unsafe-eval`** 基本抵消 XSS 缓解；应逐步收紧或采用 Nonce。
- **把「同源」与「同站（Site）」混用**——SameSite Cookie 按 eTLD+1 划分，子域策略需单独设计。
