"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuthFromCallback } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error || !token) {
      router.replace("/login?error=auth_failed");
      return;
    }

    setAuthFromCallback(token)
      .then(() => router.replace("/dashboard"))
      .catch(() => router.replace("/login?error=auth_failed"));
  }, [searchParams, router, setAuthFromCallback]);

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      <p className="text-muted-2 text-sm">Signing you in...</p>
    </div>
  );
}
