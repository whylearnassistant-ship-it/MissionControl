import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch("http://127.0.0.1:18789/cron", {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    return NextResponse.json({ cron: data, online: true });
  } catch {
    // Return sample data if gateway is unavailable
    return NextResponse.json({
      cron: [],
      online: false,
    });
  }
}
