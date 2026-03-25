import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const categories = [
  {
    id: "java",
    name: "Java",
    description: "Java 基础、JVM、并发编程、集合框架、Spring",
    count: 25,
    topics: ["基础语法", "JVM 内存模型", "垃圾回收", "并发编程", "集合框架", "Spring Boot"],
  },
  {
    id: "python",
    name: "Python",
    description: "Python 基础、GIL、装饰器、异步编程、Web 框架",
    count: 20,
    topics: ["基础语法", "GIL", "装饰器", "生成器", "异步 IO", "FastAPI"],
  },
  {
    id: "frontend",
    name: "前端",
    description: "HTML/CSS/JS、React、浏览器原理、性能优化",
    count: 25,
    topics: ["JavaScript 核心", "React", "CSS 布局", "浏览器渲染", "性能优化", "TypeScript"],
  },
  {
    id: "algorithms",
    name: "算法",
    description: "排序、搜索、动态规划、图算法、常见题型",
    count: 30,
    topics: ["排序算法", "二分搜索", "动态规划", "图算法", "贪心", "回溯"],
  },
  {
    id: "database",
    name: "数据库",
    description: "MySQL、Redis、索引优化、事务、分库分表",
    count: 25,
    topics: ["MySQL 索引", "事务隔离", "锁机制", "Redis 数据结构", "缓存策略", "分库分表"],
  },
  {
    id: "os",
    name: "操作系统",
    description: "进程线程、内存管理、IO 模型、死锁",
    count: 20,
    topics: ["进程与线程", "内存管理", "虚拟内存", "IO 模型", "死锁", "调度算法"],
  },
  {
    id: "network",
    name: "计算机网络",
    description: "TCP/IP、HTTP/HTTPS、DNS、网络安全",
    count: 20,
    topics: ["TCP 三次握手", "HTTP/HTTPS", "DNS 解析", "WebSocket", "网络安全", "CDN"],
  },
  {
    id: "system-design",
    name: "系统设计",
    description: "分布式系统、微服务、消息队列、缓存架构",
    count: 15,
    topics: ["分布式一致性", "微服务架构", "消息队列", "缓存设计", "限流熔断", "负载均衡"],
  },
];

export default function KnowledgePage() {
  return (
    <div className="container px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">知识库</h1>
        <p className="text-muted-foreground">
          涵盖 8 大技术方向，系统复习面试核心知识点
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/knowledge/${category.id}`}
            className="group"
          >
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {category.name}
                  </CardTitle>
                  <Badge variant="secondary">{category.count} 题</Badge>
                </div>
                <CardDescription>{category.description}</CardDescription>
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
    </div>
  );
}
