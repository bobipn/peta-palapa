import { Suspense } from "react";
import { ReportPage } from "@/components/pages/Report";

export const metadata = { title: "Report · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <ReportPage />
    </Suspense>
  );
}
