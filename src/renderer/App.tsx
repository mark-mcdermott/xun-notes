import React from 'react';

const App: React.FC = () => {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Olite</h1>
        <p className="text-gray-600">Obsidian Lite - Your personal note-taking app</p>
        <p className="text-sm text-gray-500 mt-4">
          Electron + React + Vite setup complete!
        </p>
      </div>
    </div>
  );
};

export default App;
