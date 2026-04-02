"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function KnowledgePointPage() {
  const params = useParams();
  const categoryId = params.categoryId as string;
  const pointId = params.pointId as string;
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/knowledge/points/${categoryId}/${pointId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.code === 200) {
        setContent(data.data.content);
      } else {
        throw new Error(data.message || "未知错误");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "请求失败";
      setError(`加载失败：${msg}。请确认后端服务已启动（端口 8000）`);
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, pointId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return (
    <div className="container max-w-4xl px-6 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/knowledge/${categoryId}`}>
          <Button variant="ghost" size="sm">&larr; 返回列表</Button>
        </Link>
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-center py-10">加载中...</p>
      )}

      {error && (
        <div className="text-center py-10 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchContent}>重试</Button>
        </div>
      )}

      {!isLoading && !error && content && (
        <Card>
          <CardContent className="pt-6">
            <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && !content && (
        <p className="text-muted-foreground text-center py-10">内容为空</p>
      )}
    </div>
  );
}
