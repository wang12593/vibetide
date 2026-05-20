import type { SsoProvider, SsoTokenResult, SsoUserInfo } from "./base";

export class FeishuProvider implements SsoProvider {
  name = "feishu";
  private appId: string;
  private appSecret: string;

  constructor(opts: { appId: string; appSecret: string }) {
    this.appId = opts.appId;
    this.appSecret = opts.appSecret;
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: redirectUri,
      state,
    });
    return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
  }

  async exchangeToken(code: string): Promise<SsoTokenResult> {
    const tokenUrl = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal";
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.code !== 0) {
      throw new Error(`Feishu token error: ${tokenData.msg}`);
    }

    const userTokenUrl = "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token";
    const userTokenRes = await fetch(userTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.app_access_token}`,
      },
      body: JSON.stringify({ grant_type: "authorization_code", code }),
    });
    const userTokenData = await userTokenRes.json();

    if (userTokenData.code !== 0) {
      throw new Error(`Feishu user token error: ${userTokenData.msg}`);
    }

    return {
      accessToken: userTokenData.data.access_token,
      refreshToken: userTokenData.data.refresh_token,
      expiresIn: userTokenData.data.expires_in ?? 7200,
    };
  }

  async getUserInfo(accessToken: string): Promise<SsoUserInfo> {
    const url = "https://open.feishu.cn/open-apis/authen/v1/user_info";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();

    if (data.code !== 0) {
      throw new Error(`Feishu userinfo error: ${data.msg}`);
    }

    return {
      externalId: data.data.user_id ?? data.data.open_id,
      name: data.data.name ?? "",
      email: data.data.email,
      avatar: data.data.avatar_url,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<SsoTokenResult> {
    const tokenUrl = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal";
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const tokenData = await tokenRes.json();

    const refreshUrl = "https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token";
    const refreshRes = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.app_access_token}`,
      },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const refreshData = await refreshRes.json();

    return {
      accessToken: refreshData.data.access_token,
      expiresIn: refreshData.data.expires_in ?? 7200,
    };
  }
}
