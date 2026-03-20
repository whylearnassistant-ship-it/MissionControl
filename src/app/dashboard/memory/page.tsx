"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Brain, FileText, CalendarDays } from "lucide-react";
import { marked } from "marked";

export default function MemoryPage() {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => {
        setFiles(d.files || []);
        if (d.files?.length > 0) {
          setSelectedDate(d.files[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchContent = useCallback(async (date: string) => {
    if (!date) return;
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/memory?date=${date}`);
      const d = await res.json();
      setContent(d.content);
    } catch {
      setContent(null);
    }
    setLoadingContent(false);
  }, []);

  useEffect(() => {
    if (selectedDate) fetchContent(selectedDate);
  }, [selectedDate, fetchContent]);

  const currentIdx = files.indexOf(selectedDate);
  const hasPrev = currentIdx < files.length - 1;
  const hasNext = currentIdx > 0;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-text-secondary">Loading memory...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Memory</h1>
        <p className="text-sm text-text-secondary mt-1">Daily logs and agent memories</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Date list */}
        <div className="lg:col-span-1">
          <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent" />
                Dates
              </h3>
            </div>
            <div className="p-2 max-h-[500px] overflow-y-auto space-y-0.5">
              {files.length === 0 && (
                <div className="py-8 text-center text-text-tertiary">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No memory files found</p>
                </div>
              )}
              {files.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedDate(f)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedDate === f
                      ? "bg-accent/12 text-accent font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-2 opacity-60" />
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-text-primary">
                  {selectedDate || "Select a date"}
                </h3>
              </div>
              {selectedDate && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => hasPrev && setSelectedDate(files[currentIdx + 1])}
                    disabled={!hasPrev}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => hasNext && setSelectedDate(files[currentIdx - 1])}
                    disabled={!hasNext}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-6 min-h-[400px]">
              {loadingContent ? (
                <div className="flex items-center justify-center h-40 text-text-secondary text-sm">
                  Loading...
                </div>
              ) : content ? (
                <div
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ __html: marked(content) as string }}
                />
              ) : selectedDate ? (
                <div className="flex flex-col items-center justify-center h-40 text-text-tertiary">
                  <FileText className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No content for this date</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-text-tertiary">
                  <Brain className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Select a date to view memories</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
