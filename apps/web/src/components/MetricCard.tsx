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
    jade: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    cinnabar: "bg-red-50 text-red-700 ring-1 ring-red-200",
    ink: "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200",
  }[tone];

  return (
    <Card className="overflow-hidden border-white/80 bg-white/86 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur">
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
