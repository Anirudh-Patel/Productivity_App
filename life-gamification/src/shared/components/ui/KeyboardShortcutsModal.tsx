import { X, Keyboard } from 'lucide-react';
import { KeyboardShortcut, formatShortcut } from '../../../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

const KeyboardShortcutsModal = ({ isOpen, onClose, shortcuts }: KeyboardShortcutsModalProps) => {
  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-solo-primary border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Keyboard className="w-6 h-6 text-solo-accent" />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-solo-bg rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-lg font-semibold text-solo-accent mb-3">{category}</h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-solo-bg rounded-lg">
                    <span className="text-gray-300">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-800 border border-gray-700 rounded">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {shortcuts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Keyboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No keyboard shortcuts available</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-800 bg-solo-primary">
          <p className="text-sm text-gray-400 text-center">
            Press <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-800 border border-gray-700 rounded">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;