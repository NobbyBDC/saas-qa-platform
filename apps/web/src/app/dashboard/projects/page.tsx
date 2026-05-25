'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { ProjectCard } from '@/components/Dashboard/ProjectCard';
import { NewProjectModal } from '@/components/Projects/NewProjectModal';

export default function ProjectsPage() {
  const [showNewProject, setShowNewProject] = useState(false);
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <p className="text-slate-400 text-sm mt-1">Manage and monitor your QA projects</p>
        </div>
        <button onClick={() => setShowNewProject(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-1/2 mb-3" />
              <div className="h-3 bg-slate-700 rounded w-3/4 mb-6" />
              <div className="h-8 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-slate-400 text-lg mb-2">No projects yet</p>
          <p className="text-slate-500 text-sm mb-6">Create your first project to start automated QA testing</p>
          <button onClick={() => setShowNewProject(true)} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" /> Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}
