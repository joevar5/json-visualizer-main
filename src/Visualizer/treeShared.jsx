import React, { useState, useCallback } from 'react';

const URL_REGEX = /^https?:\/\/\S+$/i;

export const getType = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

export const isExpandable = (value) => {
  const type = getType(value);
  return type === 'object' || type === 'array';
};

export const childCount = (value) => {
  return Array.isArray(value) ? value.length : Object.keys(value).length;
};

export const matchesQuery = (key, value, query) => {
  if (!query) return false;
  const q = query.toLowerCase();
  if (String(key).toLowerCase().includes(q)) return true;
  if (!isExpandable(value)) {
    return String(value).toLowerCase().includes(q);
  }
  return false;
};

// An array is a good fit for the table view when most of its items are
// plain objects (rows), rather than a mix of primitives/nested arrays.
export const isTableCandidate = (value) => {
  if (!Array.isArray(value) || value.length === 0) return false;
  const objectCount = value.filter(
    (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  ).length;
  return objectCount / value.length > 0.5;
};

// Converts our internal dot/index path ("root.experience.0.company") into a
// JS-style access path ("experience[0].company") suitable for copy/paste.
export const toDisplayPath = (rawPath) => {
  const parts = rawPath.split('.').slice(1); // drop the leading "root"
  if (parts.length === 0) return '$';
  let out = '';
  parts.forEach((part) => {
    if (/^\d+$/.test(part)) {
      out += `[${part}]`;
    } else {
      out += (out ? '.' : '') + part;
    }
  });
  return out;
};

export const HighlightText = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  const before = String(text).slice(0, idx);
  const match = String(text).slice(idx, idx + query.length);
  const after = String(text).slice(idx + query.length);
  return (
    <>
      {before}
      <mark className="tv-highlight">{match}</mark>
      {after}
    </>
  );
};

export const ValueRenderer = ({ value, query }) => {
  const type = getType(value);

  if (type === 'string') {
    if (value === '') {
      return <span className="tv-placeholder">value</span>;
    }
    if (URL_REGEX.test(value)) {
      return (
        <a
          className="tv-link"
          href={value}
          target="_blank"
          rel="noopener noreferrer"
        >
          <HighlightText text={value} query={query} />
        </a>
      );
    }
    return <span className="tv-value tv-string">"<HighlightText text={value} query={query} />"</span>;
  }

  if (type === 'number') return <span className="tv-value tv-number">{String(value)}</span>;
  if (type === 'boolean') return <span className="tv-value tv-boolean">{String(value)}</span>;
  if (type === 'null') return <span className="tv-value tv-null">null</span>;

  return null;
};

export const CopyPathButton = ({ path }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    const displayPath = toDisplayPath(path);
    try {
      await navigator.clipboard.writeText(displayPath);
    } catch (err) {
      // Clipboard API unavailable (e.g. insecure context) - fail silently.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [path]);

  return (
    <button
      className={`tv-copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy path: ${toDisplayPath(path)}`}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
};
