import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readFile, stat } from "fs/promises";
import { execSync } from "child_process";
import JSON5 from "json5";
import { readdirSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "/home/openclaw/.openclaw/openclaw.json";
const OPENCLAW_DIR = "/home/openclaw/.openclaw";

interface AgentStatus {
  id: string;
  name: string;
  type: "main" | "coder" | "subagent";
  status: "working" | "idle";
  task?: string;
}

// Check if any session .jsonl.lock files exist (indicates active inference)
function hasActiveLockFiles(agentDir: string): boolean {
  try {
    const sessionsDir = path.join(agentDir, "sessions");
    const files = readdirSync(sessionsDir);
    return files.some((f) => f.endsWith(".jsonl.lock"));
  } catch {
    return false;
  }
}

// Check session recency from sessions.json
// Returns true if any session for this agent was updated within thresholdMs
function hasRecentSession(
  sessionsJsonPath: string,
  agentId: string,
  bindings: Array<Record<string, unknown>>,
  thresholdMs: number = 30000
): boolean {
  try {
    const raw = execSync(`cat "${sessionsJsonPath}" 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 3000,
    });
    const sessions = JSON.parse(raw);
    const now = Date.now();

    // Find which session keys map to this agent via bindings
    const agentChannelIds = bindings
      .filter((b) => b.agentId === agentId)
      .map((b) => {
        const match = b.match as Record<string, unknown>;
        const peer = match?.peer as Record<string, unknown>;
        return (peer?.id as string)?.replace("channel:", "") || "";
      })
      .filter(Boolean);

    for (const [key, value] of Object.entries(sessions)) {
      const session = value as Record<string, unknown>;
      const updatedAt = session.updatedAt as number;
      if (!updatedAt) continue;

      const age = now - updatedAt;

      // Direct match: session key contains the agent id
      const isDirectMatch = key.includes(`agent:${agentId}:`);

      // Channel match: session is for a channel bound to this agent
      const isChannelMatch = agentChannelIds.some((chId) =>
        key.includes(chId)
      );

      // For main agent, also check the main session key
      const isMainSession =
        agentId === "main" && key === "agent:main:main";

      if ((isDirectMatch || isChannelMatch || isMainSession) && age < thresholdMs) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Get active subagent runs from runs.json
function getActiveSubagentRuns(): Array<{
  runId: string;
  task: string;
  startedAt: number;
}> {
  try {
    const raw = execSync(
      `cat "${OPENCLAW_DIR}/subagents/runs.json" 2>/dev/null`,
      { encoding: "utf-8", timeout: 3000 }
    );
    const data = JSON.parse(raw);
    const runs = data.runs || {};
    const active: Array<{ runId: string; task: string; startedAt: number }> =
      [];

    for (const [, run] of Object.entries(runs)) {
      const r = run as Record<string, unknown>;
      // Active = has startedAt but no endedAt
      if (r.startedAt && !r.endedAt) {
        active.push({
          runId: r.runId as string,
          task: ((r.task as string) || "").slice(0, 100),
          startedAt: r.startedAt as number,
        });
      }
    }
    return active;
  } catch {
    return [];
  }
}

export async function GET() {
  const user = await verifyAuth();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config = JSON5.parse(raw);

    const agentList = config.agents?.list || [];
    const bindings = config.bindings || [];

    // Find the main agent's sessions.json (all agents run under main)
    const mainSessionsPath = path.join(
      OPENCLAW_DIR,
      "agents/main/sessions/sessions.json"
    );

    // Check for lock files (active inference)
    const mainAgentDir = path.join(OPENCLAW_DIR, "agents/main");
    const hasLocks = hasActiveLockFiles(mainAgentDir);

    // Get active subagent runs
    const activeSubagentRuns = getActiveSubagentRuns();

    const agents: AgentStatus[] = agentList.map(
      (agent: Record<string, unknown>) => {
        const id = agent.id as string;
        const name = (agent.name as string) || id;

        let type: AgentStatus["type"] = "main";
        if (id === "coder" || name.toLowerCase().includes("coder")) {
          type = "coder";
        }

        // Check if this agent has a recently-updated session (within 30s)
        const recentlyActive = hasRecentSession(
          mainSessionsPath,
          id,
          bindings,
          30000
        );

        // Also check lock files — if locks exist and session is recent, definitely working
        const isWorking = recentlyActive && hasLocks;

        // More lenient: if session updated within 15s, likely still in a turn
        const veryRecent = hasRecentSession(
          mainSessionsPath,
          id,
          bindings,
          15000
        );

        return {
          id,
          name,
          type,
          status: (isWorking || veryRecent) ? "working" as const : "idle" as const,
        };
      }
    );

    // Add ONLY active subagents (not idle placeholders)
    for (let i = 0; i < activeSubagentRuns.length && i < 4; i++) {
      const run = activeSubagentRuns[i];
      agents.push({
        id: `subagent-${i + 1}`,
        name: `Sub ${i + 1}`,
        type: "subagent",
        status: "working",
        task: run.task,
      });
    }

    return NextResponse.json({ agents, timestamp: Date.now() });
  } catch (err) {
    return NextResponse.json({
      agents: [
        { id: "main", name: "Main", type: "main", status: "idle" },
      ],
      timestamp: Date.now(),
      error: String(err),
    });
  }
}
