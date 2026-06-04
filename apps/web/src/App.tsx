import { Navigate, Route, Routes } from "react-router-dom";

import { NovelCenterShell } from "@/components/layout/NovelCenterShell";
import { AssetsPage } from "@/pages/AssetsPage";
import { ChapterPage } from "@/pages/ChapterPage";
import { NewNovelPage } from "@/pages/NewNovelPage";
import { NovelsPage } from "@/pages/NovelsPage";
import { OutlinePage } from "@/pages/OutlinePage";
import { OverviewPage } from "@/pages/OverviewPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { TasksPage } from "@/pages/TasksPage";

export default function App() {
  return (
    <Routes>
      <Route element={<NovelsPage />} index />
      <Route element={<NewNovelPage />} path="novels/new" />
      <Route element={<NovelCenterShell />} path="novels/:novelId">
        <Route element={<Navigate replace to="overview" />} index />
        <Route element={<OverviewPage />} path="overview" />
        <Route element={<AssetsPage />} path="assets" />
        <Route element={<OutlinePage />} path="outline" />
        <Route element={<ChapterPage />} path="chapter" />
        <Route element={<TasksPage />} path="tasks" />
        <Route element={<ReviewPage />} path="review" />
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
