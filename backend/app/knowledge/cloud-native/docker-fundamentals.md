# Docker 核心原理

- **难度**: 进阶
- **分类**: 云原生 / 容器
- **标签**: [Docker, Namespace, Cgroups, UnionFS, 镜像, Dockerfile, 网络, 安全]

## 核心概念

**容器**不是虚拟机：它与宿主机共享内核，通过 **Linux Namespace** 隔离进程视图（PID、NET、MNT、USER 等），通过 **Cgroups** 限制与计量 CPU、内存、IO 等资源。**UnionFS（联合文件系统）** 与 **分层镜像** 叠加只读层与可写容器层，实现镜像复用与快速启动。

**Docker 引擎**（containerd/runc 等链路）负责镜像拉取、OCI 运行时创建容器、网络与卷挂载。**Dockerfile** 描述构建步骤；**多阶段构建**用前一阶段编译产物复制到精简运行镜像，减小攻击面与体积。

## 详细解析

**Namespace**：`pid` 隔离进程 ID；`net` 独立网络栈（接口、路由、iptables）；`mnt` 挂载点视图；`ipc`、`uts`、`user` 等分别隔离 IPC、主机名、UID/GID 映射（rootless 依赖 user namespace）。

**Cgroups v1/v2**：限制 CPU share/quota、内存上限、blkio、pids 数量等；OOM 时容器内进程可能被杀。理解 **limits vs requests**（K8s 语境）前先掌握 Docker 的 `--cpus`、`--memory`。

**镜像分层**：每条 Dockerfile 指令常产生一层；层缓存要求 **顺序稳定** 与 **把易变层置后**。`COPY`/`ADD` 前尽量少改以命中缓存。**镜像 digest** 唯一标识内容寻址层。

**Dockerfile 实践**：选 **官方 slim/alpine** 需权衡 libc 兼容与调试工具；合并 `RUN` 减少层数但可读性下降需平衡；**非 root 用户** `USER` 运行；`HEALTHCHECK` 声明健康探测；敏感信息用 **build secret / 运行时挂载**，勿 `ARG` 泄露进历史层。

**多阶段构建**：构建阶段装编译器与依赖，最终阶段只拷贝二进制与静态资源，避免把源码与密钥留在镜像。

**网络模式**：**bridge** 默认 NAT，容器有独立 IP；**host** 共享宿主机网络栈，性能高但端口冲突；**none** 无网卡；**overlay**（Swarm/K8s CNI）跨主机虚拟二层。**自定义网络**提供 DNS 容器名解析。

**数据卷**：**bind mount** 绑定宿主机路径，适合开发；**named volume** 由 Docker 管理，适合持久化数据。**只读挂载** `ro` 降低篡改风险。

**安全加固**：最小镜像、只读根文件系统、capability 降级（`--cap-drop`）、seccomp/AppArmor/SELinux、镜像扫描（CVE）、不在镜像内放 `.env` 密钥、定期更新基础镜像。

**OCI 与运行时**：**OCI 镜像规范** 与 **runc** 等运行时创建隔离进程；**containerd** 作为守护进程管理镜像与容器生命周期，Docker CLI 与 K8s 在多数发行版上最终都落到类似链路。面试可说清 **「镜像 = 只读层 + 配置元数据」**。

**`.dockerignore`**：排除 `.git`、`node_modules`、本地构建产物，减小 build context 上传时间并避免误拷机密。**构建缓存** 在 CI 中可配合 **BuildKit cache mount**（`--mount=type=cache`）加速依赖安装。

**日志与进程**：容器内 **PID 1** 需正确处理信号（如使用 `tini`/`dumb-init` 或 Go 程序自身转发 SIGTERM）；日志应写 **stdout/stderr** 由运行时收集，避免写满容器可写层。

**资源与 ulimit**：除 Cgroups 外，注意 **nofile** 等 ulimit；高并发服务在 compose/K8s 中需一并调优，否则「本地能跑、容器里 accept 失败」。

**镜像签名与供应链**：**Docker Content Trust**、**cosign** 等对镜像验签；拉取策略用 digest 固定版本，避免 `:latest` 漂移导致不可复现与投毒风险。

## 示例代码

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app -trimpath -ldflags="-s -w" ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /app /app
USER nonroot:nonroot
ENTRYPOINT ["/app"]
```

说明：多阶段 + distroless 减小体积与 shell 攻击面；`nonroot` 降低权限。

**Compose 与 Swarm（了解）**：单机编排用 Compose；Swarm 提供简易集群与 overlay。与 K8s 相比，Swarm 组件更少但生态与扩展性较弱，面试可对比 **控制平面复杂度与 CNI 生态**。

**排查思路**：`docker inspect` 看挂载与网络；`docker logs` 看应用输出；`docker stats` 看 Cgroups 限额是否触顶；进入容器用 `docker exec` 时注意 **生产环境勿依赖交互 shell 排障常态化**。

## 面试追问

- **追问 1**：容器与 KVM/VM 在隔离强度、性能、内核共享上的根本差异？
- **追问 2**：写时复制（CoW）在镜像层与容器可写层如何工作？删除文件为何可能产生 whiteout？
- **追问 3**：bridge 网络下容器访问外网的 NAT 路径？host 模式对端口绑定与安全的影响？
- **追问 4**：为什么 Dockerfile 里 `RUN apt-get update && install` 常写在一行？缓存失效链路是什么？
- **追问 5**：rootless Docker 依赖哪些内核能力？与特权容器 `--privileged` 风险对比？

## 常见误区

- 把容器当 **轻量 VM** 忽视 **内核共享**：宿主机内核漏洞影响所有容器。
- **镜像层缓存** 被 `COPY . .` 提前打散，导致每次构建全量重装依赖。
- **Alpine + glibc 混用** 引发奇怪段错误；动态链接需一致 libc。
- **容器内以 root 跑服务** 与宿主机 **目录 777 bind mount** 扩大入侵后果。
- 认为 **多阶段构建** 自动安全——若 `COPY --from=build` 误拷入密钥或 `.git`，仍会泄漏。
- **PID 1 是 shell 脚本** 且未 `exec` 主进程——信号达不到应用，优雅退出失效。
- **`docker run --privileged` 等同大幅削弱隔离**——除非确有必要，生产应禁止或白名单 cap。
- **卷权限与 UID 映射** 混乱——bind mount 宿主机目录与容器 `USER` UID 不一致导致读写失败或权限过大。
