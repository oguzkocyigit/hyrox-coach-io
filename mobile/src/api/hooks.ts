/**
 * TanStack Query hook'lari — ekranlarin backend ile tek temas noktasi.
 * Query key kurali: [kaynak, parametreler...]
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/api/client";
import type {
  Exercise,
  HealthSyncRequest,
  HealthSyncResponse,
  PlanEntry,
  PlanEntryCreate,
  UserProfile,
  UserProfileUpdate,
  WeekPlanResponse,
  WeeklyAnalysisResponse,
  WeeklyMetricsResponse,
  WorkoutCreate,
  WorkoutCreateResponse,
  WorkoutHistoryResponse,
  WorkoutTemplate,
  WorkoutTemplateCreate,
} from "@/api/types";

const HISTORY_PAGE_SIZE = 20;

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<UserProfile>("/api/v1/users/me"),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserProfileUpdate) =>
      api.patch<UserProfile>("/api/v1/users/me", payload),
    onSuccess: (profile) => {
      queryClient.setQueryData(["me"], profile);
    },
  });
}

export function useWeeklyMetrics() {
  return useQuery({
    queryKey: ["metrics", "weekly"],
    queryFn: () => api.get<WeeklyMetricsResponse>("/api/v1/metrics/weekly"),
  });
}

export function useExercises(category?: string) {
  const query = category ? `?category=${category}` : "";
  return useQuery({
    queryKey: ["exercises", category ?? "all"],
    queryFn: () => api.get<Exercise[]>(`/api/v1/exercises${query}`),
    // Katalog nadiren degisir; oturum boyunca cache yeterli
    staleTime: Infinity,
  });
}

export function useWorkoutHistory() {
  return useInfiniteQuery({
    queryKey: ["workouts", "history"],
    queryFn: ({ pageParam }) =>
      api.get<WorkoutHistoryResponse>(
        `/api/v1/workouts?limit=${HISTORY_PAGE_SIZE}&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total_count ? nextOffset : undefined;
    },
  });
}

/** Idman kaydi/silme sonrasi dashboard ve gecmis birlikte tazelenir. */
function invalidateWorkoutData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["workouts"] });
  void queryClient.invalidateQueries({ queryKey: ["metrics"] });
}

export function useLogWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkoutCreate) =>
      api.post<WorkoutCreateResponse>("/api/v1/workouts", payload),
    onSuccess: () => invalidateWorkoutData(queryClient),
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workoutLogId: string) =>
      api.delete(`/api/v1/workouts/${workoutLogId}`),
    onSuccess: () => invalidateWorkoutData(queryClient),
  });
}

export function useWeeklyAnalysis() {
  return useMutation({
    mutationFn: () =>
      api.post<WeeklyAnalysisResponse>("/api/v1/analysis/weekly", {}),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/api/v1/users/me"),
    onSuccess: () => {
      // Tum kullanici verisi sunucuda silindi; lokal cache de temizlenir
      queryClient.clear();
    },
  });
}

// ---------------------------------------------------------------
// Antrenman programi: sablonlar + haftalik plan
// ---------------------------------------------------------------
export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<WorkoutTemplate[]>("/api/v1/templates"),
  });
}

function invalidatePlanData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["templates"] });
  void queryClient.invalidateQueries({ queryKey: ["plan"] });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkoutTemplateCreate) =>
      api.post<WorkoutTemplate>("/api/v1/templates", payload),
    onSuccess: () => invalidatePlanData(queryClient),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: string;
      payload: WorkoutTemplateCreate;
    }) => api.put<WorkoutTemplate>(`/api/v1/templates/${templateId}`, payload),
    onSuccess: () => invalidatePlanData(queryClient),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => api.delete(`/api/v1/templates/${templateId}`),
    onSuccess: () => invalidatePlanData(queryClient),
  });
}

/** start: haftanin pazartesisi (YYYY-MM-DD). */
export function useWeekPlan(start: string) {
  return useQuery({
    queryKey: ["plan", "week", start],
    queryFn: () => api.get<WeekPlanResponse>(`/api/v1/plan/week?start=${start}`),
  });
}

export function useScheduleEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlanEntryCreate) =>
      api.post<PlanEntry>("/api/v1/plan/entries", payload),
    onSuccess: () => invalidatePlanData(queryClient),
  });
}

export function useSetEntryCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, completed }: { entryId: string; completed: boolean }) =>
      completed
        ? api.post<PlanEntry>(`/api/v1/plan/entries/${entryId}/complete`, {})
        : api.delete<PlanEntry>(`/api/v1/plan/entries/${entryId}/complete`),
    onSuccess: () => invalidatePlanData(queryClient),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => api.delete(`/api/v1/plan/entries/${entryId}`),
    onSuccess: () => invalidatePlanData(queryClient),
  });
}

export function useHealthSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: HealthSyncRequest) =>
      api.post<HealthSyncResponse>("/api/v1/sync/health", payload),
    onSuccess: (result) => {
      if (result.imported > 0) invalidateWorkoutData(queryClient);
    },
  });
}
