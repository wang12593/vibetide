import type { SsoProvider, SsoTokenResult, SsoUserInfo } from "./base";

export class WechatWorkProvider implements SsoProvider {
  name = "wechat_work";
  private corpId: string;
  private agentId: string;
  private secret: string;

  constructor(opts: { corpId: string; agentId: string; secret: string }) {
    this.corpId = opts.corpId;
    this.agentId = opts.agentId;
    this.secret = opts.secret;
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      appid: this.corpId,
      agentid: this.agentId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "snsapi_base",
      state,
    });
    return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
  }

  async exchangeToken(code: string): Promise<SsoTokenResult> {
    const accessTokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.secret}`;
    const tokenRes = await fetch(accessTokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.errcode !== 0) {
      throw new Error(`WechatWork token error: ${tokenData.errmsg}`);
    }

    const userUrl = `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${tokenData.access_token}&code=${code}`;
    const userRes = await fetch(userUrl);
    const userData = await userRes.json();

    if (userData.errcode !== 0) {
      throw new Error(`WechatWork user error: ${userData.errmsg}`);
    }

    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in ?? 7200,
    };
  }

  async getUserInfo(accessToken: string): Promise<SsoUserInfo> {
    return {
      externalId: "",
      name: "",
    };
  }

  async refreshAccessToken(_refreshToken: string): Promise<SsoTokenResult> {
    return this.exchangeToken("");
  }
}
