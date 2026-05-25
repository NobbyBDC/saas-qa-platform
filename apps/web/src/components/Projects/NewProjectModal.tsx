'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Link2, GitBranch } from 'lucide-react';
import { useCreateProject } from '@/hooks/useProjects';

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(80),
  description: z.string().max(500).optional(),
  previewUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  repositoryUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface NewProjectModalProps {
  onClose: () => void;
}

export function NewProjectModal({ onClose }: NewProjectModalProps) {
  const { mutate: createProject, isPending, error } = useCreateProject();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    createProject(data, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">New Project</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name</label>
            <input {...register('name')} className="input" placeholder="My Landing Page" />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description (optional)</label>
            <textarea {...register('description')} className="input resize-none h-20" placeholder="Brief description..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Preview URL (optional)
            </label>
            <input {...register('previewUrl')} className="input" placeholder="https://your-staging-site.com" />
            {errors.previewUrl && <p className="text-xs text-red-400 mt-1">{errors.previewUrl.message}</p>}
            <p className="text-xs text-slate-500 mt-1">Used for Accessibility, Performance, Functional, and Security tests</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" /> Repository URL (optional)
            </label>
            <input {...register('repositoryUrl')} className="input" placeholder="https://github.com/org/repo" />
            {errors.repositoryUrl && <p className="text-xs text-red-400 mt-1">{errors.repositoryUrl.message}</p>}
            <p className="text-xs text-slate-500 mt-1">Used for Code Quality scanning via SonarQube</p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {(error as Error).message}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
