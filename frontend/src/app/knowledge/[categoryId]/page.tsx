"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    fetch(`http://localhost:8000/api/knowledge/categories/${categoryId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 200) setPoints(data.data);
      })
      .finally(() => setIsLoading(false));
  }, [categoryId]);

  if (isLoading) {
    return (
      <div className="container px-6 py-10">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

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
    </div>
  );
}
