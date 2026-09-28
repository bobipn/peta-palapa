import { Suspense } from "react";
import { ChildrenPage } from "@/components/pages/Children";

export const metadata = { title: "Children · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <ChildrenPage />
    </Suspense>
  );
}
