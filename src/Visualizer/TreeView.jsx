import React, { useState, useMemo, useCallback } from 'react';
import ArrayTable from './ArrayTable';
import {
  isExpandable,
  childCount,
  matchesQuery,
  isTableCandidate,
  HighlightText,
  ValueRenderer,
  CopyPathButton,
} from './treeShared';
import './TreeView.css';

// [Tree] Pre-order DFS to find every path (object/array) that contains a match,
// so ancestors of a matching node can be force-expanded during search.
const collectMatchAncestors = (key, value, query, path, acc) => {
  let selfOrDescendantMatch = matchesQuery(key, value, query);

  if (isExpandable(value)) {
    const entries = Array.isArray(value)
      ? value.map((v, i) => [i, v])
      : Object.entries(value);

    entries.forEach(([childKey, childValue]) => {
      const childPath = `${path}.${childKey}`;
      const childMatched = collectMatchAncestors(childKey, childValue, query, childPath, acc);
      selfOrDescendantMatch = selfOrDescendantMatch || childMatched;
    });
  }

  if (selfOrDescendantMatch) {
    acc.add(path);
  }
  return selfOrDescendantMatch;
};

const CHILDREN_PAGE_SIZE = 200;

// Renders `entries` windowed to CHILDREN_PAGE_SIZE at a time with a "Load
// more" button, so expanding a huge array/object doesn't dump thousands of
// DOM nodes into the tree at once. While a search query is active we skip
// windowing - the per-node `visible` check already filters most of the list
// down to just matches and their ancestors, so the effective render count
// stays small anyway, and windowing would risk hiding a match past the page.
const TreeChildren = ({ entries, query, renderEntry }) => {
  const [visibleCount, setVisibleCount] = useState(CHILDREN_PAGE_SIZE);

  React.useEffect(() => {
    setVisibleCount(CHILDREN_PAGE_SIZE);
  }, [entries]);

  const windowed = query ? entries : entries.slice(0, visibleCount);
  const remaining = entries.length - windowed.length;

  return (
    <>
      {windowed.map(renderEntry)}
      {remaining > 0 && (
        <button
          className="tv-load-more"
          onClick={() => setVisibleCount((c) => c + CHILDREN_PAGE_SIZE)}
        >
          Load {Math.min(CHILDREN_PAGE_SIZE, remaining)} more ({remaining} remaining)
        </button>
      )}
    </>
  );
};

