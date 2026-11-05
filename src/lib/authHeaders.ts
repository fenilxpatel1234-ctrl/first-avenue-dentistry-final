/**
 * Client authentication header generator for First Avenue Dentistry API
 * Securely retrieves session token from active 2FA admin/doctor session.
 */

export function getAdminAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('vantage_admin_session');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const token = parsed?.sessionToken;
    if (token && typeof token === 'string') {
      return {
        Authorization: `Bearer ${token}`,
        'X-Session-Token': token,
      };
    }
  } catch {}
  return {};
}
