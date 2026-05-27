import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "jade" | "amber" | "cinnabar" | "ink";
}

export function MetricCard({ label, value, hint, icon: Icon, tone = "ink" }: MetricCardProps) {
  const toneClass = {
    jade: "bg-emerald-900 text-emerald-50",
    amber: "bg-amber-700 text-amber-50",
    cinnabar: "bg-red-800 text-red-50",
    ink: "bg-stone-900 text-stone-50",
  }[tone];

  return (
    <Card className="paper-panel overflow-hidden">
      <CardContent className="flex items-start gap-4 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
