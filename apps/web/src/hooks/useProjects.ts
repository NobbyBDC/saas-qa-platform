import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project, TestRun } from '@qa-platform/shared-types';

export const useProjects = () =>
  useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/projects');
      return data.data;
    },
  });

export const useProject = (id: string) =>
  useQuery<Project>({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

export const useRecentRuns = (limit = 20) =>
  useQuery<TestRun[]>({
    queryKey: ['runs', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/runs', { params: { limit } });
      return data.data;
    },
  });

export const useProjectRuns = (projectId: string) =>
  useQuery<TestRun[]>({
    queryKey: ['projects', projectId, 'runs'],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/runs`);
      return data.data;
    },
    enabled: !!projectId,
  });

export const useUpdateProject = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.patch(`/projects/${projectId}`, payload);
      return data.data as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      figmaUrl: string;
      figmaToken: string;
      description?: string;
      repositoryUrl?: string;
    }) => {
      const { data } = await api.post('/projects', payload);
      return data.data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};

export const useRun = (runId: string) =>
  useQuery({
    queryKey: ['runs', runId],
    queryFn: async () => {
      const { data } = await api.get(`/runs/${runId}`);
      return data.data as import('@qa-platform/shared-types').TestRun & {
        issues: import('@qa-platform/shared-types').Issue[];
      };
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? 3000 : false;
    },
  });

export interface EnabledTests {
  functional: boolean;
  accessibility: boolean;
  performance: boolean;
  security: boolean;
  codeQuality: boolean;
}

export const useRunProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, enabledTests }: { projectId: string; enabledTests?: EnabledTests }) => {
      const { data } = await api.post(`/projects/${projectId}/runs`, enabledTests ? { enabledTests } : {});
      return data.data as TestRun;
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'runs'] });
      qc.invalidateQueries({ queryKey: ['runs', 'recent'] });
    },
  });
};
