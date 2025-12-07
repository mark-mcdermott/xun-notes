import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar,
  Settings,
  FileText,
  Code,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  FilePlus,
  FolderPlus,
  X,
  Plus,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Pencil,
  Link,
  PanelLeftClose,
  PanelLeftOpen,
  Columns,
  BookOpen,
  FolderTree,
  Hash,
  Eye
} from 'lucide-react';
import { useVault } from './hooks/useVault';
import { useTags } from './hooks/useTags';
import { FileTree } from './components/FileTree';
import { MarkdownEditor } from './components/MarkdownEditor';
import { LiveMarkdownEditor } from './components/LiveMarkdownEditor';
import { TagBrowser } from './components/TagBrowser';
import { TagView } from './components/TagView';
import { DailyNotesNav } from './components/DailyNotesNav';
import { CommandPalette } from './components/CommandPalette';
import { Breadcrumb } from './components/Breadcrumb';
import { PublishDialog } from './components/PublishDialog';
import { PublishProgressPopup } from './components/PublishProgressPopup';
import { SettingsPage } from './components/SettingsPage';
import { CreateFileDialog } from './components/CreateFileDialog';

type SidebarTab = 'files' | 'tags' | 'daily';
type EditorViewMode = 'markdown' | 'editor' | 'split' | 'preview';
type Tab = { type: 'file'; path: string; content: string } | { type: 'tag'; tag: string };

