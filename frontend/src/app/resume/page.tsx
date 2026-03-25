"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function ResumePage() {
  const [resumeText, setResumeText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!resumeText.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => setIsAnalyzing(false), 2000);
  };

  return (
    <div className="container px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">简历分析</h1>
        <p className="text-muted-foreground">
          粘贴简历内容，AI 自动生成面试高频问题和项目追问方向
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>简历内容</CardTitle>
            <CardDescription>
              粘贴你的简历文本，重点包含项目经历和技术栈
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="在这里粘贴你的简历内容..."
              className="min-h-[300px] resize-none"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleAnalyze}
              disabled={!resumeText.trim() || isAnalyzing}
            >
              {isAnalyzing ? "分析中..." : "开始分析"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>功能说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">1</Badge>
                <div>
                  <p className="text-sm font-medium">简历押题</p>
                  <p className="text-xs text-muted-foreground">
                    根据简历中的技术栈和项目经历，生成 20+ 高频面试问题
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">2</Badge>
                <div>
                  <p className="text-sm font-medium">项目追问</p>
                  <p className="text-xs text-muted-foreground">
                    针对每个项目经历，生成技术深挖方向和追问链
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">3</Badge>
                <div>
                  <p className="text-sm font-medium">亮点提取</p>
                  <p className="text-xs text-muted-foreground">
                    识别简历亮点，建议如何在面试中突出展示
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-0.5 shrink-0">4</Badge>
                <div>
                  <p className="text-sm font-medium">改进建议</p>
                  <p className="text-xs text-muted-foreground">
                    发现简历中的薄弱环节，给出针对性改进建议
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>分析结果</CardTitle>
              <CardDescription>AI 分析结果将在这里展示</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                粘贴简历内容并点击"开始分析"查看结果
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
