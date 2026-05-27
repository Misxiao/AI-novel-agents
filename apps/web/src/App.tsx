import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { AssetsPage } from "@/pages/AssetsPage";
import { ChapterPage } from "@/pages/ChapterPage";
import { NovelsPage } from "@/pages/NovelsPage";
import { OutlinePage } from "@/pages/OutlinePage";
import { OverviewPage } from "@/pages/OverviewPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { TasksPage } from "@/pages/TasksPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route element={<NovelsPage />} index />
        <Route element={<OverviewPage />} path="overview" />
        <Route element={<AssetsPage />} path="assets" />
        <Route element={<OutlinePage />} path="outline" />
        <Route element={<ChapterPage />} path="chapter" />
        <Route element={<TasksPage />} path="tasks" />
        <Route element={<ReviewPage />} path="review" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}
