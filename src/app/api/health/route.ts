import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Render health check. Deliberately does not touch the database, so a short
// database outage does not take the web service offline.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