const App: React.FC = () => {
  const { vaultPath, fileTree, loading, error, readFile, writeFile, createFile, createFolder, deleteFile, getTodayNote, getDailyNote, getDailyNoteDates, refreshFileTree } = useVault();
  const { tags, loading: tagsLoading, getTagContent, deleteTag, refreshTags } = useTags();

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [dailyNoteDates, setDailyNoteDates] = useState<string[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>('editor');
  const [publishTag, setPublishTag] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogType, setCreateDialogType] = useState<'file' | 'folder'>('file');
  const [inlineCreateType, setInlineCreateType] = useState<'file' | 'folder' | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [blogs, setBlogs] = useState<Array<{ id: string; name: string }>>([]);

  // Blog block publish progress state
  const [blogBlockPublishJobId, setBlogBlockPublishJobId] = useState<string | null>(null);
  const [blogBlockPublishStatus, setBlogBlockPublishStatus] = useState<'pending' | 'preparing' | 'pushing' | 'building' | 'deploying' | 'completed' | 'failed'>('pending');
  const [blogBlockPublishProgress, setBlogBlockPublishProgress] = useState(0);
  const [blogBlockPublishSteps, setBlogBlockPublishSteps] = useState<Array<{ name: string; status: 'pending' | 'in_progress' | 'completed' | 'failed'; message?: string }>>([]);
  const [blogBlockPublishError, setBlogBlockPublishError] = useState<string | null>(null);
  const blogBlockPublishResolveRef = useRef<((success: boolean) => void) | null>(null);

  // Navigation history for back/forward
  type HistoryEntry = { type: 'file'; path: string } | { type: 'tag'; tag: string } | { type: 'settings' };
  const [navHistory, setNavHistory] = useState<HistoryEntry[]>([]);
  const [navHistoryIndex, setNavHistoryIndex] = useState(-1);
  const isNavigatingRef = useRef(false); // Prevent adding to history during back/forward

  // Derived state for active tab
  const activeTab = activeTabIndex >= 0 ? openTabs[activeTabIndex] : null;
  const activeFileTab = activeTab?.type === 'file' ? activeTab : null;
  const activeTagTab = activeTab?.type === 'tag' ? activeTab : null;
  const selectedFile = activeFileTab?.path ?? null;
  const fileContent = activeFileTab?.content ?? '';
  const selectedTag = activeTagTab?.tag ?? null;

  // Navigation history helpers
  const pushToHistory = useCallback((entry: HistoryEntry) => {
    if (isNavigatingRef.current) return; // Don't push during back/forward navigation

    setNavHistory(prev => {
      // Remove any forward history when pushing new entry
      const newHistory = prev.slice(0, navHistoryIndex + 1);
      // Don't add duplicate consecutive entries
      const lastEntry = newHistory[newHistory.length - 1];
      if (lastEntry &&
          lastEntry.type === entry.type &&
          ((entry.type === 'file' && lastEntry.type === 'file' && lastEntry.path === entry.path) ||
           (entry.type === 'tag' && lastEntry.type === 'tag' && lastEntry.tag === entry.tag) ||
           (entry.type === 'settings' && lastEntry.type === 'settings'))) {
        return prev;
      }
      return [...newHistory, entry];
    });
    setNavHistoryIndex(prev => prev + 1);
  }, [navHistoryIndex]);

  const canGoBack = navHistoryIndex > 0;
  const canGoForward = navHistoryIndex < navHistory.length - 1;

  const navigateToEntry = useCallback(async (entry: HistoryEntry) => {
    isNavigatingRef.current = true;
    try {
      if (entry.type === 'file') {
        // Check if file is already open in tabs
        const existingIndex = openTabs.findIndex(tab => tab.type === 'file' && tab.path === entry.path);
        if (existingIndex >= 0) {
          setActiveTabIndex(existingIndex);
          setShowSettings(false);
        } else {
          // Need to load the file
          const content = await readFile(entry.path);
          setOpenTabs(prev => [...prev, { type: 'file', path: entry.path, content }]);
          setActiveTabIndex(openTabs.length);
          setShowSettings(false);
        }
      } else if (entry.type === 'tag') {
        // Check if tag is already open in tabs
        const existingIndex = openTabs.findIndex(tab => tab.type === 'tag' && tab.tag === entry.tag);
        if (existingIndex >= 0) {
          setActiveTabIndex(existingIndex);
          setShowSettings(false);
        } else {
          setOpenTabs(prev => [...prev, { type: 'tag', tag: entry.tag }]);
          setActiveTabIndex(openTabs.length);
          setShowSettings(false);
        }
      } else if (entry.type === 'settings') {
        setShowSettings(true);
      }
    } finally {
      isNavigatingRef.current = false;
    }
  }, [openTabs, readFile]);

  const goBack = useCallback(async () => {
    if (!canGoBack) return;
    const newIndex = navHistoryIndex - 1;
    setNavHistoryIndex(newIndex);
    await navigateToEntry(navHistory[newIndex]);
  }, [canGoBack, navHistoryIndex, navHistory, navigateToEntry]);

  const goForward = useCallback(async () => {
    if (!canGoForward) return;
    const newIndex = navHistoryIndex + 1;
    setNavHistoryIndex(newIndex);
    await navigateToEntry(navHistory[newIndex]);
  }, [canGoForward, navHistoryIndex, navHistory, navigateToEntry]);

  // Load today's note on mount
  useEffect(() => {
    const loadTodayNote = async () => {
      try {
        const { path, content } = await getTodayNote();
        setOpenTabs([{ type: 'file', path, content }]);
        setActiveTabIndex(0);
      } catch (err) {
        console.error('Failed to load today note:', err);
      }
    };

    if (vaultPath) {
      loadTodayNote();
    }
  }, [vaultPath, getTodayNote]);

  // Load daily note dates on mount
  useEffect(() => {
    const loadDates = async () => {
      try {
        const dates = await getDailyNoteDates();
        setDailyNoteDates(dates);
      } catch (err) {
        console.error('Failed to load daily note dates:', err);
      }
    };

    if (vaultPath) {
      loadDates();
    }
  }, [vaultPath, getDailyNoteDates]);

  // Load blogs for editor autocomplete
  useEffect(() => {
    const loadBlogs = async () => {
      try {
        const result = await window.electronAPI.publish.getBlogs();
        if (result.success && result.blogs) {
          setBlogs(result.blogs);
        }
      } catch (err) {
        console.error('Failed to load blogs:', err);
      }
    };
    loadBlogs();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+P or Ctrl+P to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Cmd+, or Ctrl+, to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sidebar resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(180, Math.min(400, resizeRef.current.startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Subscribe to blog block publish progress
  useEffect(() => {
    if (!blogBlockPublishJobId) return;

    const subscribeToProgress = async () => {
      await window.electronAPI.publish.subscribe(blogBlockPublishJobId, (data: any) => {
        setBlogBlockPublishStatus(data.status);
        setBlogBlockPublishProgress(data.progress);
        setBlogBlockPublishSteps(data.steps || []);
        if (data.error) {
          setBlogBlockPublishError(data.error);
        }
        // Resolve the promise when complete
        if (data.status === 'completed' || data.status === 'failed') {
          if (blogBlockPublishResolveRef.current) {
            blogBlockPublishResolveRef.current(data.status === 'completed');
            blogBlockPublishResolveRef.current = null;
          }
        }
      });
    };

    subscribeToProgress();

    return () => {
      window.electronAPI.publish.unsubscribe(blogBlockPublishJobId);
    };
  }, [blogBlockPublishJobId]);

  const handleFileClick = async (path: string) => {
    try {
      // Check if file is already open
      const existingIndex = openTabs.findIndex(tab => tab.type === 'file' && tab.path === path);
      if (existingIndex >= 0) {
        setActiveTabIndex(existingIndex);
      } else {
        const content = await readFile(path);
        setOpenTabs(prev => [...prev, { type: 'file', path, content }]);
        setActiveTabIndex(openTabs.length);
      }
      setShowSettings(false);
      pushToHistory({ type: 'file', path });
    } catch (err: any) {
      console.error('Failed to read file:', err);
      alert(`Failed to read file: ${err.message}`);
    }
  };

  const handleTabClick = (index: number) => {
    const tab = openTabs[index];
    setActiveTabIndex(index);
    setShowSettings(false);
    if (tab) {
      if (tab.type === 'file') {
        pushToHistory({ type: 'file', path: tab.path });
      } else {
        pushToHistory({ type: 'tag', tag: tab.tag });
      }
    }
  };

  const handleCloseTab = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs(prev => prev.filter((_, i) => i !== index));
    if (activeTabIndex === index) {
      // If closing active tab, switch to previous tab or next if first
      setActiveTabIndex(Math.max(0, index - 1));
    } else if (activeTabIndex > index) {
      // Adjust active index if closing a tab before it
      setActiveTabIndex(activeTabIndex - 1);
    }
    // If no tabs left, reset
    if (openTabs.length === 1) {
      setActiveTabIndex(-1);
    }
  };

  const handleTagClick = (tag: string) => {
    // Check if tag is already open
    const existingIndex = openTabs.findIndex(tab => tab.type === 'tag' && tab.tag === tag);
    if (existingIndex >= 0) {
      setActiveTabIndex(existingIndex);
    } else {
      setOpenTabs(prev => [...prev, { type: 'tag', tag }]);
      setActiveTabIndex(openTabs.length);
    }
    setShowSettings(false);
    pushToHistory({ type: 'tag', tag });
  };

  const handleEditorTagClick = (tag: string, newTab: boolean) => {
    // Check if tag is already open
    const existingIndex = openTabs.findIndex(tab => tab.type === 'tag' && tab.tag === tag);
    if (existingIndex >= 0) {
      setActiveTabIndex(existingIndex);
    } else {
      setOpenTabs(prev => [...prev, { type: 'tag', tag }]);
      setActiveTabIndex(openTabs.length);
    }
    setShowSettings(false);
    setSidebarTab('tags');
    pushToHistory({ type: 'tag', tag });
  };

  const handleOpenTodayNote = async () => {
    try {
      const { path, content } = await getTodayNote();
      // Check if file is already open
      const existingIndex = openTabs.findIndex(tab => tab.type === 'file' && tab.path === path);
      if (existingIndex >= 0) {
        setActiveTabIndex(existingIndex);
      } else {
        setOpenTabs(prev => [...prev, { type: 'file', path, content }]);
        setActiveTabIndex(openTabs.length);
      }
      setShowSettings(false);
      pushToHistory({ type: 'file', path });

      // Refresh daily note dates in case a new one was created
      const dates = await getDailyNoteDates();
      setDailyNoteDates(dates);
    } catch (err: any) {
      console.error('Failed to open today note:', err);
    }
  };

  const handleDateSelect = async (date: string) => {
    try {
      const { path, content } = await getDailyNote(date);
      // Check if file is already open
      const existingIndex = openTabs.findIndex(tab => tab.type === 'file' && tab.path === path);
      if (existingIndex >= 0) {
        setActiveTabIndex(existingIndex);
      } else {
        setOpenTabs(prev => [...prev, { type: 'file', path, content }]);
        setActiveTabIndex(openTabs.length);
      }
      setShowSettings(false);
      pushToHistory({ type: 'file', path });

      // Refresh daily note dates in case a new one was created
      const dates = await getDailyNoteDates();
      setDailyNoteDates(dates);
    } catch (err: any) {
      console.error('Failed to load daily note:', err);
      alert(`Failed to load daily note: ${err.message}`);
    }
  };

  const handleSave = async (content: string) => {
    if (!selectedFile || activeTabIndex < 0) return;
    const currentTab = openTabs[activeTabIndex];
    if (currentTab?.type !== 'file') return;

    try {
      await writeFile(selectedFile, content);
      // Update content in the tabs array
      setOpenTabs(prev => prev.map((tab, i) =>
        i === activeTabIndex && tab.type === 'file' ? { ...tab, content } : tab
      ));

      // Refresh tags after save to pick up new tags
      await refreshTags();
    } catch (err: any) {
      console.error('Failed to save file:', err);
      throw err;
    }
  };

  const handleCommandPaletteFileSelect = async (path: string) => {
    await handleFileClick(path);
  };

  const handleCommandPaletteTagSelect = (tag: string) => {
    setSidebarTab('tags');
    handleTagClick(tag);
  };

  const handleCommandPaletteDateSelect = async (date: string) => {
    setSidebarTab('daily');
    await handleDateSelect(date);
  };

  const handleCreateFile = () => {
    setSidebarTab('files');
    setInlineCreateType('file');
  };

  const handleCreateFolder = () => {
    setSidebarTab('files');
    setInlineCreateType('folder');
  };

  const handleInlineCreate = async (name: string, type: 'file' | 'folder') => {
    try {
      if (type === 'file') {
        const path = `notes/${name}`;
        const initialContent = `# ${name.replace('.md', '')}\n\n`;
        await createFile(path, initialContent);

        // Open the new file in a tab
        setOpenTabs(prev => [...prev, { type: 'file', path, content: initialContent }]);
        setActiveTabIndex(openTabs.length);
        setShowSettings(false);
      } else {
        const path = `notes/${name}`;
        await createFolder(path);
      }
    } catch (err: any) {
      console.error('Failed to create:', err);
    } finally {
      setInlineCreateType(null);
    }
  };

  const handleInlineCancel = () => {
    setInlineCreateType(null);
  };

  const handleDeleteFile = async (path: string, type: 'file' | 'folder') => {
    try {
      await deleteFile(path);

      // Close the tab if this file was open
      const tabIndex = openTabs.findIndex(tab => tab.type === 'file' && tab.path === path);
      if (tabIndex >= 0) {
        setOpenTabs(prev => prev.filter((_, i) => i !== tabIndex));
        if (activeTabIndex === tabIndex) {
          setActiveTabIndex(Math.max(0, tabIndex - 1));
        } else if (activeTabIndex > tabIndex) {
          setActiveTabIndex(activeTabIndex - 1);
        }
        if (openTabs.length === 1) {
          setActiveTabIndex(-1);
        }
      }
    } catch (err: any) {
      console.error('Failed to delete:', err);
    }
  };

  const handleQuickCreateFile = async () => {
    // Generate unique untitled filename
    let name = 'untitled.md';
    let counter = 1;

    // Check existing tabs and find a unique name
    const existingNames = openTabs
      .filter((tab): tab is Tab & { type: 'file' } => tab.type === 'file')
      .map(tab => {
        const parts = tab.path.split('/');
        return parts[parts.length - 1];
      });

    while (existingNames.includes(name)) {
      name = `untitled-${counter}.md`;
      counter++;
    }

    const path = `notes/${name}`;
    const initialContent = `# ${name.replace('.md', '')}\n\n`;

    try {
      await createFile(path, initialContent);
      setOpenTabs(prev => [...prev, { type: 'file', path, content: initialContent }]);
      setActiveTabIndex(openTabs.length);
      setShowSettings(false);
    } catch (err: any) {
      // If file already exists on disk, try next number
      if (err.message?.includes('exists')) {
        counter++;
        name = `untitled-${counter}.md`;
        const newPath = `notes/${name}`;
        const newContent = `# ${name.replace('.md', '')}\n\n`;
        await createFile(newPath, newContent);
        setOpenTabs(prev => [...prev, { type: 'file', path: newPath, content: newContent }]);
        setActiveTabIndex(openTabs.length);
        setShowSettings(false);
      } else {
        console.error('Failed to create file:', err);
      }
    }
  };

  const handleCreate = async (name: string) => {
    if (createDialogType === 'file') {
      // Create file in notes folder by default
      const path = `notes/${name}`;
      const initialContent = `# ${name.replace('.md', '')}\n\n`;
      await createFile(path, initialContent);

      // Open the new file in a tab
      setOpenTabs(prev => [...prev, { type: 'file', path, content: initialContent }]);
      setActiveTabIndex(openTabs.length);
      setShowSettings(false);
    } else {
      // Create folder in notes folder by default
      const path = `notes/${name}`;
      await createFolder(path);
    }
  };

  const handleDeleteTag = async (tag: string) => {
    try {
      const result = await deleteTag(tag);
      alert(`Successfully deleted tag ${tag}!\n\n${result.filesModified.length} files modified\n${result.sectionsDeleted} sections removed`);

      // Refresh file tree and tags
      await refreshFileTree();
      await refreshTags();

      // Close the tag tab if open
      const tagTabIndex = openTabs.findIndex(tab => tab.type === 'tag' && tab.tag === tag);
      if (tagTabIndex >= 0) {
        setOpenTabs(prev => prev.filter((_, i) => i !== tagTabIndex));
        if (activeTabIndex === tagTabIndex) {
          setActiveTabIndex(Math.max(0, tagTabIndex - 1));
        } else if (activeTabIndex > tagTabIndex) {
          setActiveTabIndex(activeTabIndex - 1);
        }
        if (openTabs.length === 1) {
          setActiveTabIndex(-1);
        }
      }
    } catch (err: any) {
      throw err; // Re-throw to be handled by TagView
    }
  };

  const handlePublish = (tag: string) => {
    setPublishTag(tag);
    setPublishDialogOpen(true);
  };

  // Direct publish from blog block (with progress popup)
  const handlePublishBlogBlock = async (blogId: string, content: string): Promise<boolean> => {
    try {
      // Reset state
      setBlogBlockPublishStatus('pending');
      setBlogBlockPublishProgress(0);
      setBlogBlockPublishSteps([]);
      setBlogBlockPublishError(null);

      const result = await window.electronAPI.publish.toBlogDirect(blogId, content);

      if (result.success && result.jobId) {
        // Create a promise that will resolve when the job completes
        const completionPromise = new Promise<boolean>((resolve) => {
          blogBlockPublishResolveRef.current = resolve;
        });

        // Set the job ID to trigger subscription
        setBlogBlockPublishJobId(result.jobId);

        // Wait for completion
        return await completionPromise;
      } else {
        setBlogBlockPublishError(result.error || 'Failed to start publish job');
        setBlogBlockPublishStatus('failed');
        setBlogBlockPublishJobId('error'); // Show popup with error
        return false;
      }
    } catch (err: any) {
      setBlogBlockPublishError(err.message || 'Failed to publish');
      setBlogBlockPublishStatus('failed');
      setBlogBlockPublishJobId('error'); // Show popup with error
      return false;
    }
  };

  // Close blog block publish popup
  const handleCloseBlogBlockPublish = () => {
    if (blogBlockPublishJobId && blogBlockPublishJobId !== 'error') {
      window.electronAPI.publish.unsubscribe(blogBlockPublishJobId);
    }
    setBlogBlockPublishJobId(null);
    setBlogBlockPublishStatus('pending');
    setBlogBlockPublishProgress(0);
    setBlogBlockPublishSteps([]);
    setBlogBlockPublishError(null);
  };

  const handleUpdateTagContent = async (filePath: string, oldContent: string, newContent: string) => {
    try {
      // Read the current file content
      const fileContent = await readFile(filePath);

      // Replace the old content with the new content
      const updatedContent = fileContent.replace(oldContent, newContent);

      // Write the updated content back to the file
      await writeFile(filePath, updatedContent);

      // If this file is currently open in a tab, update its content
      const tabIndex = openTabs.findIndex(tab => tab.type === 'file' && tab.path === filePath);
      if (tabIndex !== -1) {
        setOpenTabs(prev => prev.map((tab, i) =>
          i === tabIndex && tab.type === 'file' ? { ...tab, content: updatedContent } : tab
        ));
      }
    } catch (err: any) {
      console.error('Failed to update tag content:', err);
      throw err;
    }
  };

  if (loading && !fileTree) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-obsidian-bg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-obsidian-text-secondary">Loading vault...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-obsidian-bg">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  // Get filename from path for tab display
  const getFileName = (path: string | null) => {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1].replace('.md', '');
  };

  // Calculate word and character count
  const getWordCount = (text: string) => {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  };

  const getCharCount = (text: string) => {
    return text.length;
  };

  // Get vault name from path
  const getVaultName = () => {
    if (!vaultPath) return 'vault';
    const parts = vaultPath.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-obsidian-bg">
      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        fileTree={fileTree}
        tags={tags}
        onFileSelect={handleCommandPaletteFileSelect}
        onTagSelect={handleCommandPaletteTagSelect}
        onDateSelect={handleCommandPaletteDateSelect}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
      />

      {/* Publish Dialog */}
      {publishDialogOpen && publishTag && (
        <PublishDialog
          tag={publishTag}
          onClose={() => {
            setPublishDialogOpen(false);
            setPublishTag(null);
          }}
        />
      )}

      {/* Blog Block Publish Progress Popup */}
      {blogBlockPublishJobId && (
        <PublishProgressPopup
          status={blogBlockPublishStatus}
          progress={blogBlockPublishProgress}
          steps={blogBlockPublishSteps}
          error={blogBlockPublishError}
          onClose={handleCloseBlogBlockPublish}
        />
      )}

      
      {/* Create File/Folder Dialog */}
      <CreateFileDialog
        isOpen={createDialogOpen}
        type={createDialogType}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreate}
      />

      {/* Top bar - spans full width */}
      <div className="h-[45px] flex items-center" style={{ backgroundColor: '#f6f6f6', borderBottom: '1px solid #e0e0e0' }}>
        {/* Left section - same width as both sidebars (44px + 1px border + sidebarWidth, or just auto when collapsed) */}
        <div className="h-full flex items-center" style={{ width: sidebarCollapsed ? 'auto' : `${44 + 1 + sidebarWidth}px`, borderRight: sidebarCollapsed ? 'none' : '1px solid #e0e0e0' }}>
          {/* macOS traffic light space */}
          <div className="w-[70px] h-full" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

          {/* Collapse sidebar button */}
          <div className="flex items-center justify-end h-full flex-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button className="h-full px-3 hover:bg-[#e8e8e8] transition-colors cursor-pointer" style={{ color: '#737373', backgroundColor: 'transparent', marginLeft: sidebarCollapsed ? '10px' : '0' }} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              {sidebarCollapsed ? <PanelLeftOpen size={22} strokeWidth={1.5} style={{ marginTop: '1px' }} /> : <PanelLeftClose size={20} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Tab bar in title bar */}
        <div className="flex items-end h-full flex-1" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {(openTabs.length > 0 || showSettings) && (
            <div className="flex items-end h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {/* All Tabs (file and tag) */}
              {openTabs.map((tab, index) => {
                const isActive = index === activeTabIndex && !showSettings;
                const tabKey = tab.type === 'file' ? tab.path : `tag-${tab.tag}`;
                const tabLabel = tab.type === 'file' ? getFileName(tab.path) : tab.tag;
                return (
                  <div
                    key={tabKey}
                    onClick={() => handleTabClick(index)}
                    className="flex items-center justify-between cursor-pointer"
                    style={{
                      backgroundColor: isActive ? '#ffffff' : '#f6f6f6',
                      border: '1px solid #e0e0e0',
                      borderBottom: isActive ? '1px solid #ffffff' : 'none',
                      marginLeft: index === 0 ? (sidebarCollapsed ? '15px' : '12px') : '6px',
                      height: 'calc(100% - 8px)',
                      width: '180px',
                      paddingLeft: '10px',
                      paddingRight: '6px',
                      borderTopLeftRadius: '8px',
                      borderTopRightRadius: '8px',
                      marginBottom: isActive ? '-1px' : '0'
                    }}
                  >
                    <span className="truncate" style={{ fontSize: '13.5px', color: isActive ? '#4a4a4a' : '#6a6a6a' }}>{tabLabel}</span>
                    <button
                      className="p-0.5 rounded transition-colors flex items-center justify-center hover:bg-[#e0e0e0]"
                      style={{ color: isActive ? '#4a4a4a' : '#6a6a6a', backgroundColor: 'transparent' }}
                      title="Close tab"
                      onClick={(e) => handleCloseTab(index, e)}
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
              {/* Settings Tab */}
              {showSettings && (
                <div
                  className="flex items-center justify-between cursor-pointer"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    borderBottom: '1px solid #ffffff',
                    marginLeft: openTabs.length === 0 ? (sidebarCollapsed ? '15px' : '12px') : '6px',
                    height: 'calc(100% - 8px)',
                    width: '180px',
                    paddingLeft: '10px',
                    paddingRight: '6px',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px',
                    marginBottom: '-1px'
                  }}
                >
                  <span className="flex items-center gap-2" style={{ fontSize: '13.5px', color: '#4a4a4a' }}>
                    <Settings size={14} strokeWidth={1.5} />
                    Settings
                  </span>
                  <button
                    className="p-0.5 rounded transition-colors flex items-center justify-center hover:bg-[#e0e0e0]"
                    style={{ color: '#4a4a4a', backgroundColor: 'transparent' }}
                    title="Close settings"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettings(false);
                    }}
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              )}
              {/* New tab button */}
              <button
                className="h-full transition-colors flex items-center justify-center hover:bg-[#e8e8e8]"
                style={{ color: '#808080', backgroundColor: 'transparent', paddingLeft: '12px', paddingRight: '8px' }}
                title="New note"
                onClick={handleQuickCreateFile}
              >
                <Plus size={18} strokeWidth={1.5} style={{ marginTop: '2px' }} />
              </button>
            </div>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center pr-3 gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* <button className="p-1 hover:bg-[#e8e8e8] rounded" style={{ color: '#737373' }}>
            <ChevronDown size={16} strokeWidth={1.5} />
          </button> */}
        </div>
      </div>

      {/* Main area below top bar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Far-left Icon Sidebar */}
        <div className="w-[44px] min-w-[44px] flex-shrink-0 flex flex-col items-center" style={{ backgroundColor: '#f6f6f6', borderRight: '1px solid #e0e0e0', paddingTop: '16px' }}>
          {/* Top icons */}
          {/* <button className="p-2 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent', marginBottom: '8px' }} title="Daily Notes" onClick={() => setSidebarTab('daily')}>
            <Calendar size={20} strokeWidth={1.5} />
          </button> */}
          <button className="p-2 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent', marginBottom: '8px' }} title="Today's Note" onClick={handleOpenTodayNote}>
            <FileText size={20} strokeWidth={1.5} />
          </button>
          <button className="p-2 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent', marginBottom: '8px' }} title="File Tree" onClick={() => setSidebarTab('files')}>
            <FolderTree size={20} strokeWidth={1.5} />
          </button>
          <button className="p-2 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent' }} title="Tags" onClick={() => setSidebarTab('tags')}>
            <Code size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Left Sidebar - File tree with toolbar */}
        {!sidebarCollapsed && (
        <div className="flex flex-col relative" style={{ width: `${sidebarWidth + 1}px`, backgroundColor: '#f6f6f6', paddingTop: '16px' }}>
          {/* Resize handle */}
          <div
            className="absolute inset-y-0 cursor-col-resize hover:bg-blue-400/50 transition-colors"
            style={{ right: 0, width: '4px', top: 0, bottom: 0, backgroundColor: isResizing ? 'rgba(96, 165, 250, 0.5)' : 'transparent', borderRight: '1px solid #e0e0e0' }}
            onMouseDown={handleResizeStart}
          />
          {/* Sidebar toolbar */}
          <div className="h-9 flex items-center" style={{ backgroundColor: 'transparent', marginBottom: '16px', paddingLeft: '20px' }}>
            <div className="flex items-center gap-0.5">
              <button className="p-1.5 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent' }} title="New note" onClick={handleCreateFile}>
                <FilePlus size={20} strokeWidth={1.5} />
              </button>
              <button className="p-1.5 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent' }} title="New folder" onClick={handleCreateFolder}>
                <FolderPlus size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto" style={{ paddingLeft: '13px' }}>
            {sidebarTab === 'daily' ? (
              <DailyNotesNav
                onDateSelect={handleDateSelect}
                currentDate={selectedFile?.includes('daily-notes/') ? selectedFile.split('/').pop()?.replace('.md', '') : null}
                existingDates={dailyNoteDates}
              />
            ) : sidebarTab === 'files' ? (
              <FileTree
                tree={fileTree}
                onFileClick={handleFileClick}
                onDelete={handleDeleteFile}
                inlineCreateType={inlineCreateType}
                onInlineCreate={handleInlineCreate}
                onInlineCancel={handleInlineCancel}
              />
            ) : (
              <TagBrowser
                tags={tags}
                selectedTag={selectedTag}
                onTagClick={handleTagClick}
              />
            )}
          </div>

          {/* Bottom vault selector and settings - all on one row */}
          <div className="px-2 flex items-center justify-between" style={{ borderTop: '1px solid #e0e0e0', paddingTop: '10px', paddingBottom: '10px' }}>
            <button className="flex items-center px-2 py-1.5 hover:bg-[#e8e8e8] rounded text-xs" style={{ color: '#737373', backgroundColor: 'transparent' }}>
              <div className="flex flex-col items-center" style={{ marginRight: '6px', marginLeft: '8px' }}>
                <ChevronUp size={12} strokeWidth={2} className="mb-[-4px]" />
                <ChevronDown size={12} strokeWidth={2} />
              </div>
              <span className="truncate text-left" style={{ fontWeight: 600 }}>{getVaultName()}</span>
            </button>
            <div className="flex items-center gap-1">
              {/* <button className="p-1.5 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent' }} title="Help">
                <HelpCircle size={16} strokeWidth={1.5} />
              </button> */}
              <button className="p-1.5 hover:bg-[#e8e8e8] rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent', marginRight: '8px' }} title="Settings" onClick={() => setShowSettings(true)}>
                <Settings size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col bg-white">

        {showSettings ? (
          <SettingsPage vaultPath={vaultPath} />
        ) : activeFileTab ? (
          <>
            {/* Navigation bar with breadcrumb */}
            <div className="flex items-center px-3 relative" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
              {/* Left side - arrow buttons */}
              <div className="flex items-center gap-2">
                <button
                  className={`p-1 rounded transition-colors ${canGoBack ? 'hover:bg-[#e8e8e8]' : 'opacity-40 cursor-default'}`}
                  style={{ color: '#737373', backgroundColor: 'transparent' }}
                  title="Back"
                  onClick={goBack}
                  disabled={!canGoBack}
                >
                  <ArrowLeft size={18} strokeWidth={1.5} />
                </button>
                <button
                  className={`p-1 rounded transition-colors ${canGoForward ? 'hover:bg-[#e8e8e8]' : 'opacity-40 cursor-default'}`}
                  style={{ color: '#737373', backgroundColor: 'transparent' }}
                  title="Forward"
                  onClick={goForward}
                  disabled={!canGoForward}
                >
                  <ArrowRight size={18} strokeWidth={1.5} />
                </button>
              </div>

              {/* Center - breadcrumbs */}
              <div className="absolute left-1/2 transform -translate-x-1/2">
                <Breadcrumb path={selectedFile!} />
              </div>

              {/* Right side - view mode icon */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  className="p-1 rounded transition-colors"
                  style={{ color: '#737373', backgroundColor: 'transparent' }}
                  title={`View mode: ${editorViewMode}`}
                  onClick={() => {
                    const modes: EditorViewMode[] = ['markdown', 'editor', 'split', 'preview'];
                    const currentIndex = modes.indexOf(editorViewMode);
                    setEditorViewMode(modes[(currentIndex + 1) % 4]);
                  }}
                >
                  {editorViewMode === 'markdown' && <Hash size={18} strokeWidth={1.5} />}
                  {editorViewMode === 'editor' && <Pencil size={18} strokeWidth={1.5} />}
                  {editorViewMode === 'split' && <Columns size={18} strokeWidth={1.5} />}
                  {editorViewMode === 'preview' && <Eye size={18} strokeWidth={1.5} />}
                </button>
                {/* <button className="p-1 rounded transition-colors" style={{ color: '#737373', backgroundColor: 'transparent' }} title="More options">
                  <MoreHorizontal size={18} strokeWidth={1.5} />
                </button> */}
              </div>
            </div>

            {/* Markdown Editor */}
            <div className="flex-1 overflow-hidden">
              {editorViewMode === 'editor' ? (
                <LiveMarkdownEditor
                  key={selectedFile}
                  initialContent={fileContent}
                  filePath={selectedFile!}
                  onSave={handleSave}
                  onTagClick={handleEditorTagClick}
                  blogs={blogs}
                  onPublishBlogBlock={handlePublishBlogBlock}
                />
              ) : (
                <MarkdownEditor
                  key={selectedFile}
                  initialContent={fileContent}
                  filePath={selectedFile!}
                  onSave={handleSave}
                  viewMode={editorViewMode}
                />
              )}
            </div>

            {/* Status bar - matching Obsidian layout */}
            <div className="flex items-center justify-end">
              <div className="flex items-center" style={{ color: '#5c5c5c', gap: '28px', backgroundColor: '#f6f6f6', padding: '6px 13px', fontSize: '12.75px', borderTop: '1px solid #e0e0e0', borderLeft: '1px solid #e0e0e0', borderTopLeftRadius: '8px' }}>
                <div className="flex items-center gap-1">
                  <Link size={12} strokeWidth={1.5} style={{ marginRight: '3px' }} />
                  <span>0 backlinks</span>
                </div>
                <div className="flex items-center gap-1">
                  <Pencil size={12} strokeWidth={1.5} style={{ marginRight: '3px' }} />
                  <span>{getWordCount(fileContent)} {getWordCount(fileContent) === 1 ? 'word' : 'words'}</span>
                </div>
                <span>{getCharCount(fileContent)} {getCharCount(fileContent) === 1 ? 'character' : 'characters'}</span>
              </div>
            </div>
          </>
        ) : activeTagTab ? (
          <TagView
            tag={activeTagTab.tag}
            getContent={getTagContent}
            onDeleteTag={handleDeleteTag}
            onPublish={handlePublish}
            onUpdateContent={handleUpdateTagContent}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            goBack={goBack}
            goForward={goForward}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-xl bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8" style={{ color: '#999999' }} strokeWidth={1.5} />
              </div>
              <p className="text-[#5c5c5c] mb-1">Select a file to view</p>
              <p className="text-xs" style={{ color: '#999999' }}>
                Press <kbd className="px-1.5 py-0.5 bg-[#f5f5f5] rounded text-[#5c5c5c]">⌘P</kbd> to open command palette
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default App;
