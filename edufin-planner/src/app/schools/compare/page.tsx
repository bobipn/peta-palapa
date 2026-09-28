import { Suspense } from "react";
import { ComparePage } from "@/components/pages/Compare";

export const metadata = { title: "School comparison · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <ComparePage />
    </Suspense>
  );
}
