import React, { useState, useEffect, useRef } from 'react';
import './Home.css';
import MonoEditor from '../Editor/MonoEditor';
import JsonGraph from '../Visualizer/JsonGraph';
import TreeView from '../Visualizer/TreeView';
import LogicShowcase from '../components/LogicShowcase/LogicShowcase';
import {
  loadCurrentDocument,
  saveCurrentDocument,
  loadRecentDocuments,
  addRecentDocument,
  removeRecentDocument,
  clearRecentDocuments,
} from '../utils/jsonPersistence';

const DEFAULT_JSON = `{
  "personal_info": {
    "name": "Joel Varghese",
    "title": "Backend Developer | ML Engineer",
    "location": "India",
    "contact": {
      "email": "joevar541@gmail.com"
    }
  },
  "profiles": {
    "linkedin": "https://www.linkedin.com/in/joel-eapen/",
    "github": "https://github.com/joevar5",
    "portfolio": ""
  },
  "experience": [
    {
      "company": "IBM"
    }
  ],
  "skills": {
    "programming_languages": [
      "Python",
      "Go"
    ],
    "ml_ai": [
      "Classical ML",
      "Generative AI"
    ]
  }
}`;

const Home = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showLogic, setShowLogic] = useState(false);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'tree'
  const [jsonCode, setJsonCode] = useState(() => loadCurrentDocument() || DEFAULT_JSON);
  const [recentDocuments, setRecentDocuments] = useState(() => loadRecentDocuments());
  const jsonGraphRef = useRef(null);

  // Auto-save the working document so a refresh never loses your work.
  useEffect(() => {
    const timeoutId = setTimeout(() => saveCurrentDocument(jsonCode), 500);
    return () => clearTimeout(timeoutId);
  }, [jsonCode]);

  // Snapshot into "recent documents" once editing has settled, so we don't
  // spam the history on every keystroke.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setRecentDocuments((prev) => addRecentDocument(prev, jsonCode));
    }, 5000);
    return () => clearTimeout(timeoutId);
  }, [jsonCode]);

  const handleLoadRecent = (content) => setJsonCode(content);
  const handleRemoveRecent = (id) => setRecentDocuments((prev) => removeRecentDocument(prev, id));
  const handleClearRecent = () => setRecentDocuments(clearRecentDocuments());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleRefresh = () => {
    // Clear search state when refreshing
    if (jsonGraphRef.current && jsonGraphRef.current.clearSearch) {
      jsonGraphRef.current.clearSearch();
    }

    // Force re-render of the visualization by updating the key
    setJsonCode(jsonCode + ' '); // Add a space
    setTimeout(() => {
      setJsonCode(jsonCode.trim()); // Remove the space
    }, 100);
  };

  const handleExportImage = async () => {
    try {
      if (!jsonGraphRef.current) {
        alert('Graph not ready for export');
        return;
      }

      const dataUrl = await jsonGraphRef.current.exportAsImage();

      // Convert data URL to blob to handle large images
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Ensure specific MIME type
      const imageBlob = new Blob([blob], { type: 'image/png' });
      const url = URL.createObjectURL(imageBlob);

      // Generate clean filename
      const date = new Date();
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeString = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const filename = `json-graph-${dateString}-${timeString}.png`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none'; // Ensure not visible
      document.body.appendChild(a);
      a.click();

      // Cleanup with slight delay to ensure browser captures the click
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export image. Please try again.');
    }
  };

  return (
    <div className={`home-container ${isMobile ? 'mobile' : 'desktop'}`}>
      <LogicShowcase isOpen={showLogic} onClose={() => setShowLogic(false)} />

      <div className="pane editor-pane">
        <MonoEditor
          value={jsonCode}
          onChange={setJsonCode}
          onExportImage={handleExportImage}
          onRefresh={handleRefresh}
          recentDocuments={recentDocuments}
          onLoadRecent={handleLoadRecent}
          onRemoveRecent={handleRemoveRecent}
          onClearRecent={handleClearRecent}
        />
      </div>

      <div className="pane graph-pane">
        <div className="view-mode-switcher">
          <button
            className={`view-mode-btn ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
          >
            Graph View
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            Tree View
          </button>
        </div>

        <div className="view-mode-content">
          {viewMode === 'graph' ? (
            <JsonGraph
              ref={jsonGraphRef}
              data={jsonCode}
              onShowLogic={() => setShowLogic(true)}
            />
          ) : (
            <TreeView data={jsonCode} />
          )}
        </div>

        {/* Author Attribution */}
        <div className="author-attribution">
          <span className="created-by">Created by</span>
          <a
            href="https://www.linkedin.com/in/joel-eapen/"
            target="_blank"
            rel="noopener noreferrer"
            className="author-link"
          >
            Joel Varghese
          </a>
        </div>
      </div>
    </div>
  );
}

export default Home;