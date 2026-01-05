import React, { useEffect, useState, useRef } from 'react';
import { Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { LiveMarkdownEditor } from './LiveMarkdownEditor';

interface TaggedContent {
  date: string;
  filePath: string;
  content: string;
}

interface TagViewProps {
  tag: string;
  getContent: (tag: string) => Promise<TaggedContent[]>;
  onDeleteTag?: (tag: string) => Promise<void>;
  onPublish?: (tag: string) => void;
  onUpdateContent?: (filePath: string, oldContent: string, newContent: string) => Promise<void>;
  onTagClick?: (tag: string, newTab: boolean) => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  goBack?: () => void;
  goForward?: () => void;
}

export const TagView: React.FC<TagViewProps> = ({ tag, getContent, onDeleteTag, onUpdateContent, onTagClick, canGoBack, canGoForward, goBack, goForward }) => {
  const [content, setContent] = useState<TaggedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Track original content for each item to enable updates
  const originalContentRef = useRef<Map<number, string>>(new Map());

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDeleteConfirm) {
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm]);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getContent(tag);
        setContent(result);
        // Store original content for each item
        originalContentRef.current = new Map();
        result.forEach((item, index) => {
          originalContentRef.current.set(index, item.content);
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [tag, getContent]);

  // Create save handler for each content section
  const createSaveHandler = (index: number, filePath: string) => {
    return async (newContent: string) => {
      const originalContent = originalContentRef.current.get(index);
      if (originalContent && newContent !== originalContent && onUpdateContent) {
        await onUpdateContent(filePath, originalContent, newContent);
        // Update original content ref after successful save
        originalContentRef.current.set(index, newContent);
        // Update local state
        setContent(prev => prev.map((c, i) => i === index ? { ...c, content: newContent } : c));
      }
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-obsidian-bg">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <div className="text-obsidian-text-secondary">Loading {tag}...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-obsidian-bg">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-obsidian-bg">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-obsidian-surface flex items-center justify-center mx-auto mb-3">
            <span className="text-accent text-2xl font-bold">#</span>
          </div>
          <p className="text-obsidian-text-secondary">No content found for {tag}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Navigation bar - matches note page exactly */}
      <div className="flex items-center relative" style={{ paddingTop: '16px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '24px' }}>
        {/* Left side - arrow buttons */}
        <div className="flex items-center gap-2">
          <button
            className={`p-1 rounded transition-colors ${canGoBack ? 'hover:bg-[var(--hover-bg)]' : 'opacity-40 cursor-default'}`}
            style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent' }}
            title="Back"
            onClick={goBack}
            disabled={!canGoBack}
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${canGoForward ? 'hover:bg-[var(--hover-bg)]' : 'opacity-40 cursor-default'}`}
            style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent' }}
            title="Forward"
            onClick={goForward}
            disabled={!canGoForward}
          >
            <ArrowRight size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Center - tag name (like breadcrumb) */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <span style={{ fontSize: '13.75px', color: 'var(--breadcrumb-text)' }}>
            <span className="text-accent">#</span>{tag.substring(1)}
          </span>
        </div>

        {/* Right side - trash icon only */}
        {onDeleteTag && (
          <div className="flex items-center ml-auto">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 rounded transition-all hover:opacity-60"
              style={{ color: 'var(--status-error)', backgroundColor: 'transparent' }}
              title="Delete all content with this tag"
            >
              <Trash2 size={18} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--dialog-backdrop)', zIndex: 9999 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '360px',
              backgroundColor: 'var(--dialog-bg)',
              border: '1px solid var(--border-light)',
              boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
              padding: '24px',
              borderRadius: '12px'
            }}
          >
            <h2 className="font-semibold mb-2" style={{ fontSize: '18px', color: 'var(--dialog-heading)' }}>Delete Tag Content?</h2>
            <p className="mb-4" style={{ fontSize: '14px', color: 'var(--dialog-text)', lineHeight: '1.5' }}>
              This will permanently delete all content tagged with <strong style={{ color: 'var(--accent-primary)' }}>{tag}</strong> from your notes.
              This action cannot be undone.
            </p>
            <p className="mb-6" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {content.length} {content.length === 1 ? 'section' : 'sections'} will be removed from your files.
            </p>
            <div className="flex gap-4 justify-end" style={{ marginTop: '24px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="transition-colors"
                style={{
                  padding: '11px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--btn-secondary-text)',
                  backgroundColor: 'var(--btn-secondary-bg)',
                  border: '1px solid var(--btn-secondary-border)',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)',
                  marginRight: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-secondary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-secondary-bg)'}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    if (onDeleteTag) {
                      await onDeleteTag(tag);
                      setShowDeleteConfirm(false);
                    }
                  } catch (err: any) {
                    alert(`Failed to delete tag: ${err.message}`);
                  }
                }}
                className="transition-colors"
                style={{
                  padding: '11px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--btn-danger-text)',
                  backgroundColor: 'var(--btn-danger-bg)',
                  border: '1px solid var(--btn-danger-bg)',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-danger-bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-danger-bg)'}
              >
                Delete {content.length} {content.length === 1 ? 'Section' : 'Sections'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        <div style={{ padding: '16px 24px 24px 0' }}>
          {content.map((item, index) => (
            <div
              key={`${item.filePath}-${index}`}
            >
              {/* File path header - uneditable, light gray */}
              <h2
                className="font-semibold"
                style={{
                  fontSize: '1.5em',
                  lineHeight: '1.3',
                  color: 'var(--text-muted)',
                  marginTop: index === 0 ? '25px' : '48px',
                  marginBottom: '8px',
                  paddingLeft: '48px'
                }}
              >
                {item.filePath.replace('.md', '')}
              </h2>

              {/* Live Markdown Editor - same as note page */}
              <div style={{ marginLeft: '0', marginRight: '0' }}>
                <LiveMarkdownEditor
                  key={`${item.filePath}-${index}-${item.content.substring(0, 20)}`}
                  initialContent={item.content}
                  filePath={item.filePath}
                  onSave={createSaveHandler(index, item.filePath)}
                  onTagClick={onTagClick}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
