import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { execSync } from "child_process";
import JSON5 from "json5";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "/home/openclaw/.openclaw/openclaw.json";

interface AgentStatus {
  id: string;
  name: string;
  type: "main" | "coder" | "subagent";
  status: "working" | "idle";
}

function getActiveProcesses(): string {
  try {
    return execSync("pgrep -fa openclaw 2>/dev/null || true", {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
  } catch {
    return "";
  }
}

function getSubagentCount(): number {
  try {
    const result = execSync(
      "pgrep -fa 'subagent' 2>/dev/null | wc -l || echo 0",
      { encoding: "utf-8", timeout: 3000 }
    ).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
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
    const processes = getActiveProcesses();
    const subagentCount = Math.max(getSubagentCount(), 0);

    const agents: AgentStatus[] = agentList.map(
      (agent: Record<string, unknown>) => {
        const id = agent.id as string;
        const name = (agent.name as string) || id;

        // Determine type based on agent id/name
        let type: AgentStatus["type"] = "main";
        if (id === "coder" || name.toLowerCase().includes("coder")) {
          type = "coder";
        }

        // Check if this agent has active sessions
        const isWorking =
          processes.includes(`agent:${id}`) ||
          processes.includes(`--agent ${id}`) ||
          processes.includes(`agentId=${id}`);

        return {
          id,
          name,
          type,
          status: isWorking ? ("working" as const) : ("idle" as const),
        };
      }
    );

    // Add subagent entries if any are active
    const activeSubagents = Math.min(subagentCount, 4); // cap at 4 for display
    for (let i = 0; i < activeSubagents; i++) {
      agents.push({
        id: `subagent-${i + 1}`,
        name: `Sub ${i + 1}`,
        type: "subagent",
        status: "working",
      });
    }

    // If no subagents active, show one idle subagent slot
    if (activeSubagents === 0) {
      agents.push({
        id: "subagent-1",
        name: "Sub 1",
        type: "subagent",
        status: "idle",
      });
    }

    return NextResponse.json({ agents, timestamp: Date.now() });
  } catch (err) {
    return NextResponse.json(
      {
        agents: [
          { id: "main", name: "Main", type: "main", status: "idle" },
          { id: "subagent-1", name: "Sub 1", type: "subagent", status: "idle" },
        ],
        timestamp: Date.now(),
        error: String(err),
      }
    );
  }
}
