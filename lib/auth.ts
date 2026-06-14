import * as jose from "jose";
import { cookies } from "next/headers";

// Security: Throw at startup in production if JWT_SECRET is not set
const jwtSecretRaw = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && !jwtSecretRaw) {
  throw new Error("JWT_SECRET environment variable is required in production.");
}

if (!jwtSecretRaw) {
  console.warn(
    "[auth] WARNING: JWT_SECRET is not set. Using a default dev secret. DO NOT use this in production."
  );
}

const secret = new TextEncoder().encode(
  jwtSecretRaw || "default_super_secret_key_for_development_only_32+"
);

export async function signToken(payload: Record<string, unknown>) {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return await verifyToken(token);
}
