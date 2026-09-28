import { Suspense } from "react";
import { PlanningPage } from "@/components/pages/Planning";

export const metadata = { title: "Planning · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <PlanningPage />
    </Suspense>
  );
}
