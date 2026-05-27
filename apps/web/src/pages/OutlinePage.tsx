import { Flag, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getNovelOutline } from "@/services/mockApi";
import { useAppStore } from "@/stores/appStore";
import { useAsyncValue } from "@/hooks/useAsyncValue";

export function OutlinePage() {
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const { data, loading, error } = useAsyncValue(() => getNovelOutline(selectedNovelId), [selectedNovelId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">正在读取大纲...</div>;
  }

  if (error || !data) {
    return <div className="text-sm text-destructive">{error || "大纲加载失败"}</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="paper-panel">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ScrollText className="h-4 w-4" />
            总纲
          </div>
          <CardTitle className="ink-title text-2xl">故事主线</CardTitle>
          <CardDescription className="max-w-4xl leading-6">{data.outline.logline}</CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        {data.outline.volumes.map((volume) => (
          <Card className="paper-panel" key={volume.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{volume.title}</CardTitle>
                <Badge variant={volume.status === "推进中" ? "amber" : volume.status === "已完成" ? "jade" : "outline"}>
                  {volume.status}
                </Badge>
              </div>
              <CardDescription className="leading-6">{volume.goal}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="paper-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            章纲列表
          </CardTitle>
          <CardDescription>当前小说的章节计划，不显示跨小说数据。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>章节</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>卷</TableHead>
                <TableHead>章节目标</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.chapterPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">第 {plan.chapterNo} 章</TableCell>
                  <TableCell>{plan.title}</TableCell>
                  <TableCell className="text-muted-foreground">{plan.volumeTitle}</TableCell>
                  <TableCell className="max-w-[360px] text-muted-foreground">{plan.objective}</TableCell>
                  <TableCell>
                    <Badge variant={plan.status === "已确认" ? "jade" : plan.status === "待确认" ? "amber" : "outline"}>
                      {plan.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