const TreeNode = ({
  nodeKey,
  value,
  path,
  depth,
  collapsedPaths,
  onToggle,
  onHoverPath,
  query,
  sortKeys,
  forceExpandPaths,
  tableModePaths,
  onToggleTableMode,
}) => {
  const expandable = isExpandable(value);
  const isCollapsed = collapsedPaths.has(path) && !(query && forceExpandPaths.has(path));
  const isTableMode = tableModePaths.has(path) && isTableCandidate(value);

  const entries = useMemo(() => {
    if (!expandable) return [];
    const raw = Array.isArray(value)
      ? value.map((v, i) => [i, v])
      : Object.entries(value);
    if (sortKeys && !Array.isArray(value)) {
      return [...raw].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    }
    return raw;
  }, [value, expandable, sortKeys]);

  const visible = useMemo(() => {
    if (!query) return true;
    if (matchesQuery(nodeKey, value, query)) return true;
    return expandable && forceExpandPaths.has(path);
  }, [query, nodeKey, value, expandable, forceExpandPaths, path]);

  if (!visible) return null;

  const count = expandable ? childCount(value) : null;
  const bracket = Array.isArray(value) ? `[${count}]` : `{${count}}`;

  return (
    <div className="tv-node" style={{ '--depth': depth }}>
      <div
        className="tv-row"
        onMouseEnter={() => onHoverPath(path)}
      >
        {expandable ? (
          <button
            className="tv-toggle"
            onClick={() => onToggle(path)}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="tv-toggle-spacer" />
        )}

        <span className="tv-key">
          <HighlightText text={nodeKey} query={query} />
        </span>
        <span className="tv-colon">:</span>

        <span className="tv-row-value" title={typeof value === 'string' ? value : undefined}>
          {expandable ? (
            <span className="tv-count">{bracket}</span>
          ) : (
            <ValueRenderer value={value} query={query} />
          )}
        </span>

        <span className="tv-row-actions">
          {isTableCandidate(value) && (
            <button
              className={`tv-table-toggle-btn ${isTableMode ? 'active' : ''}`}
              title={isTableMode ? 'Switch to tree view' : 'Switch to table view'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleTableMode(path);
              }}
            >
              {isTableMode ? 'Tree' : 'Table'}
            </button>
          )}
          <CopyPathButton path={path} />
        </span>
      </div>

      {expandable && !isCollapsed && (
        isTableMode ? (
          <ArrayTable
            data={value}
            basePath={path}
            query={query}
            onHoverPath={onHoverPath}
          />
        ) : (
          <div className="tv-children">
            <TreeChildren
              entries={entries}
              query={query}
              renderEntry={([childKey, childValue]) => (
                <TreeNode
                  key={childKey}
                  nodeKey={childKey}
                  value={childValue}
                  path={`${path}.${childKey}`}
                  depth={depth + 1}
                  collapsedPaths={collapsedPaths}
                  onToggle={onToggle}
                  onHoverPath={onHoverPath}
                  query={query}
                  sortKeys={sortKeys}
                  forceExpandPaths={forceExpandPaths}
                  tableModePaths={tableModePaths}
                  onToggleTableMode={onToggleTableMode}
                />
              )}
            />
          </div>
        )
      )}
    </div>
  );
};

