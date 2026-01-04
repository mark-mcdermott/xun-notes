import React, { useState, useEffect } from 'react';

interface BlogTarget {
  id: string;
  name: string;
  siteUrl?: string;
  github: {
    repo: string;
    branch: string;
    token: string;
  };
  cloudflare?: {
    accountId: string;
    projectName: string;
    token: string;
  };
  content: {
    path: string;
    livePostPath?: string;
    format: 'single-file' | 'multi-file';
    filename?: string;
  };
}

interface PublishSettingsProps {
  onClose: () => void;
  vaultPath?: string | null;
}

export const PublishSettings: React.FC<PublishSettingsProps> = ({ onClose, vaultPath }) => {
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
      siteUrl: '',
      github: {
        repo: '',
        branch: 'main',
        token: ''
      },
      cloudflare: {
        accountId: '',
        projectName: '',
        token: ''
      },
      content: {
        path: 'src/content/posts/',
        livePostPath: '/posts/',
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
    if (!editingBlog.content.path.trim()) {
      errors.push('Content path is required');
    }
    if (!editingBlog.content.filename?.trim()) {
      errors.push('Filename template is required');
    }

    // Cloudflare fields are optional, but if any are filled, all must be filled
    const cf = editingBlog.cloudflare;
    if (cf && (cf.accountId || cf.projectName || cf.token)) {
      if (!cf.accountId.trim()) {
        errors.push('Cloudflare account ID is required when using Cloudflare');
      }
      if (!cf.projectName.trim()) {
        errors.push('Cloudflare project name is required when using Cloudflare');
      }
      if (!cf.token.trim()) {
        errors.push('Cloudflare API token is required when using Cloudflare');
      }
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
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-obsidian-bg-secondary rounded-xl p-8 shadow-xl border border-obsidian-border">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            <p className="text-obsidian-text-secondary">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (editingBlog) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto backdrop-blur-sm">
        <div className="bg-obsidian-bg-secondary rounded-xl p-6 max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto shadow-xl border border-obsidian-border">
          <h2 className="text-lg font-semibold mb-4 text-obsidian-text">
            {blogs.find(b => b.id === editingBlog.id) ? 'Edit Blog' : 'Add Blog'}
          </h2>

          <div className="space-y-4">
            {/* Blog Name */}
            <div>
              <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                Blog Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={editingBlog.name}
                onChange={e => setEditingBlog({ ...editingBlog, name: e.target.value })}
                className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                placeholder="My Blog"
                required
              />
            </div>

            {/* Site URL */}
            <div>
              <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                Site URL
              </label>
              <input
                type="text"
                value={editingBlog.siteUrl || ''}
                onChange={e => setEditingBlog({ ...editingBlog, siteUrl: e.target.value })}
                className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                placeholder="https://yourblog.com"
              />
              <p className="text-xs text-obsidian-text-muted mt-1">
                Base URL for your blog (used for post links after publishing)
              </p>
            </div>

            {/* GitHub Config */}
            <div className="border-t border-obsidian-border pt-4">
              <h3 className="text-sm font-semibold mb-3 text-obsidian-text uppercase tracking-wider">GitHub</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Repository (username/repo) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.github.repo}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, repo: e.target.value }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="username/blog-repo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Branch <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.github.branch}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, branch: e.target.value }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="main"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Personal Access Token <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={editingBlog.github.token}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, token: e.target.value }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="ghp_..."
                  />
                  <p className="mt-1 text-xs text-obsidian-text-muted">
                    Fine-grained: <code className="bg-gray-100 px-1 rounded">contents: read/write</code> · Classic: <code className="bg-gray-100 px-1 rounded">repo</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Cloudflare Pages Config (Optional) */}
            <div className="border-t border-obsidian-border pt-4">
              <h3 className="text-sm font-semibold mb-1 text-obsidian-text uppercase tracking-wider">Cloudflare Pages</h3>
              <p className="text-xs text-obsidian-text-muted mb-3">
                Optional: Add these to track deployment status
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Account ID
                  </label>
                  <input
                    type="text"
                    value={editingBlog.cloudflare?.accountId || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      cloudflare: {
                        accountId: e.target.value,
                        projectName: editingBlog.cloudflare?.projectName || '',
                        token: editingBlog.cloudflare?.token || ''
                      }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="Your Cloudflare account ID"
                  />
                  <p className="text-xs text-obsidian-text-muted mt-1">
                    Found in Cloudflare dashboard URL or Workers & Pages → Overview
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={editingBlog.cloudflare?.projectName || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      cloudflare: {
                        accountId: editingBlog.cloudflare?.accountId || '',
                        projectName: e.target.value,
                        token: editingBlog.cloudflare?.token || ''
                      }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="my-blog"
                  />
                  <p className="text-xs text-obsidian-text-muted mt-1">
                    The name of your Pages project (not the domain)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    API Token
                  </label>
                  <input
                    type="password"
                    value={editingBlog.cloudflare?.token || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      cloudflare: {
                        accountId: editingBlog.cloudflare?.accountId || '',
                        projectName: editingBlog.cloudflare?.projectName || '',
                        token: e.target.value
                      }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="Your Cloudflare API token"
                  />
                  <p className="text-xs text-obsidian-text-muted mt-1">
                    Create at: dash.cloudflare.com → My Profile → API Tokens
                  </p>
                </div>
              </div>
            </div>

            {/* Content Config */}
            <div className="border-t border-obsidian-border pt-4">
              <h3 className="text-sm font-semibold mb-3 text-obsidian-text uppercase tracking-wider">Content</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Backend Content Path <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.path}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, path: e.target.value }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="src/content/posts/"
                  />
                  <p className="text-xs text-obsidian-text-muted mt-1">
                    Path in your GitHub repo where posts are stored
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Live Post Path
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.livePostPath || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, livePostPath: e.target.value }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="/posts/"
                  />
                  <p className="text-xs text-obsidian-text-muted mt-1">
                    URL path for posts on your live site (e.g., /posts/ or /blog/)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-obsidian-text-secondary mb-1">
                    Filename Template <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.filename || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, filename: e.target.value }
                    })}
                    className="w-full px-4 py-3 border border-obsidian-border rounded-lg bg-white text-obsidian-text placeholder-obsidian-text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none shadow-sm"
                    placeholder="{tag}.md"
                  />
                  <p className="text-xs text-obsidian-text-muted mt-1">
                    Use {'{tag}'} as a placeholder for the tag name
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-obsidian-text-secondary hover:bg-obsidian-hover rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveBlog}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-obsidian-bg-secondary rounded-xl p-6 max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto shadow-xl border border-obsidian-border">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-obsidian-text">Settings</h2>
            {vaultPath && (
              <p className="text-xs text-obsidian-text-muted mt-0.5">
                Vault: {vaultPath}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-obsidian-text-muted hover:text-obsidian-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-4">
          {blogs.map(blog => (
            <div
              key={blog.id}
              className="flex items-center justify-between p-4 border border-obsidian-border rounded-lg bg-obsidian-surface/50 hover:bg-obsidian-surface transition-colors"
            >
              <div>
                <h3 className="font-medium text-obsidian-text">{blog.name}</h3>
                <p className="text-sm text-obsidian-text-muted">
                  {blog.github.repo}{blog.cloudflare?.projectName ? ` → ${blog.cloudflare.projectName}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditBlog(blog)}
                  className="px-3 py-1 text-sm text-accent hover:bg-accent/10 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteBlog(blog.id)}
                  className="px-3 py-1 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {blogs.length === 0 && (
            <p className="text-center text-obsidian-text-muted py-8">
              No blog configurations yet. Add one to get started!
            </p>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-obsidian-border">
          <button
            onClick={handleAddBlog}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
          >
            Add Blog
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-obsidian-text-secondary hover:bg-obsidian-hover rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
