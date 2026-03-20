import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: "planning" | "active" | "review" | "completed";
  progress: number;
  createdAt: string;
  updatedAt: string;
  color: string;
  taskCount: number;
}

interface DB {
  tasks: Task[];
  projects: Project[];
}

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function defaultDB(): DB {
  return {
    tasks: [
      {
        id: "task-1",
        title: "Set up CI/CD pipeline",
        description: "Configure GitHub Actions for automated testing and deployment",
        status: "todo",
        priority: "high",
        assignee: "admin",
        createdAt: "2026-03-18T10:00:00Z",
        updatedAt: "2026-03-18T10:00:00Z",
        labels: ["infrastructure"],
      },
      {
        id: "task-2",
        title: "Design system components",
        description: "Create reusable UI components for the dashboard",
        status: "in-progress",
        priority: "medium",
        createdAt: "2026-03-17T14:00:00Z",
        updatedAt: "2026-03-19T09:00:00Z",
        labels: ["design", "frontend"],
      },
      {
        id: "task-3",
        title: "API documentation",
        description: "Write comprehensive API docs for all endpoints",
        status: "backlog",
        priority: "low",
        createdAt: "2026-03-16T08:00:00Z",
        updatedAt: "2026-03-16T08:00:00Z",
        labels: ["docs"],
      },
      {
        id: "task-4",
        title: "Database migration scripts",
        description: "Create migration scripts for schema changes",
        status: "done",
        priority: "high",
        assignee: "admin",
        createdAt: "2026-03-15T12:00:00Z",
        updatedAt: "2026-03-19T16:00:00Z",
        labels: ["backend"],
      },
      {
        id: "task-5",
        title: "User analytics dashboard",
        description: "Build analytics view with charts and metrics",
        status: "backlog",
        priority: "medium",
        createdAt: "2026-03-14T11:00:00Z",
        updatedAt: "2026-03-14T11:00:00Z",
        labels: ["feature"],
      },
    ],
    projects: [
      {
        id: "proj-1",
        title: "Mission Control Dashboard",
        description: "Build the main monitoring dashboard for OpenClaw agents",
        status: "active",
        progress: 65,
        createdAt: "2026-03-10T10:00:00Z",
        updatedAt: "2026-03-20T10:00:00Z",
        color: "#8b5cf6",
        taskCount: 12,
      },
      {
        id: "proj-2",
        title: "Agent Orchestration",
        description: "Improve agent coordination and task distribution system",
        status: "planning",
        progress: 15,
        createdAt: "2026-03-12T14:00:00Z",
        updatedAt: "2026-03-18T09:00:00Z",
        color: "#06b6d4",
        taskCount: 8,
      },
      {
        id: "proj-3",
        title: "Memory System v2",
        description: "Redesign the memory persistence and retrieval system",
        status: "review",
        progress: 90,
        createdAt: "2026-03-05T08:00:00Z",
        updatedAt: "2026-03-20T14:00:00Z",
        color: "#22c55e",
        taskCount: 6,
      },
      {
        id: "proj-4",
        title: "Plugin Marketplace",
        description: "Create a marketplace for sharing OpenClaw plugins and skills",
        status: "completed",
        progress: 100,
        createdAt: "2026-02-20T10:00:00Z",
        updatedAt: "2026-03-15T16:00:00Z",
        color: "#f59e0b",
        taskCount: 15,
      },
    ],
  };
}

export function readDB(): DB {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const db = defaultDB();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

export function writeDB(db: DB) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