const TreeView = ({ data }) => {
  const [collapsedPaths, setCollapsedPaths] = useState(() => new Set());
  const [hoverPath, setHoverPath] = useState('root');
  const [query, setQuery] = useState('');
  const [sortKeys, setSortKeys] = useState(false);
  const [tableModePaths, setTableModePaths] = useState(() => new Set());

  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(data), error: null };
    } catch (e) {
      return { value: null, error: e.message };
    }
  }, [data]);

  const forceExpandPaths = useMemo(() => {
    const acc = new Set();
    if (query && parsed.value !== null) {
      collectMatchAncestors('root', parsed.value, query, 'root', acc);
    }
    return acc;
  }, [query, parsed.value]);

  const matchCount = useMemo(() => {
    if (!query) return 0;
    let count = 0;
    const walk = (key, value) => {
      if (matchesQuery(key, value, query)) count += 1;
      if (isExpandable(value)) {
        const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
        entries.forEach(([k, v]) => walk(k, v));
      }
    };
    walk('root', parsed.value);
    return count;
  }, [query, parsed.value]);

  const handleToggle = useCallback((path) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleToggleTableMode = useCallback((path) => {
    setTableModePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => setCollapsedPaths(new Set()), []);

  const handleCollapseAll = useCallback(() => {
    if (parsed.value === null) return;
    const acc = new Set();
    const walk = (key, value, path) => {
      if (isExpandable(value)) {
        acc.add(path);
        const entries = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
        entries.forEach(([k, v]) => walk(k, v, `${path}.${k}`));
      }
    };
    walk('root', parsed.value, 'root');
    setCollapsedPaths(acc);
  }, [parsed.value]);

  const breadcrumb = hoverPath.split('.');

  if (parsed.error) {
    return (
      <div className="tree-view tree-view-error">
        Invalid JSON: {parsed.error}
      </div>
    );
  }

  const rootCount = isExpandable(parsed.value) ? childCount(parsed.value) : null;
  const rootBracket = Array.isArray(parsed.value) ? `[${rootCount}]` : `{${rootCount}}`;
  const rootIsTableMode = tableModePaths.has('root') && isTableCandidate(parsed.value);

  return (
    <div className="tree-view">
      <div className="tv-toolbar">
        <div className="tv-toolbar-actions">
          <button
            className={`tv-icon-btn ${sortKeys ? 'active' : ''}`}
            title="Sort keys alphabetically"
            onClick={() => setSortKeys((s) => !s)}
          >
            <span className="tv-icon-glyph">⇅</span>
            <span className="tv-icon-label">Sort</span>
          </button>
          <button className="tv-icon-btn" title="Expand all nodes" onClick={handleExpandAll}>
            <span className="tv-icon-glyph">⊞</span>
            <span className="tv-icon-label">Expand all</span>
          </button>
          <button className="tv-icon-btn" title="Collapse all nodes" onClick={handleCollapseAll}>
            <span className="tv-icon-glyph">⊟</span>
            <span className="tv-icon-label">Collapse all</span>
          </button>
        </div>

        <div className="tv-toolbar-search">
          <input
            type="text"
            placeholder="Search keys or values..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="tv-search-input"
          />
          {query && (
            <span className="tv-match-count">{matchCount} match{matchCount === 1 ? '' : 'es'}</span>
          )}
        </div>
      </div>

      <div className="tv-breadcrumb">
        {breadcrumb.map((segment, i) => (
          <React.Fragment key={i}>
            <span className="tv-breadcrumb-segment">{segment}</span>
            {i < breadcrumb.length - 1 && <span className="tv-breadcrumb-sep">▸</span>}
          </React.Fragment>
        ))}
        <span className="tv-breadcrumb-sep">▸</span>
      </div>

      <div className="tv-body" onMouseLeave={() => setHoverPath('root')}>
        <div className="tv-node" style={{ '--depth': 0 }}>
          <div className="tv-row" onMouseEnter={() => setHoverPath('root')}>
            <button
              className="tv-toggle"
              onClick={() => handleToggle('root')}
              aria-label={collapsedPaths.has('root') ? 'Expand' : 'Collapse'}
            >
              {collapsedPaths.has('root') ? '▶' : '▼'}
            </button>
            <span className="tv-key">root</span>
            <span className="tv-colon">:</span>
            <span className="tv-row-value">
              <span className="tv-count">{rootBracket}</span>
            </span>

            <span className="tv-row-actions">
              {isTableCandidate(parsed.value) && (
                <button
                  className={`tv-table-toggle-btn ${rootIsTableMode ? 'active' : ''}`}
                  title={rootIsTableMode ? 'Switch to tree view' : 'Switch to table view'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleTableMode('root');
                  }}
                >
                  {rootIsTableMode ? 'Tree' : 'Table'}
                </button>
              )}
              <CopyPathButton path="root" />
            </span>
          </div>

          {!collapsedPaths.has('root') && isExpandable(parsed.value) && (
            rootIsTableMode ? (
              <ArrayTable
                data={parsed.value}
                basePath="root"
                query={query}
                onHoverPath={setHoverPath}
              />
            ) : (
              <div className="tv-children">
                <TreeChildren
                  entries={
                    Array.isArray(parsed.value)
                      ? parsed.value.map((v, i) => [i, v])
                      : sortKeys
                        ? Object.entries(parsed.value).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
                        : Object.entries(parsed.value)
                  }
                  query={query}
                  renderEntry={([key, value]) => (
                    <TreeNode
                      key={key}
                      nodeKey={key}
                      value={value}
                      path={`root.${key}`}
                      depth={1}
                      collapsedPaths={collapsedPaths}
                      onToggle={handleToggle}
                      onHoverPath={setHoverPath}
                      query={query}
                      sortKeys={sortKeys}
                      forceExpandPaths={forceExpandPaths}
                      tableModePaths={tableModePaths}
                      onToggleTableMode={handleToggleTableMode}
                    />
                  )}
                />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default TreeView;
