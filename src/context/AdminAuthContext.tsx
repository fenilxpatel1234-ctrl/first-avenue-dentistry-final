import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getAdminAuthHeaders } from '../lib/authHeaders';
import { authenticateWithPasskey } from '../lib/passkeyService';
import { seedInitialClinicalDataIfEmpty, subscribeToRealtimeClinicEvents } from '../lib/firestoreService';

export interface AdminUserSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: string;
  username?: string;
  doctorId?: string;
  sessionToken?: string;
  hasPasskey?: boolean;
}

export interface LoginChallengeResult {
  requiresOtp: boolean;
  email: string;
  maskedEmail: string;
  adminName?: string;
  role?: string;
  doctorId?: string;
  message?: string;
}

export interface PasswordResetChallengeResult {
  email: string;
  maskedEmail: string;
  username?: string;
  message?: string;
}

interface AdminAuthContextType {
  user: (AdminUserSession | User) | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signInWithCredentials: (
    usernameOrEmail: string,
    pass: string,
    portalMode?: 'admin' | 'doctor'
  ) => Promise<LoginChallengeResult>;
  signInWithPasskey: (
    portalMode: 'admin' | 'doctor',
    identifierHint?: string
  ) => Promise<AdminUserSession>;
  signInAsDoctor: (identifier: string, pass?: string) => Promise<AdminUserSession>;
  verifyLoginOtp: (
    email: string,
    otp: string,
    portalMode?: 'admin' | 'doctor'
  ) => Promise<AdminUserSession>;
  resendLoginOtp: (email: string) => Promise<{ message: string; maskedEmail: string }>;
  requestPasswordResetOtp: (identifier: string) => Promise<PasswordResetChallengeResult>;
  resetPasswordWithOtp: (email: string, otp: string, newPassword: string) => Promise<string>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(AdminUserSession | User) | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const headers = getAdminAuthHeaders();
      if (!headers.Authorization && !headers['X-Admin-Id'] && !headers['X-Admin-Email']) {
        return;
      }
      const res = await fetch('/api/admin/me', { headers });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data.success && data.user) {
        const token = data.sessionToken || data.user.sessionToken;
        const updatedSession: AdminUserSession = {
          uid: data.user.id || 'admin-fenil',
          email: data.user.email || 'fenilxpatel2642@gmail.com',
          displayName: data.user.name || 'Dr. Fenil',
          role: data.user.role || 'Super Admin',
          username: data.user.username || 'fenil',
          doctorId: data.user.doctorId,
          sessionToken: token,
        };
        setUser(updatedSession);
        const toStore = { ...data.user, sessionToken: token };
        localStorage.setItem('vantage_admin_session', JSON.stringify(toStore));
      }
    } catch {}
  }, []);

  useEffect(() => {
    // 1. Check local session cache for active admin or doctor session
    try {
      const stored = localStorage.getItem('vantage_admin_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.email || parsed.name || parsed.username)) {
          setUser({
            uid: parsed.id || parsed.uid || 'admin-fenil',
            email: parsed.email || 'fenilxpatel2642@gmail.com',
            displayName: parsed.name || parsed.displayName || 'Dr. Fenil',
            role: parsed.role || 'Super Admin',
            username: parsed.username || 'fenil',
            doctorId: parsed.doctorId,
            sessionToken: parsed.sessionToken,
          });
          seedInitialClinicalDataIfEmpty().catch(() => {});
          setLoading(false);
          refreshSession().catch(() => {});
        }
      }
    } catch {}

    // 2. Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        seedInitialClinicalDataIfEmpty().catch(() => {});
      }
      setLoading(false);
    });

    // 3. Real-time role & account sync via SSE
    const unsubSse = subscribeToRealtimeClinicEvents((ev) => {
      if (ev.type === 'admins_updated') {
        refreshSession().catch(() => {});
      }
    });

    return () => {
      unsubscribe();
      unsubSse();
    };
  }, [refreshSession]);

  const signInAsDoctor = async (
    identifier: string,
    pass: string = '1234567890'
  ): Promise<AdminUserSession> => {
    const cleanIdent = identifier.trim();
    const res = await fetch('/api/doctor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: cleanIdent,
        username: cleanIdent,
        email: cleanIdent,
        password: pass,
        portalMode: 'doctor',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.user) {
      throw new Error(data.error || 'Invalid doctor credentials.');
    }

    const token = data.sessionToken || data.user?.sessionToken;
    const sessionUser: AdminUserSession = {
      uid: data.user.id || `doc-${data.user.doctorId || '1'}`,
      email: data.user.email || 'firstavenuedentistry@gmail.com',
      displayName: data.user.name || 'Doctor',
      role: data.user.role || 'Doctor',
      username: data.user.username || cleanIdent,
      doctorId: data.user.doctorId,
      sessionToken: token,
    };

    setUser(sessionUser);
    seedInitialClinicalDataIfEmpty().catch(() => {});
    try {
      const toStore = { ...data.user, sessionToken: token };
      localStorage.setItem('vantage_admin_session', JSON.stringify(toStore));
    } catch {}
    return sessionUser;
  };

  const signInWithCredentials = async (
    usernameOrEmail: string,
    pass: string,
    portalMode?: 'admin' | 'doctor'
  ): Promise<LoginChallengeResult> => {
    const ident = usernameOrEmail.trim();
    const endpoint = portalMode === 'doctor' ? '/api/doctor/login' : '/api/admin/login';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: ident,
        username: ident,
        email: ident,
        password: pass,
        portalMode,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.error ||
          (portalMode === 'doctor'
            ? 'Invalid doctor username/email or password.'
            : 'Invalid administrator username/email or password.')
      );
    }

    if (data.requiresOtp) {
      return {
        requiresOtp: true,
        email: data.email,
        maskedEmail: data.maskedEmail || data.email,
        adminName: data.adminName,
        role: data.role,
        doctorId: data.doctorId,
        message: data.message,
      };
    }

    if (data.success && data.user) {
      const token = data.sessionToken || data.user?.sessionToken;
      const sessionUser: AdminUserSession = {
        uid: data.user.id || 'admin-fenil',
        email: data.user.email || 'fenilxpatel2642@gmail.com',
        displayName: data.user.name || 'Dr. Fenil',
        role: data.user.role || 'Super Admin',
        username: data.user.username || ident,
        doctorId: data.user.doctorId,
        sessionToken: token,
      };
      setUser(sessionUser);
      seedInitialClinicalDataIfEmpty().catch(() => {});
      try {
        const toStore = { ...data.user, sessionToken: token };
        localStorage.setItem('vantage_admin_session', JSON.stringify(toStore));
      } catch {}
      return {
        requiresOtp: false,
        email: data.user.email,
        maskedEmail: data.user.email,
        adminName: data.user.name,
        role: data.user.role,
        doctorId: data.user.doctorId,
        message: data.message || 'Signed in successfully.',
      };
    }

    throw new Error('Invalid credentials.');
  };

  const signInWithPasskey = async (
    portalMode: 'admin' | 'doctor',
    identifierHint?: string
  ): Promise<AdminUserSession> => {
    const result = await authenticateWithPasskey(portalMode, identifierHint);
    const token = result.sessionToken || result.user?.sessionToken;
    const sessionUser: AdminUserSession = {
      uid: result.user.id || 'admin-fenil',
      email: result.user.email || 'fenilxpatel2642@gmail.com',
      displayName: result.user.name || 'Dr. Fenil',
      role: result.user.role || 'Super Admin',
      username: result.user.username || 'fenil',
      doctorId: result.user.doctorId,
      sessionToken: token,
    };

    setUser(sessionUser);
    seedInitialClinicalDataIfEmpty().catch(() => {});
    try {
      const toStore = { ...result.user, sessionToken: token };
      localStorage.setItem('vantage_admin_session', JSON.stringify(toStore));
    } catch {}
    return sessionUser;
  };

  const verifyLoginOtp = async (
    email: string,
    otp: string,
    portalMode?: 'admin' | 'doctor'
  ): Promise<AdminUserSession> => {
    const res = await fetch('/api/admin/verify-login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        otp: otp.trim(),
        portalMode,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success || !data.user) {
      throw new Error(data.error || 'Invalid or expired 6-digit access code.');
    }

    const token = data.sessionToken || data.user?.sessionToken;
    const hasPasskey = Boolean(data.hasPasskey ?? data.user?.hasPasskey);
    const sessionUser: AdminUserSession = {
      uid: data.user.id || 'admin-fenil',
      email: data.user.email || 'fenilxpatel2642@gmail.com',
      displayName: data.user.name || 'Dr. Fenil',
      role: data.user.role || 'Super Admin',
      username: data.user.username || 'fenil',
      doctorId: data.user.doctorId,
      sessionToken: token,
      hasPasskey,
    };

    setUser(sessionUser);
    seedInitialClinicalDataIfEmpty().catch(() => {});
    try {
      const toStore = { ...data.user, sessionToken: token };
      localStorage.setItem('vantage_admin_session', JSON.stringify(toStore));
    } catch {}
    return sessionUser;
  };

  const resendLoginOtp = async (email: string) => {
    const res = await fetch('/api/admin/resend-login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to resend access code.');
    }
    return {
      message: data.message || 'New 6-digit access code sent to your email.',
      maskedEmail: data.maskedEmail || email,
    };
  };

  const requestPasswordResetOtp = async (
    identifier: string
  ): Promise<PasswordResetChallengeResult> => {
    const res = await fetch('/api/admin/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Could not find administrator account.');
    }
    return {
      email: data.email,
      maskedEmail: data.maskedEmail || data.email,
      username: data.username,
      message: data.message,
    };
  };

  const resetPasswordWithOtp = async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<string> => {
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        otp: otp.trim(),
        newPassword: newPassword.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password.');
    }
    return data.message || 'Password updated successfully!';
  };

  const signOut = async () => {
    try {
      const stored = localStorage.getItem('vantage_admin_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.sessionToken) {
          fetch('/api/admin/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${parsed.sessionToken}`,
            },
          }).catch(() => {});
        }
      }
      localStorage.removeItem('vantage_admin_session');
    } catch {}
    try {
      await firebaseSignOut(auth);
    } catch {}
    setUser(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        loading,
        refreshSession,
        signInWithCredentials,
        signInWithPasskey,
        signInAsDoctor,
        verifyLoginOtp,
        resendLoginOtp,
        requestPasswordResetOtp,
        resetPasswordWithOtp,
        signOut,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
