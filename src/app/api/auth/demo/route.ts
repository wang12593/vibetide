import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const res = NextResponse.redirect(new URL("/home", req.url));

  const demoSession = {
    access_token: "demo-access-token-" + Date.now(),
    refresh_token: "demo-refresh-token",
    token_type: "bearer",
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: {
      id: "demo-user",
      email: "demo@vibetide.local",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: { full_name: "演示用户" },
      created_at: new Date().toISOString(),
    },
  };

  res.cookies.set(
    "sb-vibetide-auth-token",
    JSON.stringify(demoSession),
    {
      httpOnly: true,
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
    }
  );

  return res;
}
