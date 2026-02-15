import React, { useRef } from 'react';
import './Toolbar.css';

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
    validationMessage
}) => {
    const fileInputRef = useRef(null);

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
                <button className="toolbar-btn" onClick={onFormat} title="Format JSON">
                    Format
                </button>

                <button className="toolbar-btn" onClick={onMinify} title="Minify JSON">
                    Minify
                </button>

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

                <button className="toolbar-btn" onClick={onRefresh} title="Refresh Visualization">
                    Refresh
                </button>

                <button className="toolbar-btn" onClick={onExportImage} title="Export as Image">
                    Export PNG
                </button>
            </div>
        </div>
    );
};

export default Toolbar;
