"use client";

import { useQuery } from "@tanstack/react-query";
import { templateApi } from "@/lib/api";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: templateApi.getAll,
    staleTime: 60_000 * 5, // Cache for 5 minutes
  });
}

export function useCompatibleTemplates(params: Record<string, string>) {
  const hasParams = Object.values(params).some(Boolean);

  return useQuery({
    queryKey: ["templates", "compatible", params],
    queryFn: () => templateApi.getCompatible(params),
    enabled: hasParams,
    staleTime: 30_000,
  });
}
