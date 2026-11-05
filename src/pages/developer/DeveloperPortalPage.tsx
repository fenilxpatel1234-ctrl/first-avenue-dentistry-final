import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Terminal,
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
  Activity,
  Sliders,
  ArrowUpRight,
  Play,
  History,
  Check,
  KeyRound,
  Server,
} from "lucide-react";

export type SiteOperationalMode = "live" | "maintenance" | "inauguration";

export interface SiteControlHistoryEntry {
  id: string;
  action: string;
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
  mode: "live",
  maintenanceTitle: "Scheduled Clinical System Upgrade in Progress",
  maintenanceMessage:
    "First Avenue Dentistry is currently performing scheduled maintenance and security updates to serve you better. Our online portal will return shortly.",
  maintenanceEta: "Within 2 Hours",
  showEmergencyContact: true,
  inaugurationTargetTime: new Date(Date.now() + 3600 * 1000).toISOString(),
  inaugurationTitle: "Grand Digital Inauguration",
  inaugurationSubtitle:
    "Welcome to the all-new First Avenue Dentistry digital clinical experience.",
  inaugurationNote: "St. Thomas, Ontario • Comprehensive Family & Cosmetic Dentistry",
  autoRevealOnZero: true,
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
  history: [],
};

const DEV_SESSION_STORAGE_KEY = "fad_developer_session_v1";
const DEV_BYPASS_STORAGE_KEY = "fad_developer_bypass_v1";

interface DeveloperSession {
  username: string;
  email: string;
  role: string;
  sessionToken: string;
  authenticatedAt: string;
}

