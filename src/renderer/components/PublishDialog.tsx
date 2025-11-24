import React, { useState, useEffect } from 'react';

interface PublishDialogProps {
  tag: string;
  onClose: () => void;
}

interface BlogTarget {
  id: string;
  name: string;
}

interface PublishStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}

type PublishStatus = 'pending' | 'preparing' | 'pushing' | 'building' | 'deploying' | 'completed' | 'failed';

export const PublishDialog: React.FC<PublishDialogProps> = ({ tag, onClose }) => {
  const [blogs, setBlogs] = useState<BlogTarget[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<PublishStatus>('pending');
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<PublishStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBlogs();
  }, []);

  useEffect(() => {
    if (jobId) {
      subscribeToProgress();
      return () => {
        window.electronAPI.publish.unsubscribe(jobId);
      };
    }
  }, [jobId]);

  const loadBlogs = async () => {
    try {
      const result = await window.electronAPI.publish.getBlogs();
      console.log('PublishDialog: getBlogs result:', result);
      if (result.success && result.blogs) {
        console.log('PublishDialog: Blogs loaded:', result.blogs);
        setBlogs(result.blogs);
        if (result.blogs.length > 0) {
          setSelectedBlogId(result.blogs[0].id);
        }
      } else {
        console.error('PublishDialog: Failed to load blogs:', result.error);
      }
    } catch (error) {
      console.error('Failed to load blogs:', error);
    }
  };

  const subscribeToProgress = async () => {
    if (!jobId) return;

    await window.electronAPI.publish.subscribe(jobId, (data: any) => {
      setStatus(data.status);
      setProgress(data.progress);
      setSteps(data.steps || []);
      if (data.error) {
        setError(data.error);
      }
    });
  };

  const handlePublish = async () => {
    if (!selectedBlogId) return;

    try {
      setPublishing(true);
      setError(null);

      const result = await window.electronAPI.publish.toBlog(selectedBlogId, tag);

      if (result.success && result.jobId) {
        setJobId(result.jobId);
      } else {
        setError(result.error || 'Failed to start publish job');
        setPublishing(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish');
      setPublishing(false);
    }
  };

  const handleClose = () => {
    if (jobId) {
      window.electronAPI.publish.unsubscribe(jobId);
    }
    onClose();
  };

  const getStatusColor = (status: PublishStatus) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'preparing':
      case 'pushing':
      case 'building':
      case 'deploying':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStepIcon = (stepStatus: PublishStep['status']) => {
    switch (stepStatus) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '⋯';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  if (blogs.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white shadow-xl rounded-lg p-6 max-w-md w-full m-4" style={{ backgroundColor: '#ffffff' }}>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            No Blogs Configured
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            You need to configure at least one blog before publishing. Would you like to set one up?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white shadow-xl rounded-lg p-6 max-w-md w-full m-4" style={{ backgroundColor: '#ffffff' }}>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Publish #{tag}
        </h2>

        {!publishing ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Blog
              </label>
              <select
                value={selectedBlogId}
                onChange={e => setSelectedBlogId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
              >
                {blogs.map(blog => (
                  <option key={blog.id} value={blog.id}>
                    {blog.name || 'Unnamed Blog'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Publish
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${getStatusColor(status)}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
                <span className="text-sm text-gray-600">
                  {progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    status === 'failed' ? 'bg-red-600' :
                    status === 'completed' ? 'bg-green-600' :
                    'bg-blue-600'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className={`text-sm ${
                      step.status === 'completed' ? 'text-green-600' :
                      step.status === 'failed' ? 'text-red-600' :
                      step.status === 'in_progress' ? 'text-blue-600' :
                      'text-gray-400'
                    }`}>
                      {getStepIcon(step.status)}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{step.name}</p>
                      {step.message && (
                        <p className="text-xs text-gray-500">{step.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              {(status === 'completed' || status === 'failed') && (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Close
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
