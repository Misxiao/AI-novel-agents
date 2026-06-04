import { useEffect } from "react";
import {
  Archive,
  ArrowLeft,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PenLine,
  ScrollText,
} from "lucide-react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listNovels } from "@/services/api";
import { useAppStore } from "@/stores/appStore";
import type { Novel } from "@/types";
import { useAsyncValue } from "@/hooks/useAsyncValue";

const centerNavItems = [
  { to: "overview", label: "概览", icon: LayoutDashboard },
  { to: "assets", label: "创作资产", icon: Archive },
  { to: "outline", label: "大纲", icon: ScrollText },
  { to: "chapter", label: "章节", icon: PenLine },
  { to: "tasks", label: "任务中心", icon: ClipboardList },
  { to: "review", label: "评审报告", icon: FileText },
];

function CenterHeader({ novels, selectedNovel }: { novels: Novel[]; selectedNovel: Novel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentSection = location.pathname.split("/").pop() || "overview";

  const handleNovelChange = (novelId: string) => {
    navigate(`/novels/${novelId}/${currentSection}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/80 bg-white/72 shadow-sm shadow-slate-200/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild size="icon" variant="outline">
              <Link aria-label="返回小说列表" to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-700">
                创作中心
              </p>
              <h1 className="truncate text-2xl font-semibold tracking-normal text-slate-950">
                {selectedNovel.title}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="切换小说"
              className="h-10 w-[210px] border-white bg-white/88 shadow-sm"
              onChange={(event) => handleNovelChange(event.target.value)}
              value={selectedNovel.novelId}
            >
              {novels.map((novel) => (
                <option key={novel.novelId} value={novel.novelId}>
                  {novel.title}
                </option>
              ))}
            </Select>
            <Badge variant="outline">{selectedNovel.stage}</Badge>
            <Badge variant="secondary">{formatDateTime(selectedNovel.updatedAt)}</Badge>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {centerNavItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-cyan-700 text-white shadow-sm"
                    : "bg-white/54 text-slate-600 hover:bg-white hover:text-slate-950",
                )
              }
              key={item.to}
              to={item.to}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function NovelCenterShell() {
  const { novelId } = useParams<{ novelId: string }>();
  const setSelectedNovelId = useAppStore((state) => state.setSelectedNovelId);
  const { data: novels, loading, error } = useAsyncValue(listNovels, []);

  useEffect(() => {
    if (novelId) {
      setSelectedNovelId(novelId);
    }
  }, [novelId, setSelectedNovelId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        正在打开创作中心...
      </div>
    );
  }

  if (error || !novels) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-destructive">
        {error || "加载失败"}
      </div>
    );
  }

  if (novels.length === 0) {
    return <Navigate replace to="/novels/new" />;
  }

  const selectedNovel = novels.find((novel) => novel.novelId === novelId);
  if (!selectedNovel) {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="min-h-screen bg-app">
      <CenterHeader novels={novels} selectedNovel={selectedNovel} />
      <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8">
        <Outlet context={{ novels, selectedNovel }} />
      </main>
    </div>
  );
}
