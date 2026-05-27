import { Feather, Fingerprint, Layers3, Map, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { getNovelAssets } from "@/services/mockApi";
import { useAppStore } from "@/stores/appStore";
import { useAsyncValue } from "@/hooks/useAsyncValue";
import type { AssetKind } from "@/types";

const assetLabels: Record<AssetKind, string> = {
  world: "世界观",
  character: "角色",
  style: "风格",
  foreshadowing: "伏笔",
};

export function AssetsPage() {
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const { data, loading, error } = useAsyncValue(() => getNovelAssets(selectedNovelId), [selectedNovelId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">正在读取创作资产...</div>;
  }

  if (error || !data) {
    return <div className="text-sm text-destructive">{error || "资产加载失败"}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <Card className="paper-panel">
          <CardHeader>
            <CardTitle className="ink-title text-2xl">角色库</CardTitle>
            <CardDescription>角色口吻、状态和人物弧线只属于当前 novelId。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.characters.map((character) => (
              <div className="rounded-md border bg-card/70 p-4" key={character.id}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <UsersRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{character.name}</div>
                    <div className="text-xs text-muted-foreground">{character.role}</div>
                    <p className="mt-2 text-sm leading-6">{character.arc}</p>
                    <p className="mt-2 rounded-md bg-muted/45 p-2 text-xs leading-5 text-muted-foreground">
                      {character.voice}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="paper-panel">
          <CardHeader>
            <CardTitle className="ink-title text-2xl">资产面板</CardTitle>
            <CardDescription>世界观、风格档案和伏笔账本的摘要入口。</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="world">世界观</TabsTrigger>
                <TabsTrigger value="style">风格</TabsTrigger>
                <TabsTrigger value="foreshadowing">伏笔</TabsTrigger>
              </TabsList>
              {["all", "world", "style", "foreshadowing"].map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.assets
                      .filter((asset) => tab === "all" || asset.kind === tab)
                      .map((asset) => (
                        <div className="rounded-md border bg-card/70 p-4" key={asset.id}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 font-semibold">
                              {asset.kind === "world" ? <Map className="h-4 w-4" /> : null}
                              {asset.kind === "style" ? <Feather className="h-4 w-4" /> : null}
                              {asset.kind === "foreshadowing" ? <Fingerprint className="h-4 w-4" /> : null}
                              {asset.kind === "character" ? <Layers3 className="h-4 w-4" /> : null}
                              {asset.title}
                            </div>
                            <Badge variant="outline">{assetLabels[asset.kind]}</Badge>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">{asset.summary}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {asset.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">{tag}</Badge>
                            ))}
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground">更新于 {formatDateTime(asset.updatedAt)}</div>
                        </div>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
