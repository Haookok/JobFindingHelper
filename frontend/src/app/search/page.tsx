"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchResult {
  path: string;
  category: string;
  category_name: string;
  title: string;
  difficulty: string;
  tags: string;
  score: number;
  highlight: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(
        `${apiBase}/api/search/query?q=${encodeURIComponent(q)}&limit=30`
      );
      const data = await res.json();
      if (data.code === 200) {
        setResults(data.data.results);
        setTotal(data.data.total);
      }
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const difficultyVariant = (d: string): "default" | "secondary" | "destructive" => {
    if (d.includes("深入")) return "destructive";
    if (d.includes("进阶")) return "default";
    return "secondary";
  };

  return (
    <div className="container px-6 py-10 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">知识库搜索</h1>
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-xl">
          <Input
            type="search"
            placeholder="输入关键词搜索全部知识点..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "搜索中..." : "搜索"}
          </Button>
        </form>
      </div>

      {hasSearched && (
        <p className="text-sm text-muted-foreground">
          找到 <span className="font-semibold text-foreground">{total}</span> 个相关知识点
        </p>
      )}

      <div className="space-y-4">
        {results.map((r) => (
          <Link key={r.path} href={`/knowledge/${r.path}`}>
            <Card className="transition-all hover:shadow-md hover:border-primary/40 cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base">{r.title}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {r.category_name}
                  </Badge>
                  {r.difficulty && (
                    <Badge variant={difficultyVariant(r.difficulty)} className="text-xs">
                      {r.difficulty}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    相关度 {r.score}
                  </span>
                </div>
                {r.tags && (
                  <CardDescription className="text-xs">
                    {r.tags}
                  </CardDescription>
                )}
              </CardHeader>
              {r.highlight && (
                <CardContent className="pt-0">
                  <div
                    className="text-sm text-muted-foreground leading-relaxed [&_mark]:bg-yellow-200 [&_mark]:text-foreground [&_mark]:px-0.5 [&_mark]:rounded-sm"
                    dangerouslySetInnerHTML={{ __html: r.highlight }}
                  />
                </CardContent>
              )}
            </Card>
          </Link>
        ))}

        {hasSearched && results.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">未找到相关知识点，试试其他关键词</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container px-6 py-10">加载中...</div>}>
      <SearchContent />
    </Suspense>
  );
}
