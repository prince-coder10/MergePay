import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  
  // Terminate session by deleting the cookie
  cookieStore.delete("session");
  
  return NextResponse.json({ success: true });
}
