import React, { useMemo, useState, useCallback } from 'react';
import { ValueRenderer, isExpandable, childCount, matchesQuery, CopyPathButton } from './treeShared';
import './ArrayTable.css';

const PAGE_SIZE = 100;
const MAX_SCANNED_FOR_COLUMNS = 1000;

const getColumns = (rows) => {
  const seen = new Set();
  const columns = [];
  rows.slice(0, MAX_SCANNED_FOR_COLUMNS).forEach((item) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item).forEach((key) => {
        if (!seen.has(key)) {
          seen.add(key);
          columns.push(key);
        }
      });
    }
  });
  return columns;
};

const compareCellValues = (a, b) => {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
};

const rowMatchesQuery = (row, columns, query) => {
  if (!query) return false;
  return columns.some((col) => matchesQuery(col, row[col], query));
};

const Cell = ({ value, query }) => {
  if (value === undefined) return <span className="at-cell-empty">—</span>;
  if (isExpandable(value)) {
    const count = childCount(value);
    const bracket = Array.isArray(value) ? `[${count}]` : `{${count}}`;
    return <span className="at-cell-badge" title={JSON.stringify(value)}>{bracket}</span>;
  }
  return <ValueRenderer value={value} query={query} />;
};

const ArrayTable = ({ data, basePath, query, onHoverPath }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const columns = useMemo(() => getColumns(data), [data]);

  const indexedRows = useMemo(
    () => data.map((item, index) => ({ item, index })),
    [data]
  );

  const filteredRows = useMemo(() => {
    if (!query) return indexedRows;
    return indexedRows.filter(({ item, index }) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return matchesQuery(index, item, query);
      }
      return rowMatchesQuery(item, columns, query);
    });
  }, [indexedRows, query, columns]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    const withKey = filteredRows.map((row) => ({
      ...row,
      sortValue: row.item && typeof row.item === 'object' ? row.item[sortColumn] : undefined,
    }));
    withKey.sort((a, b) => {
      const cmp = compareCellValues(a.sortValue, b.sortValue);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return withKey;
  }, [filteredRows, sortColumn, sortDirection]);

  const visibleRows = sortedRows.slice(0, visibleCount);

  const handleSort = useCallback((column) => {
    setSortColumn((prev) => {
      if (prev !== column) {
        setSortDirection('asc');
        return column;
      }
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return column;
    });
  }, []);

  if (columns.length === 0) {
    return <div className="at-empty">No tabular columns to display.</div>;
  }

  return (
    <div className="at-wrapper">
      <div className="at-scroll">
        <table className="at-table">
          <thead>
            <tr>
              <th className="at-index-col">#</th>
              {columns.map((col) => (
                <th key={col} onClick={() => handleSort(col)} className="at-sortable">
                  {col}
                  {sortColumn === col && (
                    <span className="at-sort-arrow">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
              <th className="at-actions-col" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ item, index }) => {
              const rowPath = `${basePath}.${index}`;
              return (
                <tr key={index} onMouseEnter={() => onHoverPath(rowPath)}>
                  <td className="at-index-col">{index}</td>
                  {columns.map((col) => (
                    <td key={col}>
                      <Cell value={item && typeof item === 'object' ? item[col] : undefined} query={query} />
                    </td>
                  ))}
                  <td className="at-actions-col">
                    <CopyPathButton path={rowPath} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="at-footer">
        <span className="at-row-count">
          Showing {visibleRows.length} of {sortedRows.length} row{sortedRows.length === 1 ? '' : 's'}
          {query && sortedRows.length !== data.length ? ` (filtered from ${data.length})` : ''}
        </span>
        {visibleCount < sortedRows.length && (
          <button
            className="at-load-more"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Load {Math.min(PAGE_SIZE, sortedRows.length - visibleCount)} more
          </button>
        )}
      </div>
    </div>
  );
};

export default ArrayTable;
