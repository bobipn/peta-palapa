import { Suspense } from "react";
import { LoginPage } from "@/components/pages/Login";

export const metadata = { title: "Masuk · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
