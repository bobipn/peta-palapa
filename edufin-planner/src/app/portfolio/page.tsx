import { Suspense } from "react";
import { PortfolioPage } from "@/components/pages/Portfolio";

export const metadata = { title: "Portfolio · EduFin Planner" };

export default function Page() {
  return (
    <Suspense>
      <PortfolioPage />
    </Suspense>
  );
}
