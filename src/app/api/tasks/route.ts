import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readDB, writeDB, Task } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = readDB();
  return NextResponse.json({ tasks: db.tasks });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = readDB();

  if (body.action === "create") {
    const task: Task = {
      id: `task-${Date.now()}`,
      title: body.title || "New Task",
      description: body.description || "",
      status: body.status || "backlog",
      priority: body.priority || "medium",
      assignee: body.assignee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labels: body.labels || [],
    };
    db.tasks.push(task);
    writeDB(db);
    return NextResponse.json({ task });
  }

  if (body.action === "update") {
    const idx = db.tasks.findIndex((t) => t.id === body.id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    db.tasks[idx] = { ...db.tasks[idx], ...body.data, updatedAt: new Date().toISOString() };
    writeDB(db);
    return NextResponse.json({ task: db.tasks[idx] });
  }

  if (body.action === "delete") {
    db.tasks = db.tasks.filter((t) => t.id !== body.id);
    writeDB(db);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
