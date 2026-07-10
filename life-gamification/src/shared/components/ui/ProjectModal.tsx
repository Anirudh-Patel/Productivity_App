import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderKanban, Trash2 } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import type { CreateProjectRequest, Project } from '../../../types';
import { ButtonLoader } from './LoadingSpinner';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, the modal edits this project instead of creating a new one. */
  project?: Project | null;
}

/** Preset color palette matching the gamified rarity/theme accents. */
const COLOR_PRESETS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

/** Small icon set (emoji) for quick project identity selection. */
const ICON_PRESETS = ['📁', '🌱', '💼', '🏃', '🎨', '📚', '💡', '🎯', '🔥', '⚔️', '🏆', '🧠'];

const DEFAULT_FORM: CreateProjectRequest = {
  name: '',
  description: '',
  color: COLOR_PRESETS[0],
  icon: ICON_PRESETS[0],
  priority: 3,
};

/**
 * Create/edit project modal. Handles the create, update and delete flows via
 * the gameStore project actions. Matches the Solo Leveling dark theme used by
 * CreateTaskModal.
 */
const ProjectModal = ({ isOpen, onClose, project }: ProjectModalProps) => {
  const { createProject, updateProject, deleteProject } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formData, setFormData] = useState<CreateProjectRequest>(DEFAULT_FORM);

  const isEditing = Boolean(project);

  // Sync form state whenever the modal opens or the target project changes.
  useEffect(() => {
    if (!isOpen) return;
    setConfirmDelete(false);
    if (project) {
      setFormData({
        name: project.name,
        description: project.description ?? '',
        color: project.color,
        icon: project.icon,
        priority: project.priority,
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [isOpen, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      if (isEditing && project) {
        await updateProject(project.id, formData);
      } else {
        await createProject(formData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    setLoading(true);
    try {
      await deleteProject(project.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-solo-primary border border-gray-800 rounded-lg w-full max-w-md max-h-[90vh] flex flex-col"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FolderKanban className="w-6 h-6 text-solo-accent" />
                {isEditing ? 'Edit Project' : 'New Project'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-solo-bg rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="project-name" className="block text-sm font-medium mb-2">
                    Project Name *
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                    placeholder="e.g., Fitness Journey"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="project-description" className="block text-sm font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent resize-none"
                    rows={2}
                    placeholder="Optional description..."
                  />
                </div>

                {/* Color picker */}
                <div>
                  <label className="block text-sm font-medium mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          formData.color === color ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Icon picker */}
                <div>
                  <label className="block text-sm font-medium mb-2">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_PRESETS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-colors ${
                          formData.icon === icon
                            ? 'bg-theme-accent/20 border-theme-accent'
                            : 'bg-solo-bg border-gray-700 hover:border-gray-600'
                        }`}
                        aria-label={`Select icon ${icon}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label htmlFor="project-priority" className="block text-sm font-medium mb-2">
                    Priority: {formData.priority}/5
                  </label>
                  <input
                    id="project-priority"
                    type="range"
                    min="1"
                    max="5"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Low</span>
                    <span>Critical</span>
                  </div>
                </div>

                {/* Delete section (edit mode only) */}
                {isEditing && (
                  <div className="pt-2 border-t border-gray-800">
                    {confirmDelete ? (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3">
                        <p className="text-sm text-red-300">
                          Delete this project? Tasks will be unassigned but kept.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="flex-1 px-3 py-2 border border-gray-700 rounded-lg text-sm hover:bg-solo-bg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {loading && <ButtonLoader />}
                            Confirm Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete project
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 p-6 border-t border-gray-800 bg-solo-primary">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg hover:bg-solo-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !formData.name.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
                >
                  {loading && <ButtonLoader />}
                  {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProjectModal;
