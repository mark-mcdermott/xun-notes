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
import { VaultSelectionDialog } from './components/VaultSelectionDialog';
import logoLeftFacing from './assets/pink-and-gray-mech-left.png';

type SidebarTab = 'files' | 'tags' | 'daily';
type EditorViewMode = 'markdown' | 'editor' | 'split' | 'preview';
type Tab = { type: 'file'; path: string; content: string } | { type: 'tag'; tag: string };

const App: React.FC = () => {
  const { vaultPath, fileTree, loading, error, readFile, writeFile, createFile, createFolder, deleteFile, moveFile, renameFile, getTodayNote, getDailyNote, getDailyNoteDates, refreshFileTree } = useVault();
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
  const [inlineCreateFolder, setInlineCreateFolder] = useState<{ folderPath: string; type: 'file' | 'folder' } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [blogs, setBlogs] = useState<Array<{ id: string; name: string }>>([]);

  // Vault switcher state
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  const [allVaults, setAllVaults] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const vaultMenuRef = useRef<HTMLDivElement>(null);

  // Blog block publish progress state
  const [blogBlockPublishJobId, setBlogBlockPublishJobId] = useState<string | null>(null);
  const [blogBlockPublishStatus, setBlogBlockPublishStatus] = useState<'pending' | 'preparing' | 'pushing' | 'building' | 'deploying' | 'completed' | 'failed'>('pending');
  const [blogBlockPublishProgress, setBlogBlockPublishProgress] = useState(0);
  const [blogBlockPublishSteps, setBlogBlockPublishSteps] = useState<Array<{ name: string; status: 'pending' | 'in_progress' | 'completed' | 'failed'; message?: string }>>([]);
  const [blogBlockPublishError, setBlogBlockPublishError] = useState<string | null>(null);
  const [blogBlockPublishPostUrl, setBlogBlockPublishPostUrl] = useState<string | null>(null);
  const blogBlockPublishResolveRef = useRef<((result: { success: boolean; slug?: string }) => void) | null>(null);

  // Navigation history for back/forward
  type HistoryEntry = { type: 'file'; path: string } | { type: 'tag'; tag: string } | { type: 'settings' };
  const [navHistory, setNavHistory] = useState<HistoryEntry[]>([]);
  const [navHistoryIndex, setNavHistoryIndex] = useState(-1);
  const isNavigatingRef = useRef(false); // Prevent adding to history during back/forward

  // Vault selection state
  const [showVaultSelection, setShowVaultSelection] = useState(false);
  const [defaultVaultPath, setDefaultVaultPath] = useState<string>('');
  const [vaultInitialized, setVaultInitialized] = useState(false);

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

  // Check for first run and show vault selection
  useEffect(() => {
    const checkFirstRun = async () => {
      try {
        const [firstRunResult, defaultPathResult] = await Promise.all([
          window.electronAPI.vault.isFirstRun(),
          window.electronAPI.vault.getDefaultPath()
        ]);

        if (firstRunResult.success && firstRunResult.isFirstRun) {
          setDefaultVaultPath(defaultPathResult.path || '');
          setShowVaultSelection(true);
        } else {
          // Not first run, initialize normally
          setVaultInitialized(true);
        }
      } catch (err) {
        console.error('Failed to check first run:', err);
        setVaultInitialized(true);
      }
    };

    checkFirstRun();
  }, []);

  // Handle vault switch from Settings page (smooth SPA transition)
  const handleVaultSwitchFromSettings = useCallback(async () => {
    try {
      // Refresh file tree and tags
      await refreshFileTree();
      await refreshTags();

      // Refresh vaults list
      const vaultsResult = await window.electronAPI.vault.getAll();
      if (vaultsResult.success) {
        setAllVaults(vaultsResult.vaults || []);
        setActiveVaultId(vaultsResult.activeVaultId || null);
      }

      // Refresh blogs
      const blogsResult = await window.electronAPI.publish.getBlogs();
      if (blogsResult.success && blogsResult.blogs) {
        setBlogs(blogsResult.blogs);
      }

      // Refresh daily note dates
      const dates = await getDailyNoteDates();
      setDailyNoteDates(dates);

      // Close all tabs and open today's note for the new vault
      const { path, content } = await getTodayNote();
      setOpenTabs([{ type: 'file', path, content }]);
      setActiveTabIndex(0);

      // Reset navigation history
      setNavHistory([]);
      setNavHistoryIndex(-1);
    } catch (err) {
      console.error('Failed to refresh after vault switch:', err);
    }
  }, [refreshFileTree, refreshTags, getDailyNoteDates, getTodayNote]);

  // Handle vault selection
  const handleVaultSelect = async (path: string) => {
    try {
      await window.electronAPI.vault.initialize(path);
      setShowVaultSelection(false);
      setVaultInitialized(true);
      // Refresh file tree after initialization
      refreshFileTree();
    } catch (err) {
      console.error('Failed to initialize vault:', err);
    }
  };

  const handleVaultSkip = async () => {
    try {
      await window.electronAPI.vault.initialize();
      setShowVaultSelection(false);
      setVaultInitialized(true);
      refreshFileTree();
    } catch (err) {
      console.error('Failed to initialize vault:', err);
    }
  };

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

    if (vaultPath && vaultInitialized) {
      loadTodayNote();
    }
  }, [vaultPath, vaultInitialized, getTodayNote]);

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

  // Load vaults for vault switcher
  useEffect(() => {
    const loadVaults = async () => {
      try {
        const result = await window.electronAPI.vault.getAll();
        if (result.success) {
          setAllVaults(result.vaults || []);
          setActiveVaultId(result.activeVaultId || null);
        }
      } catch (err) {
        console.error('Failed to load vaults:', err);
      }
    };
    loadVaults();
  }, []);

  // Close vault menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vaultMenuRef.current && !vaultMenuRef.current.contains(event.target as Node)) {
        setVaultMenuOpen(false);
      }
    };
    if (vaultMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [vaultMenuOpen]);

  // Handle vault switch
  const handleVaultSwitch = async (vaultId: string) => {
    try {
      const result = await window.electronAPI.vault.switch(vaultId);
      if (result.success) {
        setActiveVaultId(vaultId);
        setVaultMenuOpen(false);
        // Reload the page to refresh all state with the new vault
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to switch vault:', err);
    }
  };

  // Initialize theme and listen for changes
  useEffect(() => {
    const initTheme = async () => {
      try {
        const { effectiveTheme } = await window.electronAPI.theme.get();
        document.documentElement.dataset.theme = effectiveTheme;
      } catch (err) {
        console.error('Failed to get theme:', err);
      }
    };

    initTheme();

    // Listen for theme changes from main process
    window.electronAPI.theme.onChange(({ effectiveTheme }) => {
      document.documentElement.dataset.theme = effectiveTheme;
    });

    return () => {
      window.electronAPI.theme.removeChangeListener();
    };
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
        if (data.postUrl) {
          setBlogBlockPublishPostUrl(data.postUrl);
        }
        // Resolve the promise when complete
        if (data.status === 'completed' || data.status === 'failed') {
          if (blogBlockPublishResolveRef.current) {
            blogBlockPublishResolveRef.current({
              success: data.status === 'completed',
              slug: data.slug
            });
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

      // Refresh file tree and daily note dates in case a new one was created
      await refreshFileTree();
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

      // Refresh file tree and daily note dates in case a new one was created
      await refreshFileTree();
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

  // Helper to find next available "Untitled" name
  const getNextUntitledName = (basePath: string): string => {
    const existingNames = new Set<string>();

    // Collect existing file names from file tree
    const collectNames = (node: typeof fileTree) => {
      if (!node) return;
      if (node.type === 'file') {
        existingNames.add(node.name.replace('.md', ''));
      }
      node.children?.forEach(collectNames);
    };
    collectNames(fileTree);

    // Also check open tabs
    openTabs.forEach(tab => {
      if (tab.type === 'file') {
        const name = tab.path.split('/').pop()?.replace('.md', '') || '';
        existingNames.add(name);
      }
    });

    // Find next available name
    if (!existingNames.has('Untitled')) {
      return 'Untitled';
    }
    let counter = 2;
    while (existingNames.has(`Untitled ${counter}`)) {
      counter++;
    }
    return `Untitled ${counter}`;
  };

  // Helper to find next available "Untitled" folder name
  const getNextUntitledFolderName = (basePath: string): string => {
    const existingNames = new Set<string>();

    // Collect existing folder names from file tree
    const collectNames = (node: typeof fileTree) => {
      if (!node) return;
      if (node.type === 'folder') {
        existingNames.add(node.name);
      }
      node.children?.forEach(collectNames);
    };
    collectNames(fileTree);

    // Find next available name
    if (!existingNames.has('Untitled')) {
      return 'Untitled';
    }
    let counter = 2;
    while (existingNames.has(`Untitled ${counter}`)) {
      counter++;
    }
    return `Untitled ${counter}`;
  };

  const handleCreateFile = async () => {
    setSidebarTab('files');
    const name = getNextUntitledName('');
    const path = `${name}.md`;
    const initialContent = `# ${name}\n\n`;

    try {
      await createFile(path, initialContent);
      setOpenTabs(prev => [...prev, { type: 'file', path, content: initialContent }]);
      setActiveTabIndex(openTabs.length);
      setShowSettings(false);
    } catch (err: any) {
      console.error('Failed to create file:', err);
    }
  };

  const handleCreateFolder = async () => {
    setSidebarTab('files');
    // Immediately create an Untitled folder like we do with files
    const name = getNextUntitledFolderName('');
    const path = name;
    try {
      await createFolder(path);
    } catch (err: any) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleInlineCreate = async (name: string, type: 'file' | 'folder') => {
    try {
      if (type === 'file') {
        const path = name;
        const initialContent = `# ${name.replace('.md', '')}\n\n`;
        await createFile(path, initialContent);

        // Open the new file in a tab
        setOpenTabs(prev => [...prev, { type: 'file', path, content: initialContent }]);
        setActiveTabIndex(openTabs.length);
        setShowSettings(false);
      } else {
        const path = name;
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

  // Handle moving file via drag-and-drop
  const handleMoveFile = async (sourcePath: string, destFolder: string) => {
    try {
      const newPath = await moveFile(sourcePath, destFolder);

      // Update any open tab that has this file
      setOpenTabs(prev => prev.map(tab => {
        if (tab.type === 'file' && tab.path === sourcePath) {
          return { ...tab, path: newPath };
        }
        return tab;
      }));
    } catch (err: any) {
      console.error('Failed to move file:', err);
    }
  };

  // Handle renaming file or folder
  const handleRenameFile = async (oldPath: string, newName: string): Promise<string | null> => {
    try {
      // Check if this is a file (has .md extension)
      const isFile = newName.endsWith('.md');

      const newPath = await renameFile(oldPath, newName);

      // If it's a file, update the title in the document
      if (isFile) {
        const newTitle = newName.replace('.md', '');

        // Check if file is open in a tab
        const openTab = openTabs.find(tab => tab.type === 'file' && tab.path === oldPath);

        if (openTab && openTab.type === 'file') {
          // Update the # Title line in the content
          const updatedContent = openTab.content.replace(/^# .+$/m, `# ${newTitle}`);

          // Write the updated content to the file
          await writeFile(newPath, updatedContent);

          // Update the tab with new path and content
          setOpenTabs(prev => prev.map(tab => {
            if (tab.type === 'file' && tab.path === oldPath) {
              return { ...tab, path: newPath, content: updatedContent };
            }
            return tab;
          }));
        } else {
          // File not open, read it, update title, and write back
          try {
            const content = await readFile(newPath);
            const updatedContent = content.replace(/^# .+$/m, `# ${newTitle}`);
            await writeFile(newPath, updatedContent);
          } catch (err) {
            // File might not have a title line, that's ok
            console.log('Could not update title in file:', err);
          }
        }
      } else {
        // It's a folder, just update any open tabs with paths inside this folder
        setOpenTabs(prev => prev.map(tab => {
          if (tab.type === 'file' && tab.path.startsWith(oldPath + '/')) {
            const relativePath = tab.path.substring(oldPath.length);
            return { ...tab, path: newPath + relativePath };
          }
          return tab;
        }));
      }

      return newPath;
    } catch (err: any) {
      console.error('Failed to rename file:', err);
      return null;
    }
  };

  // Handle context menu "New Note" or "New Folder" in a specific folder
  const handleCreateInFolder = async (folderPath: string, type: 'file' | 'folder') => {
    if (type === 'file') {
      // Immediately create an Untitled file like Obsidian
      const name = getNextUntitledName(folderPath);
      const path = `${folderPath}/${name}.md`;
      const initialContent = `# ${name}\n\n`;

      try {
        await createFile(path, initialContent);
        setOpenTabs(prev => [...prev, { type: 'file', path, content: initialContent }]);
        setActiveTabIndex(openTabs.length);
        setShowSettings(false);
      } catch (err: any) {
        console.error('Failed to create file:', err);
      }
    } else {
      // Immediately create an Untitled folder like we do with files
      const name = getNextUntitledFolderName(folderPath);
      const path = `${folderPath}/${name}`;
      try {
        await createFolder(path);
      } catch (err: any) {
        console.error('Failed to create folder:', err);
      }
    }
  };

  // Handle inline create within a folder (now only used for folders)
  const handleInlineCreateInFolder = async (name: string, folderPath: string, type: 'file' | 'folder') => {
    try {
      if (type === 'file') {
        const path = `${folderPath}/${name}`;
        const initialContent = `# ${name.replace('.md', '')}\n\n`;
        await createFile(path, initialContent);

        // Open the new file in a tab
        setOpenTabs(prev => [...prev, { type: 'file', path, content: initialContent }]);
        setActiveTabIndex(openTabs.length);
        setShowSettings(false);
      } else {
        const path = `${folderPath}/${name}`;
        await createFolder(path);
      }
    } catch (err: any) {
      console.error('Failed to create in folder:', err);
    } finally {
      setInlineCreateFolder(null);
    }
  };

  const handleInlineCreateInFolderCancel = () => {
    setInlineCreateFolder(null);
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
  const handlePublishBlogBlock = async (blogId: string, content: string): Promise<{ success: boolean; slug?: string }> => {
    try {
      // Reset state
      setBlogBlockPublishStatus('pending');
      setBlogBlockPublishProgress(0);
      setBlogBlockPublishSteps([]);
      setBlogBlockPublishError(null);

      const result = await window.electronAPI.publish.toBlogDirect(blogId, content);

      if (result.success && result.jobId) {
        // Create a promise that will resolve when the job completes
        const completionPromise = new Promise<{ success: boolean; slug?: string }>((resolve) => {
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
        return { success: false };
      }
    } catch (err: any) {
      setBlogBlockPublishError(err.message || 'Failed to publish');
      setBlogBlockPublishStatus('failed');
      setBlogBlockPublishJobId('error'); // Show popup with error
      return { success: false };
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
    setBlogBlockPublishPostUrl(null);
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

  // Show vault selection dialog on first run
  if (showVaultSelection) {
    return (
      <VaultSelectionDialog
        defaultPath={defaultVaultPath}
        onSelect={handleVaultSelect}
        onSkip={handleVaultSkip}
      />
    );
  }

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
          postUrl={blogBlockPublishPostUrl}
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
      <div className="h-[45px] flex items-center" style={{ backgroundColor: 'var(--tab-bar-bg)', borderBottom: '1px solid var(--border-primary)' }}>
        {/* Left section - same width as both sidebars (44px + 1px border + sidebarWidth, or just auto when collapsed) */}
        <div className="h-full flex items-center" style={{ width: sidebarCollapsed ? 'auto' : `${44 + 1 + sidebarWidth}px`, borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border-primary)', WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {/* macOS traffic light space */}
          <div className="w-[70px] h-full" />

          {/* Collapse sidebar button */}
          <div className="flex items-center justify-end h-full flex-1">
            <button className="h-full px-3 hover:bg-[var(--sidebar-hover)] hover:opacity-60 transition-all cursor-pointer" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent', marginLeft: sidebarCollapsed ? '10px' : '0', WebkitAppRegion: 'no-drag' } as React.CSSProperties} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
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
                      backgroundColor: isActive ? 'var(--tab-active-bg)' : 'var(--tab-inactive-bg)',
                      border: '1px solid var(--border-primary)',
                      borderBottom: isActive ? '1px solid var(--tab-active-bg)' : 'none',
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
                    <span className="truncate hover:opacity-60 transition-all" style={{ fontSize: '13.5px', color: isActive ? 'var(--tab-active-text)' : 'var(--tab-inactive-text)' }}>{tabLabel}</span>
                    <button
                      className="p-0.5 rounded transition-all flex items-center justify-center hover:bg-[var(--tab-close-hover)] hover:opacity-60"
                      style={{ color: isActive ? 'var(--tab-active-text)' : 'var(--tab-inactive-text)', backgroundColor: 'transparent' }}
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
                    backgroundColor: 'var(--tab-active-bg)',
                    border: '1px solid var(--border-primary)',
                    borderBottom: '1px solid var(--tab-active-bg)',
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
                  <span className="flex items-center gap-2 hover:opacity-60 transition-all" style={{ fontSize: '13.5px', color: 'var(--tab-active-text)' }}>
                    <Settings size={14} strokeWidth={1.5} style={{ marginRight: '5px' }} />
                    Settings
                  </span>
                  <button
                    className="p-0.5 rounded transition-all flex items-center justify-center hover:bg-[var(--tab-close-hover)] hover:opacity-60"
                    style={{ color: 'var(--tab-active-text)', backgroundColor: 'transparent' }}
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
                className="h-full transition-all flex items-center justify-center hover:bg-[var(--sidebar-hover)] hover:opacity-60"
                style={{ color: 'var(--tab-inactive-text)', backgroundColor: 'transparent', paddingLeft: '12px', paddingRight: '8px' }}
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
          <img src={logoLeftFacing} alt="Xun" style={{ height: '40px', width: 'auto', marginRight: '12px', marginTop: '1px' }} />
        </div>
      </div>

      {/* Main area below top bar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Far-left Icon Sidebar */}
        <div className="w-[46px] min-w-[46px] flex-shrink-0 flex flex-col items-center" style={{ backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-primary)', paddingTop: '16px' }}>
          {/* Top icons */}
          {/* <button className="p-2 hover:bg-[var(--sidebar-hover)] rounded transition-colors" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent', marginBottom: '8px' }} title="Daily Notes" onClick={() => setSidebarTab('daily')}>
            <Calendar size={20} strokeWidth={1.5} />
          </button> */}
          <button className="p-2 hover:bg-[var(--sidebar-hover)] hover:opacity-60 rounded transition-all" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent' }} title="Today's Note" onClick={handleOpenTodayNote}>
            <FileText size={20} strokeWidth={1.5} />
          </button>
          <hr style={{ width: '24px', border: 'none', borderTop: '1px solid var(--border-primary)' }} />
          <button className="p-2 hover:bg-[var(--sidebar-hover)] hover:opacity-60 rounded transition-all" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent', marginBottom: '8px' }} title="File Tree" onClick={() => setSidebarTab('files')}>
            <FolderTree size={20} strokeWidth={1.5} />
          </button>
          <button className="p-2 hover:bg-[var(--sidebar-hover)] hover:opacity-60 rounded transition-all" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent' }} title="Tags" onClick={() => setSidebarTab('tags')}>
            <Code size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Left Sidebar - File tree with toolbar */}
        {!sidebarCollapsed && (
        <div className="flex flex-col relative" style={{ width: `${sidebarWidth + 1}px`, backgroundColor: 'var(--sidebar-bg)', paddingTop: '16px' }}>
          {/* Resize handle */}
          <div
            className="absolute inset-y-0 cursor-col-resize hover:bg-blue-400/50 transition-colors"
            style={{ right: 0, width: '4px', top: 0, bottom: 0, backgroundColor: isResizing ? 'var(--resize-handle)' : 'transparent', borderRight: '1px solid var(--border-primary)' }}
            onMouseDown={handleResizeStart}
          />
          {/* Sidebar toolbar */}
          <div className="h-9 flex items-center" style={{ backgroundColor: 'transparent', marginBottom: '16px', paddingLeft: '20px' }}>
            <div className="flex items-center gap-0.5">
              <button className="p-1.5 hover:bg-[var(--sidebar-hover)] hover:opacity-60 rounded transition-all" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent' }} title="New note" onClick={handleCreateFile}>
                <FilePlus size={20} strokeWidth={1.5} />
              </button>
              <button className="p-1.5 hover:bg-[var(--sidebar-hover)] hover:opacity-60 rounded transition-all" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent' }} title="New folder" onClick={handleCreateFolder}>
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
                onMoveFile={handleMoveFile}
                onRename={handleRenameFile}
                inlineCreateType={inlineCreateType}
                onInlineCreate={handleInlineCreate}
                onInlineCancel={handleInlineCancel}
                inlineCreateFolder={inlineCreateFolder}
                onInlineCreateInFolder={handleInlineCreateInFolder}
                onInlineCreateInFolderCancel={handleInlineCreateInFolderCancel}
                onCreateInFolder={handleCreateInFolder}
                onSidebarContextMenu={async () => {
                  const result = await window.electronAPI.contextMenu.showSidebarMenu();
                  if (result) {
                    switch (result.action) {
                      case 'new-note':
                        handleCreateFile();
                        break;
                      case 'new-folder':
                        handleCreateFolder();
                        break;
                    }
                  }
                }}
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
          <div className="px-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '10px', paddingBottom: '10px' }}>
            <div ref={vaultMenuRef} className="relative">
              <button
                className="flex items-center px-2 py-1.5 hover:bg-[var(--sidebar-hover)] hover:opacity-60 rounded text-xs transition-all"
                style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent', outline: 'none' }}
                onClick={() => setVaultMenuOpen(!vaultMenuOpen)}
              >
                <div className="flex flex-col items-center" style={{ marginRight: '6px', marginLeft: '8px' }}>
                  <ChevronUp size={12} strokeWidth={2} className="mb-[-4px]" />
                  <ChevronDown size={12} strokeWidth={2} />
                </div>
                <span className="truncate text-left" style={{ fontWeight: 600 }}>{getVaultName()}</span>
              </button>
              {/* Vault switcher dropdown */}
              {vaultMenuOpen && allVaults.length > 0 && (
                <div
                  className="absolute left-0 z-50"
                  style={{
                    bottom: '100%',
                    marginBottom: '4px',
                    backgroundColor: 'var(--dialog-bg)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    padding: '4px',
                    minWidth: '200px'
                  }}
                >
                  {[...allVaults].sort((a, b) => a.name.localeCompare(b.name)).map((vault) => (
                    <button
                      key={vault.id}
                      className="w-full text-left flex items-center justify-between cursor-pointer transition-colors"
                      style={{
                        backgroundColor: vault.id === activeVaultId ? 'var(--sidebar-hover)' : 'transparent',
                        padding: '8px 12px',
                        margin: '2px 0',
                        borderRadius: '6px',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = vault.id === activeVaultId ? 'var(--sidebar-hover)' : 'transparent'}
                      onClick={() => handleVaultSwitch(vault.id)}
                    >
                      <span className="flex items-center" style={{ flex: 1 }}>
                        <span
                          className="truncate"
                          style={{
                            color: 'var(--accent-primary)',
                            fontWeight: 500
                          }}
                        >
                          {vault.name}
                        </span>
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
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginLeft: '8px'
                        }}
                      >
                        vault
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* <button className="p-1.5 hover:bg-[var(--sidebar-hover)] rounded transition-colors" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent' }} title="Help">
                <HelpCircle size={16} strokeWidth={1.5} />
              </button> */}
              <button className="p-1.5 hover:bg-[var(--sidebar-hover)] hover:opacity-60 rounded transition-all" style={{ color: 'var(--sidebar-icon)', backgroundColor: 'transparent', marginRight: '8px', outline: 'none' }} title="Settings" onClick={() => setShowSettings(true)}>
                <Settings size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>

        {showSettings ? (
          <SettingsPage vaultPath={vaultPath} onVaultSwitch={handleVaultSwitchFromSettings} />
        ) : activeFileTab ? (
          <>
            {/* Navigation bar with breadcrumb */}
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

              {/* Center - breadcrumbs */}
              <div className="absolute left-1/2 transform -translate-x-1/2">
                <Breadcrumb path={selectedFile!} />
              </div>

              {/* Right side - view mode icon (hidden - editor mode is now the only option)
              <div className="flex items-center gap-1 ml-auto">
                <button
                  className="p-1 rounded transition-all hover:opacity-60"
                  style={{ color: 'var(--text-icon)', backgroundColor: 'transparent', marginTop: '6px' }}
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
                <button className="p-1 rounded transition-colors" style={{ color: 'var(--text-icon)', backgroundColor: 'transparent' }} title="More options">
                  <MoreHorizontal size={18} strokeWidth={1.5} />
                </button>
              </div>
              */}
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
              <div className="flex items-center" style={{ color: 'var(--status-bar-text)', gap: '28px', backgroundColor: 'var(--status-bar-bg)', padding: '6px 13px', fontSize: '12.75px', borderTop: '1px solid var(--border-primary)', borderLeft: '1px solid var(--border-primary)', borderTopLeftRadius: '8px' }}>
                {/* Backlinks - commented out for now
                <div className="flex items-center gap-1">
                  <Link size={12} strokeWidth={1.5} style={{ marginRight: '3px' }} />
                  <span>0 backlinks</span>
                </div>
                */}
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
              <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <FileText className="w-8 h-8" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
              </div>
              <p style={{ color: 'var(--text-secondary)' }} className="mb-1">Select a file to view</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Press <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>⌘P</kbd> to open command palette
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
