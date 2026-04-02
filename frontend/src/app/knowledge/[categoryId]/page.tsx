"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface KnowledgePoint {
  id: string;
  title: string;
  filename: string;
}

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params.categoryId as string;
  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPoints = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/categories/${categoryId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.code === 200) {
        setPoints(data.data);
      } else {
        throw new Error(data.message || "未知错误");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "请求失败";
      setError(`加载失败：${msg}。请确认后端服务已启动（端口 8000）`);
    } finally {
      setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return (
    <div className="container px-6 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/knowledge">
          <Button variant="ghost" size="sm">&larr; 返回知识库</Button>
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{categoryId}</h1>
        <p className="text-muted-foreground">
          共 {points.length} 个知识点
        </p>
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-center py-10">加载中...</p>
      )}

      {error && (
        <div className="text-center py-10 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchPoints}>重试</Button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-3">
          {points.map((point, i) => (
            <Link key={point.id} href={`/knowledge/${categoryId}/${point.id}`}>
              <Card className="transition-all hover:shadow-md hover:border-primary/40">
                <CardHeader className="py-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
                    <div>
                      <CardTitle className="text-base">{point.title}</CardTitle>
                      <CardDescription className="text-xs">{point.filename}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}

          {points.length === 0 && (
            <p className="text-muted-foreground text-center py-10">
              该分类暂无知识点
            </p>
          )}
        </div>
      )}
    </div>
  );
}
