import React, { useState, useEffect, useRef } from 'react';
import './Home.css';
import MonoEditor from '../Editor/MonoEditor';
import JsonGraph from '../Visualizer/JsonGraph';

const Home = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [jsonCode, setJsonCode] = useState(`{
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
}`);
  const jsonGraphRef = useRef(null);

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
      <div className="pane editor-pane">
        <MonoEditor
          value={jsonCode}
          onChange={setJsonCode}
          onExportImage={handleExportImage}
          onRefresh={handleRefresh}
        />
      </div>

      <div className="pane graph-pane">
        <JsonGraph data={jsonCode} ref={jsonGraphRef} />

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