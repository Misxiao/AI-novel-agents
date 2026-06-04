import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Edit3,
  GitBranch,
  Landmark,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncValue } from "@/hooks/useAsyncValue";
import {
  generateFirstOutline,
  getNovelOutline,
  reviseNovelOutline,
  saveNovelOutline,
  updateNovel,
} from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import type { Novel, Outline } from "@/types";

const issueVariant: Record<Outline["issues"][number]["level"], "jade" | "amber" | "cinnabar"> = {
  健康: "jade",
  关注: "amber",
  风险: "cinnabar",
};

const foreshadowingVariant: Record<Outline["foreshadowing"][number]["status"], "jade" | "amber" | "cinnabar" | "outline"> = {
  已埋设: "outline",
  推进中: "amber",
  待回收: "amber",
  已回收: "jade",
  风险: "cinnabar",
};

type OutlineData = Awaited<ReturnType<typeof getNovelOutline>>;

export function OutlinePage() {
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const setToastMessage = useAppStore((state) => state.setToastMessage);
  const { selectedNovel } = useOutletContext<{ selectedNovel: Novel }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [generatedData, setGeneratedData] = useState<OutlineData | null>(null);
  const [outlineDraft, setOutlineDraft] = useState<Outline | null>(null);
  const [activeVolumeId, setActiveVolumeId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(selectedNovel.title);
  const [editingMaster, setEditingMaster] = useState(false);
  const [editingVolume, setEditingVolume] = useState(false);
  const [masterInstruction, setMasterInstruction] = useState("");
  const [volumeInstruction, setVolumeInstruction] = useState("");
  const autoGenerateStarted = useRef(false);
  const { data: loadedData, loading, error } = useAsyncValue(() => getNovelOutline(selectedNovelId), [selectedNovelId]);
  const data = generatedData ?? loadedData;
  const hasOutline = Boolean(outlineDraft?.volumes.length);

  useEffect(() => {
    setTitleDraft(selectedNovel.title);
  }, [selectedNovel.title]);

  useEffect(() => {
    if (data?.outline) {
      setOutlineDraft(data.outline);
      setActiveVolumeId((current) => current || data.outline.volumes[0]?.id || "");
    }
  }, [data]);

  const activeVolume = useMemo(
    () => outlineDraft?.volumes.find((volume) => volume.id === activeVolumeId) ?? outlineDraft?.volumes[0],
    [activeVolumeId, outlineDraft],
  );

  const runFirstOutlineGeneration = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setGenerationError("");
    try {
      const result = await generateFirstOutline(selectedNovelId);
      const nextData = { outline: result.outline, chapterPlans: result.chapterPlans };
      setGeneratedData(nextData);
      setOutlineDraft(result.outline);
      setActiveVolumeId(result.outline.volumes[0]?.id ?? "");
      setToastMessage(result.task.outputSnapshot);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("generate");
      setSearchParams(nextParams, { replace: true });
    } catch (generationFailed) {
      const message = generationFailed instanceof Error ? generationFailed.message : "首次大纲生成失败";
      setGenerationError(message);
      setToastMessage(message);
    } finally {
      setGenerating(false);
    }
  }, [generating, searchParams, selectedNovelId, setSearchParams, setToastMessage]);

  useEffect(() => {
    setGeneratedData(null);
    setOutlineDraft(null);
    setGenerationError("");
    setActiveVolumeId("");
    autoGenerateStarted.current = false;
  }, [selectedNovelId]);

  useEffect(() => {
    if (loading || !data || autoGenerateStarted.current || searchParams.get("generate") !== "1") return;
    autoGenerateStarted.current = true;
    void runFirstOutlineGeneration();
  }, [data, loading, runFirstOutlineGeneration, searchParams]);

  const persistOutline = async (nextOutline: Outline, successMessage: string) => {
    setSaving(true);
    try {
      const result = await saveNovelOutline(selectedNovelId, nextOutline);
      const nextData = { outline: result.outline, chapterPlans: result.chapterPlans };
      setGeneratedData(nextData);
      setOutlineDraft(result.outline);
      setToastMessage(successMessage);
    } catch (saveFailed) {
      setToastMessage(saveFailed instanceof Error ? saveFailed.message : "大纲保存失败");
    } finally {
      setSaving(false);
    }
  };

  const reviseOutline = async (scope: "master" | "volume") => {
    const instruction = scope === "master" ? masterInstruction : volumeInstruction;
    if (!instruction.trim()) {
      setToastMessage("请先填写你的修改想法。");
      return;
    }
    setSaving(true);
    try {
      const result = await reviseNovelOutline(selectedNovelId, {
        scope,
        instruction,
        volumeId: scope === "volume" ? activeVolume?.id : undefined,
      });
      setGeneratedData({ outline: result.outline, chapterPlans: result.chapterPlans });
      setOutlineDraft(result.outline);
      setMasterInstruction("");
      setVolumeInstruction("");
      setToastMessage(result.task.outputSnapshot);
    } catch (reviseFailed) {
      setToastMessage(reviseFailed instanceof Error ? reviseFailed.message : "AI 修改失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">正在读取大纲...</div>;
  }

  if (error || !data || !outlineDraft) {
    return <div className="text-sm text-destructive">{error || "大纲加载失败"}</div>;
  }

  const statusLabel = generating ? "生成中" : generationError ? "生成失败" : hasOutline ? "已生成" : "待生成";
  const statusVariant = generationError ? "cinnabar" : hasOutline ? "jade" : generating ? "amber" : "outline";

  const updateMasterField = <K extends keyof Outline["masterOutline"]>(key: K, value: Outline["masterOutline"][K]) => {
    setOutlineDraft((current) => current ? { ...current, masterOutline: { ...current.masterOutline, [key]: value } } : current);
  };

  const updateBaselineField = <K extends keyof Outline["baseline"]>(key: K, value: Outline["baseline"][K]) => {
    setOutlineDraft((current) => current ? { ...current, baseline: { ...current.baseline, [key]: value } } : current);
  };

  const updateVolumeField = <K extends keyof Outline["volumes"][number]>(key: K, value: Outline["volumes"][number][K]) => {
    if (!activeVolume) return;
    setOutlineDraft((current) => current
      ? {
          ...current,
          volumes: current.volumes.map((volume) => volume.id === activeVolume.id ? { ...volume, [key]: value } : volume),
        }
      : current,
    );
  };

  const addVolume = async () => {
    const nextIndex = outlineDraft.volumes.length + 1;
    const nextVolume: Outline["volumes"][number] = {
      id: `${selectedNovelId}-volume-${Date.now()}`,
      title: `第 ${nextIndex} 卷：新卷草案`,
      goal: "填写这一卷的阶段目标、核心冲突和预计章节范围。",
      conflict: "卷核心冲突待确认。",
      highlights: ["阶段目标", "关键反转", "伏笔回收"],
      chapterRange: "待规划",
      status: "未开始",
    };
    const nextOutline = { ...outlineDraft, volumes: [...outlineDraft.volumes, nextVolume] };
    setActiveVolumeId(nextVolume.id);
    await persistOutline(nextOutline, "已新增分卷草案。");
  };

  const deleteActiveVolume = async () => {
    if (!activeVolume || outlineDraft.volumes.length <= 1) return;
    const confirmed = window.confirm(`删除「${activeVolume.title}」会影响该卷规划、时间线、伏笔和后续章节入口。是否继续？`);
    if (!confirmed) return;
    const nextVolumes = outlineDraft.volumes.filter((volume) => volume.id !== activeVolume.id);
    const nextOutline = { ...outlineDraft, volumes: nextVolumes };
    setActiveVolumeId(nextVolumes[0]?.id ?? "");
    await persistOutline(nextOutline, "已删除分卷草案。");
  };

  const confirmMaster = async () => {
    await persistOutline(
      { ...outlineDraft, masterOutline: { ...outlineDraft.masterOutline, status: "已确认" } },
      "总纲已确认。",
    );
  };

  const saveTitle = async () => {
    if (!titleDraft.trim()) return;
    setSaving(true);
    try {
      await updateNovel(selectedNovelId, { title: titleDraft });
      setToastMessage("小说名称已保存。");
      setEditingTitle(false);
    } catch (titleFailed) {
      setToastMessage(titleFailed instanceof Error ? titleFailed.message : "小说名称保存失败");
    } finally {
      setSaving(false);
    }
  };

  const generateTitle = async () => {
    const nextTitle = outlineDraft.baseline.hook.replace(/[，。！？、\s]/g, "").slice(0, 8) || `${selectedNovel.genre}新书`;
    setTitleDraft(nextTitle);
    setSaving(true);
    try {
      await updateNovel(selectedNovelId, { title: nextTitle });
      setToastMessage("已根据故事基准生成并保存小说名称。");
      setEditingTitle(false);
    } catch (titleFailed) {
      setToastMessage(titleFailed instanceof Error ? titleFailed.message : "小说名称生成失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="paper-panel">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="ink">
                  <ScrollText className="mr-1 h-3.5 w-3.5" />
                  大纲工作台
                </Badge>
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {editingTitle ? (
                  <input
                    className="h-10 min-w-[260px] rounded-md border border-input bg-card/90 px-3 text-xl font-semibold"
                    onChange={(event) => setTitleDraft(event.target.value)}
                    value={titleDraft}
                  />
                ) : (
                  <CardTitle className="ink-title text-2xl">{titleDraft}</CardTitle>
                )}
                <Button onClick={() => setEditingTitle((current) => !current)} size="sm" variant="outline">
                  <Edit3 className="h-4 w-4" />
                  修改名称
                </Button>
                <Button disabled={saving} onClick={generateTitle} size="sm" variant="outline">
                  <Sparkles className="h-4 w-4" />
                  AI 生成名称
                </Button>
                {editingTitle ? <Button disabled={saving} onClick={saveTitle} size="sm">保存名称</Button> : null}
              </div>
              <CardDescription className="mt-2 max-w-3xl leading-6">{outlineDraft.logline}</CardDescription>
            </div>
            <Button disabled={generating || saving} onClick={runFirstOutlineGeneration} variant={hasOutline ? "outline" : "default"}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : generationError ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "生成中..." : generationError ? "重试生成" : hasOutline ? "重新生成" : "生成大纲"}
            </Button>
          </div>
        </CardHeader>
        {(generating || generationError || !hasOutline) ? (
          <CardContent>
            {generating ? <StatusBox icon={<Loader2 className="h-4 w-4 animate-spin" />} text="正在生成总纲、分卷和章纲草案，并写入本地 SQLite。" /> : null}
            {generationError ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{generationError}</div> : null}
            {!generating && !generationError && !hasOutline ? (
              <div className="rounded-md border bg-muted/35 p-5 text-sm leading-6 text-muted-foreground">
                这本小说还没有生成首次大纲。点击“生成大纲”后，会基于创建时的想法和预计字数生成可确认草案。
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      {hasOutline ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <Card className="paper-panel">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpenCheck className="h-5 w-5" />
                    总纲确认
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={outlineDraft.masterOutline.status === "需修订" ? "cinnabar" : outlineDraft.masterOutline.status === "草稿" ? "amber" : "jade"}>
                      {outlineDraft.masterOutline.status}
                    </Badge>
                    <Button onClick={() => setEditingMaster((current) => !current)} size="sm" variant="outline">
                      <Edit3 className="h-4 w-4" />
                      修改
                    </Button>
                    <Button disabled={saving} onClick={confirmMaster} size="sm">
                      <CheckCircle2 className="h-4 w-4" />
                      确认为总纲
                    </Button>
                  </div>
                </div>
                <CardDescription>这里可以直接修改，也可以写下想法让系统生成修改草案。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <EditableText title="故事起点" value={outlineDraft.masterOutline.opening} editing={editingMaster} onChange={(value) => updateMasterField("opening", value)} />
                  <EditableText title="主线目标" value={outlineDraft.masterOutline.mainGoal} editing={editingMaster} onChange={(value) => updateMasterField("mainGoal", value)} />
                  <EditableText title="升级路径" value={outlineDraft.masterOutline.escalation} editing={editingMaster} onChange={(value) => updateMasterField("escalation", value)} />
                  <EditableText title="高潮设计" value={outlineDraft.masterOutline.climax} editing={editingMaster} onChange={(value) => updateMasterField("climax", value)} />
                  <EditableText title="结局方向" value={outlineDraft.masterOutline.ending} editing={editingMaster} onChange={(value) => updateMasterField("ending", value)} />
                  <EditableText title="成长线" value={outlineDraft.masterOutline.protagonistArc} editing={editingMaster} onChange={(value) => updateMasterField("protagonistArc", value)} />
                </div>
                <div className="rounded-md border bg-cyan-50/55 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-cyan-950">立项基准</div>
                    <Button onClick={() => setEditingMaster(true)} size="sm" variant="outline">修改基准</Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <EditableText title="核心卖点" value={outlineDraft.baseline.sellingPoint} editing={editingMaster} onChange={(value) => updateBaselineField("sellingPoint", value)} />
                    <EditableText title="主冲突" value={outlineDraft.baseline.mainConflict} editing={editingMaster} onChange={(value) => updateBaselineField("mainConflict", value)} />
                    <EditableText title="故事引擎" value={outlineDraft.baseline.storyEngine} editing={editingMaster} onChange={(value) => updateBaselineField("storyEngine", value)} />
                    <EditableText title="结局方向" value={outlineDraft.baseline.endingDirection} editing={editingMaster} onChange={(value) => updateBaselineField("endingDirection", value)} />
                  </div>
                </div>
                {editingMaster ? (
                  <div className="flex justify-end">
                    <Button disabled={saving} onClick={() => persistOutline(outlineDraft, "总纲修改已保存。")}>保存总纲修改</Button>
                  </div>
                ) : null}
                <InstructionBox
                  disabled={saving}
                  onSubmit={() => reviseOutline("master")}
                  onValueChange={setMasterInstruction}
                  placeholder="例如：把主线目标改得更明确，第一卷不要太快暴露幕后黑手。"
                  title="我的总纲修改想法"
                  value={masterInstruction}
                />
              </CardContent>
            </Card>

            <Card className="paper-panel h-fit">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers3 className="h-5 w-5" />
                      分卷规划
                    </CardTitle>
                    <CardDescription className="mt-1">卷纲可以新增、修改、删除；创作正文跳到章节页。</CardDescription>
                  </div>
                  <Button disabled={saving} onClick={addVolume} size="icon" variant="outline" aria-label="新增卷">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {outlineDraft.volumes.map((volume) => (
                  <button
                    className={`w-full rounded-md border p-3 text-left transition-colors ${activeVolume?.id === volume.id ? "border-cyan-200 bg-cyan-50 text-cyan-950" : "bg-card/70 hover:bg-muted/55"}`}
                    key={volume.id}
                    onClick={() => setActiveVolumeId(volume.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{volume.title}</div>
                      <Badge variant={volume.status === "推进中" ? "amber" : volume.status === "已完成" ? "jade" : "outline"}>{volume.status}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{volume.goal}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </section>

          {activeVolume ? (
            <Card className="paper-panel">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{activeVolume.title}</CardTitle>
                    <CardDescription className="mt-2 leading-6">当前卷工作区。章节和正文创作在章节页继续。</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setEditingVolume((current) => !current)} size="sm" variant="outline">
                      <Edit3 className="h-4 w-4" />
                      修改本卷
                    </Button>
                    <Button asChild size="sm">
                      <Link to="../chapter">
                        创作
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button disabled={saving || outlineDraft.volumes.length <= 1} onClick={deleteActiveVolume} size="icon" variant="outline" aria-label="删除当前卷">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <EditableText title="卷标题" value={activeVolume.title} editing={editingVolume} onChange={(value) => updateVolumeField("title", value)} />
                  <EditableText title="预计章节" value={activeVolume.chapterRange ?? ""} editing={editingVolume} onChange={(value) => updateVolumeField("chapterRange", value)} />
                  <EditableText title="卷目标" value={activeVolume.goal} editing={editingVolume} onChange={(value) => updateVolumeField("goal", value)} />
                  <EditableText title="卷核心冲突" value={activeVolume.conflict ?? ""} editing={editingVolume} onChange={(value) => updateVolumeField("conflict", value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(activeVolume.highlights ?? []).map((highlight) => <Badge key={highlight} variant="secondary">{highlight}</Badge>)}
                </div>
                {editingVolume ? (
                  <div className="flex justify-end">
                    <Button disabled={saving} onClick={() => persistOutline(outlineDraft, "分卷修改已保存。")}>保存分卷修改</Button>
                  </div>
                ) : null}
                <InstructionBox
                  disabled={saving}
                  onSubmit={() => reviseOutline("volume")}
                  onValueChange={setVolumeInstruction}
                  placeholder="例如：把这一卷的中段冲突加密，卷末回收一个更强的伏笔。"
                  title="我的分卷修改想法"
                  value={volumeInstruction}
                />
              </CardContent>
            </Card>
          ) : null}

          <Tabs className="paper-panel rounded-md border bg-white/90 p-4 shadow-manuscript" defaultValue="issues">
            <TabsList>
              <TabsTrigger value="issues">结构检查</TabsTrigger>
              <TabsTrigger value="timeline">故事时间线</TabsTrigger>
              <TabsTrigger value="foreshadowing">伏笔</TabsTrigger>
            </TabsList>

            <TabsContent className="grid gap-3 md:grid-cols-2" value="issues">
              {outlineDraft.issues.length ? outlineDraft.issues.map((issue) => (
                <div className="rounded-md border bg-card/70 p-3" key={issue.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">{issue.title}</div>
                    <Badge variant={issueVariant[issue.level]}>{issue.level}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.detail}</p>
                </div>
              )) : <EmptyDetail icon={<AlertTriangle className="h-4 w-4" />} text="暂无结构风险。" />}
            </TabsContent>

            <TabsContent className="grid gap-3 md:grid-cols-2" value="timeline">
              {outlineDraft.timelineEvents.length ? outlineDraft.timelineEvents.map((event) => (
                <div className="rounded-md border bg-card/75 p-4" key={event.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{event.title}</div>
                    <Badge variant={event.canon ? "jade" : "outline"}>{event.canon ? "canon" : "待确认"}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.summary}</p>
                  <div className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                    <GitBranch className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{event.causality}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{event.storyTime} / {event.narrativePosition}</div>
                </div>
              )) : <EmptyDetail icon={<Clock3 className="h-4 w-4" />} text="暂无时间线事件。" />}
            </TabsContent>

            <TabsContent className="grid gap-3 md:grid-cols-2" value="foreshadowing">
              {outlineDraft.foreshadowing.length ? outlineDraft.foreshadowing.map((item) => (
                <div className="rounded-md border bg-card/75 p-4" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-medium">{item.title}</div>
                    <Badge variant={foreshadowingVariant[item.status]}>{item.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.plantedAt}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{item.payoffAt}</span>
                  </div>
                </div>
              )) : <EmptyDetail icon={<Landmark className="h-4 w-4" />} text="暂无伏笔草案。" />}
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

function EditableText({
  title,
  value,
  editing,
  onChange,
}: {
  title: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-md border bg-card/75 p-3">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {editing ? (
        <Textarea className="mt-2 min-h-[92px]" onChange={(event) => onChange(event.target.value)} value={value} />
      ) : (
        <p className="mt-1 whitespace-pre-line text-sm leading-6">{value}</p>
      )}
    </div>
  );
}

function InstructionBox({
  disabled,
  onSubmit,
  onValueChange,
  placeholder,
  title,
  value,
}: {
  disabled: boolean;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  placeholder: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <div className="text-sm font-medium">{title}</div>
      <Textarea className="mt-2 min-h-[96px]" onChange={(event) => onValueChange(event.target.value)} placeholder={placeholder} value={value} />
      <div className="mt-3 flex justify-end">
        <Button disabled={disabled} onClick={onSubmit} variant="outline">
          <Sparkles className="h-4 w-4" />
          AI 生成修改草案
        </Button>
      </div>
    </div>
  );
}

function StatusBox({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="rounded-md border border-cyan-100 bg-cyan-50/70 p-5 text-sm leading-6 text-cyan-950">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {text}
      </div>
    </div>
  );
}

function EmptyDetail({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="rounded-md border bg-muted/35 p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        {icon}
        {text}
      </div>
    </div>
  );
}
