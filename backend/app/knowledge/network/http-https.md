# HTTP 与 HTTPS

- **难度**: 进阶
- **分类**: 计算机网络 / 应用层
- **标签**: [HTTP, HTTPS, TLS, HTTP2, HTTP3, Keep-Alive, 队头阻塞]

## 核心概念

**HTTP** 是无状态的应用层协议，基于请求/响应模型；**HTTPS** 在 HTTP 之下增加 **TLS**（原 SSL），提供加密、完整性校验与（可选）身份认证。版本演进主要围绕**连接复用**、**多路复用**与**传输路径**（TCP → QUIC/UDP）的优化。

**REST 与动词**：虽与版本无强绑定，面试常问 **GET 幂等**、**PUT 与 PATCH**、**Idempotency-Key** 与网关超时重试的关系。

## 详细解析

**HTTP 1.0 / 1.1 / 2 / 3 对比**：

| 维度 | 1.0 | 1.1 | 2 | 3 |
|------|-----|-----|---|---|
| 连接 | 默认短连接 | **Keep-Alive** 默认更普及 | 单连接多路复用 | 基于 **QUIC**（UDP） |
| 特性 | 简单 | 管道化（受限）、Host、分块 | **二进制分帧**、HPACK 压缩、服务端推送（实践中少用） | 0-RTT/1-RTT、连接迁移、内置加密 |
| 队头阻塞 | 每请求可占连接 | 同连接上响应仍可能互相等待 | **应用层**多流并行；**TCP 层**仍可能 HOL | QUIC 流级，缓解 TCP HOL |

**HTTPS 握手（简化）**：TCP 三次握手后进入 **TLS 握手**（以 TLS 1.2 为例）：ClientHello（支持的算法、随机数）→ ServerHello + 证书 + ServerKeyExchange 等 → 客户端验证证书并生成预主密钥 → 双方算出会话密钥 → ChangeCipherSpec，之后 HTTP 密文传输。**TLS 1.3** 常减少往返（1-RTT / 0-RTT 恢复）。

**证书验证**：客户端校验证书链是否由受信 CA 签发、域名是否匹配（SAN/CN）、有效期、是否吊销（OCSP/CRL）、证书透明度等。

**HTTP 状态码（常见）**：2xx 成功（200、201、204）；3xx 重定向（301 永久、302/307/308 临时与语义差异）；4xx 客户端错误（400、401、403、404）；5xx 服务端错误（500、502、503、504）。面试需能区分 **301 vs 302**、**401 vs 403**、**502 vs 504**。

**Keep-Alive**：同一 TCP 连接上发送多个请求/响应，减少握手开销；1.1 默认 `Connection: keep-alive`（除非显式 close）。注意与**超时**、**最大请求数**等服务器限制。

**队头阻塞**：**HTTP/1.1** 同连接上若前一个响应慢，后续响应可能被拖住；**HTTP/2** 在单连接上多流交错，但底层 **TCP 丢包重排** 仍可能造成整连接阻塞；**HTTP/3 + QUIC** 在传输层以流为单位，改善该问题。

**ALPN**：TLS 握手中通过 **Application-Layer Protocol Negotiation** 协商上层是 `h2` 还是 `http/1.1` 等，避免额外往返。

**HPACK（HTTP/2）**：头部用**静态表 + 动态表 + Huffman** 压缩；动态表在连接级维护，需注意**安全面**（CRIME 类攻击历史上有 HTTP 压缩相关讨论，HPACK 设计有所规避）。

**QUIC 要点**：基于 UDP，**连接 ID** 利于**网络切换**（Wi-Fi ↔ 蜂窝）；TLS 1.3 集成；用户态协议栈更易迭代，也带来**中间盒**与审计上的新话题。

**Cookie / Session**：HTTP 无状态，身份常靠 **Cookie** 或 **Authorization**；与 **SameSite**、**CSRF** 防护常一起考。

**缓存与条件请求（顺带）**：**Cache-Control** 控制浏览器/CDN 缓存；**ETag/If-None-Match**、**Last-Modified** 实现 **304** 节省带宽；与 **HTTPS** 结合时注意**敏感页**禁用缓存。

**安全响应头（实践）**：**CSP**、**X-Content-Type-Options**、**X-Frame-Options/Frame-Ancestors** 等与 HTTP 版本独立，面试可展示「懂 Web 全链路」。

**Upgrade 与协议切换**：**Connection: Upgrade** 用于 **WebSocket** 等；与 **HTTP/2** 的 ALPN 协商不同路径，勿混用术语。

**413/414/431**：分别对应 **Payload 过大**、**URI 过长**、**请求头过大**（常见于 Cookie 膨胀），排障时比笼统 400 更有指向性。

**Range 与断点续传**：`Accept-Ranges` / `206 Partial Content` 用于大文件下载与视频拖拽；CDN 源站与缓存策略需一致，否则易出现**异常 Range** 或缓存碎片。

## 示例代码

```bash
# 观察 TLS 握手与证书链（需本机有 openssl）
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null | openssl x509 -noout -subject -dates
```

```python
import urllib.request
req = urllib.request.Request("https://example.com")
with urllib.request.urlopen(req, timeout=10) as r:
    print(r.status, r.getheader("Content-Type"))
```

## 面试追问

- **追问 1**：TLS 1.3 相对 1.2 减少了哪些往返？0-RTT 的**重放攻击**风险与缓解思路？
- **追问 2**：HTTP/2 的**流优先级**与**流量控制**如何工作？为何仍有开发者关闭服务端推送？
- **追问 3**：**HSTS**、**证书固定（pinning）** 与纯 HTTPS 的关系及各自适用场景？
- **追问 4**：**mTLS** 在微服务与服务网格中的角色？与公网站点单向 TLS 的差异？

## 常见误区

- 把 HTTPS 等同于「只加密」——忽略 **完整性** 与 **身份认证**（中间人若未校验证书仍可被攻击）。
- 认为 HTTP/2 一定比 1.1 快：小站点、错误配置（如未合并与压缩策略不当）可能收益有限。
- 混淆 **302** 与 **307**：后者在重定向时更严格保留方法与 body（实践中仍要看客户端实现）。
- 把 **204 No Content** 与 **200 + 空 body** 混用导致缓存与中间件行为不一致。
- 误以为 **HTTP/3** 不需要可靠传输——QUIC 在 UDP 之上实现了**用户态可靠性与拥塞控制**。

**面试串联**：可从「一次浏览器输入 URL」串起 **DNS → TCP/TLS → HTTP 版本协商 → 缓存头（Cache-Control/ETag）**。
