import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const positions = [
  {
    id: "backend",
    name: "后端开发",
    description: "Java/Go + 数据库 + 系统设计，45 分钟标准面试",
    difficulty: "中等",
    topics: ["Java", "数据库", "操作系统", "系统设计"],
    duration: 45,
  },
  {
    id: "frontend-dev",
    name: "前端开发",
    description: "JavaScript/TypeScript + React + 浏览器 + 网络",
    difficulty: "中等",
    topics: ["JavaScript", "React", "CSS", "网络", "性能优化"],
    duration: 45,
  },
  {
    id: "algorithm",
    name: "算法工程师",
    description: "ML/DL 基础 + 数学 + 编程能力",
    difficulty: "困难",
    topics: ["机器学习", "深度学习", "数学", "编程"],
    duration: 60,
  },
  {
    id: "data",
    name: "数据开发",
    description: "SQL + 大数据技术栈 + 分布式计算",
    difficulty: "中等",
    topics: ["SQL", "Hadoop", "Spark", "数据仓库"],
    duration: 45,
  },
];

const difficultyColor: Record<string, "default" | "secondary" | "destructive"> = {
  "简单": "secondary",
  "中等": "default",
  "困难": "destructive",
};

export default function InterviewPage() {
  return (
    <div className="container px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">模拟面试</h1>
        <p className="text-muted-foreground">
          选择岗位方向，开启 AI 模拟面试。还原大厂面试流程：自我介绍 → 项目经历 → 八股文 → 算法 → 反问
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {positions.map((pos) => (
          <Card key={pos.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{pos.name}</CardTitle>
                <Badge variant={difficultyColor[pos.difficulty]}>
                  {pos.difficulty}
                </Badge>
              </div>
              <CardDescription>{pos.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {pos.topics.map((topic) => (
                    <Badge key={topic} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  预计时长：{pos.duration} 分钟
                </p>
              </div>
              <Button className="w-full">开始面试</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>面试记录</CardTitle>
          <CardDescription>你的历史模拟面试记录将在这里展示</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            暂无面试记录，选择一个岗位开始你的第一次模拟面试吧
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
