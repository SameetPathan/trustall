import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Stall } from "@/db/schema";
import { getStallById } from "./store";

const COOKIE = "trustall_owner";

function secret(): string {
  // SESSION_SECRET is preferred. The fallback keeps a fresh clone working, and is
  // still server-only: it is derived from values the browser never sees.
  return (
    process.env.SESSION_SECRET ??
    createHash("sha256")
      .update(`${process.env.DATABASE_URL ?? ""}|${process.env.OWNER_DEMO_PASSCODE ?? ""}|trustall`)
      .digest("hex")
  );
}

function sign(stallId: string): string {
  return createHmac("sha256", secret()).update(stallId).digest("hex");
}

export async function setOwnerSession(stallId: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${stallId}.${sign(stallId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearOwnerSession() {
  (await cookies()).delete(COOKIE);
}

/** The stall this browser is signed in to as owner, or null. */
export async function getOwnerStall(): Promise<Stall | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const stallId = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), "hex");
  const expected = Buffer.from(sign(stallId), "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return getStallById(stallId);
}
