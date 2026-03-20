"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2, FolderKanban } from "lucide-react";

interface Project {
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

const COLUMNS = [
  { id: "planning" as const, label: "Planning", color: "text-blue-400" },
  { id: "active" as const, label: "Active", color: "text-accent" },
  { id: "review" as const, label: "Review", color: "text-warning" },
  { id: "completed" as const, label: "Completed", color: "text-success" },
];

const COLORS = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    color: "#8b5cf6",
    status: "planning" as const,
  });

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const d = await res.json();
      setProjects(d.projects || []);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const updateProjectStatus = async (id: string, status: string) => {
    const proj = projects.find((p) => p.id === id);
    const progress = status === "completed" ? 100 : proj?.progress || 0;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, data: { status, progress } }),
    });
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: status as Project["status"], progress } : p)));
  };

  const createProject = async () => {
    if (!newProject.title.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...newProject }),
    });
    const d = await res.json();
    if (d.project) setProjects((prev) => [...prev, d.project]);
    setNewProject({ title: "", description: "", color: "#8b5cf6", status: "planning" });
    setShowCreate(false);
  };

  const deleteProject = async (id: string) => {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-text-secondary">Loading projects...</div>;
  }

  return (
    <div className="p-6 lg:p-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Projects</h1>
          <p className="text-sm text-text-secondary mt-1">{projects.length} projects</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-accent/20"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-bg-secondary border border-border rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">New Project</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Project name"
                value={newProject.title}
                onChange={(e) => setNewProject((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                autoFocus
              />
              <textarea
                placeholder="Description"
                value={newProject.description}
                onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors resize-none h-20"
              />
              <div>
                <label className="text-xs text-text-secondary mb-2 block">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewProject((p) => ({ ...p, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${
                        newProject.color === c ? "ring-2 ring-offset-2 ring-offset-bg-secondary ring-accent scale-110" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={createProject}
                disabled={!newProject.title.trim()}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium rounded-lg transition-all"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-0 overflow-auto">
        {COLUMNS.map((col) => {
          const colProjects = projects.filter((p) => p.status === col.id);
          return (
            <div
              key={col.id}
              className={`flex flex-col min-h-[200px] bg-bg-secondary/50 border border-border rounded-xl transition-colors duration-200 ${
                dragOverCol === col.id ? "kanban-column-over border-accent/30" : ""
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("projectId");
                if (id) updateProjectStatus(id, col.id);
                setDragOverCol(null);
              }}
            >
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
                <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                <span className="text-xs text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
                  {colProjects.length}
                </span>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {colProjects.map((proj) => (
                  <div
                    key={proj.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("projectId", proj.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="bg-bg-card border border-border rounded-lg p-4 cursor-grab active:cursor-grabbing hover:border-border-hover hover:shadow-md hover:shadow-accent/5 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                        <h4 className="text-sm font-semibold text-text-primary">{proj.title}</h4>
                      </div>
                      <button
                        onClick={() => deleteProject(proj.id)}
                        className="text-text-tertiary/50 hover:text-danger opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {proj.description && (
                      <p className="text-xs text-text-tertiary line-clamp-2 mb-3">{proj.description}</p>
                    )}
                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
                        <span>Progress</span>
                        <span>{proj.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${proj.progress}%`, backgroundColor: proj.color }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                      <span>{proj.taskCount} tasks</span>
                      <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}

                {colProjects.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-text-tertiary/50">
                    <FolderKanban className="w-6 h-6 mb-2" />
                    <span className="text-xs">No projects</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
