import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Category {
  id: string;
  name: string;
  description: string;
  group: string;
  topics: string[];
}

const categories: Category[] = [
  // AI 与算法
  {
    id: "ai-llm",
    name: "AI / LLM",
    description: "Transformer、Attention、大模型原理、RAG、Agent、微调、推理优化",
    group: "AI 与算法",
    topics: ["Transformer", "Self-Attention", "RAG", "Agent", "LoRA 微调", "RLHF/DPO", "推理优化", "MoE"],
  },
  {
    id: "machine-learning",
    name: "机器学习",
    description: "损失函数、优化器、经典模型、特征工程、评估指标、深度学习基础",
    group: "AI 与算法",
    topics: ["损失函数", "梯度下降", "SVM", "决策树", "CNN/RNN", "BatchNorm", "正则化", "评估指标"],
  },
  // 计算机基础
  {
    id: "algorithms",
    name: "数据结构与算法",
    description: "排序、搜索、动态规划、图算法、贪心、回溯",
    group: "计算机基础",
    topics: ["排序算法", "二分搜索", "动态规划", "图算法", "贪心", "回溯", "链表/树", "LeetCode 高频"],
  },
  {
    id: "os",
    name: "操作系统",
    description: "进程线程、内存管理、IO 模型、死锁、调度算法",
    group: "计算机基础",
    topics: ["进程与线程", "内存管理", "虚拟内存", "IO 模型", "死锁", "调度算法"],
  },
  {
    id: "network",
    name: "计算机网络",
    description: "TCP/IP、HTTP/HTTPS、DNS、WebSocket、网络安全",
    group: "计算机基础",
    topics: ["TCP 三次握手", "HTTP/HTTPS", "DNS 解析", "WebSocket", "网络安全", "CDN"],
  },
  {
    id: "database",
    name: "数据库",
    description: "MySQL、Redis、索引优化、事务、锁机制、分库分表",
    group: "计算机基础",
    topics: ["MySQL 索引", "事务隔离", "锁机制", "Redis 数据结构", "缓存策略", "分库分表"],
  },
  // 后端开发
  {
    id: "java",
    name: "Java",
    description: "Java 基础、JVM、并发编程、集合框架、Spring 生态",
    group: "后端开发",
    topics: ["JVM 内存模型", "垃圾回收", "并发编程", "集合框架", "Spring Boot", "设计模式"],
  },
  {
    id: "python",
    name: "Python",
    description: "Python 基础、GIL、装饰器、异步编程、Web 框架",
    group: "后端开发",
    topics: ["GIL", "装饰器", "生成器", "异步 IO", "FastAPI", "类型标注"],
  },
  {
    id: "go",
    name: "Go",
    description: "Goroutine、Channel、GC、接口、并发模式、微服务框架",
    group: "后端开发",
    topics: ["Goroutine", "Channel", "GMP 调度", "接口设计", "GC", "Gin/gRPC"],
  },
  // 前端开发
  {
    id: "frontend",
    name: "前端",
    description: "JavaScript 核心、React/Vue、浏览器原理、性能优化、工程化",
    group: "前端开发",
    topics: ["JavaScript 核心", "React", "Vue", "浏览器渲染", "性能优化", "TypeScript", "Vite/Webpack"],
  },
  // 架构与工程
  {
    id: "system-design",
    name: "系统设计",
    description: "分布式系统、微服务、消息队列、缓存架构、限流熔断",
    group: "架构与工程",
    topics: ["分布式一致性", "微服务架构", "消息队列", "缓存设计", "限流熔断", "负载均衡"],
  },
  {
    id: "cloud-native",
    name: "云原生",
    description: "Docker、Kubernetes、CI/CD、服务网格、可观测性",
    group: "架构与工程",
    topics: ["Docker", "Kubernetes", "CI/CD", "Helm", "Istio", "Prometheus"],
  },
  {
    id: "security",
    name: "安全",
    description: "Web 安全、认证授权、加密算法、OWASP Top 10",
    group: "架构与工程",
    topics: ["XSS/CSRF", "SQL 注入", "JWT/OAuth", "HTTPS/TLS", "加密算法"],
  },
  // 求职软实力
  {
    id: "project-experience",
    name: "项目经验",
    description: "STAR 法则、项目亮点提炼、技术选型论述、难点复盘",
    group: "求职软实力",
    topics: ["STAR 法则", "亮点提炼", "技术选型", "数据量化", "难点复盘"],
  },
  {
    id: "soft-skills",
    name: "软技能",
    description: "自我介绍、反问技巧、薪资谈判、职业规划、沟通表达",
    group: "求职软实力",
    topics: ["自我介绍", "反问环节", "薪资谈判", "职业规划", "沟通表达"],
  },
];

const groups = [...new Set(categories.map((c) => c.group))];

export default function KnowledgePage() {
  return (
    <div className="container px-6 py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">知识库</h1>
        <p className="text-muted-foreground">
          涵盖 15 大技术方向，从 AI/LLM 到系统设计，构建完整面试知识体系
        </p>
      </div>

      {groups.map((group) => (
        <section key={group} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{group}</h2>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {categories
              .filter((c) => c.group === group)
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/knowledge/${category.id}`}
                  className="group"
                >
                  <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {category.name}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs leading-relaxed">
                        {category.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {category.topics.map((topic) => (
                          <Badge key={topic} variant="outline" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
