import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const WORKSPACE = "/home/openclaw/.openclaw/workspace";
const IGNORE = new Set([".git", "node_modules", ".next", ".cache", "__pycache__", ".venv"]);

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
}

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

  const filePath = req.nextUrl.searchParams.get("file");

  if (filePath) {
    const fullPath = path.join(WORKSPACE, filePath);
    // Security: ensure within workspace
    if (!fullPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > 500_000) {
        return NextResponse.json({ content: "File too large to preview (>500KB)", truncated: true });
      }
      const content = fs.readFileSync(fullPath, "utf-8");
      return NextResponse.json({ content, path: filePath });
    } catch {
      return NextResponse.json({ content: null, path: filePath });
    }
  }

  const tree = buildTree(WORKSPACE, WORKSPACE);
  return NextResponse.json({ tree });
}