export function getStoredDeveloperBypass(): boolean {
  try {
    return localStorage.getItem(DEV_BYPASS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setStoredDeveloperBypass(val: boolean): void {
  try {
    if (val) {
      localStorage.setItem(DEV_BYPASS_STORAGE_KEY, "true");
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

/* ============================================================================
 * 1. PUBLIC MAINTENANCE MODE SCREEN
 * ========================================================================== */
export const MaintenanceView: React.FC<{
  config: SiteControlConfig;
  onOpenDeveloperPortal: () => void;
}> = ({ config, onOpenDeveloperPortal }) => {
  return (
    <div className="min-h-screen bg-[#070C14] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#1E5AFF] selection:text-white">
      {/* Subtle architectural background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[780px] h-[360px] bg-[#F59E0B]/10 blur-[130px] rounded-full" />

      {/* Top Header */}
      <header className="relative z-10 w-full bg-[#070C14] border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
              alt="First Avenue Dentistry"
              className="h-8 sm:h-10 w-auto max-w-[165px] sm:max-w-[210px] object-contain"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#FBBF24] text-xs font-semibold tracking-wide shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            Scheduled Maintenance
          </div>
        </div>
      </header>

      {/* Center Maintenance Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl bg-[#0D1523]/95 border border-white/10 rounded-3xl p-8 sm:p-12 shadow-2xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#FBBF24] mb-7">
            <Wrench className="w-7 h-7" />
          </div>

          <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#FBBF24] mb-3">
            System Upgrade In Progress
          </p>

          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight mb-4">
            {config.maintenanceTitle || DEFAULT_SITE_CONTROL.maintenanceTitle}
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
            {config.maintenanceMessage || DEFAULT_SITE_CONTROL.maintenanceMessage}
          </p>

          {/* Status & ETA Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#070C14] border border-white/10 mb-8">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 shrink-0">
                <Clock className="w-5 h-5 text-[#FBBF24]" />
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Estimated Return
                </div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  {config.maintenanceEta || "Shortly"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 shrink-0">
                <Shield className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Patient Records
                </div>
                <div className="text-sm font-semibold text-[#10B981] mt-0.5">
                  Encrypted & Protected
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact Information */}
          {config.showEmergencyContact && (
            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Need Immediate Dental Assistance?
                </div>
                <div className="text-sm text-slate-300 mt-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1E5AFF] shrink-0" />
                  191 First Ave, St. Thomas, ON N5R 4P2
                </div>
              </div>

              <a
                href="tel:5192076890"
                className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#1E5AFF] hover:bg-[#194CE0] text-white font-semibold text-sm transition-colors shadow-lg shadow-[#1E5AFF]/25 shrink-0"
              >
                <Phone className="w-4 h-4" />
                (519) 207-6890
              </a>
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer with subtle developer console entry */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-slate-500 border-t border-white/5">
        <span>© {new Date().getFullYear()} First Avenue Dentistry. All rights reserved.</span>
        <button
          type="button"
          onClick={onOpenDeveloperPortal}
          title="Developer Systems Console"
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-300 transition-colors font-mono text-[11px] cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
          SysOps
        </button>
      </footer>
    </div>
  );
};

/* ============================================================================
 * 2. PUBLIC INAUGURATION COUNTDOWN SCREEN
 * ========================================================================== */
export const InaugurationCountdownView: React.FC<{
  config: SiteControlConfig;
  onRevealComplete: () => void;
  onOpenDeveloperPortal: () => void;
}> = ({ config, onRevealComplete, onOpenDeveloperPortal }) => {
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
      await fetch("/api/site-control/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Even if network hiccups, proceed with local reveal callback
    }
    setTimeout(() => {
      onRevealComplete();
    }, 1400);
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

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#060C16] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-[#1E5AFF] selection:text-white">
      {/* Subtle architectural background grid & sober royal blue radial glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-[#1E5AFF]/15 blur-[150px] rounded-full" />

      {/* Top Bar */}
      <header className="relative z-10 w-full bg-[#060C16] border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
              alt="First Avenue Dentistry"
              className="h-8 sm:h-10 w-auto max-w-[165px] sm:max-w-[210px] object-contain"
            />
            <span className="hidden md:inline-block text-xs text-slate-400 border-l border-white/15 pl-3.5 truncate">
              {config.inaugurationNote || DEFAULT_SITE_CONTROL.inaugurationNote}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-[#34D399] text-xs font-semibold tracking-wide shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            Official Digital Launch
          </div>
        </div>
      </header>

      {/* Main Countdown Stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <AnimatePresence mode="wait">
          {isRevealing ? (
            <motion.div
              key="revealing-stage"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-center max-w-xl mx-auto"
            >
              <div className="w-20 h-20 rounded-3xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#34D399] mx-auto mb-6 shadow-2xl shadow-[#10B981]/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <p className="text-xs font-mono uppercase tracking-[0.25em] text-[#34D399] mb-3">
                Inauguration Complete
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-bold text-white tracking-tight mb-4">
                Welcome to First Avenue Dentistry
              </h2>
              <p className="text-slate-300 text-base">
                Launching the live clinical website now...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="countdown-stage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-4xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-mono uppercase tracking-[0.2em] mb-6">
                <Rocket className="w-3.5 h-3.5 text-[#1E5AFF]" />
                Countdown To Official Reveal
              </div>

              <h1 className="font-display text-3xl sm:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-5">
                {config.inaugurationTitle || DEFAULT_SITE_CONTROL.inaugurationTitle}
              </h1>

              <p className="text-slate-300 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed mb-12">
                {config.inaugurationSubtitle || DEFAULT_SITE_CONTROL.inaugurationSubtitle}
              </p>

              {/* 4-Block Tabular Countdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl mx-auto mb-12">
                {[
                  { label: "DAYS", value: pad(days) },
                  { label: "HOURS", value: pad(hours) },
                  { label: "MINUTES", value: pad(minutes) },
                  { label: "SECONDS", value: pad(seconds) },
                ].map((unit) => (
                  <div
                    key={unit.label}
                    className="bg-[#0D1626]/95 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-[#1E5AFF]" />
                    <motion.div
                      key={unit.value}
                      initial={{ y: -8, opacity: 0.6 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="font-mono text-4xl sm:text-6xl font-bold text-white tabular-nums tracking-tight"
                    >
                      {unit.value}
                    </motion.div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-400 mt-3">
                      {unit.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Scheduled Target Timestamp or Enter Button */}
              {isZero ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <button
                    type="button"
                    onClick={triggerWebsiteReveal}
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white font-display font-bold text-base tracking-wide shadow-2xl shadow-[#10B981]/30 transition-all cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Enter First Avenue Dentistry Website
                  </button>
                </motion.div>
              ) : (
                <div className="inline-flex flex-wrap items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-[#0D1626] border border-white/10 text-xs text-slate-300">
                  <Calendar className="w-4 h-4 text-[#1E5AFF]" />
                  <span>Scheduled Reveal:</span>
                  <span className="font-mono font-semibold text-white">
                    {new Date(targetMs).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-slate-500 border-t border-white/5">
        <span>191 First Ave, St. Thomas, ON • (519) 207-6890</span>
        <button
          type="button"
          onClick={onOpenDeveloperPortal}
          title="Developer Systems Console"
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-300 transition-colors font-mono text-[11px] cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
          SysOps
        </button>
      </footer>
    </div>
  );
};

/* ============================================================================
 * 3. DEDICATED DEVELOPER SYSTEMS & SITE OPERATIONS PORTAL
 *    (Visually & structurally distinct from Doctor & Clinical Admin Portals)
 * ========================================================================== */
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

  // Login Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Editable Draft State
  const [draftMode, setDraftMode] = useState<SiteOperationalMode>(siteControl.mode);
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
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 19);
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
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [previewTab, setPreviewTab] = useState<"maintenance" | "inauguration" | "audit">(
    siteControl.mode === "inauguration" ? "inauguration" : "maintenance"
  );
  const [liveCountdownStr, setLiveCountdownStr] = useState<string>("");

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
        setLiveCountdownStr("Invalid Date");
        return;
      }
      const diff = target - Date.now();
      if (diff <= 0) {
        setLiveCountdownStr("00d : 00h : 00m : 00s (READY TO REVEAL)");
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      setLiveCountdownStr(`${pad(d)}d : ${pad(h)}h : ${pad(m)}m : ${pad(s)}s`);
    };
    updateTicker();
    const id = window.setInterval(updateTicker, 500);
    return () => window.clearInterval(id);
  }, [inaugurationTargetLocal]);

  const handleDeveloperLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/developer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.developer) {
        setLoginError(data.error || "Invalid developer credentials.");
        setIsLoggingIn(false);
        return;
      }
      localStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(data.developer));
      setSession(data.developer);
      setUsername("");
      setPassword("");
    } catch {
      setLoginError("Failed to reach Developer Authentication endpoint.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDeveloperLogout = () => {
    localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    setSession(null);
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
    setDraftMode("inauguration");
    setPreviewTab("inauguration");
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
      const res = await fetch("/api/site-control", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
          type: "error",
          text: data.error || "Failed to deploy site operational state.",
        });
        return;
      }

      onSiteControlUpdated(data.siteControl);
      setDraftMode(data.siteControl.mode);
      setSaveBanner({
        type: "success",
        text: `Deployed [${data.siteControl.mode.toUpperCase()}] mode across all connected clients.`,
      });
    } catch {
      setSaveBanner({
        type: "error",
        text: "Network error while deploying site operational state.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleForceRevealNow = async () => {
    setIsSaving(true);
    setSaveBanner(null);
    try {
      const res = await fetch("/api/site-control/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.sessionToken
            ? { Authorization: `Bearer ${session.sessionToken}` }
            : {}),
        },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (res.ok && data.siteControl) {
        onSiteControlUpdated(data.siteControl);
        setDraftMode("live");
        setSaveBanner({
          type: "success",
          text: "Website immediately revealed to LIVE mode for all visitors!",
        });
      } else {
        setSaveBanner({
          type: "error",
          text: data.error || "Could not force reveal website.",
        });
      }
    } catch {
      setSaveBanner({
        type: "error",
        text: "Network error while triggering reveal.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  /* ------------------------------------------------------------------------
   * DEVELOPER AUTHENTICATION GATE (Distinct Industrial Terminal Theme)
   * ---------------------------------------------------------------------- */
  if (!session) {
    return (
      <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col justify-between font-mono relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #94A3B8 1px, transparent 1px), linear-gradient(to bottom, #94A3B8 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Top System Strip */}
        <header className="relative z-10 border-b border-slate-800 bg-[#0B0F17] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-white block">
                FAD // SYSOPS & DEPLOYMENT CONSOLE
              </span>
              <span className="text-[10px] text-slate-400">
                HIDDEN DEVELOPER CONTROL PLANE • NODE V4.2
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToPublic}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-sans font-medium transition-colors cursor-pointer"
          >
            ← Public Website
          </button>
        </header>

        {/* Center Terminal Login Box */}
        <main className="relative z-10 flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-[#0E131D] border border-slate-800 rounded-2xl p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-[#F59E0B]" />
                <span className="text-sm font-bold tracking-wide text-white uppercase">
                  Developer Root Access
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase">
                Port 3000
              </span>
            </div>

            <form onSubmit={handleDeveloperLogin} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Developer Identifier
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="developer"
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-xl bg-[#080B10] border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#10B981] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Master Access Key
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl bg-[#080B10] border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#10B981] transition-colors"
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#04130D] font-mono font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer mt-2"
              >
                {isLoggingIn ? "Authenticating..." : "Initialize Developer Session →"}
              </button>
            </form>
          </motion.div>
        </main>

        <footer className="relative z-10 border-t border-slate-900 px-6 py-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>ISOLATED MANAGEMENT PORTAL (SEPARATE FROM ADMIN & DOCTOR PORTALS)</span>
          <span>SHORTCUT: CTRL + SHIFT + D</span>
        </footer>
      </div>
    );
  }

  /* ------------------------------------------------------------------------
   * AUTHENTICATED DEVELOPER MANAGEMENT CONSOLE
   * ---------------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#080B10] text-slate-100 flex flex-col font-sans selection:bg-[#10B981] selection:text-[#04130D]">
      {/* Top Industrial Command Header (100% Solid Background) */}
      <header className="sticky top-0 z-30 bg-[#0B0F17] border-b border-slate-800 px-4 sm:px-6 py-3.5 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-sm tracking-wider uppercase text-white">
                  Developer Site Operations Console
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono uppercase text-slate-300">
                  Isolated Portal #3
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Control public availability, Maintenance lockouts, and Inauguration launch timers
              </p>
            </div>
          </div>

          {/* Right Status & Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Current Live Broadcast State Pill */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#080B10] border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">ACTIVE STATE:</span>
              {siteControl.mode === "live" && (
                <span className="inline-flex items-center gap-1.5 text-[#10B981] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  LIVE PRODUCTION
                </span>
              )}
              {siteControl.mode === "maintenance" && (
                <span className="inline-flex items-center gap-1.5 text-[#F59E0B] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                  MAINTENANCE MODE
                </span>
              )}
              {siteControl.mode === "inauguration" && (
                <span className="inline-flex items-center gap-1.5 text-[#38BDF8] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-ping" />
                  INAUGURATION COUNTDOWN
                </span>
              )}
            </div>

            {/* Developer Bypass Toggle */}
            <button
              type="button"
              onClick={handleToggleBypass}
              title="When enabled, your browser bypasses Maintenance & Inauguration screens so you can test the live website while visitors see the lock screen."
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-mono transition-colors cursor-pointer ${
                devBypass
                  ? "bg-[#1E5AFF]/20 border-[#1E5AFF] text-white"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {devBypass ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Dev Bypass: {devBypass ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={onNavigateToPublic}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <span>Open Public Site</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDeveloperLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Deployment Status Banner */}
        <AnimatePresence>
          {saveBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                saveBanner.type === "success"
                  ? "bg-[#10B981]/10 border-[#10B981]/40 text-[#34D399]"
                  : "bg-red-950/60 border-red-800 text-red-200"
              }`}
            >
              <div className="flex items-center gap-3 text-sm font-medium">
                {saveBanner.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                )}
                <span>{saveBanner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveBanner(null)}
                className="text-xs font-mono uppercase opacity-75 hover:opacity-100 cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION 1: 3-WAY MASTER OPERATIONAL MODE SWITCHER */}
        <section className="bg-[#0E131D] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-800">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#10B981] block">
                01 // Master Traffic Router
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                Website Operational State
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleDeployConfiguration()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-[#04130D] font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#10B981]/20 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSaving ? "animate-spin" : ""}`} />
                {isSaving ? "Deploying..." : "Save & Broadcast State"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mode 1: LIVE */}
            <div
              onClick={() => setDraftMode("live")}
              className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                draftMode === "live"
                  ? "bg-[#10B981]/10 border-[#10B981] shadow-lg shadow-[#10B981]/10"
                  : "bg-[#080B10] border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 flex items-center justify-center text-[#10B981]">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase font-bold ${
                      siteControl.mode === "live"
                        ? "bg-[#10B981] text-[#04130D]"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {siteControl.mode === "live" ? "Currently Active" : "Standby"}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  1. Live Production Website
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Normal public operation. Patients can browse all clinical pages and book
                  appointments in real time.
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraftMode("live");
                  handleDeployConfiguration("live");
                }}
                className="mt-5 w-full py-2.5 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981] text-[#34D399] hover:text-[#04130D] font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Switch to Live Now
              </button>
            </div>

            {/* Mode 2: MAINTENANCE */}
            <div
              onClick={() => {
                setDraftMode("maintenance");
                setPreviewTab("maintenance");
              }}
              className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                draftMode === "maintenance"
                  ? "bg-[#F59E0B]/10 border-[#F59E0B] shadow-lg shadow-[#F59E0B]/10"
                  : "bg-[#080B10] border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center text-[#F59E0B]">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase font-bold ${
                      siteControl.mode === "maintenance"
                        ? "bg-[#F59E0B] text-[#1F1300]"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {siteControl.mode === "maintenance" ? "Currently Active" : "Standby"}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  2. Maintenance Lockout Mode
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Redirects all public visitors to a dedicated "Website Under Maintenance" screen
                  with ETA and emergency phone contact.
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraftMode("maintenance");
                  setPreviewTab("maintenance");
                  handleDeployConfiguration("maintenance");
                }}
                className="mt-5 w-full py-2.5 rounded-xl bg-[#F59E0B]/20 hover:bg-[#F59E0B] text-[#FBBF24] hover:text-[#1F1300] font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Activate Maintenance Mode
              </button>
            </div>

            {/* Mode 3: INAUGURATION COUNTDOWN */}
            <div
              onClick={() => {
                setDraftMode("inauguration");
                setPreviewTab("inauguration");
              }}
              className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                draftMode === "inauguration"
                  ? "bg-[#1E5AFF]/15 border-[#1E5AFF] shadow-lg shadow-[#1E5AFF]/15"
                  : "bg-[#080B10] border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#1E5AFF]/20 flex items-center justify-center text-[#60A5FA]">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase font-bold ${
                      siteControl.mode === "inauguration"
                        ? "bg-[#1E5AFF] text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {siteControl.mode === "inauguration" ? "Currently Active" : "Standby"}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  3. Inauguration Countdown Mode
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Displays a grand ceremonial countdown timer before revealing the website for the
                  first time when the clock reaches 00:00:00.
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraftMode("inauguration");
                  setPreviewTab("inauguration");
                  handleDeployConfiguration("inauguration");
                }}
                className="mt-5 w-full py-2.5 rounded-xl bg-[#1E5AFF]/25 hover:bg-[#1E5AFF] text-[#93C5FD] hover:text-white font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Start Inauguration Timer
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 2: CONFIGURATION PANELS (MAINTENANCE + INAUGURATION) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT CARD: MAINTENANCE SETTINGS */}
          <section className="bg-[#0E131D] border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center text-[#F59E0B]">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#F59E0B] block">
                      Configuration A
                    </span>
                    <h3 className="text-base font-bold text-white">
                      Maintenance Screen Parameters
                    </h3>
                  </div>
                </div>

                {siteControl.mode === "maintenance" && (
                  <span className="px-2.5 py-1 rounded bg-[#F59E0B]/20 text-[#FBBF24] text-[10px] font-mono uppercase font-bold">
                    Live on Public Site
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Maintenance Headline
                  </label>
                  <input
                    type="text"
                    value={maintenanceTitle}
                    onChange={(e) => setMaintenanceTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 text-white text-sm focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Public Notice Message
                  </label>
                  <textarea
                    rows={3}
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 text-white text-sm focus:outline-none focus:border-[#F59E0B] resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      Estimated Completion (ETA)
                    </label>
                    <input
                      type="text"
                      value={maintenanceEta}
                      onChange={(e) => setMaintenanceEta(e.target.value)}
                      placeholder="e.g., Within 2 Hours / 4:00 PM EST"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 text-white text-sm focus:outline-none focus:border-[#F59E0B]"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showEmergencyContact}
                        onChange={(e) => setShowEmergencyContact(e.target.checked)}
                        className="w-4 h-4 accent-[#F59E0B]"
                      />
                      <span className="text-xs text-slate-200 font-medium">
                        Show Emergency Phone
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Visitors will be redirected to the maintenance view immediately.
              </span>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setDraftMode("maintenance");
                  handleDeployConfiguration("maintenance");
                }}
                className="px-5 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#1F1300] font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                Save & Enable Maintenance
              </button>
            </div>
          </section>

          {/* RIGHT CARD: INAUGURATION COUNTDOWN SETTINGS */}
          <section className="bg-[#0E131D] border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1E5AFF]/20 flex items-center justify-center text-[#60A5FA]">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#60A5FA] block">
                      Configuration B
                    </span>
                    <h3 className="text-base font-bold text-white">
                      Inauguration Launch & Countdown Timer
                    </h3>
                  </div>
                </div>

                {siteControl.mode === "inauguration" && (
                  <span className="px-2.5 py-1 rounded bg-[#1E5AFF]/25 text-[#93C5FD] text-[10px] font-mono uppercase font-bold">
                    Countdown Active
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {/* Target Date-Time & Quick Presets */}
                <div className="p-4 rounded-2xl bg-[#080B10] border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#60A5FA]" />
                      Inauguration Reveal Date & Time
                    </label>
                    <span className="font-mono text-xs text-[#34D399] font-semibold">
                      {liveCountdownStr}
                    </span>
                  </div>

                  <input
                    type="datetime-local"
                    step="1"
                    value={inaugurationTargetLocal}
                    onChange={(e) => setInaugurationTargetLocal(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0E131D] border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[#1E5AFF]"
                  />

                  {/* Instant Demo / Launch Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-mono text-slate-400 mr-1">
                      Quick Timer Presets:
                    </span>
                    {[
                      { label: "+15 Sec (Demo)", sec: 15 },
                      { label: "+30 Sec", sec: 30 },
                      { label: "+2 Min", sec: 120 },
                      { label: "+5 Min", sec: 300 },
                      { label: "+1 Hour", sec: 3600 },
                      { label: "+24 Hours", sec: 86400 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyQuickCountdownPreset(preset.sec)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-[#1E5AFF] text-slate-200 hover:text-white font-mono text-[11px] transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      Inauguration Headline
                    </label>
                    <input
                      type="text"
                      value={inaugurationTitle}
                      onChange={(e) => setInaugurationTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 text-white text-sm focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      Location / Header Badge
                    </label>
                    <input
                      type="text"
                      value={inaugurationNote}
                      onChange={(e) => setInaugurationNote(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 text-white text-sm focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Ceremonial Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={inaugurationSubtitle}
                    onChange={(e) => setInaugurationSubtitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 text-white text-sm focus:outline-none focus:border-[#1E5AFF] resize-none"
                  />
                </div>

                <label className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#080B10] border border-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRevealOnZero}
                    onChange={(e) => setAutoRevealOnZero(e.target.checked)}
                    className="w-4 h-4 accent-[#1E5AFF]"
                  />
                  <span className="text-xs text-slate-200 font-medium">
                    Automatically reveal live website to all visitors the moment countdown hits
                    00:00:00
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleForceRevealNow}
                className="px-4 py-2.5 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981] text-[#34D399] hover:text-[#04130D] font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Reveal Website Immediately
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setDraftMode("inauguration");
                  handleDeployConfiguration("inauguration");
                }}
                className="px-5 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#194CE0] text-white font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Save & Launch Countdown
              </button>
            </div>
          </section>
        </div>

        {/* SECTION 3: INTERACTIVE SCREEN SIMULATOR & DEPLOYMENT AUDIT LOG */}
        <section className="bg-[#0E131D] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-mono uppercase tracking-wider font-bold text-white">
                03 // Live Screen Simulator & State Audit Log
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewTab("maintenance")}
                className={`px-3.5 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                  previewTab === "maintenance"
                    ? "bg-[#F59E0B] text-[#1F1300] font-bold"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Preview Maintenance Screen
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("inauguration")}
                className={`px-3.5 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                  previewTab === "inauguration"
                    ? "bg-[#1E5AFF] text-white font-bold"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Preview Inauguration Screen
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("audit")}
                className={`px-3.5 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                  previewTab === "audit"
                    ? "bg-[#10B981] text-[#04130D] font-bold"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Audit Log ({siteControl.history?.length || 0})
              </button>
            </div>
          </div>

          {previewTab === "audit" ? (
            <div className="p-6 max-h-[420px] overflow-y-auto space-y-2.5 font-mono">
              {(!siteControl.history || siteControl.history.length === 0) && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No mode transitions recorded yet.
                </div>
              )}
              {siteControl.history?.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#080B10] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold ${
                        item.mode === "live"
                          ? "bg-[#10B981]/20 text-[#34D399]"
                          : item.mode === "maintenance"
                          ? "bg-[#F59E0B]/20 text-[#FBBF24]"
                          : "bg-[#1E5AFF]/20 text-[#93C5FD]"
                      }`}
                    >
                      {item.mode}
                    </span>
                    <span className="text-slate-200">{item.action}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>Actor: {item.actor}</span>
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t border-slate-800 max-h-[640px] overflow-y-auto">
              {previewTab === "maintenance" ? (
                <MaintenanceView
                  config={{
                    ...siteControl,
                    maintenanceTitle,
                    maintenanceMessage,
                    maintenanceEta,
                    showEmergencyContact,
                  }}
                  onOpenDeveloperPortal={() => {}}
                />
              ) : (
                <InaugurationCountdownView
                  config={{
                    ...siteControl,
                    inaugurationTargetTime: new Date(inaugurationTargetLocal).toISOString(),
                    inaugurationTitle,
                    inaugurationSubtitle,
                    inaugurationNote,
                    autoRevealOnZero: false, // don't auto-exit during preview inside console
                  }}
                  onRevealComplete={() => handleForceRevealNow()}
                  onOpenDeveloperPortal={() => {}}
                />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
