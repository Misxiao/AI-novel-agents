import { CheckCircle2, CircleAlert, LibraryBig, ListChecks, MemoryStick, Milestone } from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import { QualityPill } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAsyncValue } from "@/hooks/useAsyncValue";
import { getNovelOverview } from "@/services/mockApi";
import { useAppStore } from "@/stores/appStore";

export function OverviewPage() {
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const { data: overview, loading, error } = useAsyncValue(
    () => getNovelOverview(selectedNovelId),
    [selectedNovelId],
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground">正在读取小说概览...</div>;
  }

  if (error || !overview) {
    return <div className="text-sm text-destructive">{error || "概览加载失败"}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="paper-panel">
          <CardHeader>
            <Badge className="w-fit" variant="ink">当前故事引擎</Badge>
            <CardTitle className="ink-title mt-2 text-2xl">概览与下一步</CardTitle>
            <CardDescription className="max-w-3xl leading-6">{overview.premise}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">章节推进</span>
                <span className="text-muted-foreground">{overview.chapterProgress}%</span>
              </div>
              <Progress value={overview.chapterProgress} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">记忆健康度</span>
                <span className="text-muted-foreground">{overview.memoryHealth}%</span>
              </div>
              <Progress value={overview.memoryHealth} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-muted/35 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Milestone className="h-4 w-4" />
                  当前卷目标
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{overview.currentGoal}</p>
              </div>
              <div className="rounded-md border bg-muted/35 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  下一验收点
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{overview.nextMilestone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="paper-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              待处理事项
            </CardTitle>
            <CardDescription>按当前小说上下文生成的 mock 待办。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.pendingItems.map((item) => (
              <div className="rounded-md border bg-card/70 p-3" key={item.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{item.title}</div>
                  <Badge variant={item.priority === "高" ? "cinnabar" : item.priority === "中" ? "amber" : "outline"}>
                    {item.priority}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">归属：{item.owner}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="dense-grid">
        <MetricCard icon={LibraryBig} label={overview.metrics[0].label} value={overview.metrics[0].value} hint={overview.metrics[0].trend} />
        <MetricCard icon={MemoryStick} label={overview.metrics[1].label} value={overview.metrics[1].value} hint={overview.metrics[1].trend} tone="amber" />
        <MetricCard icon={CircleAlert} label={overview.metrics[2].label} value={overview.metrics[2].value} hint={overview.metrics[2].trend} tone="jade" />
      </div>
    </div>
  );
}
