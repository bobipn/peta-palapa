import { Suspense } from "react";
import { OnboardingPage } from "@/components/pages/Onboarding";

export const metadata = { title: "Profil keluarga · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <OnboardingPage />
    </Suspense>
  );
}
