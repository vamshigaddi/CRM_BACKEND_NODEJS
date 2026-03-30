export interface JwtPayload {
  sub: string;
  role: string;
  tenantId: string;
  iat?: number;
  exp?: number;
}
