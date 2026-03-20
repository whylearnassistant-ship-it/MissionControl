"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, GripVertical, X, Trash2, Tag } from "lucide-react";

interface Task {
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

const COLUMNS = [
  { id: "backlog" as const, label: "Backlog", color: "text-text-tertiary" },
  { id: "todo" as const, label: "Todo", color: "text-blue-400" },
  { id: "in-progress" as const, label: "In Progress", color: "text-warning" },
  { id: "done" as const, label: "Done", color: "text-success" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-danger/20 text-danger border-danger/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-text-tertiary/20 text-text-tertiary border-text-tertiary/30",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState<{ title: string; description: string; priority: Task["priority"]; status: Task["status"] }>({ title: "", description: "", priority: "medium", status: "backlog" });

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const d = await res.json();
      setTasks(d.tasks || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: taskId, data: { status } }),
    });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: status as Task["status"] } : t)));
  };

  const createTask = async () => {
    if (!newTask.title.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...newTask }),
    });
    const d = await res.json();
    if (d.task) setTasks((prev) => [...prev, d.task]);
    setNewTask({ title: "", description: "", priority: "medium", status: "backlog" });
    setShowCreate(false);
  };

  const deleteTask = async (id: string) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
    (e.target as HTMLElement).classList.add("kanban-card-dragging");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove("kanban-card-dragging");
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) updateTaskStatus(taskId, colId);
    setDragOverCol(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Tasks</h1>
          <p className="text-sm text-text-secondary mt-1">{tasks.length} tasks across {COLUMNS.length} columns</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-accent/20"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-bg-secondary border border-border rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">New Task</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors resize-none h-20"
              />
              <div className="flex gap-3">
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as Task["priority"] }))}
                  className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask((p) => ({ ...p, status: e.target.value as Task["status"] }))}
                  className="flex-1 px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-colors"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={createTask}
                disabled={!newTask.title.trim()}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-lg transition-all"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-0 overflow-auto">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className={`flex flex-col min-h-[200px] bg-bg-secondary/50 border border-border rounded-xl transition-colors duration-200 ${
                dragOverCol === col.id ? "kanban-column-over border-accent/30" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
                <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className="bg-bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-border-hover hover:shadow-md hover:shadow-accent/5 transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-text-tertiary/50 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
                            {task.priority}
                          </span>
                          {task.labels.map((l) => (
                            <span key={l} className="inline-flex items-center gap-1 text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">
                              <Tag className="w-2.5 h-2.5" />
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-text-tertiary/50 hover:text-danger opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
