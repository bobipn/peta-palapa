import { Suspense } from "react";
import { SchoolsPage } from "@/components/pages/Schools";

export const metadata = { title: "Schools · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <SchoolsPage />
    </Suspense>
  );
}
