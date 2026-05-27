import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { TaskStatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { listNovelTasks, retryTask } from "@/services/mockApi";
import { useAppStore } from "@/stores/appStore";
import type { TaskStatus, WorkflowTask } from "@/types";

export function TasksPage() {
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const filter = useAppStore((state) => state.taskStatusFilter);
  const setFilter = useAppStore((state) => state.setTaskStatusFilter);
  const setToastMessage = useAppStore((state) => state.setToastMessage);
  const toastMessage = useAppStore((state) => state.toastMessage);
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listNovelTasks(selectedNovelId, filter)
      .then(setTasks)
      .finally(() => setLoading(false));
  }, [filter, selectedNovelId]);

  const handleRetry = async (taskId: string) => {
    const updated = await retryTask(taskId);
    setTasks((items) => items.map((item) => (item.taskId === taskId ? updated : item)));
    setToastMessage("失败任务已模拟重新入队");
  };

  return (
    <Card className="paper-panel">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="ink-title text-2xl">任务中心</CardTitle>
            <CardDescription>记录 Agent 工作流任务状态、摘要和失败重试入口。</CardDescription>
          </div>
          <Select
            aria-label="任务状态筛选"
            className="w-[180px]"
            onChange={(event) => setFilter(event.target.value as TaskStatus | "all")}
            value={filter}
          >
            <option value="all">全部状态</option>
            <option value="queued">排队中</option>
            <option value="running">运行中</option>
            <option value="waiting_for_user">待确认</option>
            <option value="succeeded">已完成</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {toastMessage ? (
          <div className="mb-4 rounded-md border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-900">
            {toastMessage}
          </div>
        ) : null}
        {loading ? (
          <div className="text-sm text-muted-foreground">正在刷新任务...</div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {tasks.map((task) => (
                <div className="rounded-md border bg-card/70 p-4" key={task.taskId}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{task.title}</div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">{task.workflowName}</div>
                    </div>
                    <TaskStatusPill status={task.status} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{task.inputSnapshot}</p>
                  {task.error ? <p className="mt-2 text-xs leading-5 text-destructive">{task.error}</p> : null}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{formatDateTime(task.startedAt)}</span>
                    <Button
                      disabled={task.status !== "failed"}
                      onClick={() => handleRetry(task.taskId)}
                      size="sm"
                      variant="outline"
                    >
                      <RotateCcw className="h-4 w-4" />
                      重试
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务</TableHead>
                    <TableHead>工作流</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>输入摘要</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.taskId}>
                      <TableCell className="min-w-[180px] font-medium">
                        <div>{task.title}</div>
                        {task.error ? <div className="mt-1 text-xs text-destructive">{task.error}</div> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{task.workflowName}</TableCell>
                      <TableCell>
                        <TaskStatusPill status={task.status} />
                      </TableCell>
                      <TableCell className="max-w-[320px] text-muted-foreground">{task.inputSnapshot}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(task.startedAt)}</TableCell>
                      <TableCell>
                        <Button
                          disabled={task.status !== "failed"}
                          onClick={() => handleRetry(task.taskId)}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcw className="h-4 w-4" />
                          重试
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
