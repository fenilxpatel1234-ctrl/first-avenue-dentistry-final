import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { seedInitialClinicalDataIfEmpty } from '../lib/firestoreService';

export interface AdminUserSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: string;
  username?: string;
}

export interface LoginChallengeResult {
  requiresOtp: boolean;
  email: string;
  maskedEmail: string;
  adminName?: string;
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
  signInWithCredentials: (usernameOrEmail: string, pass: string) => Promise<LoginChallengeResult>;
  verifyLoginOtp: (email: string, otp: string) => Promise<void>;
  resendLoginOtp: (email: string) => Promise<{ message: string; maskedEmail: string }>;
  requestPasswordResetOtp: (identifier: string) => Promise<PasswordResetChallengeResult>;
  resetPasswordWithOtp: (email: string, otp: string, newPassword: string) => Promise<string>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(AdminUserSession | User) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check local session cache for verified 2FA admin session
    try {
      const stored = localStorage.getItem('vantage_admin_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.email || parsed.name || parsed.username)) {
          setUser({
            uid: parsed.id || 'admin-fenil',
            email: parsed.email || 'smartyfenil898@gmail.com',
            displayName: parsed.name || 'Dr. Fenil',
            role: parsed.role || 'Super Admin',
            username: parsed.username || 'fenil',
          });
          seedInitialClinicalDataIfEmpty().catch(() => {});
          setLoading(false);
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

    return () => unsubscribe();
  }, []);

  const signInWithCredentials = async (
    usernameOrEmail: string,
    pass: string
  ): Promise<LoginChallengeResult> => {
    const ident = usernameOrEmail.trim();

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ident,
        email: ident,
        password: pass,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Invalid administrator username/email or password.');
    }

    if (data.requiresOtp) {
      return {
        requiresOtp: true,
        email: data.email,
        maskedEmail: data.maskedEmail || data.email,
        adminName: data.adminName,
        message: data.message,
      };
    }

    if (data.success && data.user) {
      const sessionUser: AdminUserSession = {
        uid: data.user.id || 'admin-fenil',
        email: data.user.email || 'smartyfenil898@gmail.com',
        displayName: data.user.name || 'Dr. Fenil',
        role: data.user.role || 'Super Admin',
        username: data.user.username || ident,
      };
      setUser(sessionUser);
      seedInitialClinicalDataIfEmpty().catch(() => {});
      try {
        localStorage.setItem('vantage_admin_session', JSON.stringify(data.user));
      } catch {}
      return {
        requiresOtp: false,
        email: data.user.email,
        maskedEmail: data.user.email,
      };
    }

    throw new Error('Invalid administrator credentials.');
  };

  const verifyLoginOtp = async (email: string, otp: string): Promise<void> => {
    const res = await fetch('/api/admin/verify-login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        otp: otp.trim(),
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success || !data.user) {
      throw new Error(data.error || 'Invalid or expired 6-digit verification code.');
    }

    const sessionUser: AdminUserSession = {
      uid: data.user.id || 'admin-fenil',
      email: data.user.email || 'smartyfenil898@gmail.com',
      displayName: data.user.name || 'Dr. Fenil',
      role: data.user.role || 'Super Admin',
      username: data.user.username || 'fenil',
    };

    setUser(sessionUser);
    seedInitialClinicalDataIfEmpty().catch(() => {});
    try {
      localStorage.setItem('vantage_admin_session', JSON.stringify(data.user));
    } catch {}
  };

  const resendLoginOtp = async (email: string) => {
    const res = await fetch('/api/admin/resend-login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to resend verification code.');
    }
    return {
      message: data.message || 'New 6-digit verification code sent to your email.',
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
        signInWithCredentials,
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
