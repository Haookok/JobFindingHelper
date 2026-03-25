import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const modules = [
  {
    title: "知识库复习",
    description: "分类整理的技术八股文，涵盖 8 大方向",
    href: "/knowledge",
    badge: "核心",
    categories: ["Java", "Python", "前端", "算法", "数据库", "OS", "网络", "系统设计"],
  },
  {
    title: "模拟面试",
    description: "AI 驱动的模拟面试，还原大厂真实场景",
    href: "/interview",
    badge: "AI",
    categories: ["后端开发", "前端开发", "算法工程师", "数据开发"],
  },
  {
    title: "进度追踪",
    description: "学习进度可视化，发现薄弱环节",
    href: "/progress",
    badge: "数据",
    categories: ["每日复习", "知识图谱", "薄弱分析"],
  },
  {
    title: "简历分析",
    description: "上传简历，自动生成高频面试问题",
    href: "/resume",
    badge: "智能",
    categories: ["简历押题", "项目追问", "亮点提取"],
  },
];

const stats = [
  { label: "知识点总数", value: "200+", progress: 0 },
  { label: "已复习", value: "0", progress: 0 },
  { label: "模拟面试", value: "0 次", progress: 0 },
  { label: "平均得分", value: "--", progress: 0 },
];

export default function Home() {
  return (
    <div className="container px-6 py-10 space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          秋招面试辅助系统
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          系统复习技术知识，AI 模拟面试，追踪学习进度。助你高效备战秋招，拿下心仪 Offer。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={stat.progress} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href} className="group">
            <Card className="h-full transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {mod.title}
                  </CardTitle>
                  <Badge variant="secondary">{mod.badge}</Badge>
                </div>
                <CardDescription>{mod.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {mod.categories.map((cat) => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
