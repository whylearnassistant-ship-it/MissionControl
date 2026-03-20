"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  Cpu,
  Clock,
  Zap,
  Server,
  Hash,
  Radio,
} from "lucide-react";

interface AgentBinding {
  channel: string;
  accountId: string;
  channelId: string;
  guildId: string;
}

interface Agent {
  id: string;
  name: string;
  model: string;
  status: string;
  uptime: string | null;
  bindings: AgentBinding[];
}

interface AgentsData {
  online: boolean;
  uptime: string | null;
  agents: Agent[];
  accounts: string[];
  gateway: { port: number; mode: string };
  defaults: { model: string; maxConcurrent: number; workspace: string };
  error?: string;
}

export default function AgentsPage() {
  const [data, setData] = useState<AgentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/agents");
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex items-center gap-2 text-text-secondary">
          <Cpu className="w-4 h-4 animate-spin" />
          Loading agents...
        </div>
      </div>
    );
  }

  const online = data?.online ?? false;
  const agents = data?.agents ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Agents</h1>
          <p className="text-sm text-text-secondary mt-1">
            Monitor and manage your OpenClaw agents
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-hover transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Gateway Status Banner */}
      <div
        className={`mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border ${
          online
            ? "bg-success/5 border-success/20"
            : "bg-danger/5 border-danger/20"
        }`}
      >
        {online ? (
          <Wifi className="w-4 h-4 text-success" />
        ) : (
          <WifiOff className="w-4 h-4 text-danger" />
        )}
        <span
          className={`text-sm font-medium ${online ? "text-success" : "text-danger"}`}
        >
          Gateway {online ? "Connected" : "Offline"}
        </span>
        <span className="text-xs text-text-tertiary ml-2">
          127.0.0.1:{data?.gateway?.port || 18789} · {data?.gateway?.mode || "unknown"} mode
        </span>
        {data?.uptime && (
          <span className="ml-auto text-xs text-text-tertiary">
            Uptime: {data.uptime}
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Agents",
            value: agents.length,
            icon: Bot,
            color: "text-accent",
            bg: "bg-accent/10",
          },
          {
            label: "Online",
            value: online ? agents.length : 0,
            icon: Activity,
            color: "text-success",
            bg: "bg-success/10",
          },
          {
            label: "Accounts",
            value: data?.accounts?.length || 0,
            icon: Radio,
            color: "text-warning",
            bg: "bg-warning/10",
          },
          {
            label: "Max Concurrent",
            value: data?.defaults?.maxConcurrent || 0,
            icon: Zap,
            color: "text-accent",
            bg: "bg-accent/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-bg-card border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {stat.label}
              </span>
              <div
                className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}
              >
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <span className="text-2xl font-semibold text-text-primary">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Default Config */}
      {data?.defaults && (
        <div className="mb-6 bg-bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
            Default Configuration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-text-tertiary">Default Model: </span>
              <span className="text-text-secondary font-mono text-xs">
                {data.defaults.model}
              </span>
            </div>
            <div>
              <span className="text-text-tertiary">Max Concurrent: </span>
              <span className="text-text-secondary">
                {data.defaults.maxConcurrent}
              </span>
            </div>
            <div>
              <span className="text-text-tertiary">Workspace: </span>
              <span className="text-text-secondary font-mono text-xs truncate">
                {data.defaults.workspace}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-bg-card border border-border rounded-xl p-5 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                  <Bot className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary capitalize">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-text-tertiary font-mono">
                    {agent.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    online
                      ? "bg-success shadow-[0_0_6px] shadow-success/50"
                      : "bg-text-tertiary"
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    online ? "text-success" : "text-text-tertiary"
                  }`}
                >
                  {online ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                <span className="text-text-tertiary">Model:</span>
                <span className="text-text-secondary font-mono text-xs">
                  {agent.model}
                </span>
              </div>

              {agent.uptime && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                  <span className="text-text-tertiary">Uptime:</span>
                  <span className="text-text-secondary text-xs">
                    {agent.uptime}
                  </span>
                </div>
              )}

              {agent.bindings.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Hash className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                  <span className="text-text-tertiary">Channels:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {agent.bindings.map((b, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-bg-tertiary rounded text-xs text-text-secondary font-mono"
                        title={`${b.channel} · ${b.accountId} · ${b.channelId}`}
                      >
                        {b.accountId}:{b.channelId.slice(-6)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex gap-2">
              <button className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-hover transition-all">
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Restart
              </button>
              <button className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-hover transition-all">
                View Logs
              </button>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Bot className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No agents found</p>
            <p className="text-sm mt-1">
              Check that openclaw.json exists and contains agent definitions
            </p>
          </div>
        )}
      </div>

      {/* Raw Data Debug */}
      {data && (
        <details className="mt-8">
          <summary className="text-xs text-text-tertiary cursor-pointer hover:text-text-secondary transition-colors">
            Raw API Response
          </summary>
          <pre className="mt-2 p-4 bg-bg-tertiary border border-border rounded-xl text-xs font-mono text-text-secondary overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
