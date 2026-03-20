import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MEMORY_DIR = "/home/openclaw/.openclaw/workspace/memory";

export async function GET(req: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");

  if (date) {
    const filePath = path.join(MEMORY_DIR, `${date}.md`);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return NextResponse.json({ content, date });
    } catch {
      return NextResponse.json({ content: null, date });
    }
  }

  // List all memory files
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      return NextResponse.json({ files: [] });
    }
    const files = fs.readdirSync(MEMORY_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", ""))
      .sort()
      .reverse();
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
