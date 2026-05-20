import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { ssoConnections, userProfiles, organizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { FeishuProvider } from "@/lib/sso/providers/feishu";
import { DingtalkProvider } from "@/lib/sso/providers/dingtalk";
import { WechatWorkProvider } from "@/lib/sso/providers/wechat-work";
import type { SsoProvider } from "@/lib/sso/providers/base";

function getProvider(provider: string): SsoProvider | null {
  switch (provider) {
    case "feishu":
      return new FeishuProvider({
        appId: process.env.FEISHU_APP_ID ?? "",
        appSecret: process.env.FEISHU_APP_SECRET ?? "",
      });
    case "dingtalk":
      return new DingtalkProvider({
        clientId: process.env.DINGTALK_APP_KEY ?? "",
        clientSecret: process.env.DINGTALK_APP_SECRET ?? "",
      });
    case "wechat-work":
      return new WechatWorkProvider({
        corpId: process.env.WECHAT_WORK_CORP_ID ?? "",
        agentId: process.env.WECHAT_WORK_AGENT_ID ?? "",
        secret: process.env.WECHAT_WORK_CORP_SECRET ?? "",
      });
    default:
      return null;
  }
}

function getRedirectUri(provider: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/auth/sso/${provider}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerName } = await params;
  const ssoProvider = getProvider(providerName);

  if (!ssoProvider) {
    return NextResponse.redirect(new URL("/login?sso=error", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    const generatedState = crypto.randomUUID().replace(/-/g, "");
    const redirectUri = getRedirectUri(providerName);
    const authUrl = ssoProvider.getAuthUrl(generatedState, redirectUri);

    const res = NextResponse.redirect(authUrl);
    res.cookies.set("sso_state", generatedState, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    res.cookies.set("sso_provider", providerName, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  }

  const savedState = req.cookies.get("sso_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.redirect(new URL("/login?sso=error", req.url));
  }

  try {
    const tokenResult = await ssoProvider.exchangeToken(code);
    const userInfo = await ssoProvider.getUserInfo(tokenResult.accessToken);

    const supabase = await createClient();

    const existingConnection = await db.query.ssoConnections.findFirst({
      where: and(
        eq(ssoConnections.provider, providerName),
        eq(ssoConnections.externalUserId, userInfo.externalId)
      ),
    });

    let userId: string;

    if (existingConnection) {
      userId = existingConnection.userId;
      await db
        .update(ssoConnections)
        .set({
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken ?? null,
          tokenExpiresAt: new Date(Date.now() + tokenResult.expiresIn * 1000),
          updatedAt: new Date(),
        })
        .where(eq(ssoConnections.id, existingConnection.id));
    } else {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id")
        .limit(1)
        .single();

      const orgId = (orgData as any)?.id;
      if (!orgId) {
        throw new Error("No organization found. Please set up the platform first.");
      }

      const email = userInfo.email ?? `${userInfo.externalId}@sso.${providerName}.local`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: crypto.randomUUID(),
        options: {
          data: {
            full_name: userInfo.name,
            avatar_url: userInfo.avatar,
          },
        },
      });

      if (authError) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: "",
        });
        if (signInError) {
          throw new Error(`SSO auth failed: ${authError.message}`);
        }
        userId = signInData.user!.id;
      } else {
        userId = authData.user!.id;
      }

      await db.insert(ssoConnections).values({
        userId,
        provider: providerName,
        externalUserId: userInfo.externalId,
        externalOrgId: userInfo.orgId ?? null,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken ?? null,
        tokenExpiresAt: new Date(Date.now() + tokenResult.expiresIn * 1000),
        organizationId: orgId,
      });
    }

    const res = NextResponse.redirect(new URL("/home", req.url));
    res.cookies.delete("sso_state");
    res.cookies.delete("sso_provider");
    return res;
  } catch (err) {
    console.error("[SSO] OAuth flow failed:", err);
    const res = NextResponse.redirect(new URL("/login?sso=error", req.url));
    res.cookies.delete("sso_state");
    res.cookies.delete("sso_provider");
    return res;
  }
}
