"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Folder,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  FileCode,
  FileJson,
  Image,
  X,
} from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "sh":
      return FileCode;
    case "json":
      return FileJson;
    case "md":
    case "txt":
      return FileText;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return Image;
    default:
      return File;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TreeItem({
  node,
  depth,
  onSelect,
  selected,
}: {
  node: FileNode;
  depth: number;
  onSelect: (path: string) => void;
  selected: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === "directory";
  const isSelected = selected === node.path;
  const Icon = isDir ? Folder : getFileIcon(node.name);

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onSelect(node.path);
        }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-all group ${
          isSelected
            ? "bg-accent/12 text-accent"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-tertiary" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-tertiary" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon
          className={`w-4 h-4 shrink-0 ${
            isDir ? "text-accent/70" : isSelected ? "text-accent" : "text-text-tertiary"
          }`}
        />
        <span className="truncate text-left">{node.name}</span>
        {!isDir && node.size != null && (
          <span className="ml-auto text-[10px] text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((d) => setTree(d.tree || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectFile = useCallback(async (path: string) => {
    setSelectedFile(path);
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/docs?file=${encodeURIComponent(path)}`);
      const d = await res.json();
      setContent(d.content);
    } catch {
      setContent(null);
    }
    setLoadingFile(false);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-text-secondary">Loading docs...</div>;
  }

  return (
    <div className="p-6 lg:p-8 h-full flex flex-col max-w-full">
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-semibold text-text-primary">Docs</h1>
        <p className="text-sm text-text-secondary mt-1">Browse workspace files</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* File Tree */}
        <div className="lg:col-span-1 bg-bg-secondary border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Folder className="w-4 h-4 text-accent" />
              Workspace
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                onSelect={selectFile}
                selected={selectedFile}
              />
            ))}
          </div>
        </div>

        {/* File Preview */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-accent shrink-0" />
              <span className="text-sm font-medium text-text-primary truncate font-mono">
                {selectedFile || "Select a file"}
              </span>
            </div>
            {selectedFile && (
              <button
                onClick={() => { setSelectedFile(""); setContent(null); }}
                className="text-text-tertiary hover:text-text-primary transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-5">
            {loadingFile ? (
              <div className="flex items-center justify-center h-40 text-text-secondary text-sm">
                Loading...
              </div>
            ) : content ? (
              <pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
                {content}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">
                  {selectedFile ? "Unable to load file" : "Select a file to preview"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
