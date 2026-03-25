import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const categoryProgress = [
  { name: "Java", total: 25, reviewed: 0, mastered: 0 },
  { name: "Python", total: 20, reviewed: 0, mastered: 0 },
  { name: "前端", total: 25, reviewed: 0, mastered: 0 },
  { name: "算法", total: 30, reviewed: 0, mastered: 0 },
  { name: "数据库", total: 25, reviewed: 0, mastered: 0 },
  { name: "操作系统", total: 20, reviewed: 0, mastered: 0 },
  { name: "计算机网络", total: 20, reviewed: 0, mastered: 0 },
  { name: "系统设计", total: 15, reviewed: 0, mastered: 0 },
];

const weeklyGoals = [
  { label: "每日复习知识点", target: 5, current: 0, unit: "个" },
  { label: "每周模拟面试", target: 2, current: 0, unit: "次" },
  { label: "每周算法练习", target: 5, current: 0, unit: "题" },
];

export default function ProgressPage() {
  const totalPoints = categoryProgress.reduce((sum, c) => sum + c.total, 0);
  const totalReviewed = categoryProgress.reduce((sum, c) => sum + c.reviewed, 0);

  return (
    <div className="container px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">进度追踪</h1>
        <p className="text-muted-foreground">
          掌握学习进度，发现薄弱环节，制定复习计划
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总体进度</CardDescription>
            <CardTitle className="text-3xl">
              {totalReviewed} / {totalPoints}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={totalPoints > 0 ? (totalReviewed / totalPoints) * 100 : 0}
              className="h-3"
            />
            <p className="text-xs text-muted-foreground mt-2">
              已复习 {totalPoints > 0 ? Math.round((totalReviewed / totalPoints) * 100) : 0}% 的知识点
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>本周面试次数</CardDescription>
            <CardTitle className="text-3xl">0 次</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={0} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">目标：每周 2 次</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>连续学习天数</CardDescription>
            <CardTitle className="text-3xl">0 天</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={0} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">坚持就是胜利</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>分类进度</CardTitle>
          <CardDescription>各技术方向的复习完成情况</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoryProgress.map((cat, i) => (
            <div key={cat.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{cat.name}</span>
                <span className="text-xs text-muted-foreground">
                  {cat.reviewed}/{cat.total} 已复习
                </span>
              </div>
              <Progress
                value={cat.total > 0 ? (cat.reviewed / cat.total) * 100 : 0}
                className="h-2"
              />
              {i < categoryProgress.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>学习目标</CardTitle>
          <CardDescription>设定目标，保持节奏</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {weeklyGoals.map((goal) => (
            <div key={goal.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{goal.label}</span>
                <span className="text-xs text-muted-foreground">
                  {goal.current}/{goal.target} {goal.unit}
                </span>
              </div>
              <Progress
                value={(goal.current / goal.target) * 100}
                className="h-2"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
