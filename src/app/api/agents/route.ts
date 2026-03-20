import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { execSync } from "child_process";
import JSON5 from "json5";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "/home/openclaw/.openclaw/openclaw.json";

function isGatewayRunning(): boolean {
  try {
    const result = execSync("pgrep -f openclaw-gateway 2>/dev/null || true", {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

function getUptime(): string | null {
  try {
    const result = execSync(
      "ps -o etime= -p $(pgrep -f openclaw-gateway | head -1) 2>/dev/null || true",
      { encoding: "utf-8", timeout: 3000 }
    ).trim();
    return result || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const config = JSON5.parse(raw);

    const agents = config.agents || {};
    const bindings = config.bindings || [];
    const channels = config.channels || {};

    const defaults = agents.defaults || {};
    const agentList = agents.list || [];

    const online = isGatewayRunning();
    const uptime = getUptime();

    // Build agent entries with their bindings and channel info
    const parsedAgents = agentList.map((agent: Record<string, unknown>) => {
      const id = agent.id as string;
      const modelConfig = (agent.model as Record<string, unknown>) ||
        (defaults.model as Record<string, unknown>) || {};
      const model = (modelConfig.primary as string) || "unknown";

      // Find bindings for this agent
      const agentBindings = bindings
        .filter((b: Record<string, unknown>) => b.agentId === id)
        .map((b: Record<string, unknown>) => {
          const match = b.match as Record<string, unknown>;
          const peer = match?.peer as Record<string, unknown>;
          const channelId = ((peer?.id as string) || "").replace("channel:", "");
          return {
            channel: (match?.channel as string) || "unknown",
            accountId: (match?.accountId as string) || "default",
            channelId,
            guildId: (match?.guildId as string) || "",
          };
        });

      return {
        id,
        name: (agent.name as string) || id,
        model,
        status: online ? "online" : "offline",
        uptime: online ? uptime : null,
        bindings: agentBindings,
      };
    });

    // Get Discord account info
    const discord = channels.discord || {};
    const accounts = discord.accounts || {};
    const accountNames = Object.keys(accounts).filter((k: string) => k !== "default");

    return NextResponse.json({
      online,
      uptime,
      agents: parsedAgents,
      accounts: accountNames,
      gateway: {
        port: config.gateway?.port || 18789,
        mode: config.gateway?.mode || "unknown",
      },
      defaults: {
        model: defaults.model?.primary || "unknown",
        maxConcurrent: defaults.maxConcurrent || 0,
        workspace: defaults.workspace || "",
      },
    });
  } catch (err) {
    return NextResponse.json({
      online: false,
      uptime: null,
      agents: [],
      accounts: [],
      gateway: { port: 18789, mode: "unknown" },
      defaults: { model: "unknown", maxConcurrent: 0, workspace: "" },
      error: String(err),
    });
  }
}
