import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const result = await authenticate(username, password);

  if (!result) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ user: result.user });
  response.cookies.set("auth-token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
