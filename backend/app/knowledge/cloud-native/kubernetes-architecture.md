# Kubernetes 架构

- **难度**: 进阶
- **分类**: 云原生 / Kubernetes
- **标签**: [K8s, API Server, etcd, Scheduler, kubelet, Service, 工作负载, HPA, RBAC]

## 核心概念

如果 Docker 是"打包好的外卖盒"，那 Kubernetes（K8s）就是**管理整个外卖平台的调度中心**。它负责：这个外卖派给哪个骑手（调度到哪台服务器）？骑手翻车了怎么重新派单（容器挂了自动重启）？高峰期怎么多叫几个骑手（自动扩缩容）？新菜品怎么平滑上线（滚动更新）？

K8s 分两部分：**控制平面**（总部大脑）和**数据平面**（干活的节点）。总部制定策略和决策，节点执行命令和跑容器。

## 详细解析

**控制平面——总部有四个关键角色**：

**API Server（前台接待）**：所有请求的唯一入口。你想创建服务、查看状态、改配置，都得先过它。它负责身份验证（你是谁）、权限检查（你能干嘛）、数据校验。

**etcd（档案室）**：一个分布式键值数据库，存着整个集群"应该是什么样"的期望状态。API Server 收到请求后把数据存到 etcd。备份 etcd 几乎等于备份了整个集群。

**Controller Manager（各种管理员）**：一堆"管理员"不断对比"期望状态"和"实际状态"。比如 Deployment Controller 发现"我期望有 3 个副本但只有 2 个在跑"，就会创建一个新的。这种"不断检查并修正"的思路叫**调谐（Reconcile）**。

**Scheduler（派单员）**：新创建的 Pod 还没被分配到节点时，Scheduler 根据资源余量、亲和性规则、污点容忍等条件，选出最合适的节点把 Pod "派"过去。

**数据平面——每个节点上两个关键角色**：

**kubelet（骑手）**：每个节点上的代理，收到"派单"后负责拉取镜像、创建容器、做健康检查（liveness/readiness 探针）、上报状态。

**kube-proxy（路由表）**：维护 Service 到 Pod 的转发规则，让流量能找到正确的容器。

**Pod——最小的"外卖订单"**：一个 Pod 里可以有一个或多个容器，它们共享网络和存储。Pod 重建后 IP 会变，所以需要 Service 提供稳定的访问入口。

**常见工作负载**：**Deployment** 管无状态服务（比如 Web API），支持滚动更新和回滚；**StatefulSet** 管有状态服务（比如数据库），每个 Pod 有固定的名字和存储；**DaemonSet** 在每个节点上跑一份（比如日志收集器）。

**HPA（自动扩缩容）**：根据 CPU、内存或自定义指标自动调整 Pod 数量。高峰期多开几个，低谷期收回去省钱。

**RBAC（权限控制）**：谁能看什么、改什么，通过 Role 和 RoleBinding 精细控制。原则是**最小权限**——只给需要的权限。

## 示例代码

```yaml
# 一个最基本的 Deployment：跑 2 个副本，限制了资源
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo
spec:
  replicas: 2                # 期望跑 2 个 Pod
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
            requests:         # "我至少需要这么多"——调度器参考
              cpu: 100m
              memory: 128Mi
            limits:           # "最多给我这么多"——超了就限流/杀进程
              memory: 256Mi
```

## 面试追问

- **面试官可能会这样问你**：Informer 比直接 watch API Server 好在哪？怎么避免 relist 风暴？
- **面试官可能会这样问你**：kube-proxy 的 iptables 模式和 ipvs 模式有什么区别？
- **面试官可能会这样问你**：Pod 一直 Pending 怎么排查？常见原因有哪些？
- **面试官可能会这样问你**：Deployment 滚动更新失败了怎么回滚？maxUnavailable 设为 0 是什么意思？
- **面试官可能会这样问你**：HPA、VPA、Cluster Autoscaler 分别管什么？怎么配合？

## 常见误区

- **很多人会搞混的地方**：以为 Pod IP 是稳定的——Pod 一重建 IP 就变了，要用 Service 或 StatefulSet 的 DNS 来访问。
- **很多人会搞混的地方**：把 readiness 和 liveness 探针配反——readiness 是"我准备好接客了没"（没准备好就不给流量），liveness 是"我还活着没"（死了就重启）。配反了要么未就绪就接了流量，要么活着却被不断重启。
- **很多人会搞混的地方**：给所有容器设超大 limits——看起来调度成功了，但运行时节点超卖严重，大家互相抢资源频繁 OOM。
- **很多人会搞混的地方**：把 Secret 当加密存储——Secret 默认只是 base64 编码，能解码看到明文，需要配合 etcd 加密和 RBAC 保护。
- **很多人会搞混的地方**：以为 NetworkPolicy 默认就是"全部拒绝"——大多数 CNI 插件默认全通，你不写 NetworkPolicy 就等于没有网络隔离。
- **很多人会搞混的地方**：忽略 etcd 备份——etcd 存了整个集群的灵魂，它挂了又没备份，集群等于从零开始。
