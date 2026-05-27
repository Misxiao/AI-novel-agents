import {
  Archive,
  BookOpen,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  LibraryBig,
  Menu,
  PenLine,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listNovels } from "@/services/mockApi";
import { useAppStore } from "@/stores/appStore";
import type { Novel } from "@/types";
import { useAsyncValue } from "@/hooks/useAsyncValue";

const navItems = [
  { to: "/", label: "小说", icon: LibraryBig },
  { to: "/overview", label: "概览", icon: LayoutDashboard },
  { to: "/assets", label: "创作资产", icon: Archive },
  { to: "/outline", label: "大纲", icon: ScrollText },
  { to: "/chapter", label: "章节", icon: PenLine },
  { to: "/tasks", label: "任务中心", icon: ClipboardList },
  { to: "/review", label: "评审报告", icon: FileText },
];

function Sidebar({ novels }: { novels: Novel[] }) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-stone-950 text-stone-100 shadow-2xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-stone-800 px-5">
          <div>
            <div className="ink-title text-lg font-semibold">写作中枢</div>
            <div className="text-xs text-stone-400">Local Novel Workbench</div>
          </div>
          <Button
            aria-label="关闭导航"
            className="text-stone-200 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            size="icon"
            variant="ghost"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-stone-300 transition-colors",
                  "hover:bg-stone-900 hover:text-stone-50",
                  isActive && "bg-stone-100 text-stone-950 hover:bg-stone-100 hover:text-stone-950",
                )
              }
              end={item.to === "/"}
              key={item.to}
              onClick={() => setSidebarOpen(false)}
              to={item.to}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-stone-800 p-4">
          <div className="rounded-md border border-stone-800 bg-stone-900/70 p-3">
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              本地优先数据边界
            </div>
            <p className="mt-2 text-sm text-stone-200">当前管理 {novels.length} 本小说，记忆与任务按 novelId 隔离。</p>
          </div>
        </div>
      </aside>
      {sidebarOpen ? (
        <button
          aria-label="关闭导航遮罩"
          className="fixed inset-0 z-30 bg-stone-950/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}
    </>
  );
}

function TopBar({ novels }: { novels: Novel[] }) {
  const location = useLocation();
  const selectedNovelId = useAppStore((state) => state.selectedNovelId);
  const setSelectedNovelId = useAppStore((state) => state.setSelectedNovelId);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);

  const selectedNovel = novels.find((novel) => novel.novelId === selectedNovelId) ?? novels[0];
  const pageTitle =
    navItems.find((item) => item.to === location.pathname)?.label ?? "小说";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
        <Button
          aria-label="打开导航"
          className="lg:hidden"
          onClick={() => setSidebarOpen(true)}
          size="icon"
          variant="outline"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Home className="h-3.5 w-3.5" />
            {pageTitle}
          </div>
          <h1 className="ink-title truncate text-xl font-semibold tracking-normal sm:text-2xl">
            {selectedNovel?.title ?? "小说工作台"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="选择小说"
            className="w-[190px]"
            onChange={(event) => setSelectedNovelId(event.target.value)}
            value={selectedNovelId}
          >
            {novels.map((novel) => (
              <option key={novel.novelId} value={novel.novelId}>
                {novel.title}
              </option>
            ))}
          </Select>
          {selectedNovel ? (
            <>
              <Badge variant="outline">{selectedNovel.stage}</Badge>
              <Badge variant="secondary">{formatDateTime(selectedNovel.updatedAt)}</Badge>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const { data: novels, loading, error } = useAsyncValue(listNovels, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        正在铺开本地创作台...
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

  return (
    <div className="workbench-shell min-h-screen">
      <Sidebar novels={novels} />
      <div className="lg:pl-72">
        <TopBar novels={novels} />
        <main className="px-4 py-6 lg:px-8">
          <Outlet context={{ novels }} />
        </main>
      </div>
    </div>
  );
}
