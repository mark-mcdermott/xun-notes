import React, { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Edit2, Github, Cloud, Power } from 'lucide-react';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';

interface VaultEntry {
  id: string;
  name: string;
  path: string;
  dailyNotesPath: string;
  createdAt: string;
}

interface BlogTarget {
  id: string;
  name: string;
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

interface SettingsPageProps {
  vaultPath?: string | null;
  onVaultSwitch?: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onVaultSwitch }) => {
  const [blogs, setBlogs] = useState<BlogTarget[]>([]);
  const [editingBlog, setEditingBlog] = useState<BlogTarget | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-vault state
  const [vaults, setVaults] = useState<VaultEntry[]>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [deleteVaultConfirm, setDeleteVaultConfirm] = useState<VaultEntry | null>(null);

  useEffect(() => {
    loadBlogs();
    loadVaults();
  }, []);

  const loadBlogs = async () => {
    try {
      const result = await window.electronAPI.publish.getBlogs();
      if (result.success) {
        setBlogs(result.blogs || []);
      }
    } catch (error) {
      console.error('Failed to load blogs:', error);
    }
  };

  const loadVaults = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.vault.getAll();
      if (result.success) {
        setVaults(result.vaults || []);
        setActiveVaultId(result.activeVaultId || null);
      }
    } catch (error) {
      console.error('Failed to load vaults:', error);
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

  const handleAddVault = async () => {
    const result = await window.electronAPI.dialog.showOpenDialog({
      title: 'Select Vault Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.paths && result.paths.length > 0) {
      try {
        const addResult = await window.electronAPI.vault.add(result.paths[0]);
        if (addResult.success) {
          await loadVaults();
        }
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          alert('This vault is already added.');
        } else {
          console.error('Failed to add vault:', error);
        }
      }
    }
  };

  const handleEditVault = async (vault: VaultEntry) => {
    const result = await window.electronAPI.dialog.showOpenDialog({
      title: 'Select New Vault Location',
      defaultPath: vault.path,
      properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.paths && result.paths.length > 0) {
      const updateResult = await window.electronAPI.vault.update(vault.id, { path: result.paths[0] });
      if (updateResult.success) {
        await loadVaults();
        // Reload if we edited the active vault
        if (vault.id === activeVaultId) {
          window.location.reload();
        }
      }
    }
  };

  const handleDeleteVaultClick = (vault: VaultEntry) => {
    setDeleteVaultConfirm(vault);
  };

  const handleDeleteVaultConfirm = async () => {
    if (!deleteVaultConfirm) return;

    try {
      await window.electronAPI.vault.delete(deleteVaultConfirm.id);
      setDeleteVaultConfirm(null);
      await loadVaults();
      // Reload if we deleted the active vault
      if (deleteVaultConfirm.id === activeVaultId) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to delete vault:', error);
    }
  };

  const handleActivateVault = async (vault: VaultEntry) => {
    try {
      const result = await window.electronAPI.vault.switch(vault.id);
      if (result.success) {
        // Update local state
        setActiveVaultId(vault.id);
        // Notify parent to refresh app state
        if (onVaultSwitch) {
          await onVaultSwitch();
        }
      }
    } catch (error) {
      console.error('Failed to activate vault:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Blog edit form
  if (editingBlog) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: '40px 48px' }}>
        <div style={{ maxWidth: '500px' }}>
          {/* Back button */}
          <div className="mb-6">
            <Button onClick={handleCancel} variant="secondary" style={{ paddingLeft: '12px' }}>
              <ChevronLeft size={18} strokeWidth={1.5} style={{ marginRight: '4px' }} />
              Back to Settings
            </Button>
          </div>

          <h2 className="font-semibold mb-6" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>
            {blogs.find(b => b.id === editingBlog.id) ? 'Edit Blog' : 'Add Blog'}
          </h2>

          <div className="space-y-6">
            {/* Blog Name */}
            <div>
              <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
                Blog Name <span style={{ color: 'var(--status-error)' }}>*</span>
              </label>
              <input
                type="text"
                value={editingBlog.name}
                onChange={e => setEditingBlog({ ...editingBlog, name: e.target.value })}
                className="w-full"
                style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                placeholder="My Blog"
              />
            </div>

            {/* GitHub Section */}
            <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border-primary)' }}>
              <h3 className="tracking-wider mb-0" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>GitHub</h3>
              <p style={{ fontSize: '14.5px', color: 'var(--text-muted)', marginTop: '-2px', marginBottom: '24px' }}>
                From your GitHub repo settings:
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
                    Repository (username/repo) <span style={{ color: 'var(--status-error)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.github.repo}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, repo: e.target.value }
                    })}
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="username/blog-repo"
                  />
                </div>

                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
                    Branch <span style={{ color: 'var(--status-error)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.github.branch}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, branch: e.target.value }
                    })}
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="main"
                  />
                </div>

                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
                    Personal Access Token <span style={{ color: 'var(--status-error)' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={editingBlog.github.token}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      github: { ...editingBlog.github, token: e.target.value }
                    })}
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="ghp_..."
                  />
                </div>
              </div>
            </div>

            {/* Cloudflare Section */}
            <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border-primary)' }}>
              <h3 className="tracking-wider mb-0" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Cloudflare Pages</h3>
              <p style={{ fontSize: '14.5px', color: 'var(--text-muted)', marginTop: '-2px', marginBottom: '24px' }}>
                Optional: Add these to track deployment status
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
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
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="Your Cloudflare account ID"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Found in Cloudflare dashboard URL or Workers & Pages → Overview
                  </p>
                </div>

                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
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
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="my-blog"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    The name of your Pages project (not the domain)
                  </p>
                </div>

                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
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
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="Your Cloudflare API token"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Create at: dash.cloudflare.com → My Profile → API Tokens
                  </p>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border-primary)' }}>
              <h3 className="tracking-wider mb-2" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Content</h3>

              <div className="space-y-4">
                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
                    Backend Content Path <span style={{ color: 'var(--status-error)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.path}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, path: e.target.value }
                    })}
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="src/content/posts/"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Path in your GitHub repo where posts are stored
                  </p>
                </div>

                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
                    Live Post Path
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.livePostPath || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, livePostPath: e.target.value }
                    })}
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="/posts/"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    URL path for posts on your live site (e.g., /posts/ or /blog/)
                  </p>
                </div>

                <div>
                  <label className="block" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '20px', marginBottom: '14px' }}>
                    Filename Template <span style={{ color: 'var(--status-error)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editingBlog.content.filename || ''}
                    onChange={e => setEditingBlog({
                      ...editingBlog,
                      content: { ...editingBlog.content, filename: e.target.value }
                    })}
                    className="w-full"
                    style={{ padding: '10px 14px', fontSize: '14.5px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', marginBottom: '0' }}
                    placeholder="{tag}.md"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Use {'{tag}'} as a placeholder for the tag name
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-6">
              <Button onClick={handleCancel} variant="secondary" style={{ marginRight: '8px' }}>
                Cancel
              </Button>
              <Button onClick={handleSaveBlog}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main settings view
  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '40px 48px' }}>
      <div className="max-w-2xl">
        <h1 className="font-semibold" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '32px' }}>Settings</h1>

        {/* Vaults Section */}
        <div style={{ marginBottom: '32px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Vaults</h2>
            <Button onClick={handleAddVault} variant="secondary">
              <Plus size={16} strokeWidth={3} style={{ marginRight: '8px' }} />
              Add Vault
            </Button>
          </div>
          {vaults.length === 0 ? (
            <div className="py-12 text-center rounded-lg" style={{ border: '1px dashed var(--border-primary)' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                No vaults configured. Add one to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...vaults].sort((a, b) => a.name.localeCompare(b.name)).map(vault => (
                <div
                  key={vault.id}
                  className="flex items-center justify-between transition-shadow hover:shadow-md"
                  style={{
                    padding: '16px 20px',
                    border: '1px solid var(--input-border)',
                    backgroundColor: 'var(--bg-primary)',
                    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)',
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>
                        {vault.name}
                      </h3>
                      {vault.id === activeVaultId && (
                        <span style={{
                          fontSize: '11px',
                          color: 'var(--bg-secondary)',
                          backgroundColor: 'var(--text-muted)',
                          padding: '2px 6px 3px 6px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          marginLeft: '8px'
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      {vault.path}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {vault.id !== activeVaultId && (
                      <button
                        onClick={() => handleActivateVault(vault)}
                        className="p-2 rounded-lg transition-all hover:bg-gray-100 hover:opacity-60"
                        style={{ color: 'var(--text-icon)', backgroundColor: 'transparent' }}
                        title="Activate"
                      >
                        <Power size={16} strokeWidth={1.5} />
                      </button>
                    )}
                    <button
                      onClick={() => handleEditVault(vault)}
                      className="p-2 rounded-lg transition-all hover:bg-gray-100 hover:opacity-60"
                      style={{ color: 'var(--text-icon)', backgroundColor: 'transparent' }}
                      title="Edit"
                    >
                      <Edit2 size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDeleteVaultClick(vault)}
                      className="p-2 rounded-lg transition-all hover:bg-red-50 hover:opacity-60"
                      style={{ color: 'var(--status-error)', backgroundColor: 'transparent' }}
                      title="Delete"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Vault Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteVaultConfirm !== null}
          title="Delete Vault"
          message="This will permanently delete this vault folder and all files (notes) inside it. Are you sure?"
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onConfirm={handleDeleteVaultConfirm}
          onCancel={() => setDeleteVaultConfirm(null)}
        />

        {/* Blogs Section */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
            <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Blogs</h2>
            <Button onClick={handleAddBlog} variant="secondary">
              <Plus size={16} strokeWidth={3} style={{ marginRight: '8px' }} />
              Add Blog
            </Button>
          </div>

          {blogs.length === 0 ? (
            <div className="py-12 text-center rounded-lg" style={{ border: '1px dashed var(--border-primary)' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                No blog configurations yet. Add one to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...blogs].sort((a, b) => a.name.localeCompare(b.name)).map(blog => (
                <div
                  key={blog.id}
                  className="flex items-center justify-between transition-shadow hover:shadow-md"
                  style={{ padding: '16px 20px', border: '1px solid var(--input-border)', backgroundColor: 'var(--bg-primary)', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)', borderRadius: '8px', marginBottom: '12px' }}
                >
                  <div>
                    <h3 className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>{blog.name}</h3>
                    <div className="flex items-center gap-1.5" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <Github size={13} strokeWidth={1.5} style={{ marginRight: '6px' }} />
                      <span>{blog.github.repo}</span>
                    </div>
                    {blog.cloudflare?.projectName && (
                      <div className="flex items-center gap-1.5" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <Cloud size={13} strokeWidth={1.5} style={{ marginRight: '6px' }} />
                        <span>{blog.cloudflare.projectName}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditBlog(blog)}
                      className="p-2 rounded-lg transition-all hover:bg-gray-100 hover:opacity-60"
                      style={{ color: 'var(--text-icon)', backgroundColor: 'transparent' }}
                      title="Edit"
                    >
                      <Edit2 size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDeleteBlog(blog.id)}
                      className="p-2 rounded-lg transition-all hover:bg-red-50 hover:opacity-60"
                      style={{ color: 'var(--status-error)', backgroundColor: 'transparent' }}
                      title="Delete"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
