import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

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
}

export const TagView: React.FC<TagViewProps> = ({ tag, getContent, onDeleteTag, onPublish }) => {
  const [content, setContent] = useState<TaggedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getContent(tag);
        setContent(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [tag, getContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading {tag}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">#️⃣</div>
          <p>No content found for {tag}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{tag}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {content.length} {content.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <div className="flex gap-2">
            {onDeleteTag && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                title="Delete all content with this tag"
              >
                <span>🗑️</span>
                <span>Delete Tag</span>
              </button>
            )}
            <button
              onClick={() => onPublish?.(tag)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>📤</span>
              <span>Publish to Blog</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Tag Content?</h2>
            <p className="text-gray-600 mb-4">
              This will permanently delete all content tagged with <strong>{tag}</strong> from your notes.
              This action cannot be undone.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {content.length} {content.length === 1 ? 'section' : 'sections'} will be removed from your files.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete {content.length} {content.length === 1 ? 'Section' : 'Sections'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content sections */}
      <div className="p-6 space-y-8">
        {content.map((item, index) => (
          <div
            key={`${item.date}-${index}`}
            className="border-l-4 border-blue-500 pl-6 py-2"
          >
            {/* Meta info */}
            <div className="flex items-center gap-3 mb-3 text-sm text-gray-500">
              <span className="font-medium">{item.date}</span>
              <span>•</span>
              <span className="text-xs">{item.filePath}</span>
            </div>

            {/* Content */}
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
              >
                {item.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="px-6 py-4 text-xs text-gray-400 text-center border-t border-gray-200">
        This is a read-only view aggregating all content tagged with {tag}
      </div>
    </div>
  );
};
