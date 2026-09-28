import { Suspense } from "react";
import { AuthCallbackPage } from "@/components/pages/Login";

export const metadata = { title: "Masuk · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <AuthCallbackPage />
    </Suspense>
  );
}
