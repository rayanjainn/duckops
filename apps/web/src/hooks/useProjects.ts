"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { projectApi } from "@/lib/api";
import type { CreateProjectInput } from "@duckops/shared-types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: projectApi.getAll,
    refetchInterval: 15_000,
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectApi.getById(id!),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useRetryProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectApi.retry(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
