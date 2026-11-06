import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Wrench,
  Rocket,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff,
  Phone,
  MapPin,
  Calendar,
  ArrowUpRight,
  Play,
  History,
  KeyRound,
  Fingerprint,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Mail,
  User,
  ArrowLeft,
  X,
  ShieldCheck,
  Sliders,
  MonitorPlay,
} from 'lucide-react';
import { authenticateWithPasskey, registerPasskeyOnDevice } from '../../lib/passkeyService';
import { formatPortalGreeting } from '../../lib/greeting';

export type SiteOperationalMode = 'live' | 'maintenance' | 'inauguration';

export interface SiteControlHistoryEntry {
  id: string;
  action?: string;
  note?: string;
  mode: SiteOperationalMode;
  actor: string;
  timestamp: string;
}

export interface SiteControlConfig {
  mode: SiteOperationalMode;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceEta: string;
  showEmergencyContact: boolean;
  inaugurationTargetTime: string;
  inaugurationTitle: string;
  inaugurationSubtitle: string;
  inaugurationNote: string;
  autoRevealOnZero: boolean;
  updatedAt: string;
  updatedBy: string;
  history: SiteControlHistoryEntry[];
  serverTimeMs?: number;
}

export const DEFAULT_SITE_CONTROL: SiteControlConfig = {
  mode: 'live',
  maintenanceTitle: 'Scheduled Clinical System Upgrade in Progress',
  maintenanceMessage:
    'First Avenue Dentistry is currently performing scheduled maintenance and clinical platform enhancements to serve you better. Our online portal will return shortly.',
  maintenanceEta: 'Within 2 Hours',
  showEmergencyContact: true,
  inaugurationTargetTime: new Date(Date.now() + 3600 * 1000).toISOString(),
  inaugurationTitle: 'Grand Digital Inauguration',
  inaugurationSubtitle:
    'Welcome to the all-new First Avenue Dentistry digital clinical experience.',
  inaugurationNote: 'St. Thomas, Ontario • Comprehensive Family & Cosmetic Dentistry',
  autoRevealOnZero: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
  history: [],
};

const DEV_SESSION_STORAGE_KEY = 'fad_developer_session_v1';
const DEV_BYPASS_STORAGE_KEY = 'fad_developer_bypass_v1';

interface DeveloperSession {
  id?: string;
  name?: string;
  username: string;
  email: string;
  role: string;
  sessionToken: string;
  hasPasskey?: boolean;
  authenticatedAt?: string;
}

