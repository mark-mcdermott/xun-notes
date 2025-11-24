import React, { useState, useEffect } from 'react';
import { useVault } from './hooks/useVault';
import { useTags } from './hooks/useTags';
import { FileTree } from './components/FileTree';
import { MarkdownEditor } from './components/MarkdownEditor';
import { TagBrowser } from './components/TagBrowser';
import { TagView } from './components/TagView';
import { DailyNotesNav } from './components/DailyNotesNav';
import { CommandPalette } from './components/CommandPalette';
import { Breadcrumb } from './components/Breadcrumb';
import { PublishDialog } from './components/PublishDialog';
import { PublishSettings } from './components/PublishSettings';

type SidebarTab = 'files' | 'tags' | 'daily';
type ViewMode = 'editor' | 'tag-view';

const App: React.FC = () => {
  const { vaultPath, fileTree, loading, error, readFile, writeFile, getTodayNote, getDailyNote, getDailyNoteDates, refreshFileTree } = useVault();
  const { tags, loading: tagsLoading, getTagContent, deleteTag, refreshTags } = useTags();

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dailyNoteDates, setDailyNoteDates] = useState<string[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishTag, setPublishTag] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load today's note on mount
  useEffect(() => {
    const loadTodayNote = async () => {
      try {
        const { path, content } = await getTodayNote();
        setSelectedFile(path);
        setFileContent(content);
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
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFileClick = async (path: string) => {
    try {
      const content = await readFile(path);
      setSelectedFile(path);
      setFileContent(content);
      setViewMode('editor');
      setSelectedTag(null);
    } catch (err: any) {
      console.error('Failed to read file:', err);
      alert(`Failed to read file: ${err.message}`);
    }
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag);
    setViewMode('tag-view');
    setSelectedFile(null);
  };

  const handleDateSelect = async (date: string) => {
    try {
      const { path, content } = await getDailyNote(date);
      setSelectedFile(path);
      setFileContent(content);
      setViewMode('editor');
      setSelectedTag(null);

      // Refresh daily note dates in case a new one was created
      const dates = await getDailyNoteDates();
      setDailyNoteDates(dates);
    } catch (err: any) {
      console.error('Failed to load daily note:', err);
      alert(`Failed to load daily note: ${err.message}`);
    }
  };

  const handleSave = async (content: string) => {
    if (!selectedFile) return;

    try {
      await writeFile(selectedFile, content);
      setFileContent(content);

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
    // TODO: Implement file creation dialog
    alert('File creation UI coming soon!');
  };

  const handleCreateFolder = () => {
    // TODO: Implement folder creation dialog
    alert('Folder creation UI coming soon!');
  };

  const handleDeleteTag = async (tag: string) => {
    try {
      const result = await deleteTag(tag);
      alert(`Successfully deleted tag ${tag}!\n\n${result.filesModified.length} files modified\n${result.sectionsDeleted} sections removed`);

      // Refresh file tree and tags
      await refreshFileTree();
      await refreshTags();

      // Return to tags view
      setSelectedTag(null);
      setViewMode('editor');
    } catch (err: any) {
      throw err; // Re-throw to be handled by TagView
    }
  };

  const handlePublish = (tag: string) => {
    setPublishTag(tag);
    setPublishDialogOpen(true);
  };

  if (loading && !fileTree) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-gray-600">Loading vault...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-2xl mb-2">❌</div>
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
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

      {/* Settings Dialog */}
      {settingsOpen && (
        <PublishSettings onClose={() => setSettingsOpen(false)} />
      )}

      {/* Header */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-gray-800">Olite</h1>
          {vaultPath && <span className="ml-4 text-xs text-gray-500">{vaultPath}</span>}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          title="Settings (Cmd+,)"
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {/* Sidebar tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setSidebarTab('daily')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                sidebarTab === 'daily'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setSidebarTab('files')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                sidebarTab === 'files'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setSidebarTab('tags')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                sidebarTab === 'tags'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Tags
            </button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'daily' ? (
              <DailyNotesNav
                onDateSelect={handleDateSelect}
                currentDate={selectedFile?.includes('daily-notes/') ? selectedFile.split('/').pop()?.replace('.md', '') : null}
                existingDates={dailyNoteDates}
              />
            ) : sidebarTab === 'files' ? (
              <FileTree tree={fileTree} onFileClick={handleFileClick} />
            ) : (
              <TagBrowser
                tags={tags}
                selectedTag={selectedTag}
                onTagClick={handleTagClick}
              />
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col">
          {viewMode === 'editor' && selectedFile ? (
            <>
              {/* File header with breadcrumb */}
              <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
                <Breadcrumb path={selectedFile} />
              </div>

              {/* Markdown Editor */}
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor
                  key={selectedFile}
                  initialContent={fileContent}
                  filePath={selectedFile}
                  onSave={handleSave}
                />
              </div>
            </>
          ) : viewMode === 'tag-view' && selectedTag ? (
            <TagView
              tag={selectedTag}
              getContent={getTagContent}
              onDeleteTag={handleDeleteTag}
              onPublish={handlePublish}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-4">📝</div>
                <p>Select a file to view its contents</p>
                <p className="text-sm mt-2">or</p>
                <p className="text-sm">Press Cmd+P to open the command palette</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
