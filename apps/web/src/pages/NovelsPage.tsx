import { ArrowRight, BookOpen, Clock3, Gauge, Plus } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { QualityPill } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDateTime } from "@/lib/format";
import { useAppStore } from "@/stores/appStore";
import type { Novel } from "@/types";

export function NovelsPage() {
  const { novels } = useOutletContext<{ novels: Novel[] }>();
  const setSelectedNovelId = useAppStore((state) => state.setSelectedNovelId);
  const activeNovels = novels.filter((novel) => !novel.archived);
  const averageQuality = Math.round(
    activeNovels.reduce((sum, novel) => sum + novel.qualityScore, 0) / activeNovels.length,
  );
  const runningChapters = activeNovels.reduce((sum, novel) => sum + novel.completedChapters, 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border/80 bg-card/75 p-5 shadow-manuscript sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <Badge variant="ink">本地创作项目</Badge>
          <h2 className="ink-title mt-3 text-3xl font-semibold tracking-normal">小说生产总览</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            这里管理多本小说的阶段、任务、章节进度和质量状态。所有 mock 数据已按 novelId 隔离，后续可以替换为真实 Fastify API。
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          新建小说
        </Button>
      </section>

      <div className="dense-grid">
        <MetricCard icon={BookOpen} label="活跃小说" value={`${activeNovels.length}`} hint="未归档项目" tone="ink" />
        <MetricCard icon={Clock3} label="已完成章节" value={`${runningChapters}`} hint="跨项目累计" tone="jade" />
        <MetricCard icon={Gauge} label="平均质量" value={`${averageQuality}`} hint="评审维度聚合" tone="amber" />
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {novels.map((novel) => {
          const progress = Math.round((novel.completedChapters / novel.totalChapters) * 100);

          return (
            <Card className="paper-panel overflow-hidden transition-transform hover:-translate-y-0.5" key={novel.novelId}>
              <CardHeader className="border-b bg-card/75">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="ink-title truncate text-xl">{novel.title}</CardTitle>
                    <CardDescription className="mt-2">{novel.genre}</CardDescription>
                  </div>
                  <QualityPill state={novel.qualityState} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <p className="line-clamp-2 text-sm leading-6 text-foreground/82">{novel.hook}</p>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>章节进度</span>
                    <span>
                      {novel.completedChapters}/{novel.totalChapters}
                    </span>
                  </div>
                  <Progress value={progress} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border bg-muted/35 p-3">
                    <div className="text-muted-foreground">当前阶段</div>
                    <div className="mt-1 font-medium">{novel.stage}</div>
                  </div>
                  <div className="rounded-md border bg-muted/35 p-3">
                    <div className="text-muted-foreground">质量分</div>
                    <div className="mt-1 font-medium">{novel.qualityScore}</div>
                  </div>
                </div>
                <div className="rounded-md border border-dashed bg-card/50 p-3 text-xs leading-5 text-muted-foreground">
                  <div className="font-medium text-foreground">{novel.recentTask}</div>
                  <div>{formatDateTime(novel.updatedAt)} 更新</div>
                </div>
                <Button asChild className="w-full" onClick={() => setSelectedNovelId(novel.novelId)} variant="outline">
                  <Link to="/overview">
                    打开工作台
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
