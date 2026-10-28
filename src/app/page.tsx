import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";

export default function Home() {
  return (
    <Suspense>
      <AppShell />
    </Suspense>
  );
}
