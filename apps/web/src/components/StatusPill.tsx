import { Badge } from "@/components/ui/badge";
import { qualityBadgeVariant, taskBadgeVariant, taskStatusText } from "@/lib/format";
import type { QualityState, TaskStatus } from "@/types";

export function QualityPill({ state }: { state: QualityState }) {
  return <Badge variant={qualityBadgeVariant(state)}>{state}</Badge>;
}

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return <Badge variant={taskBadgeVariant(status)}>{taskStatusText(status)}</Badge>;
}
