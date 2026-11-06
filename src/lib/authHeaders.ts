/**
 * Client authentication header generator for First Avenue Dentistry API
 * Securely retrieves session token and identity headers from active admin/doctor session.
 */

export function getAdminAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('vantage_admin_session');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const headers: Record<string, string> = {};
    if (parsed?.sessionToken && typeof parsed.sessionToken === 'string') {
      headers.Authorization = `Bearer ${parsed.sessionToken}`;
      headers['X-Session-Token'] = parsed.sessionToken;
    }
    if (parsed?.id && typeof parsed.id === 'string') {
      headers['X-Admin-Id'] = parsed.id;
    }
    if (parsed?.email && typeof parsed.email === 'string') {
      headers['X-Admin-Email'] = parsed.email;
    }
    return headers;
  } catch {}
  return {};
}
