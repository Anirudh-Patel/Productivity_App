import { useEffect, useRef, useState } from 'react';
import { FolderKanban, Check } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import type { Project } from '../../../types';

interface MoveToProjectMenuProps {
  taskId: number;
  currentProjectId?: number | null;
}

/**
 * Small action-menu control for reassigning a task to a project. Renders a
 * trigger button plus a popover listing "None" and every active project.
 * Additive to the task card — does not restructure surrounding layout.
 */
const MoveToProjectMenu = ({ taskId, currentProjectId }: MoveToProjectMenuProps) => {
  const { projects, assignTaskToProject } = useGameStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProjects = projects.all.filter(
    (p: Project) => p.status === 'active' || p.id === currentProjectId
  );

  // Close popover on outside click.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleAssign = async (projectId: number | null) => {
    if (busy) return;
    setBusy(true);
    try {
      await assignTaskToProject(taskId, projectId);
      setOpen(false);
    } catch (error) {
      console.error('Failed to move task to project:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-theme-accent border border-gray-800 rounded-lg transition-colors"
        title="Move to project"
      >
        <FolderKanban className="w-3.5 h-3.5" />
        <span>Project</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 max-h-60 overflow-y-auto bg-solo-primary border border-gray-800 rounded-lg shadow-xl py-1">
          <button
            onClick={() => handleAssign(null)}
            disabled={busy}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-solo-bg transition-colors disabled:opacity-50"
          >
            <span className="text-gray-400">None</span>
            {(currentProjectId === null || currentProjectId === undefined) && (
              <Check className="w-4 h-4 text-theme-accent" />
            )}
          </button>
          {activeProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleAssign(project.id)}
              disabled={busy}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-solo-bg transition-colors disabled:opacity-50"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate">
                  {project.icon} {project.name}
                </span>
              </span>
              {currentProjectId === project.id && (
                <Check className="w-4 h-4 text-theme-accent flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoveToProjectMenu;
