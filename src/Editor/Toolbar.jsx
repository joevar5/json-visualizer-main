import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Toolbar.css';
import { formatRelativeTime } from '../utils/jsonPersistence';

const DROPDOWN_WIDTH = 320;
const VIEWPORT_MARGIN = 12;

const RecentDropdown = ({ anchorRect, recentDocuments, onLoad, onRemove, onClearAll, onClose }) => {
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    let left = anchorRect.right - width;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));
    const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 40);

    return createPortal(
        <div
            className="recent-dropdown"
            ref={dropdownRef}
            style={{ position: 'fixed', top, left, width }}
        >
            {recentDocuments.length === 0 ? (
                <div className="recent-empty">No recent documents yet.</div>
            ) : (
                <>
                    <div className="recent-list">
                        {recentDocuments.map((entry) => (
                            <div key={entry.id} className="recent-item">
                                <button
                                    className="recent-item-main"
                                    onClick={() => onLoad(entry.content)}
                                    title={entry.content.slice(0, 300)}
                                >
                                    <span className="recent-item-preview">{entry.preview}</span>
                                    <span className="recent-item-meta">
                                        {formatRelativeTime(entry.savedAt)} · {entry.size.toLocaleString()} chars
                                    </span>
                                </button>
                                <button
                                    className="recent-item-remove"
                                    onClick={() => onRemove(entry.id)}
                                    title="Remove from history"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <button className="recent-clear-all" onClick={onClearAll}>
                        Clear all history
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};

const Toolbar = ({
    jsonCode,
    setJsonCode,
    onFormat,
    onMinify,
    onCopy,
    onDownload,
    onExportImage,
    onRefresh,
    isValid,
    validationMessage,
    onShowLogic,
    recentDocuments = [],
    onLoadRecent,
    onRemoveRecent,
    onClearRecent,
}) => {
    const fileInputRef = useRef(null);
    const recentBtnRef = useRef(null);
    const [anchorRect, setAnchorRect] = useState(null);

    const toggleRecent = useCallback(() => {
        setAnchorRect((prev) => {
            if (prev) return null;
            return recentBtnRef.current ? recentBtnRef.current.getBoundingClientRect() : null;
        });
    }, []);

    const handleLoad = (content) => {
        onLoadRecent(content);
        setAnchorRect(null);
    };

    const handleUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setJsonCode(e.target.result);
            };
            reader.readAsText(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="toolbar">
            <div className="toolbar-section">
                <div className={`validation-badge ${isValid ? 'valid' : 'invalid'}`}>
                    {isValid ? '✓ VALID JSON' : '✗ INVALID JSON'}
                </div>
                {validationMessage && (
                    <div className="validation-message">{validationMessage}</div>
                )}
            </div>

            <div className="toolbar-section toolbar-actions">
                <div className="toolbar-group">
                    <button className="toolbar-btn" onClick={onFormat} title="Format JSON">
                        Format
                    </button>
                    <button className="toolbar-btn" onClick={onMinify} title="Minify JSON">
                        Minify
                    </button>
                </div>

                <div className="toolbar-group">
                    <button className="toolbar-btn" onClick={onCopy} title="Copy to Clipboard">
                        Copy
                    </button>
                    <button className="toolbar-btn" onClick={onDownload} title="Download JSON">
                        Download
                    </button>
                    <button className="toolbar-btn" onClick={triggerFileInput} title="Upload JSON File">
                        Upload
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleUpload}
                        style={{ display: 'none' }}
                    />
                </div>

                <div className="toolbar-group">
                    <button className="toolbar-btn" onClick={onRefresh} title="Refresh Visualization">
                        Refresh
                    </button>

                    <button className="toolbar-btn" onClick={onExportImage} title="Export as Image">
                        Export PNG
                    </button>

                    <button
                        className="toolbar-btn"
                        ref={recentBtnRef}
                        onClick={toggleRecent}
                        title="Recent documents"
                    >
                        Recent {recentDocuments.length > 0 ? `(${recentDocuments.length})` : ''}
                    </button>
                </div>

                {anchorRect && (
                    <RecentDropdown
                        anchorRect={anchorRect}
                        recentDocuments={recentDocuments}
                        onLoad={handleLoad}
                        onRemove={onRemoveRecent}
                        onClearAll={onClearRecent}
                        onClose={() => setAnchorRect(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default Toolbar;
