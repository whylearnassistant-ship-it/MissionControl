import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [statusRes, agentsRes, cronRes] = await Promise.allSettled([
      fetch("http://127.0.0.1:18789/status", { signal: AbortSignal.timeout(3000) }),
      fetch("http://127.0.0.1:18789/agents", { signal: AbortSignal.timeout(3000) }),
      fetch("http://127.0.0.1:18789/cron", { signal: AbortSignal.timeout(3000) }),
    ]);

    const status = statusRes.status === "fulfilled" ? await statusRes.value.json().catch(() => null) : null;
    const agents = agentsRes.status === "fulfilled" ? await agentsRes.value.json().catch(() => null) : null;
    const cron = cronRes.status === "fulfilled" ? await cronRes.value.json().catch(() => null) : null;

    return NextResponse.json({ status, agents, cron, online: true });
  } catch {
    return NextResponse.json({
      status: null,
      agents: null,
      cron: null,
      online: false,
    });
  }
}
