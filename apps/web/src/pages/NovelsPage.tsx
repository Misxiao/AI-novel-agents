import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Gauge,
  LibraryBig,
  Plus,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { QualityPill } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAsyncValue } from "@/hooks/useAsyncValue";
import { formatDateTime } from "@/lib/format";
import { listNovels } from "@/services/api";
import { useAppStore } from "@/stores/appStore";

export function NovelsPage() {
  const { data: novels, loading, error } = useAsyncValue(listNovels, []);
  const setSelectedNovelId = useAppStore((state) => state.setSelectedNovelId);

  if (loading) {
    return (
      <div className="home-canvas flex min-h-screen items-center justify-center text-sm text-slate-500">
        正在整理创作项目...
      </div>
    );
  }

  if (error || !novels) {
    return (
      <div className="home-canvas flex min-h-screen items-center justify-center text-sm text-destructive">
        {error || "小说列表加载失败"}
      </div>
    );
  }

  if (novels.length === 0) {
    return <Navigate replace to="/novels/new" />;
  }

  const activeNovels = novels.filter((novel) => !novel.archived);
  const completedChapters = activeNovels.reduce((sum, novel) => sum + novel.completedChapters, 0);
  const averageQuality = activeNovels.length
    ? Math.round(activeNovels.reduce((sum, novel) => sum + novel.qualityScore, 0) / activeNovels.length)
    : 0;

  return (
    <div className="home-canvas min-h-screen">
      <header className="border-b border-white/80 bg-white/72 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-700 text-white shadow-sm shadow-cyan-700/20">
              <LibraryBig className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">本地小说创作台</div>
            </div>
          </div>
          <Button asChild className="hidden bg-cyan-700 shadow-sm shadow-cyan-700/20 hover:bg-cyan-800 sm:inline-flex">
            <Link to="/novels/new">
              <Plus className="h-4 w-4" />
              新建小说
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8 lg:py-12">
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 border-cyan-100 bg-cyan-50 text-cyan-800" variant="outline">
              创作项目
            </Badge>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              我的小说工作台
            </h1>
          </div>
          <Button asChild className="bg-cyan-700 shadow-sm shadow-cyan-700/20 hover:bg-cyan-800 sm:hidden">
            <Link to="/novels/new">
              <Plus className="h-4 w-4" />
              新建小说
            </Link>
          </Button>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <MetricCard icon={BookOpen} label="正在创作" value={`${activeNovels.length}`} hint="活跃项目" tone="ink" />
          <MetricCard icon={CalendarClock} label="累计章节" value={`${completedChapters}`} hint="已完成章节" tone="jade" />
          <MetricCard icon={Gauge} label="平均质量" value={`${averageQuality}`} hint="综合评分" tone="amber" />
        </section>

        <section className="mt-8 grid gap-4">
          {novels.map((novel) => {
            const progress = Math.round((novel.completedChapters / novel.totalChapters) * 100);

            return (
              <Link
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={novel.novelId}
                onClick={() => setSelectedNovelId(novel.novelId)}
                to={`/novels/${novel.novelId}/overview`}
              >
                <article className="project-card rounded-lg p-5 sm:p-6">
                  <div className="grid gap-5 lg:grid-cols-[1.15fr_0.9fr_0.8fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <QualityPill state={novel.qualityState} />
                        <Badge variant="outline">{novel.stage}</Badge>
                        <span className="text-xs text-slate-500">{novel.genre}</span>
                      </div>
                      <h2 className="truncate text-2xl font-semibold tracking-normal text-slate-950">
                        {novel.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{novel.hook}</p>
                    </div>

                    <div className="min-w-0 rounded-md bg-slate-50/74 p-4 ring-1 ring-slate-200/55">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span>章节进度</span>
                        <span>
                          {novel.completedChapters}/{novel.totalChapters}
                        </span>
                      </div>
                      <Progress value={progress} />
                      <div className="mt-3 text-sm font-medium text-slate-950">{novel.currentVolume}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-500">最近任务</div>
                      <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{novel.recentTask}</div>
                      <div className="mt-2 text-xs text-slate-500">{formatDateTime(novel.updatedAt)} 更新</div>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                      <div className="rounded-md bg-white px-4 py-3 text-center shadow-sm ring-1 ring-slate-200/60">
                        <div className="text-xs text-slate-500">质量分</div>
                        <div className="text-2xl font-semibold text-slate-950">{novel.qualityScore}</div>
                      </div>
                      <Button className="bg-cyan-700 hover:bg-cyan-800" size="icon">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
