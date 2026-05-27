import dayjs from "dayjs";

import type { QualityState, TaskStatus } from "@/types";

export function formatDateTime(value: string) {
  return dayjs(value).format("MM-DD HH:mm");
}

export function taskStatusText(status: TaskStatus) {
  const textMap: Record<TaskStatus, string> = {
    queued: "排队中",
    running: "运行中",
    waiting_for_user: "待确认",
    succeeded: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return textMap[status];
}

export function qualityBadgeVariant(state: QualityState) {
  if (state === "健康") {
    return "jade" as const;
  }
  if (state === "关注") {
    return "amber" as const;
  }
  return "cinnabar" as const;
}

export function taskBadgeVariant(status: TaskStatus) {
  if (status === "succeeded") {
    return "jade" as const;
  }
  if (status === "failed" || status === "cancelled") {
    return "cinnabar" as const;
  }
  if (status === "running" || status === "waiting_for_user") {
    return "amber" as const;
  }
  return "outline" as const;
}
