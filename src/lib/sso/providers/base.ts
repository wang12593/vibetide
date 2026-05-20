export interface SsoTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface SsoUserInfo {
  externalId: string;
  name: string;
  email?: string;
  avatar?: string;
  orgId?: string;
}

export interface SsoProvider {
  name: string;
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeToken(code: string): Promise<SsoTokenResult>;
  getUserInfo(accessToken: string): Promise<SsoUserInfo>;
  refreshAccessToken(refreshToken: string): Promise<SsoTokenResult>;
}
