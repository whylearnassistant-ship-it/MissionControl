import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const CONFIG_PATH = "/home/openclaw/.openclaw/openclaw.json";

function parseJson5(text: string): Record<string, unknown> {
  // Simple JSON5-ish parser: strip comments, trailing commas, unquoted keys
  let cleaned = text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/([{,]\s*)(\w[\w$]*)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ': "$1"');
  return JSON.parse(cleaned);
}

function isGatewayRunning(): boolean {
  try {
    const result = execSync("pgrep -f 'openclaw.*gateway\\|node.*openclaw' 2>/dev/null || true", {
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
      "ps -o etime= -p $(pgrep -f 'openclaw' | head -1) 2>/dev/null || true",
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
    const config = parseJson5(raw);

    const agents = config.agents as Record<string, unknown> | undefined;
    const bindings = (config.bindings as Array<Record<string, unknown>>) || [];
    const channels = config.channels as Record<string, unknown> | undefined;

    const defaults = (agents?.defaults as Record<string, unknown>) || {};
    const agentList = ((agents?.list as Array<Record<string, unknown>>) || []);

    const online = isGatewayRunning();
    const uptime = getUptime();

    // Build agent entries with their bindings and channel info
    const parsedAgents = agentList.map((agent) => {
      const id = agent.id as string;
      const modelConfig = (agent.model as Record<string, unknown>) ||
        (defaults.model as Record<string, unknown>) || {};
      const model = (modelConfig.primary as string) || "unknown";

      // Find bindings for this agent
      const agentBindings = bindings.filter((b) => b.agentId === id);
      const boundChannels = agentBindings.map((b) => {
        const match = b.match as Record<string, unknown>;
        const peer = match?.peer as Record<string, unknown>;
        const channelId = ((peer?.id as string) || "").replace("channel:", "");
        return {
          channel: match?.channel as string || "unknown",
          accountId: match?.accountId as string || "default",
          channelId,
          guildId: match?.guildId as string || "",
        };
      });

      return {
        id,
        name: (agent.name as string) || id,
        model,
        status: online ? "online" : "offline",
        uptime: online ? uptime : null,
        bindings: boundChannels,
      };
    });

    // Get Discord account info
    const discord = (channels?.discord as Record<string, unknown>) || {};
    const accounts = (discord.accounts as Record<string, unknown>) || {};
    const accountNames = Object.keys(accounts).filter((k) => k !== "default");

    return NextResponse.json({
      online,
      uptime,
      agents: parsedAgents,
      accounts: accountNames,
      gateway: {
        port: ((config.gateway as Record<string, unknown>)?.port as number) || 18789,
        mode: ((config.gateway as Record<string, unknown>)?.mode as string) || "unknown",
      },
      defaults: {
        model: ((defaults.model as Record<string, unknown>)?.primary as string) || "unknown",
        maxConcurrent: (defaults.maxConcurrent as number) || 0,
        workspace: (defaults.workspace as string) || "",
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
