import { ClipboardCheck, FileClock, Save, Sparkles } from "lucide-react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { getChapterWorkspace } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import { useAsyncValue } from "@/hooks/useAsyncValue";

export function ChapterPage() {
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const draftBodies = useAppStore((state) => state.draftBodies);
  const setDraftBody = useAppStore((state) => state.setDraftBody);
  const setToastMessage = useAppStore((state) => state.setToastMessage);
  const toastMessage = useAppStore((state) => state.toastMessage);
  const { data: workspace, loading, error } = useAsyncValue(
    () => getChapterWorkspace(selectedNovelId),
    [selectedNovelId],
  );

  useEffect(() => {
    if (workspace && !draftBodies[selectedNovelId]) {
      setDraftBody(selectedNovelId, workspace.draft.body);
    }
  }, [draftBodies, selectedNovelId, setDraftBody, workspace]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">正在打开章节工作区...</div>;
  }

  if (error || !workspace) {
    return <div className="text-sm text-destructive">{error || "章节工作区加载失败"}</div>;
  }

  const body = draftBodies[selectedNovelId] ?? workspace.draft.body;
  const liveWordCount = body.replace(/\s/g, "").length;

  return (
    <div className="grid gap-4 xl:grid-cols-[0.82fr_1.4fr_0.78fr]">
      <Card className="paper-panel">
        <CardHeader>
          <Badge className="w-fit" variant="outline">{workspace.plan.volumeTitle}</Badge>
          <CardTitle className="ink-title text-2xl">
            第 {workspace.plan.chapterNo} 章
          </CardTitle>
          <CardDescription>{workspace.plan.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/35 p-4">
            <div className="text-sm font-medium">章节目标</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{workspace.plan.objective}</p>
          </div>
          <div className="rounded-md border bg-muted/35 p-4">
            <div className="text-sm font-medium">章末拉力</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{workspace.plan.hook}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border bg-card/70 p-3">
              <div className="text-muted-foreground">版本</div>
              <div className="mt-1 font-semibold">v{workspace.draft.version}</div>
            </div>
            <div className="rounded-md border bg-card/70 p-3">
              <div className="text-muted-foreground">状态</div>
              <div className="mt-1 font-semibold">{workspace.plan.status}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="paper-panel">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileClock className="h-5 w-5" />
                正文草稿
              </CardTitle>
              <CardDescription>
                {formatDateTime(workspace.draft.updatedAt)} 更新，当前约 {liveWordCount} 字
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setToastMessage("草稿已保存")}
                size="sm"
                variant="outline"
              >
                <Save className="h-4 w-4" />
                保存
              </Button>
              <Button
                onClick={() => setToastMessage("真实章节评审工作流尚未接入")}
                size="sm"
              >
                <ClipboardCheck className="h-4 w-4" />
                评审
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Textarea
            aria-label="章节正文"
            className="min-h-[560px] resize-y rounded-none border-0 bg-transparent p-5 font-serif text-base leading-8 shadow-none focus-visible:ring-0"
            onChange={(event) => setDraftBody(selectedNovelId, event.target.value)}
            value={body}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="paper-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              评审摘要
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">{workspace.reviewSummary}</p>
          </CardContent>
        </Card>

        <Card className="paper-panel">
          <CardHeader>
            <CardTitle>版本记录</CardTitle>
            <CardDescription>仅展示当前小说的草稿版本注记。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspace.versionNotes.map((note) => (
              <div className="rounded-md border bg-card/70 p-3 text-sm" key={note}>
                {note}
              </div>
            ))}
          </CardContent>
        </Card>

        {toastMessage ? (
          <div className="rounded-md border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-900">
            {toastMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
