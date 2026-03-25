"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function KnowledgePointPage() {
  const params = useParams();
  const categoryId = params.categoryId as string;
  const pointId = params.pointId as string;
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8000/api/knowledge/points/${categoryId}/${pointId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 200) setContent(data.data.content);
      })
      .finally(() => setIsLoading(false));
  }, [categoryId, pointId]);

  if (isLoading) {
    return (
      <div className="container px-6 py-10">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl px-6 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/knowledge/${categoryId}`}>
          <Button variant="ghost" size="sm">&larr; 返回列表</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
