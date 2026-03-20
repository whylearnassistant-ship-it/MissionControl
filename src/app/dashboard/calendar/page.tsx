"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Zap, CalendarDays } from "lucide-react";

interface CronJob {
  id?: string;
  name?: string;
  schedule?: string;
  expression?: string;
  command?: string;
  prompt?: string;
  nextRun?: string;
  lastRun?: string;
  enabled?: boolean;
  agent?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((d) => {
        const jobs = Array.isArray(d.cron) ? d.cron : [];
        setCronJobs(jobs);
        setOnline(d.online);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        Loading calendar...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Calendar</h1>
        <p className="text-sm text-text-secondary mt-1">Scheduled jobs and cron runs</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-2 bg-bg-secondary border border-border rounded-xl overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-text-primary">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-text-tertiary uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const isToday = isCurrentMonth && day === today;
              return (
                <div
                  key={i}
                  className={`calendar-day min-h-[80px] p-2 border-b border-r border-border/50 transition-colors ${
                    isToday ? "today bg-accent/5 border-accent/20" : ""
                  } ${day ? "cursor-pointer" : ""}`}
                >
                  {day && (
                    <>
                      <span
                        className={`text-sm font-medium ${
                          isToday
                            ? "text-accent bg-accent/15 w-7 h-7 rounded-full inline-flex items-center justify-center"
                            : "text-text-secondary"
                        }`}
                      >
                        {day}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cron Jobs Panel */}
        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              Scheduled Jobs
            </h3>
            <p className="text-xs text-text-tertiary mt-1">
              {online ? `${cronJobs.length} jobs configured` : "Gateway offline"}
            </p>
          </div>

          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {cronJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No scheduled jobs</p>
                <p className="text-xs mt-1">
                  {online ? "Configure cron jobs in OpenClaw" : "Connect to gateway to view jobs"}
                </p>
              </div>
            )}

            {cronJobs.map((job, i) => (
              <div
                key={job.id || i}
                className="bg-bg-card border border-border rounded-lg p-3 hover:border-border-hover transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-sm font-medium text-text-primary">
                      {job.name || job.command || job.prompt || `Job ${i + 1}`}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      job.enabled !== false ? "bg-success/15 text-success" : "bg-text-tertiary/15 text-text-tertiary"
                    }`}
                  >
                    {job.enabled !== false ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {(job.schedule || job.expression) && (
                    <p className="text-xs text-text-tertiary font-mono">
                      {job.schedule || job.expression}
                    </p>
                  )}
                  {job.nextRun && (
                    <p className="text-xs text-text-tertiary">
                      Next: {new Date(job.nextRun).toLocaleString()}
                    </p>
                  )}
                  {job.agent && (
                    <p className="text-xs text-text-tertiary">Agent: {job.agent}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
