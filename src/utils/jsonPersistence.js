const CURRENT_KEY = 'jsonTrace.currentDocument';
const RECENT_KEY = 'jsonTrace.recentDocuments';
const MAX_RECENT = 10;
const MAX_SNAPSHOT_SIZE = 2 * 1024 * 1024; // 2MB - skip huge docs from history to protect localStorage quota

export const loadCurrentDocument = () => {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch (e) {
    return null;
  }
};

export const saveCurrentDocument = (content) => {
  try {
    localStorage.setItem(CURRENT_KEY, content);
  } catch (e) {
    // Storage full or unavailable - silently skip, editor content is still in memory.
  }
};

export const loadRecentDocuments = () => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const summarize = (content) => {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return `Array (${parsed.length} item${parsed.length === 1 ? '' : 's'})`;
    }
    if (parsed !== null && typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      const shown = keys.slice(0, 4).join(', ');
      return `{ ${shown}${keys.length > 4 ? ', …' : ''} }`;
    }
    return String(parsed).slice(0, 60);
  } catch (e) {
    return content.trim().replace(/\s+/g, ' ').slice(0, 60);
  }
};

// Appends a snapshot of `content` to the recent-documents list (newest first),
// deduping against the most recent entry and capping both count and total size.
export const addRecentDocument = (recentList, content) => {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > MAX_SNAPSHOT_SIZE) return recentList;
  if (recentList.length > 0 && recentList[0].content === trimmed) return recentList;

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    size: trimmed.length,
    preview: summarize(trimmed),
    content: trimmed,
  };

  const next = [entry, ...recentList].slice(0, MAX_RECENT);

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (e) {
    // Quota exceeded - fall back to keeping just the newest few in memory only.
    return [entry, ...recentList].slice(0, 3);
  }

  return next;
};

export const removeRecentDocument = (recentList, id) => {
  const next = recentList.filter((entry) => entry.id !== id);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (e) {
    // ignore
  }
  return next;
};

export const clearRecentDocuments = () => {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch (e) {
    // ignore
  }
  return [];
};

export const formatRelativeTime = (timestamp) => {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
};
