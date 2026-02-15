import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Fix for ResizeObserver loop error in ResizeObserver
const originalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends originalResizeObserver {
  constructor(callback) {
    super((entries, observer) => {
      // Wrap the callback in requestAnimationFrame to avoid loop errors
      window.requestAnimationFrame(() => {
        if (!Array.isArray(entries) || !entries.length) {
          return;
        }
        callback(entries, observer);
      });
    });
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();