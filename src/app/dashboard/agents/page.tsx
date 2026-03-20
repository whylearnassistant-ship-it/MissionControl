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
} from "lucide-react";

interface GatewayData {
  status: Record<string, unknown> | null;
  agents: Record<string, unknown> | null;
  cron: unknown[] | null;
  online: boolean;
}

export default function AgentsPage() {
  const [data, setData] = useState<GatewayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/agents");
      const d = await res.json();
      setData(d);
    } catch {
      setData({ status: null, agents: null, cron: null, online: false });
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

  const status = data?.status as Record<string, unknown> | null;
  const agents = data?.agents;
  const online = data?.online ?? false;

  // Parse agent data from gateway response
  const agentList: Array<{
    id: string;
    name: string;
    model: string;
    status: string;
    uptime?: string;
    sessions?: number;
    channels?: string[];
  }> = [];

  if (agents && typeof agents === "object") {
    // If agents is an array
    if (Array.isArray(agents)) {
      for (const a of agents) {
        agentList.push({
          id: a.id || a.name || "unknown",
          name: a.name || a.id || "Agent",
          model: a.model || a.config?.model || "unknown",
          status: "online",
          channels: a.channels || [],
        });
      }
    }
    // If agents is an object map
    else {
      for (const [key, val] of Object.entries(agents)) {
        const v = val as Record<string, unknown>;
        agentList.push({
          id: key,
          name: (v.name as string) || key,
          model: (v.model as string) || (v.config as Record<string, unknown>)?.model as string || "unknown",
          status: "online",
          channels: (v.channels as string[]) || [],
        });
      }
    }
  }

  // If no agents parsed from API but gateway is online, show default
  if (agentList.length === 0 && online) {
    const model = (status as Record<string, unknown>)?.model as string ||
      (status as Record<string, unknown>)?.defaultModel as string || "unknown";
    agentList.push({
      id: "main",
      name: "Main Agent",
      model,
      status: "online",
    });
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Agents</h1>
          <p className="text-sm text-text-secondary mt-1">Monitor and manage your OpenClaw agents</p>
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
        <span className={`text-sm font-medium ${online ? "text-success" : "text-danger"}`}>
          Gateway {online ? "Connected" : "Offline"}
        </span>
        <span className="text-xs text-text-tertiary ml-2">127.0.0.1:18789</span>
        {online && status && (
          <span className="ml-auto text-xs text-text-tertiary">
            v{(status.version as string) || "unknown"}
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Agents",
            value: agentList.length,
            icon: Bot,
            color: "text-accent",
            bg: "bg-accent/10",
          },
          {
            label: "Online",
            value: online ? agentList.length : 0,
            icon: Activity,
            color: "text-success",
            bg: "bg-success/10",
          },
          {
            label: "Cron Jobs",
            value: Array.isArray(data?.cron) ? data.cron.length : 0,
            icon: Clock,
            color: "text-warning",
            bg: "bg-warning/10",
          },
          {
            label: "Status",
            value: online ? "Healthy" : "Down",
            icon: Zap,
            color: online ? "text-success" : "text-danger",
            bg: online ? "bg-success/10" : "bg-danger/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-bg-card border border-border rounded-xl p-4 hover:border-border-hover transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {stat.label}
              </span>
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <span className="text-2xl font-semibold text-text-primary">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agentList.map((agent) => (
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
                  <h3 className="font-semibold text-text-primary">{agent.name}</h3>
                  <p className="text-xs text-text-tertiary font-mono">{agent.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    online ? "bg-success shadow-[0_0_6px] shadow-success/50" : "bg-text-tertiary"
                  }`}
                />
                <span className={`text-xs font-medium ${online ? "text-success" : "text-text-tertiary"}`}>
                  {online ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-text-tertiary">Model:</span>
                <span className="text-text-secondary font-mono text-xs">{agent.model}</span>
              </div>
              {agent.channels && agent.channels.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-text-tertiary">Channels:</span>
                  <div className="flex gap-1 flex-wrap">
                    {agent.channels.map((ch) => (
                      <span
                        key={ch}
                        className="px-2 py-0.5 bg-bg-tertiary rounded text-xs text-text-secondary"
                      >
                        {String(ch)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex gap-2">
              <button
                className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-hover transition-all"
                onClick={() => fetchData(true)}
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Restart
              </button>
              <button className="px-3 py-1.5 text-xs font-medium bg-bg-tertiary border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-hover transition-all">
                View Logs
              </button>
            </div>
          </div>
        ))}

        {agentList.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-text-tertiary">
            <Bot className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No agents found</p>
            <p className="text-sm mt-1">Ensure the OpenClaw gateway is running</p>
          </div>
        )}
      </div>

      {/* Raw Status Debug */}
      {status && (
        <details className="mt-8">
          <summary className="text-xs text-text-tertiary cursor-pointer hover:text-text-secondary transition-colors">
            Raw Gateway Response
          </summary>
          <pre className="mt-2 p-4 bg-bg-tertiary border border-border rounded-xl text-xs font-mono text-text-secondary overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
