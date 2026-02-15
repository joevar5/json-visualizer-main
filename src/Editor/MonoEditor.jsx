import React, { useRef, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import Toolbar from "./Toolbar";
import "./MonoEditor.css";

const MonoEditor = ({ value, onChange, onExportImage, onRefresh, onShowLogic }) => {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState("");

  // Auto-validate and attempt to fix JSON
  const validateAndFixJSON = (jsonString) => {
    if (!jsonString || jsonString.trim() === '') {
      setIsValid(false);
      setValidationMessage("Empty input");
      return;
    }

    try {
      // Try to parse as-is
      JSON.parse(jsonString);
      setIsValid(true);
      setValidationMessage("Valid JSON (RFC 8259)");
    } catch (error) {
      // Extract line and column from error message
      const positionMatch = error.message.match(/position (\d+)/);
      const lineMatch = error.message.match(/line (\d+)/);
      const columnMatch = error.message.match(/column (\d+)/);

      let detailedError = error.message;

      // Try to provide more context
      if (positionMatch) {
        const position = parseInt(positionMatch[1]);
        const beforeError = jsonString.substring(Math.max(0, position - 20), position);
        const atError = jsonString.substring(position, Math.min(jsonString.length, position + 20));
        detailedError = `${error.message} | Near: "${beforeError}[HERE]${atError}"`;
      }

      // Try to auto-fix common issues
      let fixed = jsonString;

      // Fix unquoted keys: {name: "value"} -> {"name": "value"}
      fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

      // Fix single quotes to double quotes
      fixed = fixed.replace(/'/g, '"');

      // Remove trailing commas
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

      try {
        JSON.parse(fixed);
        // Auto-fix successful
        onChange(fixed);
        setIsValid(true);
        setValidationMessage("Auto-fixed and validated ✓");
      } catch (fixError) {
        setIsValid(false);
        setValidationMessage(detailedError);
      }
    }
  };

  // Validate on value change (with performance optimization for large files)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Skip expensive validation for very large files
      if (value.length > 100000) { // 100KB
        try {
          JSON.parse(value);
          setIsValid(true);
          setValidationMessage("Valid JSON (large file - auto-fix disabled)");
        } catch (error) {
          setIsValid(false);
          setValidationMessage(`Error: ${error.message}`);
        }
      } else {
        validateAndFixJSON(value);
      }
    }, 500); // Debounce validation

    return () => clearTimeout(timeoutId);
  }, [value]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    setTimeout(() => {
      editor.layout();
      editor.getAction('editor.action.formatDocument').run();
    }, 100);
  }



  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
    } catch (error) {
      alert("Cannot format invalid JSON. Please fix errors first.");
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(value);
      const minified = JSON.stringify(parsed);
      onChange(minified);
    } catch (error) {
      alert("Cannot minify invalid JSON. Please fix errors first.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      alert("JSON copied to clipboard!");
    } catch (error) {
      alert("Failed to copy to clipboard");
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `json-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Failed to download JSON");
    }
  };

  useEffect(() => {
    const container = containerRef.current;

    const resizeObserver = new ResizeObserver(() => {
      if (editorRef.current) {
        window.requestAnimationFrame(() => {
          if (editorRef.current) {
            editorRef.current.layout();
          }
        });
      }
    });

    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      if (container) {
        resizeObserver.unobserve(container);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="mono-editor-container"
    >
      <Toolbar
        jsonCode={value}
        setJsonCode={onChange}
        onFormat={handleFormat}
        onMinify={handleMinify}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onExportImage={onExportImage}
        onRefresh={onRefresh}
        onShowLogic={onShowLogic}
        isValid={isValid}
        validationMessage={validationMessage}
      />

      <div className="editor-wrapper">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={onChange}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            wordWrap: "on",
            automaticLayout: false,
            formatOnPaste: value.length < 100000,
            formatOnType: value.length < 100000,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            folding: true,
            showFoldingControls: "always",
            glyphMargin: true,
            lineNumbersMinChars: 3,
            quickSuggestions: value.length < 50000,
            suggest: { enabled: value.length < 50000 },
            parameterHints: { enabled: value.length < 50000 },
            renderValidationDecorations: value.length < 100000 ? "on" : "off",
          }}
        />
      </div>
    </div>
  );
};

export default MonoEditor;