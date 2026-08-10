import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyMessage } from "viem";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/db";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    const { address, signature } = await req.json();

    if (!address || !signature) {
      return NextResponse.json(
        { error: "Address and signature are required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const nonce = cookieStore.get("auth_nonce")?.value;

    if (!nonce) {
      return NextResponse.json(
        { error: "Authentication challenge expired. Please request a new nonce." },
        { status: 400 }
      );
    }

    // Reconstruct the message that the client signed
    const message = `Sign in to MergePay with nonce: ${nonce}`;

    // Verify the signature using viem
    let isValid = false;
    try {
      isValid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to verify signature structure" },
        { status: 400 }
      );
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature. Authentication failed." },
        { status: 401 }
      );
    }

    // Connect to database
    await dbConnect();

    const normalizedAddress = address.toLowerCase();

    // Check if user exists, otherwise create
    let user = await User.findById(normalizedAddress);
    if (!user) {
      user = await User.create({
        _id: normalizedAddress,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { address: normalizedAddress },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" }
    );

    const response = NextResponse.json({ success: true, user });

    // Store JWT in an httpOnly cookie (valid for 24h)
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // Clear the transient authentication nonce
    cookieStore.delete("auth_nonce");

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
