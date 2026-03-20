import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readDB, writeDB, Project } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = readDB();
  return NextResponse.json({ projects: db.projects });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = readDB();

  if (body.action === "create") {
    const project: Project = {
      id: `proj-${Date.now()}`,
      title: body.title || "New Project",
      description: body.description || "",
      status: body.status || "planning",
      progress: body.progress || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: body.color || "#8b5cf6",
      taskCount: 0,
    };
    db.projects.push(project);
    writeDB(db);
    return NextResponse.json({ project });
  }

  if (body.action === "update") {
    const idx = db.projects.findIndex((p) => p.id === body.id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    db.projects[idx] = { ...db.projects[idx], ...body.data, updatedAt: new Date().toISOString() };
    writeDB(db);
    return NextResponse.json({ project: db.projects[idx] });
  }

  if (body.action === "delete") {
    db.projects = db.projects.filter((p) => p.id !== body.id);
    writeDB(db);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
