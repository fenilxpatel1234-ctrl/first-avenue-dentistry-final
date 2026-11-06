import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  ShieldCheck,
  User,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Mail,
  RefreshCw,
  Stethoscope,
  Fingerprint,
  X,
} from 'lucide-react';
import { useAdminAuth, AdminUserSession } from '../../context/AdminAuthContext';
import { registerPasskeyOnDevice } from '../../lib/passkeyService';

interface AdminLoginPageProps {
  onNavigateToAdmin: () => void;
  onNavigateToDoctor?: () => void;
  onNavigateToPublic: () => void;
  initialMode?: 'admin' | 'doctor';
}

type AuthStep =
  | 'credentials'
  | 'login_otp'
  | 'passkey_prompt'
  | 'forgot_request'
  | 'forgot_verify';

function isDoctorSession(session: AdminUserSession | null | undefined): boolean {
  if (!session) return false;
  const role = String(session.role || '').trim().toLowerCase();
  if (
    role === 'super admin' ||
    role === 'clinic admin' ||
    role.includes('receptionist') ||
    role.includes('coordinator')
  ) {
    return false;
  }
  return role === 'doctor' || role.includes('specialist') || Boolean(session.doctorId);
}

export default function AdminLoginPage({
  onNavigateToAdmin,
  onNavigateToDoctor,
  onNavigateToPublic,
  initialMode = 'admin',
}: AdminLoginPageProps) {
  const {
    user,
    loading,
    signInWithCredentials,
    signInWithPasskey,
    verifyLoginOtp,
    resendLoginOtp,
    requestPasswordResetOtp,
    resetPasswordWithOtp,
  } = useAdminAuth();

  const portalMode: 'admin' | 'doctor' = initialMode === 'doctor' ? 'doctor' : 'admin';
  const [step, setStep] = useState<AuthStep>('credentials');

  // Login Credentials State (Email/Username + Password)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Access Code State
  const [loginTargetEmail, setLoginTargetEmail] = useState('');
  const [loginMaskedEmail, setLoginMaskedEmail] = useState('');
  const [loginAdminName, setLoginAdminName] = useState('');
  const [loginOtpCode, setLoginOtpCode] = useState('');
  const [verifiedSessionUser, setVerifiedSessionUser] = useState<AdminUserSession | null>(null);

  // Forgot / Reset Password State
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isSavingFirstPasskey, setIsSavingFirstPasskey] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [idleTimedOut, setIdleTimedOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_idle_timeout') === 'true') {
      setIdleTimedOut(true);
      sessionStorage.removeItem('admin_idle_timeout');
    }
  }, []);

  // Set noindex, nofollow meta tag on admin/doctor routes to prevent search engine indexing
  useEffect(() => {
    let metaTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'robots';
      document.head.appendChild(metaTag);
      created = true;
    }
    const previousContent = metaTag.content;
    metaTag.content = 'noindex, nofollow';

    return () => {
      if (created && metaTag) {
        document.head.removeChild(metaTag);
      } else if (metaTag) {
        metaTag.content = previousContent || '';
      }
    };
  }, []);

  const proceedToPortal = () => {
    if (portalMode === 'doctor' && onNavigateToDoctor) {
      onNavigateToDoctor();
    } else {
      onNavigateToAdmin();
    }
  };

  // Only redirect if already signed in prior to starting the login flow (never interrupt passkey_prompt)
  useEffect(() => {
    if (!loading && user && step === 'credentials' && !isSubmitting && !isPasskeyLoading) {
      const sessionUser = user as AdminUserSession;
      const isDoc = isDoctorSession(sessionUser);
      if (portalMode === 'doctor' && isDoc && onNavigateToDoctor) {
        onNavigateToDoctor();
      } else if (portalMode === 'admin' && !isDoc) {
        onNavigateToAdmin();
      }
    }
  }, [user, loading, step, isSubmitting, isPasskeyLoading, portalMode, onNavigateToAdmin, onNavigateToDoctor]);

  // Step 1: Validate Username/Email + Password
  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdent = identifier.trim();
    if (!cleanIdent || !password.trim()) {
      setErrorMessage(
        portalMode === 'doctor'
          ? 'Please enter both your doctor email/username and password.'
          : 'Please enter both administrative username/email and password.'
      );
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const challenge = await signInWithCredentials(cleanIdent, password, portalMode);
      if (challenge.requiresOtp) {
        setLoginTargetEmail(challenge.email);
        setLoginMaskedEmail(challenge.maskedEmail);
        setLoginAdminName(
          challenge.adminName || (portalMode === 'doctor' ? 'Doctor' : 'Staff Member')
        );
        setLoginOtpCode('');
        setStep('login_otp');
        setSuccessMessage(
          challenge.message || `Please enter the 6-digit access code sent to ${challenge.maskedEmail}.`
        );
      } else {
        proceedToPortal();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        msg ||
          (portalMode === 'doctor'
            ? 'Invalid doctor email/username or password.'
            : 'Invalid administrator username or password.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Passkey Sign-In (Bypasses email access code step)
  const handlePasskeySignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPasskeyLoading(true);

    try {
      await signInWithPasskey(portalMode, identifier.trim());
      proceedToPortal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Passkey sign-in could not be completed.');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  // Step 2: Verify Access Code -> If first-time login (no saved passkey), trigger Google Passkey browser notification prompt
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = loginOtpCode.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit access code sent to your email.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const sessionUser = await verifyLoginOtp(loginTargetEmail, cleanOtp, portalMode);
      setVerifiedSessionUser(sessionUser);

      if (!sessionUser.hasPasskey) {
        // Trigger browser notification if permitted + show Google Passkey Manager browser prompt
        try {
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification('Google Password Manager • Save Passkey', {
                body: `Save a passkey for ${sessionUser.displayName || sessionUser.username} on First Avenue Dentistry for 1-click sign-in.`,
              });
            } else if (Notification.permission === 'default') {
              Notification.requestPermission().catch(() => {});
            }
          }
        } catch {}

        setSuccessMessage(null);
        setErrorMessage(null);
        setStep('passkey_prompt');
      } else {
        proceedToPortal();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Incorrect or expired access code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Google-style Passkey on First Login
  const handleCreateGooglePasskeyOnFirstLogin = async () => {
    setIsSavingFirstPasskey(true);
    setErrorMessage(null);
    try {
      await registerPasskeyOnDevice();
      proceedToPortal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Could not save passkey. Entering portal...');
      setTimeout(() => {
        proceedToPortal();
      }, 1200);
    } finally {
      setIsSavingFirstPasskey(false);
    }
  };

  // Resend Access Code
  const handleResendLoginOtp = async () => {
    if (!loginTargetEmail) return;
    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await resendLoginOtp(loginTargetEmail);
      setSuccessMessage(res.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Failed to resend access code.');
    } finally {
      setIsResending(false);
    }
  };

  // Forgot Password Step 1: Request Reset Code
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdent = resetIdentifier.trim();
    if (!cleanIdent) {
      setErrorMessage('Please enter your username or registered email.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await requestPasswordResetOtp(cleanIdent);
      setResetTargetEmail(res.email);
      setResetMaskedEmail(res.maskedEmail);
      setResetOtpCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setStep('forgot_verify');
      setSuccessMessage(
        res.message || `6-digit password reset code sent to ${res.maskedEmail}.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Account not found.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Forgot Password Step 2: Verify Code & Set New Password
  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = resetOtpCode.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit password reset code from your email.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword.trim() !== confirmNewPassword.trim()) {
      setErrorMessage('New password and confirmation password do not match.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const msg = await resetPasswordWithOtp(
        resetTargetEmail,
        cleanOtp,
        newPassword.trim()
      );
      setIdentifier(resetIdentifier.trim());
      setPassword('');
      setStep('credentials');
      setSuccessMessage(msg || 'Password reset successfully! Please sign in with your new password.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#060C16] text-white flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden font-sans">
      {/* Subtle clinical background glow (pure navy/blue, no AI purple) */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#1E5AFF]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#0452FF]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* GOOGLE CHROME / GOOGLE PASSWORD MANAGER BROWSER NOTIFICATION BUBBLE ON FIRST-TIME LOGIN */}
      <AnimatePresence>
        {step === 'passkey_prompt' && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-[380px] rounded-2xl bg-[#202124] text-[#E8EAED] border border-[#3C4043] shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-5 font-sans"
            role="dialog"
            aria-labelledby="google-passkey-prompt-title"
          >
            {/* Top Bar: Google Logo + Google Password Manager Title + Close */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#3C4043]">
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span className="text-xs font-medium text-[#E8EAED] tracking-tight">
                  Google Password Manager
                </span>
              </div>
              <button
                type="button"
                onClick={proceedToPortal}
                disabled={isSavingFirstPasskey}
                className="p-1 rounded-full text-[#9AA0A6] hover:text-white hover:bg-[#303134] transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="pt-4 space-y-3.5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#8AB4F8]/15 border border-[#8AB4F8]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Fingerprint className="w-5 h-5 text-[#8AB4F8]" />
                </div>
                <div className="space-y-1">
                  <h2
                    id="google-passkey-prompt-title"
                    className="text-sm font-semibold text-white leading-snug"
                  >
                    Sign in faster with a passkey?
                  </h2>
                  <p className="text-xs text-[#9AA0A6] leading-relaxed">
                    With a passkey, you can sign in to{' '}
                    <span className="text-[#E8EAED] font-medium">First Avenue Dentistry</span> using
                    your fingerprint, face, or screen lock — without needing a password or access
                    code.
                  </p>
                </div>
              </div>

              {/* Account Pill */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#303134] border border-[#3C4043]">
                <div className="w-8 h-8 rounded-full bg-[#1E5AFF] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(
                    verifiedSessionUser?.displayName ||
                    verifiedSessionUser?.username ||
                    loginAdminName ||
                    'S'
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {verifiedSessionUser?.displayName || loginAdminName || 'Staff Account'}
                  </div>
                  <div className="text-[11px] text-[#9AA0A6] truncate">
                    {verifiedSessionUser?.username
                      ? `@${verifiedSessionUser.username} • ${verifiedSessionUser.email || loginTargetEmail}`
                      : loginTargetEmail}
                  </div>
                </div>
                <KeyRound className="w-4 h-4 text-[#8AB4F8] shrink-0" />
              </div>

              {/* Action Buttons (Google Chrome Dialog Style) */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={proceedToPortal}
                  disabled={isSavingFirstPasskey}
                  className="px-4 py-2 rounded-full border border-[#5F6368] hover:bg-[#303134] text-[#8AB4F8] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={handleCreateGooglePasskeyOnFirstLogin}
                  disabled={isSavingFirstPasskey}
                  className="px-4 py-2 rounded-full bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  {isSavingFirstPasskey ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#202124]/30 border-t-[#202124] rounded-full animate-spin" />
                      <span>Saving passkey...</span>
                    </>
                  ) : (
                    <span>Create a passkey</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateToPublic}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#8E8E93] hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Return to Public Website</span>
        </button>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-[#0B132B] border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl space-y-6"
        >
          {/* Logo & Portal Branding */}
          <div className="text-center space-y-3">
            <div className="w-full max-w-[240px] mx-auto py-1 flex items-center justify-center">
              <img
                src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
                alt="First Avenue Dentistry Logo"
                className="h-12 sm:h-14 w-auto max-w-full object-contain"
              />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {step === 'login_otp'
                  ? 'Identity Confirmation'
                  : step === 'passkey_prompt'
                  ? 'Save Passkey to Browser'
                  : step === 'forgot_request' || step === 'forgot_verify'
                  ? 'Reset Portal Password'
                  : portalMode === 'doctor'
                  ? 'First Avenue Dentistry Doctor Portal'
                  : 'First Avenue Dentistry Admin Portal'}
              </h1>
              <p className="text-xs text-[#8E8E93] mt-1">
                {portalMode === 'doctor'
                  ? 'Specialist & Doctor Schedule Portal • St. Thomas, ON'
                  : 'Clinical Administration & Staff Portal • St. Thomas, ON'}
              </p>
            </div>
          </div>

          {idleTimedOut && step === 'credentials' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Session Expired (5-Minute Inactivity)</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  You were automatically logged out after 5 minutes of idle time to safeguard patient privacy.
                </p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ================= CREDENTIALS & PASSKEY STEP ================= */}
          {step === 'credentials' && (
            <div className="space-y-4">
              <form onSubmit={handleCredentialsSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#8E8E93]">
                    {portalMode === 'doctor' ? 'Doctor Email or Username' : 'Admin Email or Username'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={
                        portalMode === 'doctor'
                          ? 'Enter doctor email or username'
                          : 'Enter admin email or username'
                      }
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-[#8E8E93]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetIdentifier(identifier);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        setStep('forgot_request');
                      }}
                      className="text-[11px] font-semibold text-[#1E5AFF] hover:text-white transition-colors cursor-pointer"
                    >
                      Forgot / Reset Password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isPasskeyLoading || loading}
                  className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Login</span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-white/10" />
                <span className="flex-shrink mx-3 text-[10px] font-semibold uppercase tracking-widest text-[#8E8E93]">
                  or instant passkey
                </span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={isPasskeyLoading || isSubmitting || loading}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-[#1E5AFF]/60 text-white font-semibold text-xs tracking-wide transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                {isPasskeyLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating Passkey...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-[#1E5AFF]" />
                    <span>Sign in with a Passkey</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* VIEW 2: ACCESS CODE CONFIRMATION */}
          {step === 'login_otp' && (
            <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#1E5AFF]/10 border border-[#1E5AFF]/30 text-xs text-white/90 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#1E5AFF]" />
                  <span>Access Code Sent for {loginAdminName}</span>
                </div>
                <p className="text-[11px] text-[#A1A1A8]">
                  Check <strong className="text-white">{loginMaskedEmail}</strong> for your 6-digit access code.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  6-Digit Access Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={loginOtpCode}
                  onChange={(e) => setLoginOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-center text-xl font-bold tracking-[0.5em] text-white placeholder:text-white/20 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || loginOtpCode.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Access Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {portalMode === 'doctor'
                        ? 'Verify & Enter Doctor Portal'
                        : 'Verify & Enter Admin Portal'}
                    </span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[#8E8E93] hover:text-white font-semibold cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </button>

                <button
                  type="button"
                  disabled={isResending}
                  onClick={handleResendLoginOtp}
                  className="text-[#1E5AFF] hover:text-white font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  <span>{isResending ? 'Sending...' : 'Resend Code'}</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 2B: FIRST-TIME LOGIN GOOGLE PASSKEY PROMPT STATE */}
          {step === 'passkey_prompt' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-center">
                <div className="w-12 h-12 rounded-full bg-[#1E5AFF]/15 border border-[#1E5AFF]/30 flex items-center justify-center mx-auto">
                  <Fingerprint className="w-6 h-6 text-[#1E5AFF]" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Save Your Passkey in Google Password Manager
                </h3>
                <p className="text-xs text-[#A1A1A8] leading-relaxed">
                  Use the browser prompt in the top-right corner or click below to save a passkey for{' '}
                  <strong className="text-white">
                    {verifiedSessionUser?.displayName || loginAdminName}
                  </strong>
                  . Next time you can sign in directly with a single click.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateGooglePasskeyOnFirstLogin}
                disabled={isSavingFirstPasskey}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSavingFirstPasskey ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Passkey...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    <span>Create a Passkey &amp; Continue</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={proceedToPortal}
                disabled={isSavingFirstPasskey}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[#8E8E93] hover:text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Skip for now &amp; Enter Portal
              </button>
            </div>
          )}

          {/* VIEW 3: FORGOT PASSWORD STEP 1 */}
          {step === 'forgot_request' && (
            <form onSubmit={handleRequestPasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  Username or Registered Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder="Enter username or email"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending Reset Code...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send 6-Digit Reset Code</span>
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs text-[#8E8E93] hover:text-white font-semibold cursor-pointer inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Login</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 4: FORGOT PASSWORD STEP 2 */}
          {step === 'forgot_verify' && (
            <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  6-Digit Reset Code (Sent to {resetMaskedEmail})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={resetOtpCode}
                  onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-center text-lg font-bold tracking-[0.45em] text-white placeholder:text-white/20 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  New Portal Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || resetOtpCode.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Code &amp; Save New Password</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[#8E8E93] hover:text-white font-semibold cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRequestPasswordReset}
                  className="text-[#1E5AFF] hover:text-white font-semibold cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resend Reset Code</span>
                </button>
              </div>
            </form>
          )}

        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center text-xs text-[#8E8E93] gap-2 pt-4">
        <span>&copy; {new Date().getFullYear()} First Avenue Family Dentistry. All rights reserved.</span>
      </footer>
    </div>
  );
}
