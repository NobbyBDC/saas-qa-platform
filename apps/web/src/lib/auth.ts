export interface JwtUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
}

export function getUser(): JwtUser | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.orgId,
      isSuperAdmin: payload.role === 'SUPER_ADMIN',
    };
  } catch {
    return null;
  }
}
