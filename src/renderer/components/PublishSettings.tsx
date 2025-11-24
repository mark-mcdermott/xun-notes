import React, { useState, useEffect } from 'react';

interface BlogTarget {
  id: string;
  name: string;
  github: {
    repo: string;
    branch: string;
    token: string;
  };
  vercel: {
    projectId: string;
    teamId?: string;
    token: string;
  };
  content: {
    path: string;
    format: 'single-file' | 'multi-file';
    filename?: string;
  };
}

interface PublishSettingsProps {
  onClose: () => void;
}

export const PublishSettings: React.FC<PublishSettingsProps> = ({ onClose }) => {
  const [blogs, setBlogs] = useState<BlogTarget[]>([]);
  const [editingBlog, setEditingBlog] = useState<BlogTarget | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlogs();
  }, []);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.publish.getBlogs();
      if (result.success) {
        setBlogs(result.blogs || []);
      }
    } catch (error) {
      console.error('Failed to load blogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlog = () => {
    setEditingBlog({
      id: crypto.randomUUID(),
      name: '',
      github: {
        repo: '',
        branch: 'main',
        token: ''
      },
      vercel: {
        projectId: '',
        teamId: '',
        token: ''
      },
      content: {
        path: 'src/content/posts/',
        format: 'single-file',
        filename: '{tag}.md'
      }
    });
  };

  const handleEditBlog = (blog: BlogTarget) => {
    setEditingBlog({ ...blog });
  };

  const handleSaveBlog = async () => {
    if (!editingBlog) return;

    // Validate required fields
    const errors: string[] = [];

    if (!editingBlog.name.trim()) {
      errors.push('Blog name is required');
    }
    if (!editingBlog.github.repo.trim()) {
      errors.push('GitHub repository is required');
    }
    if (!editingBlog.github.branch.trim()) {
      errors.push('GitHub branch is required');
    }
    if (!editingBlog.github.token.trim()) {
      errors.push('GitHub token is required');
    }
    if (!editingBlog.vercel.projectId.trim()) {
      errors.push('Vercel project ID is required');
    }
    if (!editingBlog.vercel.token.trim()) {
      errors.push('Vercel token is required');
    }
    if (!editingBlog.content.path.trim()) {
      errors.push('Content path is required');
    }
    if (!editingBlog.content.filename?.trim()) {
      errors.push('Filename template is required');
    }

    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
      return;
    }

    try {
      const result = await window.electronAPI.publish.saveBlog(editingBlog);
      if (result.success) {
        await loadBlogs();
        setEditingBlog(null);
      }
    } catch (error) {
      console.error('Failed to save blog:', error);
    }
  };

  const handleDeleteBlog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this blog configuration?')) {
      return;
    }

    try {
      const result = await window.electronAPI.publish.deleteBlog(id);
      if (result.success) {
        await loadBlogs();
      }
    } catch (error) {
      console.error('Failed to delete blog:', error);
    }
  };

  const handleCancel = () => {
    setEditingBlog(null);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 shadow-xl" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (editingBlog) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto shadow-xl" style={{ backgroundColor: '#ffffff' }}>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            {blogs.find(b => b.id === editingBlog.id) ? 'Edit Blog' : 'Add Blog'}
          </h2>

          <div className="space-y-4">
            {/* Blog Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blog Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={editingBlog.name}
                onChange={e => setEditingBlog({ ...editingBlog, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                placeholder="My Blog"
                required
              />
            </div>

            {/* GitHub Config */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-medium mb-3 text-gray-900">GitHub</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repository (username/repo) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.github.repo}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, repo: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="username/blog-repo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.github.branch}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, branch: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="main"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Personal Access Token <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    value={editingBlog.github.token}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, token: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="ghp_..."
                  />
                </div>
              </div>
            </div>

            {/* Vercel Config */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-medium mb-3 text-gray-900">Vercel</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.vercel.projectId}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      vercel: { ...editingBlog.vercel, projectId: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="prj_..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team ID (optional)
                  </label>
                  <input
                    type="text"
                    value={editingBlog.vercel.teamId || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      vercel: { ...editingBlog.vercel, teamId: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="team_..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Token <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    value={editingBlog.vercel.token}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      vercel: { ...editingBlog.vercel, token: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="..."
                  />
                </div>
              </div>
            </div>

            {/* Content Config */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-medium mb-3 text-gray-900">Content</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Path <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.path}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, path: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="src/content/posts/"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filename Template <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.filename || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, filename: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                    placeholder="{tag}.md"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{tag}'} as a placeholder for the tag name
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveBlog}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto shadow-xl" style={{ backgroundColor: '#ffffff' }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Blog Publishing Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {blogs.map(blog => (
            <div
              key={blog.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div>
                <h3 className="font-medium text-gray-900">{blog.name}</h3>
                <p className="text-sm text-gray-600">
                  {blog.github.repo} → Vercel
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditBlog(blog)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteBlog(blog.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {blogs.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No blog configurations yet. Add one to get started!
            </p>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <button
            onClick={handleAddBlog}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Blog
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
