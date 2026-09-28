import { Suspense } from "react";
import { Dashboard } from "@/components/pages/Dashboard";

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
