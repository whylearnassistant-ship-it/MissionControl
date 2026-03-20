import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE = "/home/openclaw/.openclaw/workspace";
const IGNORE = new Set([".git", "node_modules", ".next", ".cache", "__pycache__", ".venv", "dist", "build"]);

const CONFIG_ROOT_FILES = new Set([
  "AGENTS.md", "SOUL.md", "USER.md", "IDENTITY.md", "HEARTBEAT.md", "TOOLS.md",
]);

const CODE_EXTS = new Set(["ts", "tsx", "js", "jsx", "py", "sh", "css"]);
const MEDIA_EXTS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "mp3", "wav", "mp4", "mov", "avi"]);
const TEXT_EXTS = new Set([
  "md", "txt", "ts", "tsx", "js", "jsx", "py", "sh", "css", "json", "json5",
  "env", "yaml", "yml", "toml", "cfg", "ini", "csv", "html", "xml", "sql", "log",
]);

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
}

interface CatalogEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: string;
  category: string;
  preview: string;
}

function categorize(relPath: string, name: string, ext: string): string {
  const parts = relPath.split("/");

  // Memory — files inside memory/ directory
  if (parts[0] === "memory") return "Memory";

  // Config — root config-like files
  if (parts.length === 1 && CONFIG_ROOT_FILES.has(name)) return "Config";
  if (ext === "json5" || ext === "env") return "Config";
  if (parts.length === 1 && (ext === "json" || ext === "env")) return "Config";

  // Data — .csv, .sqlite, .db, .json inside data directories
  if (parts.some((p) => p.toLowerCase() === "data")) {
    if (["csv", "sqlite", "db", "json"].includes(ext)) return "Data";
  }

  // Media
  if (MEDIA_EXTS.has(ext)) return "Media";

  // Code
  if (CODE_EXTS.has(ext)) return "Code";

  // Documentation — .md files not in memory/ and not config
  if (ext === "md") return "Documentation";

  // Data files anywhere
  if (["csv", "sqlite", "db"].includes(ext)) return "Data";

  return "Other";
}

function isTextFile(ext: string): boolean {
  return TEXT_EXTS.has(ext);
}

function getPreview(fullPath: string, ext: string): string {
  if (!isTextFile(ext)) return "";
  try {
    const fd = fs.openSync(fullPath, "r");
    const buf = Buffer.alloc(200);
    const bytesRead = fs.readSync(fd, buf, 0, 200, 0);
    fs.closeSync(fd);
    return buf.toString("utf-8", 0, bytesRead).replace(/\n/g, " ").trim();
  } catch {
    return "";
  }
}

function collectFiles(dir: string, relativeTo: string, depth = 0): CatalogEntry[] {
  if (depth > 6) return [];
  const results: CatalogEntry[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE.has(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath, relativeTo, depth + 1));
      } else {
        try {
          const stat = fs.statSync(fullPath);
          const relPath = path.relative(relativeTo, fullPath);
          const ext = entry.name.includes(".") ? entry.name.split(".").pop()!.toLowerCase() : "";
          results.push({
            path: relPath,
            name: entry.name,
            extension: ext,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            category: categorize(relPath, entry.name, ext),
            preview: getPreview(fullPath, ext),
          });
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

function searchFiles(query: string): CatalogEntry[] {
  const all = collectFiles(WORKSPACE, WORKSPACE);
  const q = query.toLowerCase();
  const results: CatalogEntry[] = [];

  for (const file of all) {
    // Check name match
    if (file.name.toLowerCase().includes(q)) {
      results.push(file);
      continue;
    }
    // Check content match for text files
    if (isTextFile(file.extension)) {
      try {
        const fullPath = path.join(WORKSPACE, file.path);
        const fd = fs.openSync(fullPath, "r");
        const buf = Buffer.alloc(10240);
        const bytesRead = fs.readSync(fd, buf, 0, 10240, 0);
        fs.closeSync(fd);
        const content = buf.toString("utf-8", 0, bytesRead);
        const lowerContent = content.toLowerCase();
        const idx = lowerContent.indexOf(q);
        if (idx !== -1) {
          // Extract snippet around match
          const start = Math.max(0, idx - 60);
          const end = Math.min(content.length, idx + q.length + 60);
          const snippet = (start > 0 ? "..." : "") + content.slice(start, end).replace(/\n/g, " ") + (end < content.length ? "..." : "");
          results.push({ ...file, preview: snippet });
        }
      } catch {
        // skip
      }
    }
  }
  return results;
}

// --- Original tree builder ---
function buildTree(dir: string, relativeTo: string, depth = 0): FileNode[] {
  if (depth > 4) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => !IGNORE.has(e.name) && !e.name.startsWith("."))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(relativeTo, fullPath);
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: relPath,
            type: "directory" as const,
            children: buildTree(fullPath, relativeTo, depth + 1),
          };
        }
        const stat = fs.statSync(fullPath);
        return {
          name: entry.name,
          path: relPath,
          type: "file" as const,
          size: stat.size,
        };
      });
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mode = req.nextUrl.searchParams.get("mode");
  const search = req.nextUrl.searchParams.get("search");
  const filePath = req.nextUrl.searchParams.get("file");

  // Search mode
  if (search) {
    const results = searchFiles(search);
    return NextResponse.json({ results, query: search });
  }

  // Catalog mode — flat list with metadata
  if (mode === "catalog") {
    const catalog = collectFiles(WORKSPACE, WORKSPACE);
    return NextResponse.json({ catalog });
  }

  // Raw binary file serving (for images, etc.)
  const raw = req.nextUrl.searchParams.get("raw");
  if (raw) {
    const fullPath = path.join(WORKSPACE, raw);
    if (!fullPath.startsWith(WORKSPACE)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    try {
      const data = fs.readFileSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase().slice(1);
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        mp4: "video/mp4",
        mov: "video/quicktime",
        avi: "video/x-msvideo",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        pdf: "application/pdf",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";
      return new NextResponse(data, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": data.length.toString(),
          "Cache-Control": "public, max-age=60",
        },
      });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // Single file content
  if (filePath) {
    const fullPath = path.join(WORKSPACE, filePath);
    if (!fullPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const statInfo = fs.statSync(fullPath);
      const ext = path.extname(fullPath).toLowerCase().slice(1);

      // For binary/media files, return metadata only (use ?raw= to get content)
      if (MEDIA_EXTS.has(ext)) {
        return NextResponse.json({
          content: null,
          path: filePath,
          binary: true,
          mimeType: ext === "svg" ? "image/svg+xml" : `image/${ext}`,
          size: statInfo.size,
        });
      }

      if (statInfo.size > 500_000) {
        return NextResponse.json({ content: "File too large to preview (>500KB)", truncated: true });
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      return NextResponse.json({ content, path: filePath });
    } catch {
      return NextResponse.json({ content: null, path: filePath });
    }
  }

  // Default — tree mode
  const tree = buildTree(WORKSPACE, WORKSPACE);
  return NextResponse.json({ tree });
}
