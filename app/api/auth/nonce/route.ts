import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const nonce = crypto.randomUUID();

  // Set a short-lived HTTPOnly cookie for the nonce (expires in 5 minutes)
  const cookieStore = await cookies();
  cookieStore.set("auth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60, // 5 minutes
  });

  return NextResponse.json({ nonce });
}
