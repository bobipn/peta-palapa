import { Suspense } from "react";
import { AdminPage } from "@/components/pages/Admin";

export const metadata = { title: "Admin · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <AdminPage />
    </Suspense>
  );
}