export function getStoredDeveloperBypass(): boolean {
  try {
    return localStorage.getItem(DEV_BYPASS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStoredDeveloperBypass(val: boolean): void {
  try {
    if (val) {
      localStorage.setItem(DEV_BYPASS_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(DEV_BYPASS_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function hasStoredDeveloperSession(): boolean {
  try {
    const raw = localStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.sessionToken);
  } catch {
    return false;
  }
}

const FLOATING_PARTICLES = [
  { id: 1, left: '12%', top: '18%', size: 6, duration: 7, delay: 0 },
  { id: 2, left: '28%', top: '74%', size: 8, duration: 9, delay: 1.2 },
  { id: 3, left: '68%', top: '22%', size: 5, duration: 6.5, delay: 0.6 },
  { id: 4, left: '84%', top: '64%', size: 10, duration: 8.5, delay: 1.8 },
  { id: 5, left: '46%', top: '14%', size: 7, duration: 7.8, delay: 0.9 },
  { id: 6, left: '18%', top: '48%', size: 5, duration: 8.2, delay: 2.1 },
  { id: 7, left: '76%', top: '38%', size: 6, duration: 6.8, delay: 1.5 },
];

/* ============================================================================
 * 1. PUBLIC MAINTENANCE MODE SCREEN (Redesigned with Rich Motion & Effects)
 * ========================================================================== */
export const MaintenanceView: React.FC<{
  config: SiteControlConfig;
  onOpenDeveloperPortal?: () => void;
}> = ({ config }) => {
  return (
    <div className="min-h-screen bg-[#060C16] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#1E5AFF] selection:text-white">
      {/* Animated Architectural Grid & Ambient Beams (Zero AI Purple) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.14, 0.22, 0.14],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[820px] h-[420px] bg-[#F59E0B]/20 blur-[150px] rounded-full"
      />
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.1, 0.18, 0.1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="pointer-events-none absolute bottom-0 left-1/3 w-[640px] h-[360px] bg-[#1E5AFF]/15 blur-[150px] rounded-full"
      />

      {/* Floating Ambient Particles */}
      {FLOATING_PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
          animate={{
            y: [0, -22, 0],
            opacity: [0.2, 0.65, 0.2],
            scale: [1, 1.25, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute rounded-full bg-[#F59E0B]/40 blur-[1px]"
        />
      ))}

      {/* Top Header */}
      <header className="relative z-10 w-full bg-[#060C16]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
              alt="First Avenue Dentistry"
              className="h-9 sm:h-11 w-auto max-w-[180px] sm:max-w-[220px] object-contain"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/35 text-[#FBBF24] text-xs font-bold tracking-wide shrink-0 shadow-lg shadow-[#F59E0B]/10"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F59E0B]" />
            </span>
            <span>Scheduled System Enhancement</span>
          </motion.div>
        </div>
      </header>

      {/* Center Maintenance Stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl bg-gradient-to-b from-[#0E172A]/95 to-[#09101E]/95 border border-white/12 rounded-[32px] p-7 sm:p-12 shadow-[0_32px_90px_rgba(0,0,0,0.65)] relative overflow-hidden"
        >
          {/* Top Animated Progress Shimmer Line */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-white/5 overflow-hidden">
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent"
            />
          </div>

          {/* Animated Orbital Icon Emblem */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-2xl border border-dashed border-[#F59E0B]/45"
              />
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/35 flex items-center justify-center text-[#FBBF24] shadow-lg shadow-[#F59E0B]/15"
              >
                <Wrench className="w-6 h-6" />
              </motion.div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>Enhancing Patient Experience</span>
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.15] mb-4"
          >
            {config.maintenanceTitle || DEFAULT_SITE_CONTROL.maintenanceTitle}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
            className="text-slate-300 text-sm sm:text-lg leading-relaxed mb-8"
          >
            {config.maintenanceMessage || DEFAULT_SITE_CONTROL.maintenanceMessage}
          </motion.p>

          {/* Animated Live Upgrade Progress Bar */}
          <div className="mb-8 p-4 rounded-2xl bg-[#060C16]/80 border border-white/10">
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-semibold text-slate-300 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#FBBF24] animate-spin" />
                Platform Optimization in Progress
              </span>
              <span className="font-mono font-bold text-[#FBBF24]">
                ETA: {config.maintenanceEta || 'Shortly'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: '35%' }}
                animate={{ width: ['35%', '78%', '55%', '86%', '35%'] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                className="h-full rounded-full bg-gradient-to-r from-[#1E5AFF] via-[#10B981] to-[#F59E0B]"
              />
            </div>
          </div>

          {/* Status & Security Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <motion.div
              whileHover={{ y: -2 }}
              className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/10"
            >
              <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#FBBF24] shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Estimated Return
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {config.maintenanceEta || 'Shortly'}
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -2 }}
              className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/10"
            >
              <div className="w-11 h-11 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#34D399] shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Patient Appointments
                </div>
                <div className="text-sm font-bold text-[#34D399] mt-0.5">
                  Safe &amp; Fully Preserved
                </div>
              </div>
            </motion.div>
          </div>

          {/* Emergency Contact Information */}
          {config.showEmergencyContact && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Need Immediate Dental Care or Booking Help?
                </div>
                <div className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                  <span>308 Wellington Street, St. Thomas, ON N5R 2S9</span>
                </div>
              </div>

              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                href="tel:5192076890"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#1E5AFF] hover:bg-[#194CE0] text-white font-bold text-sm transition-colors shadow-xl shadow-[#1E5AFF]/30 shrink-0"
              >
                <Phone className="w-4 h-4" />
                <span>(519) 207-6890</span>
              </motion.a>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-center text-xs text-slate-500 border-t border-white/5 text-center">
        <span>&copy; {new Date().getFullYear()} First Avenue Family Dentistry. All rights reserved.</span>
      </footer>
    </div>
  );
};

/* ============================================================================
 * 2. PUBLIC INAUGURATION COUNTDOWN SCREEN (Redesigned with Kinetic Motion)
 * ========================================================================== */
export const InaugurationCountdownView: React.FC<{
  config: SiteControlConfig;
  onRevealComplete: () => void;
  onOpenDeveloperPortal?: () => void;
}> = ({ config, onRevealComplete }) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isRevealing, setIsRevealing] = useState(false);
  const [hasTriggeredZero, setHasTriggeredZero] = useState(false);

  const targetMs = React.useMemo(() => {
    const parsed = Date.parse(config.inaugurationTargetTime);
    return Number.isNaN(parsed) ? Date.now() + 60000 : parsed;
  }, [config.inaugurationTargetTime]);

  const remainingMs = Math.max(0, targetMs - nowMs);
  const isZero = remainingMs <= 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const triggerWebsiteReveal = useCallback(async () => {
    if (isRevealing) return;
    setIsRevealing(true);
    try {
      await fetch('/api/site-control/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Proceed with local reveal callback even if network hiccups
    }
    setTimeout(() => {
      onRevealComplete();
    }, 1800);
  }, [isRevealing, onRevealComplete]);

  useEffect(() => {
    if (isZero && config.autoRevealOnZero && !hasTriggeredZero) {
      setHasTriggeredZero(true);
      triggerWebsiteReveal();
    }
  }, [isZero, config.autoRevealOnZero, hasTriggeredZero, triggerWebsiteReveal]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#060C16] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#1E5AFF] selection:text-white">
      {/* Animated Ambient Glows & Grid (Royal Blue, Emerald, Warm Gold — Zero AI Purple) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <motion.div
        animate={{
          scale: [1, 1.18, 1],
          opacity: [0.16, 0.28, 0.16],
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[920px] h-[480px] bg-[#1E5AFF]/20 blur-[160px] rounded-full"
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 w-[680px] h-[340px] bg-[#10B981]/15 blur-[150px] rounded-full"
      />

      {/* Floating Celebration Particles */}
      {FLOATING_PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.25, 0.8, 0.25],
            scale: [1, 1.35, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute rounded-full bg-[#38BDF8]/50 blur-[0.5px]"
        />
      ))}

      {/* Top Bar */}
      <header className="relative z-10 w-full bg-[#060C16]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
              alt="First Avenue Dentistry"
              className="h-9 sm:h-11 w-auto max-w-[180px] sm:max-w-[220px] object-contain"
            />
            <span className="hidden md:inline-block text-xs text-slate-300 border-l border-white/15 pl-3.5 truncate">
              {config.inaugurationNote || DEFAULT_SITE_CONTROL.inaugurationNote}
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#10B981]/15 border border-[#10B981]/35 text-[#34D399] text-xs font-bold tracking-wide shrink-0 shadow-lg shadow-[#10B981]/10"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
            </span>
            <span>Official Digital Launch</span>
          </motion.div>
        </div>
      </header>

      {/* Main Countdown Stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14">
        <AnimatePresence mode="wait">
          {isRevealing ? (
            <motion.div
              key="revealing-stage"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.08 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="text-center max-w-xl mx-auto relative"
            >
              {/* Expanding Shockwave Rings */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-[#10B981]/50"
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{ scale: 1.9, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-[#1E5AFF]/50"
              />

              <motion.div
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#34D399] mx-auto mb-6 shadow-2xl shadow-[#10B981]/30 relative z-10"
              >
                <CheckCircle2 className="w-10 h-10" />
              </motion.div>

              <p className="text-xs font-mono uppercase tracking-[0.25em] text-[#34D399] mb-3">
                Launch Sequence Complete
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
                Welcome to First Avenue Dentistry
              </h2>
              <p className="text-slate-300 text-base sm:text-lg">
                Opening our live clinical experience now...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="countdown-stage"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-4xl mx-auto text-center"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.05] border border-white/12 text-slate-200 text-xs font-semibold tracking-wider uppercase mb-6 shadow-lg"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Countdown to Grand Reveal</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="font-display text-3xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.08] mb-5"
              >
                {config.inaugurationTitle || DEFAULT_SITE_CONTROL.inaugurationTitle}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="text-slate-300 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed mb-12"
              >
                {config.inaugurationSubtitle || DEFAULT_SITE_CONTROL.inaugurationSubtitle}
              </motion.p>

              {/* 4-Block Kinetic Countdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto mb-12">
                {[
                  { label: 'DAYS', value: pad(days), progress: Math.min(100, (days / 30) * 100) },
                  { label: 'HOURS', value: pad(hours), progress: (hours / 24) * 100 },
                  { label: 'MINUTES', value: pad(minutes), progress: (minutes / 60) * 100 },
                  { label: 'SECONDS', value: pad(seconds), progress: (seconds / 60) * 100 },
                ].map((unit, idx) => (
                  <motion.div
                    key={unit.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + idx * 0.08 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="bg-gradient-to-b from-[#0F1B33]/95 to-[#0A1222]/95 border border-white/12 rounded-3xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.55)] relative overflow-hidden group"
                  >
                    {/* Top Illuminated Progress Track */}
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-white/5 overflow-hidden">
                      <motion.div
                        animate={{ width: `${Math.max(8, unit.progress)}%` }}
                        transition={{ duration: 0.35 }}
                        className="h-full bg-gradient-to-r from-[#1E5AFF] to-[#10B981]"
                      />
                    </div>

                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={unit.value}
                        initial={{ y: -16, opacity: 0, scale: 0.92 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 16, opacity: 0, scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                        className="font-mono text-4xl sm:text-6xl font-extrabold text-white tabular-nums tracking-tight"
                      >
                        {unit.value}
                      </motion.div>
                    </AnimatePresence>

                    <div className="text-[11px] font-mono font-bold uppercase tracking-[0.24em] text-[#60A5FA] mt-3">
                      {unit.label}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Scheduled Target Timestamp or Enter Button */}
              {isZero ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={triggerWebsiteReveal}
                    className="inline-flex items-center gap-3 px-9 py-4.5 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white font-display font-bold text-base tracking-wide shadow-2xl shadow-[#10B981]/35 transition-all cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Enter First Avenue Dentistry Website</span>
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="inline-flex flex-wrap items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-[#0D1628]/90 border border-white/10 text-xs sm:text-sm text-slate-300 shadow-xl"
                >
                  <Calendar className="w-4 h-4 text-[#1E5AFF]" />
                  <span>Scheduled Launch:</span>
                  <span className="font-mono font-bold text-white">
                    {new Date(targetMs).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 border-t border-white/5 text-center sm:text-left">
        <span>308 Wellington Street, St. Thomas, ON • (519) 207-6890</span>
        <span>&copy; {new Date().getFullYear()} First Avenue Family Dentistry. All rights reserved.</span>
      </footer>
    </div>
  );
};

/* ============================================================================
 * 3. REDESIGNED DEVELOPER PORTAL (Simple, Attractive, Passkey + Access Code)
 * ========================================================================== */
type DevAuthStep = 'credentials' | 'otp' | 'passkey_prompt';
type DevWorkspaceTab = 'maintenance' | 'inauguration' | 'preview' | 'history';

export const DeveloperPortalPage: React.FC<{
  siteControl: SiteControlConfig;
  onSiteControlUpdated: (next: SiteControlConfig) => void;
  onNavigateToPublic: () => void;
}> = ({ siteControl, onSiteControlUpdated, onNavigateToPublic }) => {
  const [session, setSession] = useState<DeveloperSession | null>(() => {
    try {
      const raw = localStorage.getItem(DEV_SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DeveloperSession) : null;
    } catch {
      return null;
    }
  });

  // Greeting clock
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNowDate(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  // Auth Flow State
  const [authStep, setAuthStep] = useState<DevAuthStep>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [otpAdminName, setOtpAdminName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [pendingSession, setPendingSession] = useState<DeveloperSession | null>(null);

  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isSavingPasskey, setIsSavingPasskey] = useState(false);

  // 5-Minute Idle Timeout in Developer Portal
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(300);
  const lastActivityRef = useRef<number>(Date.now());

  // Editable Draft State
  const [draftMode, setDraftMode] = useState<SiteOperationalMode>(siteControl.mode);
  const [activeTab, setActiveTab] = useState<DevWorkspaceTab>(
    siteControl.mode === 'inauguration' ? 'inauguration' : 'maintenance'
  );
  const [previewMode, setPreviewMode] = useState<'maintenance' | 'inauguration'>(
    siteControl.mode === 'inauguration' ? 'inauguration' : 'maintenance'
  );

  const [maintenanceTitle, setMaintenanceTitle] = useState(siteControl.maintenanceTitle);
  const [maintenanceMessage, setMaintenanceMessage] = useState(siteControl.maintenanceMessage);
  const [maintenanceEta, setMaintenanceEta] = useState(siteControl.maintenanceEta);
  const [showEmergencyContact, setShowEmergencyContact] = useState(
    siteControl.showEmergencyContact
  );

  const [inaugurationTargetLocal, setInaugurationTargetLocal] = useState(() => {
    const d = new Date(siteControl.inaugurationTargetTime);
    if (Number.isNaN(d.getTime())) {
      const fallback = new Date(Date.now() + 3600 * 1000);
      return new Date(fallback.getTime() - fallback.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 19);
    }
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  });
  const [inaugurationTitle, setInaugurationTitle] = useState(siteControl.inaugurationTitle);
  const [inaugurationSubtitle, setInaugurationSubtitle] = useState(
    siteControl.inaugurationSubtitle
  );
  const [inaugurationNote, setInaugurationNote] = useState(siteControl.inaugurationNote);
  const [autoRevealOnZero, setAutoRevealOnZero] = useState(siteControl.autoRevealOnZero);

  const [devBypass, setDevBypass] = useState<boolean>(() => getStoredDeveloperBypass());
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [liveCountdownStr, setLiveCountdownStr] = useState<string>('');

  const handleDeveloperLogout = useCallback(() => {
    localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    setSession(null);
    setPendingSession(null);
    setAuthStep('credentials');
    setOtpCode('');
  }, []);

  // Track activity for 5-minute idle lock when logged in
  useEffect(() => {
    if (!session) return;
    lastActivityRef.current = Date.now();
    setIdleSecondsLeft(300);

    const resetIdle = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));

    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setIdleSecondsLeft(remaining);
      if (remaining <= 0) {
        handleDeveloperLogout();
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdle));
      window.clearInterval(interval);
    };
  }, [session, handleDeveloperLogout]);

  // Sync draft state when external SSE update arrives
  useEffect(() => {
    setDraftMode(siteControl.mode);
    setMaintenanceTitle(siteControl.maintenanceTitle);
    setMaintenanceMessage(siteControl.maintenanceMessage);
    setMaintenanceEta(siteControl.maintenanceEta);
    setShowEmergencyContact(siteControl.showEmergencyContact);
    setInaugurationTitle(siteControl.inaugurationTitle);
    setInaugurationSubtitle(siteControl.inaugurationSubtitle);
    setInaugurationNote(siteControl.inaugurationNote);
    setAutoRevealOnZero(siteControl.autoRevealOnZero);

    const d = new Date(siteControl.inaugurationTargetTime);
    if (!Number.isNaN(d.getTime())) {
      setInaugurationTargetLocal(
        new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
      );
    }
  }, [siteControl]);

  // Live ticker for inauguration target preview
  useEffect(() => {
    const updateTicker = () => {
      const target = new Date(inaugurationTargetLocal).getTime();
      if (Number.isNaN(target)) {
        setLiveCountdownStr('Invalid Date');
        return;
      }
      const diff = target - Date.now();
      if (diff <= 0) {
        setLiveCountdownStr('00d : 00h : 00m : 00s (Ready to Launch)');
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      setLiveCountdownStr(`${pad(d)}d : ${pad(h)}h : ${pad(m)}m : ${pad(s)}s`);
    };
    updateTicker();
    const id = window.setInterval(updateTicker, 500);
    return () => window.clearInterval(id);
  }, [inaugurationTargetLocal]);

  // Step 1: Credentials Sign-In
  const handleDeveloperLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/developer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Invalid developer credentials.');
        setIsLoggingIn(false);
        return;
      }

      if (data.requiresOtp) {
        setOtpEmail(data.email);
        setOtpMaskedEmail(data.maskedEmail || data.email);
        setOtpAdminName(data.adminName || 'Fenil Patel');
        setOtpCode('');
        setAuthStep('otp');
        setLoginSuccess(
          data.message || `Please enter the 6-digit access code sent to ${data.maskedEmail}.`
        );
      } else if (data.developer) {
        localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(data.developer));
        setSession(data.developer);
        setUsername('');
        setPassword('');
      }
    } catch {
      setLoginError('Failed to reach Developer Authentication endpoint.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Step 2: Verify 6-Digit Access Code
  const handleVerifyDeveloperOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setLoginError('Please enter the 6-digit access code sent to your email.');
      return;
    }

    setLoginError('');
    setLoginSuccess('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/developer/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otpEmail,
          otp: cleanOtp,
          portalMode: 'developer',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Incorrect or expired access code.');
        setIsLoggingIn(false);
        return;
      }

      const devUser: DeveloperSession = data.developer || data.user;
      if (!data.hasPasskey) {
        setPendingSession(devUser);
        setAuthStep('passkey_prompt');
      } else {
        localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(devUser));
        setSession(devUser);
        setUsername('');
        setPassword('');
        setOtpCode('');
      }
    } catch {
      setLoginError('Could not verify access code. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Direct 1-Click Passkey Login
  const handleDeveloperPasskeyLogin = async () => {
    setLoginError('');
    setLoginSuccess('');
    setIsPasskeyLoading(true);
    try {
      const result = await authenticateWithPasskey('developer', username.trim());
      const devSession: DeveloperSession = {
        id: result.user.id,
        name: result.user.name,
        username: result.user.username,
        email: result.user.email,
        role: 'System Developer',
        sessionToken: result.sessionToken,
        hasPasskey: true,
        authenticatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(devSession));
      setSession(devSession);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(msg || 'Passkey sign-in could not be completed.');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  // Save Passkey on First-Time Login
  const handleSaveFirstTimePasskey = async () => {
    if (!pendingSession) return;
    setIsSavingPasskey(true);
    setLoginError('');
    try {
      await registerPasskeyOnDevice(undefined, pendingSession.sessionToken, 'developer');
      const updated = { ...pendingSession, hasPasskey: true };
      localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(updated));
      setSession(updated);
      setPendingSession(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(msg || 'Could not save passkey. Entering portal...');
      setTimeout(() => {
        localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(pendingSession));
        setSession(pendingSession);
        setPendingSession(null);
      }, 1000);
    } finally {
      setIsSavingPasskey(false);
    }
  };

  const handleSkipPasskeyPrompt = () => {
    if (!pendingSession) return;
    localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(pendingSession));
    setSession(pendingSession);
    setPendingSession(null);
  };

  const handleToggleBypass = () => {
    const next = !devBypass;
    setDevBypass(next);
    setStoredDeveloperBypass(next);
  };

  const applyQuickCountdownPreset = (offsetSeconds: number) => {
    const target = new Date(Date.now() + offsetSeconds * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 19);
    setInaugurationTargetLocal(localIso);
    setDraftMode('inauguration');
    setActiveTab('inauguration');
    setPreviewMode('inauguration');
  };

  const handleDeployConfiguration = async (overrideMode?: SiteOperationalMode) => {
    if (!session?.sessionToken) return;
    setIsSaving(true);
    setSaveBanner(null);

    const targetMode = overrideMode || draftMode;
    const parsedTarget = new Date(inaugurationTargetLocal);
    const targetIso = Number.isNaN(parsedTarget.getTime())
      ? new Date(Date.now() + 3600 * 1000).toISOString()
      : parsedTarget.toISOString();

    try {
      const res = await fetch('/api/site-control', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          mode: targetMode,
          maintenanceTitle,
          maintenanceMessage,
          maintenanceEta,
          showEmergencyContact,
          inaugurationTargetTime: targetIso,
          inaugurationTitle,
          inaugurationSubtitle,
          inaugurationNote,
          autoRevealOnZero,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        handleDeveloperLogout();
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.siteControl) {
        setSaveBanner({
          type: 'error',
          text: data.error || 'Failed to update website status.',
        });
        return;
      }

      onSiteControlUpdated(data.siteControl);
      setDraftMode(data.siteControl.mode);
      setSaveBanner({
        type: 'success',
        text:
          data.siteControl.mode === 'live'
            ? 'Public website is now LIVE for all visitors.'
            : data.siteControl.mode === 'maintenance'
            ? 'Maintenance screen is now active for all public visitors.'
            : 'Launch countdown timer is now live for all visitors.',
      });
    } catch {
      setSaveBanner({
        type: 'error',
        text: 'Network error while updating website status.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleForceRevealNow = async () => {
    setIsSaving(true);
    setSaveBanner(null);
    try {
      const res = await fetch('/api/site-control/reveal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.sessionToken ? { Authorization: `Bearer ${session.sessionToken}` } : {}),
        },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (res.ok && data.siteControl) {
        onSiteControlUpdated(data.siteControl);
        setDraftMode('live');
        setSaveBanner({
          type: 'success',
          text: 'Website immediately revealed to Live mode for all visitors!',
        });
      } else {
        setSaveBanner({
          type: 'error',
          text: data.error || 'Could not reveal website.',
        });
      }
    } catch {
      setSaveBanner({
        type: 'error',
        text: 'Network error while revealing website.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* ------------------------------------------------------------------------
   * DEVELOPER PORTAL AUTHENTICATION SCREEN (Clean, Secure + Passkey Support)
   * ---------------------------------------------------------------------- */
  if (!session) {
    return (
      <div className="min-h-screen w-full bg-[#060C16] text-white flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden font-sans">
        {/* Ambient clinical navy/blue/emerald glow (Zero AI Purple) */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#1E5AFF]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[420px] h-[420px] bg-[#10B981]/8 rounded-full blur-[130px] pointer-events-none" />

        {/* GOOGLE PASSWORD MANAGER BROWSER NOTIFICATION ON FIRST LOGIN */}
        <AnimatePresence>
          {authStep === 'passkey_prompt' && pendingSession && (
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-[380px] rounded-2xl bg-[#202124] text-[#E8EAED] border border-[#3C4043] shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-5 font-sans"
              role="dialog"
            >
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
                  onClick={handleSkipPasskeyPrompt}
                  disabled={isSavingPasskey}
                  className="p-1 rounded-full text-[#9AA0A6] hover:text-white hover:bg-[#303134] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-4 space-y-3.5">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#8AB4F8]/15 border border-[#8AB4F8]/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Fingerprint className="w-5 h-5 text-[#8AB4F8]" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-white leading-snug">
                      Sign in faster with a passkey?
                    </h2>
                    <p className="text-xs text-[#9AA0A6] leading-relaxed">
                      With a passkey, you can sign in to the{' '}
                      <span className="text-[#E8EAED] font-medium">Developer Portal</span> using
                      your fingerprint, face, or screen lock.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#303134] border border-[#3C4043]">
                  <div className="w-8 h-8 rounded-full bg-[#1E5AFF] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {(pendingSession.name || pendingSession.username || 'D')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">
                      {pendingSession.name || 'Developer'}
                    </div>
                    <div className="text-[11px] text-[#9AA0A6] truncate">
                      @{pendingSession.username} • {pendingSession.email}
                    </div>
                  </div>
                  <KeyRound className="w-4 h-4 text-[#8AB4F8] shrink-0" />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSkipPasskeyPrompt}
                    disabled={isSavingPasskey}
                    className="px-4 py-2 rounded-full border border-[#5F6368] hover:bg-[#303134] text-[#8AB4F8] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Not now
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFirstTimePasskey}
                    disabled={isSavingPasskey}
                    className="px-4 py-2 rounded-full bg-[#8AB4F8] hover:bg-[#AECBFA] text-[#202124] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingPasskey ? 'Saving passkey...' : 'Create a passkey'}
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

        {/* Center Login Card */}
        <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="bg-[#0B132B] border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl space-y-6"
          >
            <div className="text-center space-y-3">
              <div className="w-full max-w-[220px] mx-auto py-1 flex items-center justify-center">
                <img
                  src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
                  alt="First Avenue Dentistry"
                  className="h-12 sm:h-14 w-auto max-w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {authStep === 'otp'
                    ? 'Identity Confirmation'
                    : authStep === 'passkey_prompt'
                    ? 'Save Passkey to Browser'
                    : 'Developer Portal'}
                </h1>
                <p className="text-xs text-[#8E8E93] mt-1">
                  Website Launch, Countdown &amp; Maintenance Control
                </p>
              </div>
            </div>

            {loginSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{loginSuccess}</span>
              </div>
            )}

            {loginError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {authStep === 'credentials' && (
              <div className="space-y-4">
                <form onSubmit={handleDeveloperLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#8E8E93]">
                      Developer Username or Email
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter developer username or email"
                        autoComplete="username"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#8E8E93]">
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        autoComplete="current-password"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || isPasskeyLoading}
                    className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoggingIn ? (
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
                  onClick={handleDeveloperPasskeyLogin}
                  disabled={isPasskeyLoading || isLoggingIn}
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

            {authStep === 'otp' && (
              <form onSubmit={handleVerifyDeveloperOtp} className="space-y-4">
                <div className="p-3 rounded-xl bg-[#1E5AFF]/10 border border-[#1E5AFF]/30 text-xs text-white/90 space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Access Code Sent for {otpAdminName}</span>
                  </div>
                  <p className="text-[11px] text-[#A1A1A8]">
                    Check <strong className="text-white">{otpMaskedEmail}</strong> for your 6-digit
                    access code.
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
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-center text-xl font-bold tracking-[0.5em] text-white placeholder:text-white/20 focus:outline-none focus:border-[#1E5AFF] focus:ring-1 focus:ring-[#1E5AFF] transition-all font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn || otpCode.length !== 6}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify &amp; Enter Developer Portal</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('credentials');
                      setLoginError('');
                      setLoginSuccess('');
                    }}
                    className="text-[#8E8E93] hover:text-white font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Login</span>
                  </button>
                </div>
              </form>
            )}

            {authStep === 'passkey_prompt' && pendingSession && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#1E5AFF]/15 border border-[#1E5AFF]/30 flex items-center justify-center mx-auto">
                    <Fingerprint className="w-6 h-6 text-[#1E5AFF]" />
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    Save Your Passkey in Google Password Manager
                  </h3>
                  <p className="text-xs text-[#A1A1A8] leading-relaxed">
                    Save a passkey for{' '}
                    <strong className="text-white">
                      {pendingSession.name || pendingSession.username}
                    </strong>{' '}
                    so you can sign in to the Developer Portal with 1 click next time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveFirstTimePasskey}
                  disabled={isSavingPasskey}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0050E6] text-white font-bold text-xs tracking-wide transition-all duration-200 shadow-md shadow-[#1E5AFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>{isSavingPasskey ? 'Saving Passkey...' : 'Create a Passkey & Continue'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipPasskeyPrompt}
                  disabled={isSavingPasskey}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[#8E8E93] hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Skip for now &amp; Enter Portal
                </button>
              </div>
            )}
          </motion.div>
        </main>

        <footer className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-center text-xs text-[#8E8E93] pt-4">
          <span>&copy; {new Date().getFullYear()} First Avenue Family Dentistry. All rights reserved.</span>
        </footer>
      </div>
    );
  }

  /* ------------------------------------------------------------------------
   * AUTHENTICATED DEVELOPER PORTAL (Simple, Attractive, Personalized Greeting)
   * ---------------------------------------------------------------------- */
  const greeting = formatPortalGreeting(
    session.name || session.username || 'Fenil Patel',
    'developer',
    nowDate
  );

  const GreetingIcon =
    greeting.period === 'morning' ? Sun : greeting.period === 'afternoon' ? Sunset : Moon;

  return (
    <div className="min-h-screen bg-[#060C16] text-slate-100 flex flex-col font-sans selection:bg-[#1E5AFF] selection:text-white">
      {/* Top Solid Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#081020] border-b border-white/10 px-4 sm:px-8 py-3.5 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
              alt="First Avenue Dentistry"
              className="h-9 sm:h-10 w-auto max-w-[175px] object-contain"
            />
            <div className="hidden sm:block h-6 w-px bg-white/15" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#60A5FA]">
                <GreetingIcon className="w-3.5 h-3.5 text-[#FBBF24] shrink-0" />
                <span className="truncate">{greeting.fullGreeting}</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Developer Portal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Idle Lock Timer */}
            <div
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300"
              title="Automatic security sign-out after 5 minutes of inactivity"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="font-mono">
                {Math.floor(idleSecondsLeft / 60)}:
                {String(idleSecondsLeft % 60).padStart(2, '0')}
              </span>
            </div>

            {/* Preview Bypass Toggle */}
            <button
              type="button"
              onClick={handleToggleBypass}
              title="Allow your browser to view the live website even while Maintenance or Countdown is active for visitors"
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                devBypass
                  ? 'bg-[#1E5AFF]/20 border-[#1E5AFF] text-white'
                  : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {devBypass ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Bypass Lock: {devBypass ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToPublic}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Website</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDeveloperLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Personalized Greeting Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-r from-[#0C162C] via-[#0F1E3C] to-[#0B1528] border border-white/10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-semibold text-[#60A5FA]">
              <GreetingIcon className="w-3.5 h-3.5 text-[#FBBF24]" />
              <span>{greeting.salutation}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {greeting.fullGreeting}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Manage your clinic website mode, schedule maintenance windows, or launch a grand
              inauguration countdown in real time.
            </p>
          </div>

          {/* Current Live Status Pill */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="px-4 py-3 rounded-2xl bg-[#060C16]/80 border border-white/10 flex items-center gap-3">
              {siteControl.mode === 'live' && (
                <>
                  <span className="w-3 h-3 rounded-full bg-[#10B981] animate-pulse" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Current Status
                    </div>
                    <div className="text-xs font-bold text-[#34D399]">Live Website</div>
                  </div>
                </>
              )}
              {siteControl.mode === 'maintenance' && (
                <>
                  <span className="w-3 h-3 rounded-full bg-[#F59E0B] animate-pulse" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Current Status
                    </div>
                    <div className="text-xs font-bold text-[#FBBF24]">Maintenance Mode</div>
                  </div>
                </>
              )}
              {siteControl.mode === 'inauguration' && (
                <>
                  <span className="w-3 h-3 rounded-full bg-[#38BDF8] animate-ping" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Current Status
                    </div>
                    <div className="text-xs font-bold text-[#38BDF8]">Launch Countdown</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Feedback Banner */}
        <AnimatePresence>
          {saveBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                saveBanner.type === 'success'
                  ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#34D399]'
                  : 'bg-red-950/60 border-red-800 text-red-200'
              }`}
            >
              <div className="flex items-center gap-3 text-sm font-semibold">
                {saveBanner.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                )}
                <span>{saveBanner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveBanner(null)}
                className="text-xs font-semibold opacity-75 hover:opacity-100 cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Simple 3-Card Website Mode Switcher */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Card 1: Live Website */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setDraftMode('live')}
            className={`rounded-3xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
              siteControl.mode === 'live'
                ? 'bg-[#10B981]/12 border-[#10B981] shadow-xl shadow-[#10B981]/10'
                : 'bg-[#0B1326] border-white/10 hover:border-white/25'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#10B981]/15 flex items-center justify-center text-[#34D399]">
                  <Globe className="w-5 h-5" />
                </div>
                {siteControl.mode === 'live' && (
                  <span className="px-3 py-1 rounded-full bg-[#10B981] text-[#04130D] text-[11px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">Live Website</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Public website is open for patients to browse services and book appointments.
              </p>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={(e) => {
                e.stopPropagation();
                setDraftMode('live');
                handleDeployConfiguration('live');
              }}
              className="mt-6 w-full py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04130D] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Switch to Live Website
            </button>
          </motion.div>

          {/* Card 2: Maintenance Mode */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => {
              setDraftMode('maintenance');
              setActiveTab('maintenance');
              setPreviewMode('maintenance');
            }}
            className={`rounded-3xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
              siteControl.mode === 'maintenance'
                ? 'bg-[#F59E0B]/12 border-[#F59E0B] shadow-xl shadow-[#F59E0B]/10'
                : 'bg-[#0B1326] border-white/10 hover:border-white/25'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#F59E0B]/15 flex items-center justify-center text-[#FBBF24]">
                  <Wrench className="w-5 h-5" />
                </div>
                {siteControl.mode === 'maintenance' && (
                  <span className="px-3 py-1 rounded-full bg-[#F59E0B] text-[#1F1300] text-[11px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">Maintenance Mode</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Displays an animated maintenance notice with estimated return time and clinic phone.
              </p>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={(e) => {
                e.stopPropagation();
                setDraftMode('maintenance');
                setActiveTab('maintenance');
                setPreviewMode('maintenance');
                handleDeployConfiguration('maintenance');
              }}
              className="mt-6 w-full py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#1F1300] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Enable Maintenance Mode
            </button>
          </motion.div>

          {/* Card 3: Launch Countdown */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => {
              setDraftMode('inauguration');
              setActiveTab('inauguration');
              setPreviewMode('inauguration');
            }}
            className={`rounded-3xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
              siteControl.mode === 'inauguration'
                ? 'bg-[#1E5AFF]/15 border-[#1E5AFF] shadow-xl shadow-[#1E5AFF]/15'
                : 'bg-[#0B1326] border-white/10 hover:border-white/25'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#1E5AFF]/20 flex items-center justify-center text-[#60A5FA]">
                  <Rocket className="w-5 h-5" />
                </div>
                {siteControl.mode === 'inauguration' && (
                  <span className="px-3 py-1 rounded-full bg-[#1E5AFF] text-white text-[11px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">Launch Countdown</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Shows a live ceremonial countdown timer that automatically reveals the website at
                00:00:00.
              </p>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={(e) => {
                e.stopPropagation();
                setDraftMode('inauguration');
                setActiveTab('inauguration');
                setPreviewMode('inauguration');
                handleDeployConfiguration('inauguration');
              }}
              className="mt-6 w-full py-3 rounded-xl bg-[#1E5AFF] hover:bg-[#194CE0] text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              Start Launch Countdown
            </button>
          </motion.div>
        </section>

        {/* Clean Tabbed Customization & Preview Workspace */}
        <section className="bg-[#0B1326] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          {/* Tab Bar */}
          <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#080F1E]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('maintenance')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'maintenance'
                    ? 'bg-[#F59E0B] text-[#1F1300]'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Maintenance Message</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('inauguration')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'inauguration'
                    ? 'bg-[#1E5AFF] text-white'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Countdown Settings</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-[#10B981] text-[#04130D]'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white'
                }`}
              >
                <MonitorPlay className="w-3.5 h-3.5" />
                <span>Live Screen Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-white text-[#060C16]'
                    : 'bg-white/[0.04] text-slate-300 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Activity ({siteControl.history?.length || 0})</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleDeployConfiguration()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#04130D] font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>

          {/* Tab 1: Maintenance Message Editor */}
          {activeTab === 'maintenance' && (
            <div className="p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Maintenance Headline
                  </label>
                  <input
                    type="text"
                    value={maintenanceTitle}
                    onChange={(e) => setMaintenanceTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 text-white text-sm focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Estimated Return Time (ETA)
                  </label>
                  <input
                    type="text"
                    value={maintenanceEta}
                    onChange={(e) => setMaintenanceEta(e.target.value)}
                    placeholder="e.g., Within 2 Hours / 4:00 PM EST"
                    className="w-full px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 text-white text-sm focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Maintenance Notice Message
                </label>
                <textarea
                  rows={3}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 text-white text-sm focus:outline-none focus:border-[#F59E0B] resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showEmergencyContact}
                    onChange={(e) => setShowEmergencyContact(e.target.checked)}
                    className="w-4 h-4 accent-[#F59E0B]"
                  />
                  <span className="text-xs text-slate-200 font-medium">
                    Display Clinic Phone &amp; Address on Maintenance Screen
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewMode('maintenance');
                      setActiveTab('preview');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Preview Screen
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setDraftMode('maintenance');
                      handleDeployConfiguration('maintenance');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#1F1300] font-bold text-xs transition-colors cursor-pointer"
                  >
                    Save &amp; Enable Maintenance
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Launch Countdown Editor */}
          {activeTab === 'inauguration' && (
            <div className="p-6 sm:p-8 space-y-5">
              <div className="p-5 rounded-2xl bg-[#060C16] border border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#60A5FA]" />
                    <span>Launch Date &amp; Time</span>
                  </label>
                  <span className="font-mono text-xs text-[#34D399] font-bold">
                    {liveCountdownStr}
                  </span>
                </div>

                <input
                  type="datetime-local"
                  step="1"
                  value={inaugurationTargetLocal}
                  onChange={(e) => setInaugurationTargetLocal(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#0B1326] border border-white/15 text-white font-mono text-sm focus:outline-none focus:border-[#1E5AFF]"
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400 mr-1">Quick Presets:</span>
                  {[
                    { label: '+15 Sec (Demo)', sec: 15 },
                    { label: '+30 Sec', sec: 30 },
                    { label: '+2 Min', sec: 120 },
                    { label: '+5 Min', sec: 300 },
                    { label: '+1 Hour', sec: 3600 },
                    { label: '+24 Hours', sec: 86400 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyQuickCountdownPreset(preset.sec)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-[#1E5AFF] text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Countdown Headline
                  </label>
                  <input
                    type="text"
                    value={inaugurationTitle}
                    onChange={(e) => setInaugurationTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 text-white text-sm focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Header Subtitle Note
                  </label>
                  <input
                    type="text"
                    value={inaugurationNote}
                    onChange={(e) => setInaugurationNote(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 text-white text-sm focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Launch Welcome Message
                </label>
                <textarea
                  rows={2}
                  value={inaugurationSubtitle}
                  onChange={(e) => setInaugurationSubtitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 text-white text-sm focus:outline-none focus:border-[#1E5AFF] resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#060C16] border border-white/10 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRevealOnZero}
                    onChange={(e) => setAutoRevealOnZero(e.target.checked)}
                    className="w-4 h-4 accent-[#1E5AFF]"
                  />
                  <span className="text-xs text-slate-200 font-medium">
                    Automatically reveal live website when countdown reaches 00:00:00
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleForceRevealNow}
                    className="px-4 py-2.5 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981] text-[#34D399] hover:text-[#04130D] font-bold text-xs transition-colors cursor-pointer"
                  >
                    Reveal Website Now
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setDraftMode('inauguration');
                      handleDeployConfiguration('inauguration');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#194CE0] text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Save &amp; Start Countdown
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Live Interactive Screen Preview */}
          {activeTab === 'preview' && (
            <div>
              <div className="px-6 py-3 bg-[#060C16] border-b border-white/10 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Interactive Preview (Test your animations and messages before publishing)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('maintenance')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewMode === 'maintenance'
                        ? 'bg-[#F59E0B] text-[#1F1300]'
                        : 'bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    Maintenance View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('inauguration')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewMode === 'inauguration'
                        ? 'bg-[#1E5AFF] text-white'
                        : 'bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    Countdown View
                  </button>
                </div>
              </div>

              <div className="max-h-[680px] overflow-y-auto">
                {previewMode === 'maintenance' ? (
                  <MaintenanceView
                    config={{
                      ...siteControl,
                      maintenanceTitle,
                      maintenanceMessage,
                      maintenanceEta,
                      showEmergencyContact,
                    }}
                  />
                ) : (
                  <InaugurationCountdownView
                    config={{
                      ...siteControl,
                      inaugurationTargetTime: new Date(inaugurationTargetLocal).toISOString(),
                      inaugurationTitle,
                      inaugurationSubtitle,
                      inaugurationNote,
                      autoRevealOnZero: false,
                    }}
                    onRevealComplete={() => handleForceRevealNow()}
                  />
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Activity History */}
          {activeTab === 'history' && (
            <div className="p-6 max-h-[420px] overflow-y-auto space-y-2.5">
              {(!siteControl.history || siteControl.history.length === 0) && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No recent status changes recorded yet.
                </div>
              )}
              {siteControl.history?.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#060C16] border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold ${
                        item.mode === 'live'
                          ? 'bg-[#10B981]/20 text-[#34D399]'
                          : item.mode === 'maintenance'
                          ? 'bg-[#F59E0B]/20 text-[#FBBF24]'
                          : 'bg-[#1E5AFF]/20 text-[#93C5FD]'
                      }`}
                    >
                      {item.mode}
                    </span>
                    <span className="text-slate-200 font-medium">
                      {item.note || item.action || `Switched to ${item.mode}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>{item.actor}</span>
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
