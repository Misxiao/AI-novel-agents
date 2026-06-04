import {
  BookMarked,
  CheckCircle2,
  CircleAlert,
  Compass,
  FileText,
  LibraryBig,
  ListChecks,
  MemoryStick,
  Milestone,
  PenTool,
  Sparkles,
  Target,
} from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAsyncValue } from "@/hooks/useAsyncValue";
import { getNovelOverview } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import type { NovelOverview } from "@/types";

const readinessVariant: Record<NovelOverview["assetReadiness"][number]["status"], "jade" | "amber" | "cinnabar" | "outline"> = {
  ready: "jade",
  draft: "amber",
  needs_review: "amber",
  missing: "cinnabar",
};

const readinessLabel: Record<NovelOverview["assetReadiness"][number]["status"], string> = {
  ready: "可用",
  draft: "草稿",
  needs_review: "需复核",
  missing: "缺失",
};

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
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="paper-panel">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="w-fit" variant="ink">当前故事引擎</Badge>
              <Badge variant="outline">简介主维护区</Badge>
            </div>
            <CardTitle className="ink-title mt-2 text-2xl">概览与立项基准</CardTitle>
            <CardDescription className="max-w-3xl leading-6">{overview.premise}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-cyan-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cyan-950">
                  <PenTool className="h-4 w-4" />
                  创作简介
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{overview.creativeSynopsis}</p>
              </div>
              <div className="rounded-md border bg-white/75 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  对外简介
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{overview.publicSynopsis}</p>
              </div>
            </div>

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
            <div className="flex flex-wrap gap-2">
              <Button size="sm">
                <Sparkles className="h-4 w-4" />
                立项诊断
              </Button>
              <Button size="sm" variant="outline">
                <BookMarked className="h-4 w-4" />
                改写简介
              </Button>
              <Button size="sm" variant="outline">
                <Compass className="h-4 w-4" />
                进入大纲规划
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="paper-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              待处理事项
            </CardTitle>
            <CardDescription>近期需要处理的章节、设定和修订事项。</CardDescription>
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

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="paper-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              立项定位
            </CardTitle>
            <CardDescription>这些信息会作为章节生产与评审的上游约束。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[
              ["核心卖点", overview.pitch.sellingPoint],
              ["情绪承诺", overview.pitch.emotionalPromise],
              ["主冲突", overview.pitch.mainConflict],
              ["故事引擎", overview.pitch.storyEngine],
              ["主角成长", overview.pitch.protagonistArc],
              ["风险提示", overview.pitch.riskNote],
            ].map(([label, value]) => (
              <div className="rounded-md border bg-card/75 p-4" key={label}>
                <div className="text-xs font-medium text-muted-foreground">{label}</div>
                <p className="mt-2 text-sm leading-6">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="paper-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              资产完整度
            </CardTitle>
            <CardDescription>判断当前小说是否适合进入大纲规划或章节生产。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.assetReadiness.map((asset) => (
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-card/70 p-3" key={asset.id}>
                <div>
                  <div className="font-medium">{asset.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{asset.note}</div>
                </div>
                <Badge variant={readinessVariant[asset.status]}>{readinessLabel[asset.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="paper-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            风格方向
          </CardTitle>
          <CardDescription>这是小说资产，不是 Prompt 配置；后续工作流只读取结果。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-md border bg-muted/35 p-4">
            <div className="text-sm font-medium">关键词</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {overview.styleDirection.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">{keyword}</Badge>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border bg-card/70 p-4">
              <div className="text-xs font-medium text-muted-foreground">节奏倾向</div>
              <p className="mt-2 text-sm leading-6">{overview.styleDirection.pacing}</p>
            </div>
            <div className="rounded-md border bg-card/70 p-4">
              <div className="text-xs font-medium text-muted-foreground">叙述视角</div>
              <p className="mt-2 text-sm leading-6">{overview.styleDirection.narration}</p>
            </div>
            <div className="rounded-md border bg-card/70 p-4">
              <div className="text-xs font-medium text-muted-foreground">对白密度</div>
              <p className="mt-2 text-sm leading-6">{overview.styleDirection.dialogueDensity}</p>
            </div>
            <div className="rounded-md border bg-card/70 p-4">
              <div className="text-xs font-medium text-muted-foreground">禁用表达</div>
              <p className="mt-2 text-sm leading-6">{overview.styleDirection.forbiddenPatterns.join("、")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
