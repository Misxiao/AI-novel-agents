import { ClipboardCheck, MessageSquareQuote } from "lucide-react";

import { QualityPill } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getReviewReport } from "@/services/mockApi";
import { useAppStore } from "@/stores/appStore";
import { useAsyncValue } from "@/hooks/useAsyncValue";

export function ReviewPage() {
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const { data: report, loading, error } = useAsyncValue(() => getReviewReport(selectedNovelId), [selectedNovelId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">正在读取评审报告...</div>;
  }

  if (error || !report) {
    return <div className="text-sm text-destructive">{error || "评审报告加载失败"}</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="paper-panel">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="ink">第 {report.chapterNo} 章</Badge>
              <CardTitle className="ink-title mt-3 text-3xl">{report.chapterTitle}</CardTitle>
              <CardDescription className="mt-2 max-w-4xl leading-6">{report.conclusion}</CardDescription>
            </div>
            <div className="rounded-md border bg-muted/35 p-4 text-center">
              <div className="text-xs text-muted-foreground">总评</div>
              <div className="mt-1 text-4xl font-semibold">{report.overallScore}</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {report.dimensions.map((dimension) => (
          <Card className="paper-panel" key={dimension.label}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{dimension.label}</CardTitle>
                <QualityPill state={dimension.level} />
              </div>
              <CardDescription>{dimension.score} 分</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={dimension.score} />
              <p className="text-sm leading-6 text-muted-foreground">{dimension.comment}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="paper-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            修改建议
          </CardTitle>
          <CardDescription>用于后续局部重写、扩写、压缩或去 AI 味处理。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {report.recommendations.map((recommendation) => (
            <div className="rounded-md border bg-card/70 p-4 text-sm leading-6" key={recommendation}>
              <MessageSquareQuote className="mb-3 h-4 w-4 text-primary" />
              {recommendation}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
