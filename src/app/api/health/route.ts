import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, service: "webuycars-web-admin" });
}
