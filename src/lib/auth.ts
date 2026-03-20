import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "mission-control-secret-change-me-in-production"
);

const USERS = [
  { id: "1", username: "admin", password: "admin", name: "Administrator" },
];

export async function authenticate(username: string, password: string) {
  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) return null;

  const token = await new SignJWT({ sub: user.id, username: user.username, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  return { token, user: { id: user.id, username: user.username, name: user.name } };
}

export async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; username: string; name: string };
  } catch {
    return null;
  }
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string; username: string; name: string };
  } catch {
    return null;
  }
}
