import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Hash, Calendar, Plus, FolderPlus } from 'lucide-react';
import type { FileNode } from '../../preload';

interface Command {
  id: string;
  title: string;
  description?: string;
  category: 'file' | 'tag' | 'action' | 'daily';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  fileTree: FileNode | null;
  tags: string[];
  onFileSelect: (path: string) => void;
  onTagSelect: (tag: string) => void;
  onDateSelect: (date: string) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  fileTree,
  tags,
  onFileSelect,
  onTagSelect,
  onDateSelect,
  onCreateFile,
  onCreateFolder
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build list of all files
  const getAllFiles = (node: FileNode | null, files: Array<{ path: string; name: string }> = []): Array<{ path: string; name: string }> => {
    if (!node) return files;

    if (node.type === 'file' && node.extension === '.md') {
      files.push({ path: node.path, name: node.name });
    }

    if (node.children) {
      node.children.forEach(child => getAllFiles(child, files));
    }

    return files;
  };

  // Build commands list
  const buildCommands = (): Command[] => {
    const commands: Command[] = [];

    // Add action commands
    commands.push({
      id: 'new-file',
      title: 'New File',
      description: 'Create a new markdown file',
      category: 'action',
      action: () => {
        onClose();
        onCreateFile();
      }
    });

    commands.push({
      id: 'new-folder',
      title: 'New Folder',
      description: 'Create a new folder',
      category: 'action',
      action: () => {
        onClose();
        onCreateFolder();
      }
    });

    // Add today/yesterday/tomorrow
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    commands.push({
      id: 'today',
      title: 'Today',
      description: today,
      category: 'daily',
      action: () => {
        onClose();
        onDateSelect(today);
      }
    });

    commands.push({
      id: 'yesterday',
      title: 'Yesterday',
      description: yesterday,
      category: 'daily',
      action: () => {
        onClose();
        onDateSelect(yesterday);
      }
    });

    commands.push({
      id: 'tomorrow',
      title: 'Tomorrow',
      description: tomorrow,
      category: 'daily',
      action: () => {
        onClose();
        onDateSelect(tomorrow);
      }
    });

    // Add all markdown files
    const allFiles = getAllFiles(fileTree);
    allFiles.forEach(file => {
      commands.push({
        id: `file-${file.path}`,
        title: file.name.replace('.md', ''),
        description: file.path,
        category: 'file',
        action: () => {
          onClose();
          onFileSelect(file.path);
        }
      });
    });

    // Add all tags
    tags.forEach(tag => {
      commands.push({
        id: `tag-${tag}`,
        title: tag,
        description: 'View tag',
        category: 'tag',
        action: () => {
          onClose();
          onTagSelect(tag);
        }
      });
    });

    return commands;
  };

  const commands = buildCommands();

  // Filter commands based on search
  const filteredCommands = commands.filter(cmd => {
    const query = searchQuery.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query)
    );
  });

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredCommands[selectedIndex]?.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  const getCategoryIcon = (category: string, isSelected: boolean) => {
    const color = isSelected ? 'var(--accent)' : 'var(--text-muted)';
    const size = 16;

    switch (category) {
      case 'file':
        return <FileText size={size} style={{ color }} strokeWidth={1.5} />;
      case 'tag':
        return <Hash size={size} style={{ color }} strokeWidth={2} />;
      case 'daily':
        return <Calendar size={size} style={{ color }} strokeWidth={1.5} />;
      case 'action':
        return <Plus size={size} style={{ color }} strokeWidth={2} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-24 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <Search size={18} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files, tags, or commands..."
              className="w-full bg-transparent text-sm border-none outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto py-2"
        >
          {filteredCommands.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              No results found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full px-4 py-2 flex items-center gap-3 text-left transition-colors"
                style={{
                  backgroundColor: index === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
                  color: index === selectedIndex ? 'var(--accent)' : 'var(--text-primary)'
                }}
              >
                <div className="w-6 flex items-center justify-center">
                  {getCategoryIcon(cmd.category, index === selectedIndex)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{cmd.title}</div>
                  {cmd.description && (
                    <div
                      className="text-xs truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {cmd.description}
                    </div>
                  )}
                </div>
                <div
                  className="text-[10px] uppercase px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)'
                  }}
                >
                  {cmd.category}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 flex items-center gap-4 text-xs"
          style={{
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-muted)'
          }}
        >
          <span className="flex items-center gap-1">
            <kbd
              className="px-1 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd
              className="px-1 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd
              className="px-1 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: 'var(--bg-tertiary)' }}
            >esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
};
