import { Plus, Pencil, LayoutGrid } from 'lucide-react';
import type { Project } from '../../../types';

interface ProjectChipBarProps {
  projects: Project[];
  /** Currently selected project id, or null for "All". */
  selectedProjectId: number | null;
  onSelect: (projectId: number | null) => void;
  onCreate: () => void;
  onEdit: (project: Project) => void;
}

/**
 * Horizontal filter bar of project chips. Each chip shows the project color,
 * icon, name, completed/total count and a thin progress bar (driven by the
 * trigger-maintained stats columns). Clicking a chip filters the task list.
 */
const ProjectChipBar = ({
  projects,
  selectedProjectId,
  onSelect,
  onCreate,
  onEdit,
}: ProjectChipBarProps) => {
  const activeProjects = projects.filter((p) => p.status === 'active');

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* All chip */}
      <button
        onClick={() => onSelect(null)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
          selectedProjectId === null
            ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/40'
            : 'bg-theme-primary text-gray-400 hover:text-theme-fg border-gray-800'
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
        <span>All</span>
      </button>

      {activeProjects.map((project) => {
        const isSelected = selectedProjectId === project.id;
        const progress =
          project.total_tasks > 0
            ? Math.min(100, (project.completed_tasks / project.total_tasks) * 100)
            : 0;

        return (
          <div
            key={project.id}
            className={`group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border text-sm transition-colors ${
              isSelected
                ? 'bg-theme-accent/20 border-theme-accent/40'
                : 'bg-theme-primary border-gray-800 hover:border-gray-700'
            }`}
          >
            <button
              onClick={() => onSelect(project.id)}
              className="flex items-center gap-2"
              title={project.description || project.name}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="text-base leading-none">{project.icon}</span>
              <span className={isSelected ? 'text-theme-accent' : 'text-theme-fg'}>
                {project.name}
              </span>
              <span className="text-xs text-gray-400">
                {project.completed_tasks}/{project.total_tasks}
              </span>
              {/* Thin progress bar */}
              <span className="w-10 h-1 bg-gray-700/60 rounded-full overflow-hidden">
                <span
                  className="block h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: project.color }}
                />
              </span>
            </button>
            <button
              onClick={() => onEdit(project)}
              className="p-1 rounded-full text-gray-500 hover:text-theme-fg hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Edit ${project.name}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* New project chip */}
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-gray-700 text-sm text-gray-400 hover:text-theme-accent hover:border-theme-accent/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>New project</span>
      </button>
    </div>
  );
};

export default ProjectChipBar;
