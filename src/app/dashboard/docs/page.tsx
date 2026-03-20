"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Folder,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  FileCode,
  FileJson,
  Image as ImageIcon,
  X,
  Search,
  LayoutGrid,
  List,
  FolderTree,
  Copy,
  Check,
  Settings,
  Brain,
  BookOpen,
  Code2,
  Database,
  Film,
  HelpCircle,
  ArrowUpDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: string;
  category: string;
  preview: string;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
}

type ViewMode = "grid" | "list" | "tree";
type SortKey = "name" | "category" | "size" | "modifiedAt";
type SortDir = "asc" | "desc";

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Config", "Memory", "Documentation", "Code", "Data", "Media", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Config:        { bg: "bg-violet-500/15",  text: "text-violet-400",  border: "border-violet-500/30",  icon: "text-violet-400" },
  Memory:        { bg: "bg-amber-500/15",   text: "text-amber-400",   border: "border-amber-500/30",   icon: "text-amber-400" },
  Documentation: { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", icon: "text-emerald-400" },
  Code:          { bg: "bg-cyan-500/15",    text: "text-cyan-400",    border: "border-cyan-500/30",    icon: "text-cyan-400" },
  Data:          { bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/30",  icon: "text-orange-400" },
  Media:         { bg: "bg-pink-500/15",    text: "text-pink-400",    border: "border-pink-500/30",    icon: "text-pink-400" },
  Other:         { bg: "bg-gray-500/15",    text: "text-gray-400",    border: "border-gray-500/30",    icon: "text-gray-400" },
};

function categoryIcon(cat: string) {
  switch (cat) {
    case "Config": return Settings;
    case "Memory": return Brain;
    case "Documentation": return BookOpen;
    case "Code": return Code2;
    case "Data": return Database;
    case "Media": return Film;
    default: return HelpCircle;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts": case "tsx": case "js": case "jsx": case "py": case "sh": case "css":
      return FileCode;
    case "json": case "json5":
      return FileJson;
    case "md": case "txt":
      return FileText;
    case "png": case "jpg": case "jpeg": case "gif": case "svg": case "webp":
      return ImageIcon;
    default:
      return File;
  }
}

function renderMarkdown(text: string): string {
  let html = text
    // Code blocks
    .replace(/```[\s\S]*?```/g, (m) => {
      const content = m.slice(m.indexOf("\n") + 1, m.lastIndexOf("```")).trim();
      return `<pre><code>${escapeHtml(content)}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Horizontal rules
    .replace(/^---+$/gm, "<hr/>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Line breaks for remaining
    .replace(/\n/g, "<br/>");
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li><br\/>?)+)/g, (m) => {
    return "<ul>" + m.replace(/<br\/>/g, "") + "</ul>";
  });
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightMatch(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(new RegExp(`(${q})`, "gi"), '<mark class="bg-accent/30 text-text-primary rounded px-0.5">$1</mark>');
}

// ─── Tree component (enhanced) ──────────────────────────────────────────────

function TreeItem({
  node, depth, onSelect, selected,
}: {
  node: FileNode; depth: number; onSelect: (path: string) => void; selected: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === "directory";
  const isSelected = selected === node.path;
  const Icon = isDir ? Folder : getFileIcon(node.name);

  return (
    <div>
      <button
        onClick={() => { if (isDir) setExpanded(!expanded); else onSelect(node.path); }}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-all group ${
          isSelected
            ? "bg-accent/12 text-accent"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-tertiary" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-tertiary" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Icon className={`w-4 h-4 shrink-0 ${isDir ? "text-accent/70" : isSelected ? "text-accent" : "text-text-tertiary"}`} />
        <span className="truncate text-left flex-1">{node.name}</span>
        {!isDir && node.size != null && (
          <span className="text-[10px] text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preview Panel ───────────────────────────────────────────────────────────

function PreviewPanel({
  file, content, loading, onClose,
}: {
  file: CatalogEntry | null; content: string | null; loading: boolean; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  if (!file) return null;

  const colors = CATEGORY_COLORS[file.category] || CATEGORY_COLORS.Other;
  const isMarkdown = file.extension === "md";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-bg-secondary border-l border-border shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                {(() => { const CatIcon = categoryIcon(file.category); return <CatIcon className={`w-4 h-4 ${colors.icon}`} />; })()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-text-primary truncate">{file.name}</h3>
                <p className="text-xs text-text-tertiary font-mono truncate mt-0.5">{file.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="Copy contents"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text}`}>
              {file.category}
            </span>
            <span>{formatSize(file.size)}</span>
            <span>{relativeTime(file.modifiedAt)}</span>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : content ? (
            isMarkdown ? (
              <div className="markdown-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
            ) : (
              <pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
                {content}
              </pre>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-text-tertiary">
              <File className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">Unable to load file content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogEntry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CatalogEntry | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load catalog + tree
  useEffect(() => {
    Promise.all([
      fetch("/api/docs?mode=catalog").then((r) => r.json()),
      fetch("/api/docs").then((r) => r.json()),
    ])
      .then(([catalogData, treeData]) => {
        setCatalog(catalogData.catalog || []);
        setTree(treeData.tree || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/docs?search=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.results || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  // Select file for preview
  const openFile = useCallback(async (entry: CatalogEntry) => {
    setSelectedFile(entry);
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/docs?file=${encodeURIComponent(entry.path)}`);
      const d = await res.json();
      setFileContent(d.content);
    } catch {
      setFileContent(null);
    }
    setLoadingFile(false);
  }, []);

  const openFileByPath = useCallback((filePath: string) => {
    const entry = catalog.find((f) => f.path === filePath);
    if (entry) openFile(entry);
  }, [catalog, openFile]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: catalog.length };
    for (const f of catalog) {
      counts[f.category] = (counts[f.category] || 0) + 1;
    }
    return counts;
  }, [catalog]);

  // Filtered + sorted files
  const displayFiles = useMemo(() => {
    let files = searchResults ?? catalog;
    if (activeCategory !== "All" && !searchResults) {
      files = files.filter((f) => f.category === activeCategory);
    }
    const sorted = [...files].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "size": cmp = a.size - b.size; break;
        case "modifiedAt": cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [catalog, searchResults, activeCategory, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 h-full flex flex-col max-w-full">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-semibold text-text-primary">Docs</h1>
        <p className="text-sm text-text-secondary mt-1">All documents created by OpenClaw agents</p>

        {/* Search bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search files by name or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Controls row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isActive = activeCategory === cat;
              const colors = cat === "All" ? null : CATEGORY_COLORS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? cat === "All"
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : `${colors!.bg} ${colors!.text} border ${colors!.border}`
                      : "bg-bg-secondary text-text-tertiary border border-transparent hover:bg-bg-hover hover:text-text-secondary"
                  }`}
                >
                  {cat}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-white/10" : "bg-bg-tertiary"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-bg-secondary border border-border rounded-lg p-0.5">
            {([
              { mode: "grid" as ViewMode, icon: LayoutGrid, label: "Grid" },
              { mode: "list" as ViewMode, icon: List, label: "List" },
              { mode: "tree" as ViewMode, icon: FolderTree, label: "Tree" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`p-1.5 rounded-md transition-all ${
                  view === mode ? "bg-accent/15 text-accent" : "text-text-tertiary hover:text-text-secondary"
                }`}
                title={label}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Search result count */}
        {searchResults && (
          <p className="mt-3 text-xs text-text-tertiary">
            {searching ? "Searching..." : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
          </p>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {displayFiles.length === 0 && !searching ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-tertiary">
            {searchQuery ? (
              <>
                <Search className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No documents match your search</p>
                <p className="text-xs mt-1">Try a different query</p>
              </>
            ) : (
              <>
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No {activeCategory !== "All" ? activeCategory.toLowerCase() : ""} files found</p>
              </>
            )}
          </div>
        ) : view === "grid" ? (
          /* ─── Grid View ─── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayFiles.map((file) => {
              const colors = CATEGORY_COLORS[file.category] || CATEGORY_COLORS.Other;
              const CatIcon = categoryIcon(file.category);
              return (
                <button
                  key={file.path}
                  onClick={() => openFile(file)}
                  className="text-left p-4 bg-bg-card border border-border rounded-xl hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${colors.bg} shrink-0`}>
                      <CatIcon className={`w-4 h-4 ${colors.icon}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                          {file.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  {file.preview && (
                    <p className="text-xs text-text-tertiary line-clamp-2 leading-relaxed mb-3">
                      {file.preview}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                    <span>{formatSize(file.size)}</span>
                    <span>{relativeTime(file.modifiedAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : view === "list" ? (
          /* ─── List View ─── */
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
              <button onClick={() => toggleSort("name")} className="col-span-4 flex items-center gap-1 hover:text-text-secondary transition-colors text-left">
                Name {sortKey === "name" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                {sortKey !== "name" && <ArrowUpDown className="w-3 h-3 opacity-40" />}
              </button>
              <button onClick={() => toggleSort("category")} className="col-span-2 hidden sm:flex items-center gap-1 hover:text-text-secondary transition-colors text-left">
                Category {sortKey === "category" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                {sortKey !== "category" && <ArrowUpDown className="w-3 h-3 opacity-40" />}
              </button>
              <button onClick={() => toggleSort("size")} className="col-span-1 hidden md:flex items-center gap-1 hover:text-text-secondary transition-colors text-left">
                Size {sortKey === "size" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                {sortKey !== "size" && <ArrowUpDown className="w-3 h-3 opacity-40" />}
              </button>
              <button onClick={() => toggleSort("modifiedAt")} className="col-span-2 hidden md:flex items-center gap-1 hover:text-text-secondary transition-colors text-left">
                Modified {sortKey === "modifiedAt" && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                {sortKey !== "modifiedAt" && <ArrowUpDown className="w-3 h-3 opacity-40" />}
              </button>
              <div className="col-span-3 hidden lg:block">Preview</div>
            </div>
            {/* Rows */}
            {displayFiles.map((file) => {
              const colors = CATEGORY_COLORS[file.category] || CATEGORY_COLORS.Other;
              const FileIcon = getFileIcon(file.name);
              return (
                <button
                  key={file.path}
                  onClick={() => openFile(file)}
                  className="w-full grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border/50 text-sm hover:bg-bg-hover transition-colors text-left items-center"
                >
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <FileIcon className={`w-4 h-4 shrink-0 ${colors.icon}`} />
                    <span className="truncate text-text-primary">{file.name}</span>
                  </div>
                  <div className="col-span-2 hidden sm:block">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                      {file.category}
                    </span>
                  </div>
                  <div className="col-span-1 hidden md:block text-xs text-text-tertiary">{formatSize(file.size)}</div>
                  <div className="col-span-2 hidden md:block text-xs text-text-tertiary">{relativeTime(file.modifiedAt)}</div>
                  <div className="col-span-3 hidden lg:block text-xs text-text-tertiary truncate">{file.preview}</div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ─── Tree View ─── */
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Folder className="w-4 h-4 text-accent" />
                Workspace
              </h3>
            </div>
            <div className="p-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {tree.map((node) => (
                <TreeItem key={node.path} node={node} depth={0} onSelect={openFileByPath} selected={selectedFile?.path || ""} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview Panel */}
      {selectedFile && (
        <PreviewPanel
          file={selectedFile}
          content={fileContent}
          loading={loadingFile}
          onClose={() => { setSelectedFile(null); setFileContent(null); }}
        />
      )}

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.2s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
