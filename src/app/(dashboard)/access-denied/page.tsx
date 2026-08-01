"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { AccessDeniedView } from "@/components/auth/AccessDeniedView";

function AccessDeniedContent() {
  const router = useRouter();
  return <AccessDeniedView onGoBack={() => router.push("/")} />;
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]" />}>
      <AccessDeniedContent />
    </Suspense>
  );
}
