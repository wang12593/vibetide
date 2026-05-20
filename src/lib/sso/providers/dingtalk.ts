import type { SsoProvider, SsoTokenResult, SsoUserInfo } from "./base";

export class DingtalkProvider implements SsoProvider {
  name = "dingtalk";
  private clientId: string;
  private clientSecret: string;

  constructor(opts: { clientId: string; clientSecret: string }) {
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid",
      prompt: "consent",
      state,
    });
    return `https://login.dingtalk.com/oauth2/challenge.htm?${params.toString()}`;
  }

  async exchangeToken(code: string): Promise<SsoTokenResult> {
    const url = "https://api.dingtalk.com/v1.0/oauth2/userAccessToken";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        code,
        grantType: "authorization_code",
      }),
    });
    const data = await res.json();

    if (data.accessToken) {
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expireIn ?? 7200,
      };
    }

    throw new Error(`Dingtalk token error: ${JSON.stringify(data)}`);
  }

  async getUserInfo(accessToken: string): Promise<SsoUserInfo> {
    const url = "https://api.dingtalk.com/v1.0/contact/users/me";
    const res = await fetch(url, {
      headers: { "x-acs-dingtalk-access-token": accessToken },
    });
    const data = await res.json();

    return {
      externalId: data.unionId ?? data.openId,
      name: data.nick ?? data.name ?? "",
      email: data.email,
      avatar: data.avatarUrl,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<SsoTokenResult> {
    const url = "https://api.dingtalk.com/v1.0/oauth2/userAccessToken";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken,
        grantType: "refresh_token",
      }),
    });
    const data = await res.json();

    return {
      accessToken: data.accessToken,
      expiresIn: data.expireIn ?? 7200,
    };
  }
}
