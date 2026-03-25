# Kubernetes 架构

- **难度**: 进阶
- **分类**: 云原生 / Kubernetes
- **标签**: [K8s, API Server, etcd, Scheduler, kubelet, Service, 工作负载, HPA, RBAC]

## 核心概念

Kubernetes 是 **控制平面 + 数据平面（节点）** 的分布式系统：**API Server** 为统一入口，校验与持久化期望状态到 **etcd**；**Controller Manager** 内各类控制器通过 watch/informer **调谐（reconcile）** 实际状态；**Scheduler** 为 Pending Pod 绑定节点。**Node** 上 **kubelet** 驱动容器运行时创建 Pod，**kube-proxy**（或 eBPF 等实现）维护 Service 到端点的转发规则。

**Pod** 是最小调度单元，共享网络与存储卷；**生命周期**含 Pending、Running、Succeeded/Failed 等。**Service** 提供稳定虚拟 IP/DNS 与负载均衡到 Pod。**Deployment** 管理无状态副本滚动升级；**StatefulSet** 有序与稳定网络标识；**DaemonSet** 每节点（或子集）一份 Pod。

## 详细解析

**API Server**：认证（证书、Bearer Token、OIDC）、授权（RBAC）、准入（Mutating/Validating Webhook）；所有组件仅通过其访问集群状态，避免直连 etcd（除 etcd 运维）。

**etcd**：一致性与高可用 KV；存集群元数据与资源对象。备份与恢复策略是运维面试常考点。

**Scheduler**：过滤（资源、亲和性、污点容忍）与打分（资源均衡、亲和）；可扩展 **调度框架**。**kubelet**：拉取镜像、探针（liveness/readiness/startup）、挂载卷、上报节点与 Pod 状态。

**Pod 生命周期**：创建 → 调度 → 拉镜像 → init 容器 → 主容器；**重启策略** `Always`/`OnFailure`/`Never`。**终止**：先发 SIGTERM，宽限期后 SIGKILL；需应用优雅关闭连接。

**Service 类型**：**ClusterIP** 集群内；**NodePort** 节点端口暴露；**LoadBalancer** 云 LB；**ExternalName** CNAME。**Headless Service**（`clusterIP: None`）配合 StatefulSet 做 DNS 逐 Pod 解析。

**Deployment**：ReplicaSet 管理版本；滚动参数 `maxSurge`/`maxUnavailable`。**StatefulSet**：稳定 hostname、有序扩缩、常与 PVC 模板配合。**DaemonSet**：日志、监控、CNI 等节点级代理。

**HPA**：依据 CPU/内存或自定义指标（Metrics API / Prometheus Adapter）扩缩 Deployment/StatefulSet 等；需 metrics-server 或自定义 metrics 管道；存在 **冷却/抖动** 与 **延迟** 需注意。

**RBAC**：`Role`/`ClusterRole` 绑定 `RoleBinding`/`ClusterRoleBinding` 到 User/Group/ServiceAccount；**最小权限**为安全基线；与 **ABAC/Node** 授权模式对比时强调 RBAC 为主流。

**CNI 与网络插件**：Calico/Cilium/Flannel 等实现 Pod 网段、路由与策略网络；**NetworkPolicy** 在 L3/L4 限制东西向流量，默认放行需显式加固。**Service 与 EndpointSlice** 将标签匹配的 Pod 端点暴露给 kube-proxy 或数据面。

**CRD 与 Operator**：**CustomResourceDefinition** 扩展 API；**Operator** 模式用控制器管理有状态应用生命周期（备份、升级）。**准入 Webhook** 可强制安全策略（镜像仓库、资源配额、标签规范）。

**存储**：**CSI** 插件对接云盘/NFS；**PV/PVC** 抽象存储供给。**ConfigMap/Secret** 挂载为卷或环境变量，Secret 仅 base64 编码非加密，需 etcd 加密与 RBAC 保护。

**可观测性**：**cAdvisor** 指标经 kubelet 暴露；控制平面组件日志与审计（Audit Policy）用于合规与入侵分析。

## 示例代码

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      labels:
        app: demo
    spec:
      serviceAccountName: demo-sa
      containers:
        - name: app
          image: demo:1.0.0
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi
```

说明：`requests` 供调度与 HPA 参考，`limits` 防资源失控；生产应配 probe 与 PDB。

## 面试追问

- **追问 1**：Informer/Lister 相对直接 watch API Server 的优势？如何避免 relist 风暴？
- **追问 2**：kube-proxy iptables 与 ipvs 模式差异？Service 会话亲和性如何实现？
- **追问 3**：Pod 一直 Pending 时如何排查？哪些事件与调度失败相关？
- **追问 4**：Deployment 滚动更新失败如何回滚？`maxUnavailable` 为 0 时语义？
- **追问 5**：HPA 与 VPA、Cluster Autoscaler 分工？自定义指标链路有哪些组件？

## 常见误区

- 认为 **Pod IP 稳定**——重建即变；持久访问依赖 Service 或 StatefulSet DNS。
- **readiness 与 liveness 配反**——未就绪流量切入或死循环重启加剧故障。
- **给所有容器超大 limits** 导致 **节点超卖与噪声邻居**，调度看似成功运行 OOM。
- **ClusterRoleBinding 过宽**（如 cluster-admin 给默认 SA）造成横向移动风险。
- 忽略 **etcd 备份** 与 **API Server 证书轮换**，灾难恢复演练缺失。
- 把 **Secret 当加密存储**——默认可被有权限者解码；应配合 **EncryptionConfiguration** 与密钥管理。
- **NetworkPolicy 未部署却以为默认拒绝**——多数插件默认全通，需显式编写策略。
- **自定义 CRD 无版本迁移与校验**——集群升级时出现不可调和字段，引发控制器崩溃。
