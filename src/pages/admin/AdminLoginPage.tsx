import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface AdminLoginPageProps {
  onNavigateToAdmin: () => void;
  onNavigateToPublic: () => void;
}

type AuthStep = 'credentials' | 'login_otp' | 'forgot_request' | 'forgot_verify';

export default function AdminLoginPage({
  onNavigateToAdmin,
  onNavigateToPublic,
}: AdminLoginPageProps) {
  const {
    user,
    loading,
    signInWithCredentials,
    verifyLoginOtp,
    resendLoginOtp,
    requestPasswordResetOtp,
    resetPasswordWithOtp,
  } = useAdminAuth();

  const [step, setStep] = useState<AuthStep>('credentials');

  // Login Credentials State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Mandatory 2FA Login OTP State
  const [loginTargetEmail, setLoginTargetEmail] = useState('');
  const [loginMaskedEmail, setLoginMaskedEmail] = useState('');
  const [loginAdminName, setLoginAdminName] = useState('');
  const [loginOtpCode, setLoginOtpCode] = useState('');

  // Forgot / Reset Password State
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status & Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Set noindex, nofollow meta tag on admin routes to prevent search engine indexing
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

  // Redirect to admin dashboard if already signed in
  useEffect(() => {
    if (!loading && user) {
      onNavigateToAdmin();
    }
  }, [user, loading, onNavigateToAdmin]);

  // Step 1: Validate Username/Email + Password -> Triggers 2FA OTP Email
  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdent = identifier.trim();
    if (!cleanIdent || !password.trim()) {
      setErrorMessage('Please enter both administrative username/email and password.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const challenge = await signInWithCredentials(cleanIdent, password);
      if (challenge.requiresOtp) {
        setLoginTargetEmail(challenge.email);
        setLoginMaskedEmail(challenge.maskedEmail);
        setLoginAdminName(challenge.adminName || 'Staff Member');
        setLoginOtpCode('');
        setStep('login_otp');
        setSuccessMessage(
          challenge.message || `6-digit 2FA passcode dispatched to ${challenge.maskedEmail}.`
        );
      } else {
        onNavigateToAdmin();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Invalid administrator username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify Mandatory 2FA Login OTP
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = loginOtpCode.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code sent to your Gmail.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await verifyLoginOtp(loginTargetEmail, cleanOtp);
      onNavigateToAdmin();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || 'Incorrect or expired verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend 2FA Login OTP
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
      setErrorMessage(msg || 'Failed to resend OTP.');
    } finally {
      setIsResending(false);
    }
  };

  // Forgot Password Step 1: Request Reset OTP
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdent = resetIdentifier.trim();
    if (!cleanIdent) {
      setErrorMessage('Please enter your administrator username or registered email.');
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

  // Forgot Password Step 2: Verify OTP & Set New Password
  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = resetOtpCode.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit password reset OTP from your email.');
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

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-[#8E8E93]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1E5AFF]" />
          <span>2FA Protected Clinical Administration</span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-[#0B132B] border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6"
        >
          {/* Logo & Portal Branding */}
          <div className="text-center space-y-3">
            <div className="w-full max-w-[260px] mx-auto py-2 flex items-center justify-center">
              <img
                src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
                alt="First Avenue Dentistry Logo"
                className="h-14 sm:h-16 w-auto max-w-full object-contain"
              />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {step === 'login_otp'
                  ? 'Two-Factor Verification'
                  : step === 'forgot_request' || step === 'forgot_verify'
                  ? 'Reset Admin Password'
                  : 'First Avenue Dentistry Admin'}
              </h1>
              <p className="text-xs text-[#8E8E93] mt-1">
                First Avenue Family Dentistry • St. Thomas, ON
              </p>
            </div>
          </div>

          {/* Security Alert Banner */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-[11px] text-[#A1A1A8] flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-[#1E5AFF] shrink-0 mt-0.5" />
            <span>
              {step === 'login_otp'
                ? `Extra security layer active: Enter the 6-digit OTP sent to ${loginMaskedEmail} to unlock the dashboard.`
                : step === 'forgot_request'
                ? 'Enter your administrator username or email to receive a 6-digit password reset passcode in your Gmail.'
                : step === 'forgot_verify'
                ? `Enter the 6-digit OTP sent to ${resetMaskedEmail} and choose your new password.`
                : 'Restricted portal for authorized clinical staff. Every sign-in requires 2FA OTP verification via Gmail.'}
            </span>
          </div>

          {idleTimedOut && step === 'credentials' && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Session Expired (5-Minute Inactivity)</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  You were automatically logged out after 5 minutes of idle time to safeguard patient privacy and clinical records.
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

          {/* VIEW 1: USERNAME / EMAIL + PASSWORD LOGIN FORM */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  Email or Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter email or username"
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
                disabled={isSubmitting || loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending 2FA Code to Gmail...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Continue with 2FA Verification</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* VIEW 2: MANDATORY 2FA LOGIN OTP VERIFICATION */}
          {step === 'login_otp' && (
            <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
              <div className="p-3 rounded-xl bg-[#1E5AFF]/10 border border-[#1E5AFF]/30 text-xs text-white/90 space-y-1">
                <div className="font-bold text-white flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#1E5AFF]" />
                  <span>Passcode Sent for {loginAdminName}</span>
                </div>
                <p className="text-[11px] text-[#A1A1A8]">
                  Check <strong className="text-white">{loginMaskedEmail}</strong> for your 6-digit login security code.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  6-Digit Security OTP Code
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
                    <span>Verifying 2FA Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify OTP &amp; Enter Admin Portal</span>
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
                  <span>{isResending ? 'Sending...' : 'Resend OTP'}</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: FORGOT PASSWORD STEP 1 (REQUEST OTP) */}
          {step === 'forgot_request' && (
            <form onSubmit={handleRequestPasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  Administrator Username or Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder="e.g. fenil or smartyfenil898@gmail.com"
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
                    <span>Sending Reset OTP to Gmail...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send 6-Digit Reset OTP</span>
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
                  <span>Return to Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW 4: FORGOT PASSWORD STEP 2 (VERIFY OTP & SET NEW PASSWORD) */}
          {step === 'forgot_verify' && (
            <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#8E8E93]">
                  6-Digit Reset OTP (Sent to {resetMaskedEmail})
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
                  New Administrator Password
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
                    <span>Verify OTP &amp; Save New Password</span>
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
                  <span>Back to Sign In</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRequestPasswordReset}
                  className="text-[#1E5AFF] hover:text-white font-semibold cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resend Reset OTP</span>
                </button>
              </div>
            </form>
          )}

          {/* Portal Protocol Info Box */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#8E8E93]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E5AFF]" />
              2FA Gmail OTP Protected
            </span>
            <span className="text-white/40">256-Bit SSL Encrypted</span>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-[#8E8E93] gap-2 pt-4">
        <span>&copy; {new Date().getFullYear()} First Avenue Family Dentistry. All rights reserved.</span>
        <span>Secure Healthcare Record Protocol &bull; PIPEDA Compliant</span>
      </footer>
    </div>
  );
}
