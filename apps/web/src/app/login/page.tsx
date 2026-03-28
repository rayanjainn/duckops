"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Github } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <span className="text-6xl">🦆</span>
          <h1 className="mt-4 text-3xl font-bold text-white">DuckOps</h1>
          <p className="mt-2 text-gray-400 text-sm">
            Self-service developer platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-gray-400 text-sm mt-1">
              Sign in to manage your projects
            </p>
          </div>

          <a
            href={`${API_URL}/api/auth/github`}
            className="flex items-center justify-center gap-3 w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </a>

          <p className="text-center text-xs text-gray-500">
            By signing in, you agree to allow DuckOps to create private
            repositories on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
}
