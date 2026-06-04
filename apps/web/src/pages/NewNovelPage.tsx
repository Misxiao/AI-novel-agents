import { useState } from "react";
import { ArrowLeft, CheckCircle2, LibraryBig } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createNovelProject } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import type { NovelCreationInput } from "@/types";

const initialInput: NovelCreationInput = {
  title: "",
  genre: "",
  seedIdea: "",
  targetReaders: "",
  targetWords: 300000,
  styleDirection: "",
};

const genreOptions = ["玄幻", "都市", "仙侠", "悬疑", "科幻", "女频", "历史", "无限流", "末世"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function textInputClass() {
  return "h-10 w-full rounded-md border border-input bg-card/80 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

export function NewNovelPage() {
  const navigate = useNavigate();
  const setSelectedNovelId = useAppStore((state) => state.setSelectedNovelId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState<NovelCreationInput>(initialInput);

  const updateInput = <K extends keyof NovelCreationInput>(key: K, value: NovelCreationInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const finishCreation = async () => {
    setSaving(true);
    setError("");
    try {
      const novel = await createNovelProject(input);
      setSelectedNovelId(novel.novelId);
      navigate(`/novels/${novel.novelId}/outline?generate=1`);
    } catch (creationFailed) {
      setError(creationFailed instanceof Error ? creationFailed.message : "新建小说失败");
    } finally {
      setSaving(false);
    }
  };

  const canCreate =
    input.seedIdea.trim().length > 0 &&
    input.targetWords > 0;

  return (
    <div className="home-canvas min-h-screen">
      <header className="border-b border-white/80 bg-white/72 shadow-sm shadow-slate-200/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild size="icon" variant="outline">
              <Link aria-label="返回小说列表" to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="text-sm font-semibold text-slate-950">新建小说</div>
              <div className="text-xs text-slate-500">填写基础信息后开始生成</div>
            </div>
          </div>
          <Badge variant="outline">极简创建</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-8 lg:px-8">
        <Card className="paper-panel mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LibraryBig className="h-5 w-5" />
              开始一本新小说
            </CardTitle>
            <CardDescription>后续设定、卖点、角色和大纲都可以进入项目后再修改。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="名称">
              <input
                className={textInputClass()}
                onChange={(event) => updateInput("title", event.target.value)}
                placeholder="可选，例如：烬城契约"
                value={input.title}
              />
            </Field>

            <Field label="题材">
              <input
                className={textInputClass()}
                list="genre-options"
                onChange={(event) => updateInput("genre", event.target.value)}
                placeholder="可选，例如：玄幻、都市、赛博修仙"
                value={input.genre}
              />
              <datalist id="genre-options">
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre} />
                ))}
              </datalist>
            </Field>

            <Field label="想法">
              <Textarea
                className="min-h-[180px]"
                onChange={(event) => updateInput("seedIdea", event.target.value)}
                placeholder="例如：主角是被宗门废掉灵根的外门弟子，但他能听见法宝的心声。"
                value={input.seedIdea}
              />
            </Field>

            <Field label="预计字数">
              <input
                className="h-10 w-full max-w-[220px] rounded-md border border-input bg-card/80 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                min={10000}
                step={10000}
                onChange={(event) => updateInput("targetWords", Number(event.target.value))}
                type="number"
                value={input.targetWords}
              />
            </Field>

            {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            <div className="flex justify-end border-t pt-5">
              <Button disabled={!canCreate || saving} onClick={finishCreation} size="lg">
                {saving ? "正在创建..." : "开始生成"}
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
