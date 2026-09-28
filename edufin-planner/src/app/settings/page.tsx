import { Suspense } from "react";
import { SettingsPage } from "@/components/pages/Settings";

export const metadata = { title: "Asumsi & Settings · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
