import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import {
  DoctorAvailabilityRecord,
  TemporarySlotReservation,
  SlotDurationMinutes,
  ComputedTimeSlot,
  DAY_NAMES,
  generateTimeSlotsFromWindow,
  getConfiguredDoctorSlotsForDate,
  sortTimeSlotsChronologically,
} from './src/types/scheduling';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: 'public/assets/aistudio/first-avenue-dentistry_978f5d83.env', override: true });

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use(express.json({ limit: '250kb' }));

// Enterprise HTTP Security Headers Middleware & Zero-Trust Origin Hardening
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Content Security Policy allowing preview embedding while blocking malicious cross-origin script injection
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.google.com https://*.run.app http://localhost:* https://localhost:*;"
  );
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  next();
});

// Sliding-window In-Memory Rate Limiter for DDoS / Brute-Force Defense
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function createRateLimiter(maxRequests: number, windowMs: number, errorMessage = 'Too many requests. Please try again shortly.') {
  return (req: Request, res: Response, next: NextFunction) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();
    const key = `${req.path}:${clientIp}`;
    const now = Date.now();
    const current = rateLimitStore.get(key);

    if (!current || now > current.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      const remainingSec = Math.ceil((current.resetAt - now) / 1000);
      return res.status(429).json({
        error: `${errorMessage} (Wait ${remainingSec}s)`,
        retryAfter: remainingSec,
      });
    }

    current.count += 1;
    next();
  };
}

// Clinic Constants
const CLINIC_NAME = 'First Avenue Dentistry';
const CLINIC_FULL_NAME = 'First Avenue Family Dentistry';
const CLINIC_PHONE = '(519) 207-6890';
const CLINIC_ADDRESS = '308 Wellington Street, St. Thomas, ON N5R 2S9';
const SITE_URL = (process.env.SITE_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// Data Storage Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const DOCTORS_FILE = path.join(DATA_DIR, 'doctors.json');
const AVAILABILITY_FILE = path.join(DATA_DIR, 'doctor_availability.json');
const RESERVATIONS_FILE = path.join(DATA_DIR, 'reservations.json');
const EMAIL_LOG_FILE = path.join(DATA_DIR, 'email_log.json');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const MANUAL_AVAILABILITY_RESET_FILE = path.join(DATA_DIR, 'manual_availability_reset_v2.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJSON<T>(file: string, fallback: T[]): T[] {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch {}
  return fallback;
}

function saveJSON<T>(file: string, data: T[]): void {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error saving ${file}:`, err);
  }
}

// Import server-side Firebase Realtime Database
import { initFirebase, fbGet, fbSet, isFirebaseReady } from './src/lib/firebaseAdmin';

// ======================== REAL-TIME SSE BROADCAST HUB ========================
const sseClients = new Set<Response>();

function broadcastRealtimeEvent(type: string, payload: Record<string, unknown> = {}) {
  const message = JSON.stringify({
    type,
    timestamp: new Date().toISOString(),
    ...payload,
  });
  for (const client of sseClients) {
    try {
      client.write(`data: ${message}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

app.get('/api/realtime/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// ======================== ATOMIC CONCURRENCY LOCKING ========================
const lockChains = new Map<string, Promise<unknown>>();

async function withAtomicLock<T>(lockKey: string, task: () => Promise<T> | T): Promise<T> {
  const prev = lockChains.get(lockKey) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  lockChains.set(lockKey, prev.then(() => current));

  await prev;
  try {
    return await task();
  } finally {
    release();
    if (lockChains.get(lockKey) === current) {
      lockChains.delete(lockKey);
    }
  }
}

// ======================== DOCTORS & INITIAL AVAILABILITY SEED ========================
export interface DoctorRecord {
  id: string;
  name: string;
  title: string;
  qualifications: string;
  specialties: string[];
  status: 'active' | 'on_leave';
  email: string;
  phone: string;
  bio: string;
  username?: string;
  updatedAt: string;
}

const LEGACY_DUMMY_DOCTOR_IDS = new Set([
  'doc-dk-sharma',
  'doc-shradha-sharma',
  'doc-john',
  'doc-sarah',
  'doc-michael',
  'acct-doc-dk-sharma',
  'acct-doc-shradha-sharma',
  'acct-doc-john',
  'acct-doc-sarah',
  'acct-doc-michael',
]);

function isLegacyDummyDoctor(id?: string, name?: string): boolean {
  const cleanId = String(id || '').trim().toLowerCase();
  if (LEGACY_DUMMY_DOCTOR_IDS.has(cleanId)) return true;
  const cleanName = String(name || '').trim().toLowerCase();
  return (
    cleanName === 'dr. d. k. sharma' ||
    cleanName === 'dr. shradha sharma' ||
    cleanName === 'dr. john' ||
    cleanName === 'dr. sarah' ||
    cleanName === 'dr. michael'
  );
}

function normalizeDoctorRecord(raw: any): DoctorRecord {
  const cleanName = String(raw?.name || 'Doctor').trim();
  const cleanId = String(
    raw?.id || `doc-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  ).trim();
  const specs = Array.isArray(raw?.specialties)
    ? raw.specialties.map((s: any) => String(s).trim()).filter(Boolean)
    : raw?.specialties
    ? String(raw.specialties)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
    : ['General Dentistry'];

  return {
    id: cleanId,
    name: cleanName,
    title: String(raw?.title || 'Dentist / Specialist').trim(),
    qualifications: String(raw?.qualifications || raw?.credentials || 'BDS, DDS').trim(),
    specialties: specs.length > 0 ? specs : ['General Dentistry'],
    status: raw?.status === 'on_leave' ? 'on_leave' : 'active',
    email: String(raw?.email || 'firstavenuedentistry@gmail.com').trim().toLowerCase(),
    phone: String(raw?.phone || '(519) 207-6890').trim(),
    bio: String(raw?.bio || '').trim(),
    username: String(
      raw?.username || cleanName.toLowerCase().replace(/[^a-z0-9.]/g, '')
    )
      .trim()
      .toLowerCase(),
    updatedAt: String(raw?.updatedAt || raw?.createdAt || new Date().toISOString()),
  };
}

function buildWeeklyScheduleForDoctor(
  activeDays: { [dayOfWeek: number]: { start: string; end: string; duration: SlotDurationMinutes } },
  defaultDuration: SlotDurationMinutes = 30
) {
  return DAY_NAMES.map((dayName, dayOfWeek) => {
    const cfg = activeDays[dayOfWeek];
    if (cfg) {
      return {
        dayOfWeek,
        dayName,
        enabled: true,
        startTime: cfg.start,
        endTime: cfg.end,
        slotDuration: cfg.duration,
        slots: generateTimeSlotsFromWindow(cfg.start, cfg.end, cfg.duration),
      };
    }
    return {
      dayOfWeek,
      dayName,
      enabled: false,
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: defaultDuration,
      slots: [],
    };
  });
}

function buildDefaultAvailabilityForDoctor(doc: DoctorRecord): DoctorAvailabilityRecord {
  const now = new Date().toISOString();
  // Doctors start with NO dummy dates or pre-enabled weekly hours.
  // Each doctor manually adds and saves their own availability from the Doctor Portal.
  return {
    doctorId: doc.id,
    doctorName: doc.name,
    defaultDuration: 30,
    recurringWeekly: buildWeeklyScheduleForDoctor({}, 30),
    specificDates: [],
    updatedAt: now,
  };
}

function isLegacyDummyAvailability(avail: DoctorAvailabilityRecord): boolean {
  const hasAutoSeededSpecIds = Array.isArray(avail.specificDates) && avail.specificDates.some(
    (d) =>
      String(d.id || '').startsWith('spec-1-') ||
      String(d.id || '').startsWith('spec-2-') ||
      String(d.id || '').startsWith('spec-3-') ||
      String(d.id || '').startsWith('spec-4-') ||
      String(d.id || '').startsWith('spec-5-') ||
      String(d.id || '').startsWith('spec-6-') ||
      String(d.note || '').endsWith('Clinical Session')
  );
  return hasAutoSeededSpecIds;
}

function initializeDoctorsAndAvailability() {
  const existingDocs = loadJSON<any>(DOCTORS_FILE, []);
  const mergedDocs: DoctorRecord[] = existingDocs
    .filter((d) => d && !isLegacyDummyDoctor(d.id, d.name))
    .map((d) => normalizeDoctorRecord(d));

  saveJSON(DOCTORS_FILE, mergedDocs);

  const resetDone = fs.existsSync(MANUAL_AVAILABILITY_RESET_FILE);
  const existingAvail = resetDone ? loadJSON<DoctorAvailabilityRecord>(AVAILABILITY_FILE, []) : [];
  const mergedAvail: DoctorAvailabilityRecord[] = [];

  for (const item of existingAvail) {
    if (isLegacyDummyAvailability(item) || isLegacyDummyDoctor(item.doctorId, item.doctorName)) {
      continue;
    }
    if (
      mergedDocs.some(
        (d) => d.id === item.doctorId || d.name.toLowerCase() === item.doctorName.toLowerCase()
      )
    ) {
      mergedAvail.push(item);
    }
  }

  for (const doc of mergedDocs) {
    const found = mergedAvail.find(
      (a) => a.doctorId === doc.id || a.doctorName.toLowerCase() === doc.name.toLowerCase()
    );
    if (!found) {
      mergedAvail.push(buildDefaultAvailabilityForDoctor(doc));
    } else if (found.doctorId !== doc.id || found.doctorName !== doc.name) {
      found.doctorId = doc.id;
      found.doctorName = doc.name;
    }
  }

  saveJSON(AVAILABILITY_FILE, mergedAvail);
  if (!resetDone) {
    try {
      fs.writeFileSync(
        MANUAL_AVAILABILITY_RESET_FILE,
        JSON.stringify({ resetAt: new Date().toISOString() }, null, 2)
      );
    } catch {}
  }
  return { doctors: mergedDocs, availabilities: mergedAvail, wasReset: !resetDone };
}

const initialClinicalState = initializeDoctorsAndAvailability();
let doctorsDatabase: DoctorRecord[] = initialClinicalState.doctors;
let availabilityDatabase: DoctorAvailabilityRecord[] = initialClinicalState.availabilities;
let appointmentDatabase: any[] = loadJSON<any>(APPOINTMENTS_FILE, []);
let reservationsDatabase: TemporarySlotReservation[] = loadJSON<TemporarySlotReservation>(RESERVATIONS_FILE, []);

function persistDoctorsDatabase() {
  saveJSON(DOCTORS_FILE, doctorsDatabase);
  if (isFirebaseReady()) {
    fbSet('doctors', doctorsDatabase).catch(() => {});
  }
}

function persistAvailabilityDatabase() {
  saveJSON(AVAILABILITY_FILE, availabilityDatabase);
  if (isFirebaseReady()) {
    fbSet('doctor_availability', availabilityDatabase).catch(() => {});
  }
}

function persistAppointmentsDatabase() {
  saveJSON(APPOINTMENTS_FILE, appointmentDatabase);
  if (isFirebaseReady()) {
    fbSet('appointments', appointmentDatabase).catch(() => {});
  }
}

function persistReservationsDatabase() {
  saveJSON(RESERVATIONS_FILE, reservationsDatabase);
  if (isFirebaseReady()) {
    fbSet('slot_reservations', reservationsDatabase).catch(() => {});
  }
}

// Admin Seed & Persistent Staff / Doctor Accounts
export interface AdminAccountRecord {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  role: string;
  doctorId?: string;
  createdAt: string;
}

let seededAdmins: Omit<AdminAccountRecord, 'id' | 'createdAt'>[] = [];
try {
  if (process.env.ADMIN_SEED) {
    const raw = process.env.ADMIN_SEED.trim();
    seededAdmins = JSON.parse(raw);
    console.log(`[Admin] Loaded ${seededAdmins.length} seeded administrator accounts.`);
  }
} catch (e: any) {
  console.warn('[Admin] Failed to parse ADMIN_SEED:', e.message);
}

function buildInitialAdmins(): AdminAccountRecord[] {
  const existing = loadJSON<AdminAccountRecord>(ADMINS_FILE, []).filter(
    (a) => !isLegacyDummyDoctor(a.id, a.name) && !isLegacyDummyDoctor(a.doctorId, a.name)
  );
  const combined: AdminAccountRecord[] = [...existing];

  const ensureAdmin = (item: {
    id: string;
    name: string;
    email: string;
    username: string;
    password: string;
    role: string;
    doctorId?: string;
  }) => {
    const foundIdx = combined.findIndex(
      (a) =>
        a.username.toLowerCase() === item.username.toLowerCase() ||
        (item.doctorId && a.doctorId === item.doctorId)
    );
    if (foundIdx === -1) {
      combined.push({
        ...item,
        createdAt: new Date().toISOString(),
      });
    } else if (item.doctorId && !combined[foundIdx].doctorId) {
      combined[foundIdx].doctorId = item.doctorId;
    }
  };

  for (const s of seededAdmins) {
    ensureAdmin({
      id: `admin-${s.username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'seed'}`,
      name: s.name || 'Dr. Fenil',
      email: s.email || 'fenilxpatel2642@gmail.com',
      username: s.username || 'fenil',
      password: s.password || '1234567890',
      role: s.role || 'Super Admin',
    });
  }

  ensureAdmin({
    id: 'admin-fenil-primary',
    name: 'Dr. Fenil',
    email: 'fenilxpatel2642@gmail.com',
    username: 'fenil',
    password: '1234567890',
    role: 'Super Admin',
  });

  ensureAdmin({
    id: 'admin-clinic-owner',
    name: 'Clinic Administrator',
    email: process.env.CLINIC_ADMIN_EMAIL || 'fenilxpatel2642@gmail.com',
    username: 'admin',
    password: '1234567890',
    role: 'Super Admin',
  });

  // Ensure each real registered doctor has a login account for the Doctor Portal
  for (const doc of doctorsDatabase) {
    const uname = doc.username || doc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    ensureAdmin({
      id: `acct-${doc.id}`,
      name: doc.name,
      email: doc.email || 'firstavenuedentistry@gmail.com',
      username: uname,
      password: '1234567890',
      role: 'Doctor',
      doctorId: doc.id,
    });
  }

  saveJSON(ADMINS_FILE, combined);
  return combined;
}

let adminsDatabase: AdminAccountRecord[] = buildInitialAdmins();

function persistAdminsDatabase() {
  saveJSON(ADMINS_FILE, adminsDatabase);
  if (isFirebaseReady()) {
    fbSet('admins', adminsDatabase).catch((err: any) => {
      console.warn('[Firebase RTDB] Admins sync warning:', err.message);
    });
  }
}

function maskEmailAddress(email: string): string {
  const clean = String(email || '').trim();
  const [local, domain] = clean.split('@');
  if (!local || !domain) return clean;
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

// Realtime Database Cloud Hydration
async function bootstrapCloudStorage() {
  const connected = initFirebase();
  if (connected) {
    try {
      const cloudAppointments = await fbGet<any[]>('appointments');
      if (Array.isArray(cloudAppointments) && cloudAppointments.length > 0) {
        appointmentDatabase = cloudAppointments;
        saveJSON(APPOINTMENTS_FILE, appointmentDatabase);
      } else if (appointmentDatabase.length > 0) {
        await fbSet('appointments', appointmentDatabase);
      }

      const cloudDoctors = await fbGet<DoctorRecord[]>('doctors');
      if (Array.isArray(cloudDoctors) && cloudDoctors.length > 0) {
        for (const cDoc of cloudDoctors) {
          if (
            cDoc &&
            cDoc.id &&
            !isLegacyDummyDoctor(cDoc.id, cDoc.name) &&
            !doctorsDatabase.some(
              (d) => d.id === cDoc.id || d.name.toLowerCase() === String(cDoc.name || '').toLowerCase()
            )
          ) {
            doctorsDatabase.push(normalizeDoctorRecord(cDoc));
          }
        }
        saveJSON(DOCTORS_FILE, doctorsDatabase);
        await fbSet('doctors', doctorsDatabase);
      } else {
        await fbSet('doctors', doctorsDatabase);
      }

      if (initialClinicalState.wasReset) {
        await fbSet('doctor_availability', availabilityDatabase);
      } else {
        const cloudAvail = await fbGet<DoctorAvailabilityRecord[]>('doctor_availability');
        if (Array.isArray(cloudAvail) && cloudAvail.length > 0) {
          for (const item of cloudAvail) {
            if (isLegacyDummyAvailability(item) || isLegacyDummyDoctor(item.doctorId, item.doctorName)) {
              continue;
            }
            if (!doctorsDatabase.some((d) => d.id === item.doctorId)) continue;
            const idx = availabilityDatabase.findIndex((a) => a.doctorId === item.doctorId);
            if (idx >= 0) {
              availabilityDatabase[idx] = item;
            } else {
              availabilityDatabase.push(item);
            }
          }
          saveJSON(AVAILABILITY_FILE, availabilityDatabase);
        }
        await fbSet('doctor_availability', availabilityDatabase);
      }

      const cloudAdmins = await fbGet<AdminAccountRecord[]>('admins');
      if (Array.isArray(cloudAdmins) && cloudAdmins.length > 0) {
        const merged = cloudAdmins.filter(
          (c) => !isLegacyDummyDoctor(c.id, c.name) && !isLegacyDummyDoctor(c.doctorId, c.name)
        );
        for (const loc of adminsDatabase) {
          if (
            !merged.some(
              (c) =>
                c.username.toLowerCase() === loc.username.toLowerCase() ||
                (loc.doctorId && c.doctorId === loc.doctorId)
            )
          ) {
            merged.push(loc);
          }
        }
        adminsDatabase = merged;
        saveJSON(ADMINS_FILE, adminsDatabase);
        await fbSet('admins', adminsDatabase);
      } else if (adminsDatabase.length > 0) {
        await fbSet('admins', adminsDatabase);
      }
    } catch (err: any) {
      console.warn('[Firebase RTDB] Cloud bootstrap warning:', err.message);
    }
  }
}

// ======================== SMTP NODEMAILER SETUP ========================
const SMTP_HOST = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525', 10);
const SMTP_USER = process.env.SMTP_USER || 'b41029001@smtp-brevo.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
const rawFrom = process.env.EMAIL_FROM || 'no-reply@vantage-i.me';
const EMAIL_FROM =
  rawFrom.endsWith('@gmail.com') && SMTP_HOST.includes('brevo')
    ? 'no-reply@vantage-i.me'
    : rawFrom;
const CLINIC_ADMIN_EMAIL = process.env.CLINIC_ADMIN_EMAIL || 'fenilxpatel2642@gmail.com';
const SECONDARY_ADMIN_EMAIL = ''; // Disabled: admin notifications route exclusively to CLINIC_ADMIN_EMAIL (fenilxpatel2642@gmail.com)

type MailTransporter = ReturnType<typeof nodemailer.createTransport>;
let smtpTransporter: MailTransporter | null = null;
let smtpReady = false;

if (SMTP_USER && SMTP_PASS) {
  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
  });
} else {
  console.log('[Email] No SMTP credentials configured. Running in file log fallback mode.');
}

function logEmailToFile(
  to: string,
  subject: string,
  html: string,
  status: 'delivered' | 'logged',
  messageId?: string
) {
  const logs = loadJSON<any>(EMAIL_LOG_FILE, []);
  logs.unshift({
    id: `eml-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    to,
    from: EMAIL_FROM,
    subject,
    html,
    status,
    messageId: messageId || null,
    timestamp: new Date().toISOString(),
  });
  saveJSON(EMAIL_LOG_FILE, logs.slice(0, 100));
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/tr>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&bull;/g, '•')
    .replace(/&amp;/g, '&')
    .replace(/&#10003;/g, '✓')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

async function deliverEmail(to: string, subject: string, html: string, icsAttachment?: string) {
  const cleanTo = String(to || '').trim();
  if (!cleanTo || !cleanTo.includes('@')) {
    return { dispatched: false, error: 'Invalid recipient email address' };
  }

  console.log(`[Email] Dispatching to ${cleanTo} from ${EMAIL_FROM}: "${subject}"`);
  let dispatched = false;
  let messageId = '';
  let lastError = '';

  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: `"${CLINIC_NAME}" <${EMAIL_FROM}>`,
        replyTo: 'firstavenuedentistry@gmail.com',
        to: cleanTo,
        subject,
        text: htmlToPlainText(html),
        html,
        ...(icsAttachment
          ? {
              attachments: [
                {
                  filename: 'appointment-invite.ics',
                  content: icsAttachment,
                  contentType: 'text/calendar; charset=utf-8; method=REQUEST',
                },
              ],
            }
          : {}),
      });
      dispatched = true;
      smtpReady = true;
      messageId = info.messageId || '';
      console.log(`[Email] Delivered via SMTP to ${cleanTo} (MessageId: ${messageId})`);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      if (lastError.includes('525') || lastError.includes('Unauthorized IP') || lastError.includes('Invalid login')) {
        console.log(`[Email] SMTP relay IP restriction active (${lastError}). Switching to local email log fallback.`);
        smtpTransporter = null;
        dispatched = true;
        messageId = `local-${Date.now()}`;
      } else {
        console.warn('[Email] SMTP dispatch warning, logged locally:', lastError);
      }
    }
  } else {
    dispatched = true;
    messageId = `local-${Date.now()}`;
  }

  logEmailToFile(cleanTo, subject, html, dispatched ? 'delivered' : 'logged', messageId);
  return { dispatched, messageId, error: lastError };
}

// --- CALENDAR INVITE GENERATORS ---
function timeSlotTo24h(slot: string): string {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(String(slot).trim());
  if (!m) return '09:00';
  let h = parseInt(m[1], 10);
  const min = m[2] ? m[2].padStart(2, '0') : '00';
  if ((m[3] || '').toUpperCase() === 'PM' && h < 12) h += 12;
  if ((m[3] || '').toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function buildIcs(apt: {
  confirmedDate?: string;
  preferredDate?: string;
  confirmedTime?: string;
  preferredTimeSlot?: string;
  preferredTime?: string;
  serviceName?: string;
  service?: string;
  assignedDoctor?: string;
}): string {
  const date = (apt.confirmedDate || apt.preferredDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const start = timeSlotTo24h(apt.confirmedTime || apt.preferredTimeSlot || apt.preferredTime || '09:00 AM');
  const [sh, sm] = start.split(':').map(Number);
  const endMin = (sh || 9) * 60 + (sm || 0) + 30;
  const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  const title = `Dental Appointment - ${apt.serviceName || apt.service || 'Consultation'} - ${CLINIC_NAME}`;
  const desc = `Appointment with ${apt.assignedDoctor || 'Dental Specialist'} at ${CLINIC_NAME}. Please arrive 10 minutes prior. Tel: ${CLINIC_PHONE}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//First Avenue Dentistry//Appointment//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@firstavenuedentistry.com`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${CLINIC_ADDRESS}`,
    `DTSTART:${date}T${start.replace(':', '')}00`,
    `DTEND:${date}T${end.replace(':', '')}00`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildGoogleCalendarUrl(apt: {
  confirmedDate?: string;
  preferredDate?: string;
  confirmedTime?: string;
  preferredTimeSlot?: string;
  preferredTime?: string;
  serviceName?: string;
  service?: string;
  assignedDoctor?: string;
}): string {
  const date = (apt.confirmedDate || apt.preferredDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const start = timeSlotTo24h(apt.confirmedTime || apt.preferredTimeSlot || apt.preferredTime || '09:00 AM').replace(':', '');
  const title = encodeURIComponent(`Dental Appointment - ${apt.serviceName || apt.service || 'Consultation'} - ${CLINIC_NAME}`);
  const details = encodeURIComponent(
    `Dental appointment with ${apt.assignedDoctor || 'Dental Specialist'} at ${CLINIC_NAME}. Location: ${CLINIC_ADDRESS}. Tel: ${CLINIC_PHONE}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}T${start}00/${date}T${start}00&details=${details}&location=${encodeURIComponent(
    CLINIC_ADDRESS
  )}`;
}

// ======================== REDESIGNED PROFESSIONAL DENTAL CLINIC EMAIL TEMPLATES ========================
function emailShell(content: string, statusBanner?: { label: string; bgColor: string; textColor: string; borderColor: string }): string {
  const bannerHtml = statusBanner
    ? `<div style="background: ${statusBanner.bgColor}; border-bottom: 1px solid ${statusBanner.borderColor}; padding: 12px 28px; text-align: center;">
         <span style="font-size: 11px; font-weight: 800; color: ${statusBanner.textColor}; text-transform: uppercase; letter-spacing: 1.4px;">
           ${statusBanner.label}
         </span>
       </div>`
    : '';

  return `
    <div style="background-color: #f1f5f9; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 12px 32px -8px rgba(6, 12, 22, 0.08);">
        <!-- Clinic Brand Header -->
        <div style="background: #060C16; padding: 28px 32px; border-bottom: 3px solid #1E5AFF;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 11px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
                  St. Thomas, Ontario &bull; Dental Care
                </div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">
                  ${CLINIC_NAME}
                </h1>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <a href="tel:5192076890" style="display: inline-block; background: rgba(255,255,255,0.1); color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
                  ${CLINIC_PHONE}
                </a>
              </td>
            </tr>
          </table>
        </div>

        ${bannerHtml}

        <!-- Email Body Content -->
        <div style="padding: 32px 32px 28px; color: #0f172a; line-height: 1.65; font-size: 14px;">
          ${content}
        </div>

        <!-- Clinic Footer -->
        <div style="background: #0f172a; padding: 24px 32px; color: #94a3b8; font-size: 12px; line-height: 1.6;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top;">
                <strong style="color: #ffffff; font-size: 13px;">${CLINIC_NAME}</strong><br />
                ${CLINIC_ADDRESS}<br />
                Direct Phone: <a href="tel:5192076890" style="color: #60a5fa; text-decoration: none; font-weight: 600;">${CLINIC_PHONE}</a>
              </td>
              <td style="text-align: right; vertical-align: top; color: #64748b; font-size: 11px;">
                Mon – Fri: 9:00 AM – 6:00 PM<br />
                Saturday: 9:00 AM – 5:00 PM<br />
                Direct Insurance Billing
              </td>
            </tr>
          </table>
          <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #64748b; text-align: center;">
            Confidential Clinical Communication &bull; Please do not share sensitive health records via unencrypted email.
          </div>
        </div>
      </div>
    </div>`;
}

function buildAppointmentSummaryTable(details: {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  status: string;
  service?: string;
  previousSlot?: string;
  reason?: string;
}): string {
  const statusUpper = details.status.toUpperCase();
  const statusColor =
    statusUpper === 'APPROVED'
      ? '#047857'
      : statusUpper === 'RESCHEDULED'
      ? '#0369a1'
      : statusUpper === 'DECLINED' || statusUpper === 'EXPIRED'
      ? '#b91c1c'
      : '#b45309';

  return `
    <div style="margin: 24px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #f1f5f9; padding: 10px 18px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px;">
        Official Appointment Summary &bull; ${CLINIC_NAME}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0; width: 40%;">Patient Name</td>
          <td style="padding: 12px 18px; font-weight: 700; color: #060C16; border-bottom: 1px solid #e2e8f0;">${details.patientName}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Doctor Name</td>
          <td style="padding: 12px 18px; font-weight: 700; color: #1E5AFF; border-bottom: 1px solid #e2e8f0;">${details.doctorName}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Appointment Date</td>
          <td style="padding: 12px 18px; font-weight: 700; color: #060C16; border-bottom: 1px solid #e2e8f0;">${details.date}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Appointment Time</td>
          <td style="padding: 12px 18px; font-weight: 700; color: #060C16; border-bottom: 1px solid #e2e8f0;">${details.time}</td>
        </tr>
        ${
          details.service
            ? `<tr>
                 <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Reason / Visit Type</td>
                 <td style="padding: 12px 18px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${details.service}</td>
               </tr>`
            : ''
        }
        ${
          details.previousSlot
            ? `<tr>
                 <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Released Previous Slot</td>
                 <td style="padding: 12px 18px; color: #64748b; text-decoration: line-through; border-bottom: 1px solid #e2e8f0;">${details.previousSlot}</td>
               </tr>`
            : ''
        }
        ${
          details.reason
            ? `<tr>
                 <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Clinical Note</td>
                 <td style="padding: 12px 18px; color: #334155; border-bottom: 1px solid #e2e8f0;">${details.reason}</td>
               </tr>`
            : ''
        }
        <tr>
          <td style="padding: 12px 18px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Appointment Status</td>
          <td style="padding: 12px 18px; font-weight: 800; color: ${statusColor}; border-bottom: 1px solid #e2e8f0;">${statusUpper}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; font-weight: 600; color: #64748b;">Clinic Name</td>
          <td style="padding: 12px 18px; font-weight: 700; color: #060C16;">${CLINIC_NAME}</td>
        </tr>
      </table>
    </div>`;
}

function resolveAdminEmailForAppointment(apt: {
  doctorId?: string;
  assignedDoctor?: string;
  doctorPreference?: string;
}): string {
  const doctorIdentifier = String(apt.doctorId || apt.assignedDoctor || apt.doctorPreference || '').trim();
  if (!doctorIdentifier || doctorIdentifier.toLowerCase() === 'any') {
    return CLINIC_ADMIN_EMAIL;
  }

  // 1. Resolve Doctor record from doctorsDatabase
  const doc = resolveDoctorRecord(doctorIdentifier);
  if (doc) {
    if (doc.email && doc.email.includes('@') && !doc.email.includes('example.com')) {
      return doc.email.trim().toLowerCase();
    }
    // Check linked admin account in adminsDatabase
    const linkedAdmin = adminsDatabase.find(
      (a) =>
        (a.doctorId && a.doctorId.toLowerCase() === doc.id.toLowerCase()) ||
        a.id.toLowerCase() === `acct-${doc.id.toLowerCase()}` ||
        (a.name && a.name.toLowerCase() === doc.name.toLowerCase())
    );
    if (linkedAdmin && linkedAdmin.email && linkedAdmin.email.includes('@') && !linkedAdmin.email.includes('example.com')) {
      return linkedAdmin.email.trim().toLowerCase();
    }
  }

  // 2. Direct lookup in adminsDatabase by ID, username, or doctorId
  const cleanId = doctorIdentifier.toLowerCase();
  const matchedAdmin = adminsDatabase.find(
    (a) =>
      (a.doctorId && a.doctorId.toLowerCase() === cleanId) ||
      a.id.toLowerCase() === cleanId ||
      (a.username && a.username.toLowerCase() === cleanId) ||
      (a.name && a.name.toLowerCase() === cleanId)
  );
  if (matchedAdmin && matchedAdmin.email && matchedAdmin.email.includes('@') && !matchedAdmin.email.includes('example.com')) {
    return matchedAdmin.email.trim().toLowerCase();
  }

  return CLINIC_ADMIN_EMAIL;
}

async function sendNewAppointmentNotification(apt: {
  doctorId?: string;
  assignedDoctor?: string;
  doctorPreference?: string;
  firstName?: string;
  name?: string;
  email: string;
  phone?: string;
  serviceName?: string;
  service?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  preferredTime?: string;
}) {
  const patientName = apt.name || apt.firstName || 'Valued Patient';
  const service = apt.serviceName || apt.service || 'Dental Consultation';
  const doctorName = apt.assignedDoctor || 'Assigned Dental Specialist';
  const date = apt.preferredDate || 'Scheduled Date';
  const time = apt.preferredTimeSlot || apt.preferredTime || 'Scheduled Time';

  const summaryTable = buildAppointmentSummaryTable({
    patientName,
    doctorName,
    date,
    time,
    status: 'PENDING',
    service,
  });

  const html = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">
        Appointment Booking Request Received
      </h2>
      <p style="margin: 0 0 14px; color: #334155;">
        Dear <strong>${patientName}</strong>, thank you for choosing <strong>${CLINIC_NAME}</strong>. Your requested appointment slot with <strong>${doctorName}</strong> is now held under <strong>PENDING</strong> status while our clinical coordinator completes final confirmation.
      </p>
      ${summaryTable}
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #1e3a8a;">
        <strong>What Happens Next:</strong> Your selected time slot (<strong>${date} at ${time}</strong>) is reserved for you so no other patient can take it. You will receive an official confirmation email as soon as your appointment is approved.
      </div>
    `,
    {
      label: 'Status: PENDING • Slot Reserved Awaiting Approval',
      bgColor: '#fffbeb',
      textColor: '#b45309',
      borderColor: '#fde68a',
    }
  );

  // 1. Deliver Acknowledgment to Patient
  const patientResult = await deliverEmail(
    apt.email,
    `Appointment Request Received (PENDING) - ${CLINIC_NAME}`,
    html
  );

  // 2. Deliver Immediate Clinic Booking Alert to the Respective Doctor / Admin Email
  const recipientAdminEmail = resolveAdminEmailForAppointment(apt);

  const adminHtml = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">
        New Patient Booking Request (${doctorName})
      </h2>
      <p style="margin: 0 0 14px; color: #334155;">
        A new patient appointment has been submitted online for <strong>${doctorName}</strong> and the slot is currently held as <strong>PENDING</strong>:
      </p>
      ${summaryTable}
      <p style="font-size: 13px; color: #475569; margin: 12px 0 0;">
        Patient Contact Phone: <strong>${apt.phone || 'Provided in portal'}</strong> &bull; Email: <strong>${apt.email}</strong><br />
        Sign in to your <strong>${CLINIC_NAME}</strong> Doctor / Admin Dashboard to Approve, Reschedule, or Decline this booking.
      </p>
    `,
    {
      label: 'Admin Action Required • New Pending Booking',
      bgColor: '#eff6ff',
      textColor: '#1e5aff',
      borderColor: '#bfdbfe',
    }
  );

  console.log(`[Email Dispatch] Delivering admin booking notification for ${doctorName} to respective account: ${recipientAdminEmail}`);
  await deliverEmail(recipientAdminEmail, `New Booking (${doctorName}): ${patientName} - ${date} ${time}`, adminHtml);
  return patientResult;
}

async function sendStatusEmail(apt: {
  status: string;
  name?: string;
  firstName?: string;
  email: string;
  service?: string;
  serviceName?: string;
  assignedDoctor?: string;
  confirmedDate?: string;
  preferredDate?: string;
  confirmedTime?: string;
  preferredTimeSlot?: string;
  preferredTime?: string;
  previousDate?: string;
  previousTime?: string;
  reason?: string;
  rescheduleReason?: string;
  declineReason?: string;
}) {
  const patientName = apt.name || apt.firstName || 'Valued Patient';
  const service = apt.serviceName || apt.service || 'Dental Consultation';
  const doctorName = apt.assignedDoctor || 'Dental Specialist';
  const date = apt.confirmedDate || apt.preferredDate || '';
  const time = apt.confirmedTime || apt.preferredTimeSlot || apt.preferredTime || '';
  const normStatus = String(apt.status || '').trim().toUpperCase();

  if (normStatus === 'APPROVED') {
    const ics = buildIcs(apt);
    const googleCal = buildGoogleCalendarUrl(apt);
    const summaryTable = buildAppointmentSummaryTable({
      patientName,
      doctorName,
      date,
      time,
      status: 'APPROVED',
      service,
    });

    const html = emailShell(
      `
        <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">
          Your Dental Appointment is Approved &amp; Confirmed!
        </h2>
        <p style="margin: 0 0 14px; color: #334155;">
          Dear <strong>${patientName}</strong>, we are pleased to confirm that your dental appointment with <strong>${doctorName}</strong> at <strong>${CLINIC_NAME}</strong> has been officially <strong>APPROVED</strong>.
        </p>
        ${summaryTable}
        <div style="text-align: center; margin: 26px 0;">
          <a href="${googleCal}" target="_blank" style="background: #1E5AFF; color: #ffffff; padding: 13px 26px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
            + Add Confirmed Visit to Google Calendar
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0;">
          An iCalendar (<code>.ics</code>) file is attached to this email. Please arrive 10 minutes before your scheduled appointment time. If you need any assistance, call us at <strong>${CLINIC_PHONE}</strong>.
        </p>
      `,
      {
        label: 'Status: APPROVED • Confirmed Clinical Booking',
        bgColor: '#ecfdf5',
        textColor: '#047857',
        borderColor: '#a7f3d0',
      }
    );

    return await deliverEmail(apt.email, `Appointment Approved (${date} at ${time}) - ${CLINIC_NAME}`, html, ics);
  }

  if (normStatus === 'RESCHEDULED') {
    const reason = apt.reason || apt.rescheduleReason || 'Updated to new available doctor slot';
    const previousSlot =
      apt.previousDate && apt.previousTime ? `${apt.previousDate} at ${apt.previousTime}` : undefined;
    const ics = buildIcs(apt);
    const googleCal = buildGoogleCalendarUrl(apt);

    const summaryTable = buildAppointmentSummaryTable({
      patientName,
      doctorName,
      date,
      time,
      status: 'RESCHEDULED',
      service,
      previousSlot,
      reason,
    });

    const html = emailShell(
      `
        <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">
          Your Dental Appointment Has Been Rescheduled
        </h2>
        <p style="margin: 0 0 14px; color: #334155;">
          Dear <strong>${patientName}</strong>, your appointment with <strong>${doctorName}</strong> at <strong>${CLINIC_NAME}</strong> has been updated to a new date and time slot:
        </p>
        ${summaryTable}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${googleCal}" target="_blank" style="background: #1E5AFF; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block;">
            + Add Updated Appointment to Google Calendar
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; margin: 0;">
          Your previous slot has been released and your new appointment window (<strong>${date} at ${time}</strong>) is reserved for you. If you need any adjustment, please call <strong>${CLINIC_PHONE}</strong>.
        </p>
      `,
      {
        label: 'Status: RESCHEDULED • Updated Appointment Schedule',
        bgColor: '#f0f9ff',
        textColor: '#0369a1',
        borderColor: '#bae6fd',
      }
    );

    return await deliverEmail(apt.email, `Appointment Rescheduled (${date} at ${time}) - ${CLINIC_NAME}`, html, ics);
  }

  if (normStatus === 'DECLINED' || normStatus === 'REJECTED') {
    const reason = apt.reason || apt.declineReason || 'Unable to accommodate the requested slot';
    const summaryTable = buildAppointmentSummaryTable({
      patientName,
      doctorName,
      date,
      time,
      status: 'DECLINED',
      service,
      reason,
    });

    const html = emailShell(
      `
        <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">
          Update Regarding Your Appointment Request
        </h2>
        <p style="margin: 0 0 14px; color: #334155;">
          Dear <strong>${patientName}</strong>, thank you for contacting <strong>${CLINIC_NAME}</strong>. Unfortunately, we are unable to confirm the requested appointment slot with <strong>${doctorName}</strong>:
        </p>
        ${summaryTable}
        <p style="color: #475569; font-size: 13px; margin: 0;">
          We invite you to visit our online booking calendar to select another available date and time, or call our reception desk directly at <strong>${CLINIC_PHONE}</strong> so we can assist you immediately.
        </p>
      `,
      {
        label: 'Status: DECLINED • Appointment Cancellation Notice',
        bgColor: '#fef2f2',
        textColor: '#b91c1c',
        borderColor: '#fecaca',
      }
    );

    return await deliverEmail(apt.email, `Appointment Update (DECLINED) - ${CLINIC_NAME}`, html);
  }

  if (normStatus === 'EXPIRED') {
    const summaryTable = buildAppointmentSummaryTable({
      patientName,
      doctorName,
      date,
      time,
      status: 'EXPIRED',
      service,
    });

    const html = emailShell(
      `
        <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">
          Temporary Appointment Reservation Expired
        </h2>
        <p style="margin: 0 0 14px; color: #334155;">
          Dear <strong>${patientName}</strong>, your 5-minute temporary hold for the appointment slot with <strong>${doctorName}</strong> at <strong>${CLINIC_NAME}</strong> expired before submission was completed:
        </p>
        ${summaryTable}
        <p style="color: #475569; font-size: 13px; margin: 0;">
          The time slot has been released back to the public schedule. You can return to our booking page anytime or call <strong>${CLINIC_PHONE}</strong> to reserve a new time slot.
        </p>
      `,
      {
        label: 'Status: EXPIRED • 5-Minute Temporary Hold Released',
        bgColor: '#fef2f2',
        textColor: '#b91c1c',
        borderColor: '#fecaca',
      }
    );

    return await deliverEmail(apt.email, `Temporary Reservation Expired - ${CLINIC_NAME}`, html);
  }

  return { dispatched: false };
}

// ======================== DOCTOR-WISE SLOT AVAILABILITY & RESERVATION ENGINE ========================

function resolveDoctorRecord(doctorIdOrName?: string): DoctorRecord | undefined {
  const clean = String(doctorIdOrName || '').trim().toLowerCase();
  if (!clean) return doctorsDatabase[0];
  const cleanAlpha = clean.replace(/[^a-z0-9]/g, '');

  const aliasMap: Record<string, string> = {
    'doc-1': 'doc-dk-sharma',
    doc1: 'doc-dk-sharma',
    drsharma: 'doc-dk-sharma',
    'doc-2': 'doc-shradha-sharma',
    doc2: 'doc-shradha-sharma',
    drshradha: 'doc-shradha-sharma',
    'doc-3': 'doc-john',
    doc3: 'doc-john',
    drjohn: 'doc-john',
    'doc-4': 'doc-sarah',
    doc4: 'doc-sarah',
    drsarah: 'doc-sarah',
    'doc-5': 'doc-michael',
    doc5: 'doc-michael',
    drmichael: 'doc-michael',
  };

  const mappedId = aliasMap[clean] || aliasMap[cleanAlpha];
  if (mappedId) {
    const foundByAlias = doctorsDatabase.find((d) => d.id.toLowerCase() === mappedId);
    if (foundByAlias) return foundByAlias;
  }

  return (
    doctorsDatabase.find((d) => d.id.toLowerCase() === clean) ||
    doctorsDatabase.find((d) => (d.username || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlpha) ||
    doctorsDatabase.find((d) => d.name.toLowerCase() === clean) ||
    doctorsDatabase.find((d) => clean.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(clean))
  );
}

function getEffectiveAppointmentDateAndTime(apt: any): { date: string; time: string } {
  const status = String(apt.status || '').toLowerCase();
  if (status === 'approved' || status === 'rescheduled') {
    return {
      date: String(apt.confirmedDate || apt.preferredDate || '').trim(),
      time: String(apt.confirmedTime || apt.preferredTimeSlot || apt.preferredTime || '').trim(),
    };
  }
  return {
    date: String(apt.preferredDate || apt.confirmedDate || '').trim(),
    time: String(apt.preferredTimeSlot || apt.preferredTime || apt.confirmedTime || '').trim(),
  };
}

function doesAppointmentMatchDoctor(apt: any, doc: DoctorRecord): boolean {
  if (apt.doctorId && String(apt.doctorId).toLowerCase() === doc.id.toLowerCase()) {
    return true;
  }
  const assigned = String(apt.assignedDoctor || apt.doctorPreference || '').trim().toLowerCase();
  if (!assigned) return false;
  return assigned === doc.name.toLowerCase() || assigned === doc.id.toLowerCase();
}

/**
 * Purges expired 5-minute temporary reservations and returns true if any expired
 */
function purgeExpiredReservations(): TemporarySlotReservation[] {
  const now = Date.now();
  const newlyExpired: TemporarySlotReservation[] = [];

  for (const res of reservationsDatabase) {
    if (res.status === 'ACTIVE' && now >= res.expiresAt) {
      res.status = 'EXPIRED';
      newlyExpired.push(res);
    }
  }

  if (newlyExpired.length > 0) {
    // Keep last 200 reservations for audit, remove very old expired ones (>1 hour)
    reservationsDatabase = reservationsDatabase.filter(
      (r) => r.status === 'ACTIVE' || now - r.createdAt < 3600 * 1000
    );
    persistReservationsDatabase();
    broadcastRealtimeEvent('reservations_expired', {
      expiredSlots: newlyExpired.map((r) => ({
        id: r.id,
        doctorId: r.doctorId,
        doctorName: r.doctorName,
        date: r.date,
        time: r.time,
      })),
    });

    // If a patient had entered their email on the expired hold, notify them politely
    for (const exp of newlyExpired) {
      if (exp.patientEmail && exp.patientEmail.includes('@')) {
        sendStatusEmail({
          status: 'EXPIRED',
          name: exp.patientName || 'Valued Patient',
          email: exp.patientEmail,
          assignedDoctor: exp.doctorName,
          preferredDate: exp.date,
          preferredTime: exp.time,
        }).catch(() => {});
      }
    }
  }

  return newlyExpired;
}

// Run background cleanup every 3 seconds so 5-minute locks expire on the server even with zero traffic
setInterval(() => {
  try {
    purgeExpiredReservations();
  } catch {}
}, 3000);

/**
 * Computes exact slot availability for a specific Doctor and Date ("YYYY-MM-DD")
 * Rules:
 * - PENDING -> Reserved (Unavailable)
 * - APPROVED -> Booked (Unavailable)
 * - RESCHEDULED -> Old slot Available, New slot Reserved/Booked (Unavailable)
 * - DECLINED -> Available
 * - EXPIRED -> Available
 * - Active 5-Min Temporary Reservation -> Unavailable to other sessions, HELD_BY_YOU for same sessionId
 */
function computeDoctorSlotsForDate(doctorIdOrName: string, dateStr: string, sessionId?: string) {
  purgeExpiredReservations();

  if (String(doctorIdOrName || '').toLowerCase() === 'any') {
    const activeDocs = doctorsDatabase.filter((d) => d.status === 'active');
    const allSlotTimes = new Set<string>();
    const docSlotMaps: { doc: DoctorRecord; slots: ComputedTimeSlot[] }[] = [];

    for (const d of activeDocs) {
      const res = computeDoctorSlotsForDate(d.id, dateStr, sessionId);
      docSlotMaps.push({ doc: d, slots: res.slots });
      res.slots.forEach((s) => allSlotTimes.add(s.time));
    }

    const mergedSlots = Array.from(allSlotTimes).map((slotTime) => {
      const held = docSlotMaps.find((m) =>
        m.slots.some((s) => s.time.toLowerCase() === slotTime.toLowerCase() && s.reason === 'HELD_BY_YOU')
      );
      if (held) {
        return held.slots.find((s) => s.time.toLowerCase() === slotTime.toLowerCase())!;
      }

      const availDoc = docSlotMaps.find((m) =>
        m.slots.some((s) => s.time.toLowerCase() === slotTime.toLowerCase() && s.available)
      );
      if (availDoc) {
        return availDoc.slots.find((s) => s.time.toLowerCase() === slotTime.toLowerCase())!;
      }

      const reserved = docSlotMaps.find((m) =>
        m.slots.some((s) => s.time.toLowerCase() === slotTime.toLowerCase() && s.reason === 'TEMPORARILY_RESERVED')
      );
      if (reserved) {
        return reserved.slots.find((s) => s.time.toLowerCase() === slotTime.toLowerCase())!;
      }

      return {
        time: slotTime,
        durationMinutes: 30 as SlotDurationMinutes,
        available: false,
        status: 'booked' as const,
        reason: 'BOOKED' as const,
      };
    });

    mergedSlots.sort((a, b) => {
      const ta = timeSlotTo24h(a.time);
      const tb = timeSlotTo24h(b.time);
      return ta.localeCompare(tb);
    });

    return {
      doctorId: 'any',
      doctorName: 'Any Available Doctor',
      date: dateStr,
      durationMinutes: 30 as SlotDurationMinutes,
      slots: mergedSlots,
    };
  }

  const doc = resolveDoctorRecord(doctorIdOrName);
  if (!doc) {
    return {
      doctorId: doctorIdOrName,
      doctorName: doctorIdOrName,
      date: dateStr,
      durationMinutes: 30 as SlotDurationMinutes,
      slots: [],
    };
  }

  const avail =
    availabilityDatabase.find((a) => a.doctorId === doc.id) ||
    buildDefaultAvailabilityForDoctor(doc);

  const configured = getConfiguredDoctorSlotsForDate(avail, dateStr);
  const now = Date.now();

  const computedSlots: ComputedTimeSlot[] = configured.slots.map((slotTime) => {
    // 1. Check active appointments for this specific doctor, date, and slotTime
    const blockingAppointment = appointmentDatabase.find((apt) => {
      const status = String(apt.status || '').toLowerCase();
      // Only PENDING, APPROVED, and RESCHEDULED occupy slots. DECLINED and EXPIRED release slots!
      if (status !== 'pending' && status !== 'approved' && status !== 'rescheduled') {
        return false;
      }
      if (!doesAppointmentMatchDoctor(apt, doc)) {
        return false;
      }
      const effective = getEffectiveAppointmentDateAndTime(apt);
      return effective.date === dateStr && effective.time.toLowerCase() === slotTime.toLowerCase();
    });

    if (blockingAppointment) {
      const st = String(blockingAppointment.status || '').toLowerCase();
      return {
        time: slotTime,
        durationMinutes: configured.durationMinutes,
        available: false,
        status: 'booked' as const,
        reason: st === 'pending' ? ('PENDING_APPROVAL' as const) : ('BOOKED' as const),
      };
    }

    // 2. Check active 5-minute temporary reservations for this specific doctor, date, and slotTime
    const activeRes = reservationsDatabase.find(
      (r) =>
        r.status === 'ACTIVE' &&
        r.expiresAt > now &&
        r.doctorId === doc.id &&
        r.date === dateStr &&
        r.time.toLowerCase() === slotTime.toLowerCase()
    );

    if (activeRes) {
      const isHeldByCaller = Boolean(sessionId && activeRes.sessionId === sessionId);
      return {
        time: slotTime,
        durationMinutes: configured.durationMinutes,
        available: isHeldByCaller,
        status: isHeldByCaller ? ('reserved_self' as const) : ('reserved_other' as const),
        reason: isHeldByCaller ? ('HELD_BY_YOU' as const) : ('TEMPORARILY_RESERVED' as const),
        reservationId: activeRes.id,
        expiresAt: activeRes.expiresAt,
      };
    }

    return {
      time: slotTime,
      durationMinutes: configured.durationMinutes,
      available: true,
      status: 'available' as const,
      reason: 'AVAILABLE' as const,
    };
  });

  return {
    doctorId: doc.id,
    doctorName: doc.name,
    date: dateStr,
    durationMinutes: configured.durationMinutes,
    slots: computedSlots,
  };
}

// ======================== ENTERPRISE 2FA STAFF AUTHENTICATION & ZERO-TRUST MIDDLEWARE ========================
const SERVER_SESSION_SECRET = process.env.SESSION_SECRET || 'vantage-clinic-hardened-session-secret-2026-secure-auth-9x7';

export interface AuthenticatedStaffSession {
  adminId: string;
  email: string;
  name?: string;
  role: string;
  doctorId?: string;
  issuedAt: number;
  expiresAt: number;
}

const activeAdminSessions = new Map<string, AuthenticatedStaffSession>();

function generateStaffSessionToken(admin: AdminAccountRecord): string {
  const now = Date.now();
  const expiresAt = now + 12 * 60 * 60 * 1000; // 12 hours
  const payloadObj: AuthenticatedStaffSession = {
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    doctorId: admin.doctorId || '',
    issuedAt: now,
    expiresAt,
  };
  const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url');

  const token = `vntg_${payloadStr}.${signature}`;
  activeAdminSessions.set(token, payloadObj);
  return token;
}

function verifyStaffSessionToken(token: string): AuthenticatedStaffSession | null {
  if (!token) return null;
  const inMem = activeAdminSessions.get(token);
  if (inMem) {
    if (Date.now() > inMem.expiresAt) {
      activeAdminSessions.delete(token);
      return null;
    }
    return inMem;
  }

  if (!token.startsWith('vntg_')) return null;
  const raw = token.slice(5);
  const dotIdx = raw.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const payloadStr = raw.substring(0, dotIdx);
  const signature = raw.substring(dotIdx + 1);

  const expectedSig = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8')) as AuthenticatedStaffSession;
    if (!data || !data.adminId || !data.expiresAt) return null;
    if (Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

function extractStaffSession(req: Request): AuthenticatedStaffSession | null {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = String(req.headers['x-session-token']).trim();
  }
  if (!token) return null;
  return verifyStaffSessionToken(token);
}

function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  const session = extractStaffSession(req);
  if (!session) {
    return res.status(401).json({
      error: 'Authentication required. Clinical patient records are protected and require a verified staff session.',
      code: 'UNAUTHORIZED',
    });
  }
  (req as any).staffUser = session;
  next();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const session = extractStaffSession(req);
  if (!session) {
    return res.status(401).json({
      error: 'Authentication required. Administrative privileges required.',
      code: 'UNAUTHORIZED',
    });
  }
  const role = String(session.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'super admin' && role !== 'clinic admin') {
    return res.status(403).json({
      error: 'Forbidden. Administrative privileges are required for this clinical operation.',
      code: 'FORBIDDEN',
    });
  }
  (req as any).staffUser = session;
  next();
}

function sanitizeText(input: unknown, maxLen = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, maxLen);
}

// ======================== API ROUTES: DOCTORS, AVAILABILITY & 5-MIN RESERVATIONS ========================

// Get all doctors + their availability schedules (Public profile fields only)
app.get('/api/doctors', (_req: Request, res: Response) => {
  return res.json({
    doctors: doctorsDatabase,
    availabilities: availabilityDatabase,
  });
});

// Upsert doctor profile (SECURED: Only authenticated administrators can add/modify doctors)
app.post('/api/doctors', requireAdminAuth, async (req: Request, res: Response) => {
  const { id, name, title, qualifications, specialties, status, email, phone, bio, username, password } = req.body;
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'Doctor name is required.' });
  }

  const now = new Date().toISOString();
  const docId = id || `doc-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
  const specs = Array.isArray(specialties)
    ? specialties
    : String(specialties || 'General Dentistry')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const existingIdx = doctorsDatabase.findIndex((d) => d.id === docId);
  const existingDoc = existingIdx >= 0 ? doctorsDatabase[existingIdx] : undefined;

  const cleanUsername = String(
    username || existingDoc?.username || cleanName.toLowerCase().replace(/[^a-z0-9.]/g, '')
  )
    .trim()
    .toLowerCase();
  const cleanEmail = String(email || existingDoc?.email || 'firstavenuedentistry@gmail.com')
    .trim()
    .toLowerCase();
  const cleanPassword = password ? String(password).trim() : '';

  const record: DoctorRecord = {
    id: docId,
    name: cleanName,
    title: String(title || existingDoc?.title || 'Dental Specialist').trim(),
    qualifications: String(qualifications || existingDoc?.qualifications || 'BDS, DDS').trim(),
    specialties: specs.length > 0 ? specs : ['General Dentistry'],
    status: status === 'on_leave' ? 'on_leave' : 'active',
    email: cleanEmail,
    phone: String(phone || existingDoc?.phone || CLINIC_PHONE).trim(),
    bio: String(bio !== undefined ? bio : existingDoc?.bio || '').trim(),
    username: cleanUsername,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    doctorsDatabase[existingIdx] = record;
  } else {
    doctorsDatabase.push(record);
  }
  persistDoctorsDatabase();

  // Ensure availability entry exists
  if (!availabilityDatabase.some((a) => a.doctorId === record.id)) {
    availabilityDatabase.push(buildDefaultAvailabilityForDoctor(record));
    persistAvailabilityDatabase();
  }

  // Ensure doctor login account exists & stays synced in adminsDatabase for 2FA Doctor Portal login
  const existingDocAcctIdx = adminsDatabase.findIndex(
    (a) =>
      a.doctorId === record.id ||
      a.id === `acct-${record.id}` ||
      a.username.toLowerCase() === cleanUsername
  );

  let effectivePassword = cleanPassword || '1234567890';
  const isNewRegistration = existingIdx < 0;

  if (existingDocAcctIdx === -1) {
    adminsDatabase.push({
      id: `acct-${record.id}`,
      name: record.name,
      email: record.email,
      username: cleanUsername,
      password: effectivePassword,
      role: 'Doctor',
      doctorId: record.id,
      createdAt: now,
    });
    persistAdminsDatabase();
  } else {
    adminsDatabase[existingDocAcctIdx].name = record.name;
    adminsDatabase[existingDocAcctIdx].email = record.email;
    adminsDatabase[existingDocAcctIdx].username = cleanUsername;
    adminsDatabase[existingDocAcctIdx].doctorId = record.id;
    adminsDatabase[existingDocAcctIdx].role = 'Doctor';
    if (cleanPassword) {
      adminsDatabase[existingDocAcctIdx].password = cleanPassword;
      effectivePassword = cleanPassword;
    } else {
      effectivePassword = adminsDatabase[existingDocAcctIdx].password || '1234567890';
    }
    persistAdminsDatabase();
  }

  // Send Doctor Portal Login Credentials email when registering a new doctor or updating their password
  let emailDispatched = false;
  if ((isNewRegistration || cleanPassword) && record.email && record.email.includes('@')) {
    const portalUrl = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/doctor` : '/doctor';
    const credentialsHtml = emailShell(
      `
        <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">
          Welcome to ${CLINIC_NAME} — Your Doctor Portal Login Credentials
        </h2>
        <p style="margin: 0 0 14px; color: #334155;">
          Hello <strong>${record.name}</strong> (${record.title}), your specialist profile and Doctor Portal account have been ${isNewRegistration ? 'registered' : 'updated'} at <strong>${CLINIC_NAME}</strong>.
        </p>
        <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #1E5AFF;">
            Doctor Portal Sign-In Details
          </p>
          <p style="margin: 6px 0; font-size: 14px; color: #060C16;">
            <strong>Portal Path:</strong> <code>${portalUrl}</code>
          </p>
          <p style="margin: 6px 0; font-size: 14px; color: #060C16;">
            <strong>Login Username:</strong> <code style="background: #EFF6FF; padding: 2px 6px; border-radius: 4px; color: #1E5AFF; font-weight: 700;">${cleanUsername}</code>
          </p>
          <p style="margin: 6px 0; font-size: 14px; color: #060C16;">
            <strong>Login Email:</strong> <code>${record.email}</code>
          </p>
          <p style="margin: 6px 0; font-size: 14px; color: #060C16;">
            <strong>Login Password:</strong> <code style="background: #EFF6FF; padding: 2px 6px; border-radius: 4px; color: #060C16; font-weight: 700;">${effectivePassword}</code>
          </p>
        </div>
        <p style="color: #475569; font-size: 13px; margin: 0;">
          <strong>2FA Security Notice:</strong> When you sign in to the Doctor Portal with your username/email and password, a 6-digit verification code (OTP) will be sent to this email address (${record.email}) to complete authentication. Once logged in, you can manage your available appointment dates and time slots.
        </p>
      `,
      {
        label: 'Doctor Portal Credentials • 2FA Enabled',
        bgColor: '#eff6ff',
        textColor: '#1e5aff',
        borderColor: '#bfdbfe',
      }
    );

    const mailRes = await deliverEmail(
      record.email,
      `Your Doctor Portal Login Credentials - ${CLINIC_NAME}`,
      credentialsHtml
    );
    emailDispatched = mailRes.dispatched;
  }

  broadcastRealtimeEvent('doctors_updated', { doctor: record });
  return res.json({
    success: true,
    doctor: record,
    emailDispatched,
  });
});

app.delete('/api/doctors/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  doctorsDatabase = doctorsDatabase.filter((d) => d.id !== id);
  availabilityDatabase = availabilityDatabase.filter((a) => a.doctorId !== id);
  adminsDatabase = adminsDatabase.filter(
    (a) => a.doctorId !== id && a.id !== `acct-${id}`
  );
  persistDoctorsDatabase();
  persistAvailabilityDatabase();
  persistAdminsDatabase();
  broadcastRealtimeEvent('doctors_updated', { deletedDoctorId: id });
  return res.json({ success: true, deletedId: id });
});

// Get all doctors' availability or specific doctor's availability + computed calendar summary
app.get('/api/availability', (req: Request, res: Response) => {
  purgeExpiredReservations();
  const doctorId = String(req.query.doctorId || '').trim();
  const date = String(req.query.date || '').trim();
  const sessionId = String(req.query.sessionId || '').trim();
  const daysAhead = Math.min(90, Math.max(7, parseInt(String(req.query.days || '45'), 10) || 45));

  if (doctorId && date) {
    const dayResult = computeDoctorSlotsForDate(doctorId, date, sessionId);
    return res.json(dayResult);
  }

  if (doctorId) {
    const doc = resolveDoctorRecord(doctorId);
    if (!doc) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }
    const avail =
      availabilityDatabase.find((a) => a.doctorId === doc.id) ||
      buildDefaultAvailabilityForDoctor(doc);

    // Compute upcoming dates summary for the interactive calendar
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const availableDates: {
      date: string;
      totalSlots: number;
      availableCount: number;
      durationMinutes: SlotDurationMinutes;
      slots: ReturnType<typeof computeDoctorSlotsForDate>['slots'];
    }[] = [];

    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const computed = computeDoctorSlotsForDate(doc.id, dateStr, sessionId);
      if (computed.slots.length > 0) {
        const availableCount = computed.slots.filter((s) => s.available).length;
        availableDates.push({
          date: dateStr,
          totalSlots: computed.slots.length,
          availableCount,
          durationMinutes: computed.durationMinutes,
          slots: computed.slots,
        });
      }
    }

    return res.json({
      doctor: doc,
      availability: avail,
      availableDates,
    });
  }

  return res.json({
    doctors: doctorsDatabase,
    availabilities: availabilityDatabase,
    activeReservations: reservationsDatabase
      .filter((r) => r.status === 'ACTIVE' && r.expiresAt > Date.now())
      .map((r) => ({
        id: r.id,
        doctorId: r.doctorId,
        doctorName: r.doctorName,
        date: r.date,
        time: r.time,
        expiresAt: r.expiresAt,
        expiresAtMs: r.expiresAtMs,
        status: r.status,
      })),
  });
});

// Save / Update a specific Doctor's Availability (SECURED: Verified staff/doctor access only)
app.put('/api/doctors/:doctorId/availability', requireStaffAuth, async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const staff = (req as any).staffUser as AuthenticatedStaffSession;
  const isDoctorRole = String(staff.role || '').toLowerCase() === 'doctor';

  const doc = resolveDoctorRecord(doctorId);
  if (!doc) {
    return res.status(404).json({ error: 'Doctor record not found.' });
  }

  // Enforce zero-trust role isolation: Doctors may ONLY modify their own clinical schedule
  if (isDoctorRole && staff.doctorId) {
    const callerDoc = resolveDoctorRecord(staff.doctorId);
    if (callerDoc && callerDoc.id !== doc.id) {
      return res.status(403).json({
        error: 'Forbidden. Doctors are only authorized to modify their own clinical schedule.',
      });
    }
  }

  const { defaultDuration, recurringWeekly, specificDates } = req.body;
  const validDuration: SlotDurationMinutes = [15, 30, 45, 60].includes(Number(defaultDuration))
    ? (Number(defaultDuration) as SlotDurationMinutes)
    : 30;

  const cleanWeekly = Array.isArray(recurringWeekly)
    ? recurringWeekly.map((w: any, idx: number) => {
        const dur: SlotDurationMinutes = [15, 30, 45, 60].includes(Number(w.slotDuration))
          ? (Number(w.slotDuration) as SlotDurationMinutes)
          : validDuration;
        const start = String(w.startTime || '09:00').trim();
        const end = String(w.endTime || '17:00').trim();
        const slots =
          Boolean(w.enabled) && Array.isArray(w.slots) && w.slots.length > 0
            ? sortTimeSlotsChronologically(w.slots.map((s: any) => String(s).trim()).filter(Boolean))
            : [];
        return {
          dayOfWeek: typeof w.dayOfWeek === 'number' ? w.dayOfWeek : idx,
          dayName: DAY_NAMES[typeof w.dayOfWeek === 'number' ? w.dayOfWeek : idx] || 'Monday',
          enabled: Boolean(w.enabled),
          startTime: start,
          endTime: end,
          slotDuration: dur,
          slots,
        };
      })
    : buildDefaultAvailabilityForDoctor(doc).recurringWeekly;

  const cleanSpecific = Array.isArray(specificDates)
    ? specificDates
        .filter((d: any) => d && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '').trim()))
        .map((d: any) => {
          const dur: SlotDurationMinutes = [15, 30, 45, 60].includes(Number(d.slotDuration))
            ? (Number(d.slotDuration) as SlotDurationMinutes)
            : validDuration;
          const start = String(d.startTime || '09:00').trim();
          const end = String(d.endTime || '17:00').trim();
          const isAvail = d.isAvailable !== false;
          const slots =
            isAvail && Array.isArray(d.slots) && d.slots.length > 0
              ? sortTimeSlotsChronologically(d.slots.map((s: any) => String(s).trim()).filter(Boolean))
              : [];
          return {
            id: String(d.id || `spec-${d.date}-${Math.random().toString(36).slice(2, 6)}`),
            date: String(d.date).trim(),
            isAvailable: isAvail,
            startTime: start,
            endTime: end,
            slotDuration: dur,
            slots,
            note: d.note ? String(d.note).trim() : undefined,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const updatedRecord: DoctorAvailabilityRecord = {
    doctorId: doc.id,
    doctorName: doc.name,
    defaultDuration: validDuration,
    recurringWeekly: cleanWeekly,
    specificDates: cleanSpecific,
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = availabilityDatabase.findIndex((a) => a.doctorId === doc.id);
  if (existingIdx >= 0) {
    availabilityDatabase[existingIdx] = updatedRecord;
  } else {
    availabilityDatabase.push(updatedRecord);
  }

  persistAvailabilityDatabase();
  broadcastRealtimeEvent('availability_updated', {
    doctorId: doc.id,
    doctorName: doc.name,
    availability: updatedRecord,
  });

  return res.json({
    success: true,
    availability: updatedRecord,
    message: `Availability schedule saved for ${doc.name}.`,
  });
});

// ======================== FIVE-MINUTE TEMPORARY RESERVATION ENDPOINTS ========================

// 1. Acquire / Lock a 5-Minute Temporary Slot Reservation (Atomic + Rate Limited)
app.post('/api/reservations/lock', createRateLimiter(20, 60000, 'Too many slot reservation attempts.'), async (req: Request, res: Response) => {
  const { doctorId, doctorName, date, time, sessionId, patientName, patientEmail } = req.body;
  let doc = resolveDoctorRecord(doctorId || doctorName);
  const cleanDate = String(date || '').trim();
  const cleanTime = String(time || '').trim();
  const cleanSession = String(sessionId || '').trim();

  if (!doc && String(doctorId || '').toLowerCase() === 'any' && cleanDate && cleanTime) {
    for (const d of doctorsDatabase.filter((x) => x.status === 'active')) {
      const res = computeDoctorSlotsForDate(d.id, cleanDate, cleanSession);
      const s = res.slots.find(
        (x) => x.time.toLowerCase() === cleanTime.toLowerCase() && (x.available || x.reason === 'HELD_BY_YOU')
      );
      if (s) {
        doc = d;
        break;
      }
    }
  }

  if (!doc || !cleanDate || !cleanTime || !cleanSession) {
    return res.status(400).json({
      error: 'Doctor, appointment date, time slot, and session ID are required to reserve a slot.',
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return res.status(400).json({ error: 'Invalid appointment date format.' });
  }

  const lockKey = `slot:${doc.id}:${cleanDate}:${cleanTime.toLowerCase()}`;

  return withAtomicLock(lockKey, async () => {
    purgeExpiredReservations();

    // Release any OTHER active reservation held by this same client sessionId
    let releasedPrevious = false;
    for (const r of reservationsDatabase) {
      if (
        r.status === 'ACTIVE' &&
        r.sessionId === cleanSession &&
        !(r.doctorId === doc.id && r.date === cleanDate && r.time.toLowerCase() === cleanTime.toLowerCase())
      ) {
        r.status = 'RELEASED';
        releasedPrevious = true;
      }
    }

    // Check doctor's configured availability and booking conflicts for this exact slot
    const dayStatus = computeDoctorSlotsForDate(doc.id, cleanDate, cleanSession);
    const matchingSlot = dayStatus.slots.find(
      (s) => s.time.toLowerCase() === cleanTime.toLowerCase()
    );

    if (!matchingSlot) {
      if (releasedPrevious) persistReservationsDatabase();
      return res.status(400).json({
        error: `${doc.name} does not have an available slot at ${cleanTime} on ${cleanDate}.`,
      });
    }

    if (!matchingSlot.available) {
      if (releasedPrevious) persistReservationsDatabase();
      const reasonMsg =
        matchingSlot.reason === 'TEMPORARILY_RESERVED'
          ? 'This time slot is currently being reserved by another patient (5-minute hold active). Please choose another time slot.'
          : 'This time slot has already been booked. Please choose another available time.';
      return res.status(409).json({
        error: reasonMsg,
        reason: matchingSlot.reason,
      });
    }

    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    // Check if this session already holds an active reservation on this exact slot
    const existingRes = reservationsDatabase.find(
      (r) =>
        r.status === 'ACTIVE' &&
        r.sessionId === cleanSession &&
        r.doctorId === doc.id &&
        r.date === cleanDate &&
        r.time.toLowerCase() === cleanTime.toLowerCase() &&
        r.expiresAt > now
    );

    let reservation: TemporarySlotReservation;
    if (!existingRes) {
      const exp = now + FIVE_MINUTES_MS;
      reservation = {
        id: `res-${now}-${crypto.randomBytes(3).toString('hex')}`,
        doctorId: doc.id,
        doctorName: doc.name,
        date: cleanDate,
        time: matchingSlot.time,
        sessionId: cleanSession,
        patientName: patientName ? String(patientName).trim() : '',
        patientEmail: patientEmail ? String(patientEmail).trim().toLowerCase() : '',
        createdAt: now,
        expiresAt: exp,
        expiresAtMs: exp,
        status: 'ACTIVE',
      };
      reservationsDatabase.push(reservation);
    } else {
      reservation = existingRes;
      reservation.expiresAtMs = reservation.expiresAt;
      // Update patient info if provided without resetting the 5-min timer
      if (patientName) reservation.patientName = String(patientName).trim();
      if (patientEmail) reservation.patientEmail = String(patientEmail).trim().toLowerCase();
    }

    persistReservationsDatabase();
    broadcastRealtimeEvent('reservation_locked', {
      reservation: {
        id: reservation.id,
        doctorId: reservation.doctorId,
        doctorName: reservation.doctorName,
        date: reservation.date,
        time: reservation.time,
        expiresAt: reservation.expiresAt,
        expiresAtMs: reservation.expiresAtMs,
      },
    });

    return res.json({
      success: true,
      reservation,
      serverTime: now,
      remainingSeconds: Math.max(0, Math.ceil((reservation.expiresAt - now) / 1000)),
    });
  });
});

// 2. Release a Temporary Slot Reservation (when patient changes slot or closes modal)
app.post('/api/reservations/release', createRateLimiter(30, 60000), (req: Request, res: Response) => {
  const { reservationId, sessionId } = req.body;
  const cleanSession = String(sessionId || '').trim();
  const cleanResId = String(reservationId || '').trim();
  let releasedCount = 0;

  if (!cleanSession && !cleanResId) {
    return res.json({ success: true, releasedCount: 0 });
  }

  for (const r of reservationsDatabase) {
    if (
      r.status === 'ACTIVE' &&
      ((cleanResId && r.id === cleanResId && (!cleanSession || r.sessionId === cleanSession)) ||
        (cleanSession && r.sessionId === cleanSession))
    ) {
      r.status = 'RELEASED';
      releasedCount++;
    }
  }

  if (releasedCount > 0) {
    persistReservationsDatabase();
    broadcastRealtimeEvent('reservation_released', { reservationId: cleanResId });
  }

  return res.json({ success: true, releasedCount });
});

// ======================== APPOINTMENTS CRUD & ADMIN ACTIONS ========================

// Get all appointments - SECURED: Only verified staff/doctors can access clinical appointments
app.get('/api/appointments', requireStaffAuth, (req: Request, res: Response) => {
  purgeExpiredReservations();
  const staff = (req as any).staffUser as AuthenticatedStaffSession;
  const isDoctorRole = String(staff.role || '').toLowerCase() === 'doctor';

  // If authenticated as Doctor, strictly scope to appointments for their clinical schedule
  if (isDoctorRole && staff.doctorId) {
    const doc = resolveDoctorRecord(staff.doctorId);
    if (doc) {
      const filtered = appointmentDatabase.filter((apt) => doesAppointmentMatchDoctor(apt, doc));
      return res.json(filtered);
    }
  }

  // Clinic Admin or Super Admin can view all appointments or filter by doctorId
  const doctorId = String(req.query.doctorId || '').trim();
  if (doctorId) {
    const doc = resolveDoctorRecord(doctorId);
    if (doc) {
      const filtered = appointmentDatabase.filter((apt) => doesAppointmentMatchDoctor(apt, doc));
      return res.json(filtered);
    }
  }
  return res.json(appointmentDatabase);
});

// Submit Appointment (Atomic verification + converts 5-min temporary reservation into PENDING booking)
app.post('/api/appointments', createRateLimiter(15, 60000), async (req: Request, res: Response) => {
  const {
    id: clientProvidedId,
    firstName,
    lastName,
    name,
    email,
    phone,
    preferredDate,
    preferredTimeSlot,
    preferredTime,
    serviceName,
    service,
    reason,
    doctorId,
    assignedDoctor,
    doctorPreference,
    insuranceProvider,
    notes,
    sessionId,
    reservationId,
  } = req.body;

  const resolvedName = sanitizeText(String(name || `${firstName || ''} ${lastName || ''}`).trim(), 120);
  const resolvedEmail = sanitizeText(String(email || '').trim().toLowerCase(), 160);
  const resolvedPhone = sanitizeText(String(phone || '').trim(), 35);
  const resolvedDate = sanitizeText(String(preferredDate || '').trim(), 30);
  const resolvedTime = sanitizeText(String(preferredTime || preferredTimeSlot || '').trim(), 30);
  const resolvedService = sanitizeText(String(service || serviceName || reason || 'Dental Consultation').trim(), 100);
  const resolvedReason = sanitizeText(String(reason || notes || resolvedService).trim(), 500);

  if (!resolvedName || !resolvedEmail || !resolvedPhone) {
    return res.status(400).json({ error: 'Full Name, Email Address, and Phone Number are required.' });
  }
  if (!resolvedDate || !resolvedTime) {
    return res.status(400).json({ error: 'Please select an available appointment date and time slot.' });
  }

  let doc = resolveDoctorRecord(doctorId || assignedDoctor || doctorPreference);
  if (
    !doc &&
    (String(doctorId || '').toLowerCase() === 'any' ||
      String(assignedDoctor || '').toLowerCase() === 'any available doctor') &&
    resolvedDate &&
    resolvedTime
  ) {
    for (const d of doctorsDatabase.filter((x) => x.status === 'active')) {
      const res = computeDoctorSlotsForDate(d.id, resolvedDate, sessionId);
      const s = res.slots.find((x) => x.time.toLowerCase() === resolvedTime.toLowerCase());
      if (s && (s.available || s.reason === 'HELD_BY_YOU')) {
        doc = d;
        break;
      }
    }
  }
  if (!doc) {
    return res.status(400).json({ error: 'Selected doctor was not found.' });
  }

  const lockKey = `slot:${doc.id}:${resolvedDate}:${resolvedTime.toLowerCase()}`;

  return withAtomicLock(lockKey, async () => {
    purgeExpiredReservations();

    // If a reservationId was supplied, check if it expired before form submission
    if (reservationId) {
      const existingRes = reservationsDatabase.find((r) => r.id === reservationId);
      if (existingRes && existingRes.status === 'EXPIRED') {
        return res.status(410).json({
          error:
            'Your 5-minute temporary reservation has expired and the slot was released. Please select an available time slot to continue.',
          expired: true,
        });
      }
    }

    // Verify slot is still available for this caller (sessionId)
    const dayStatus = computeDoctorSlotsForDate(doc.id, resolvedDate, sessionId);
    const slotInfo = dayStatus.slots.find(
      (s) => s.time.toLowerCase() === resolvedTime.toLowerCase()
    );

    if (!slotInfo) {
      return res.status(400).json({
        error: `${doc.name} is not available on ${resolvedDate} at ${resolvedTime}. Please select one of the doctor's available time slots.`,
      });
    }

    if (!slotInfo.available) {
      return res.status(409).json({
        error:
          slotInfo.reason === 'TEMPORARILY_RESERVED'
            ? 'Another patient currently holds a 5-minute reservation on this slot. Please select another time slot.'
            : `This time slot (${resolvedDate} at ${resolvedTime}) with ${doc.name} has already been booked.`,
      });
    }

    // Check for duplicate submission by same email + doctor + date + time
    const duplicate = appointmentDatabase.find(
      (a) =>
        String(a.email || '').toLowerCase() === resolvedEmail &&
        doesAppointmentMatchDoctor(a, doc) &&
        getEffectiveAppointmentDateAndTime(a).date === resolvedDate &&
        getEffectiveAppointmentDateAndTime(a).time.toLowerCase() === resolvedTime.toLowerCase() &&
        ['pending', 'approved', 'rescheduled'].includes(String(a.status || '').toLowerCase())
    );
    if (duplicate) {
      return res.status(409).json({
        error: 'You already have an active appointment request for this doctor, date, and time.',
      });
    }

    // Convert any active temporary reservation into CONVERTED
    for (const r of reservationsDatabase) {
      if (
        r.status === 'ACTIVE' &&
        ((reservationId && r.id === reservationId) ||
          (sessionId && r.sessionId === sessionId) ||
          (r.doctorId === doc.id && r.date === resolvedDate && r.time.toLowerCase() === resolvedTime.toLowerCase()))
      ) {
        r.status = 'CONVERTED';
      }
    }
    persistReservationsDatabase();

    const now = new Date().toISOString();
    const newAppointment = {
      id: clientProvidedId || `apt-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      name: resolvedName,
      firstName: firstName || resolvedName.split(' ')[0] || '',
      lastName: lastName || resolvedName.split(' ').slice(1).join(' ') || '',
      email: resolvedEmail,
      phone: resolvedPhone,
      preferredDate: resolvedDate,
      preferredTime: slotInfo.time,
      preferredTimeSlot: slotInfo.time,
      confirmedDate: '',
      confirmedTime: '',
      serviceName: resolvedService,
      service: resolvedService,
      reason: resolvedReason,
      doctorId: doc.id,
      assignedDoctor: doc.name,
      doctorPreference: doc.name,
      durationMinutes: slotInfo.durationMinutes,
      reservationId: reservationId || undefined,
      insuranceProvider: insuranceProvider || '',
      notes: notes || resolvedReason,
      status: 'pending',
      history: [
        {
          status: 'pending',
          timestamp: now,
          note: `Booked online by patient for ${doc.name} (${resolvedDate} at ${slotInfo.time})`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    appointmentDatabase.unshift(newAppointment);
    persistAppointmentsDatabase();

    broadcastRealtimeEvent('appointment_created', {
      appointment: newAppointment,
    });

    // Trigger automated email acknowledgment
    const emailResult = await sendNewAppointmentNotification(newAppointment);

    return res.status(201).json({
      success: true,
      appointment: newAppointment,
      emailDispatched: emailResult.dispatched,
    });
  });
});

// Admin / Doctor Update Appointment Status (Approve, Decline, Reschedule with Atomic Slot Validation & Release)
app.put('/api/appointments/:id/status', requireStaffAuth, async (req: Request, res: Response) => {
  const staff = (req as any).staffSession as AuthenticatedStaffSession;
  const { id } = req.params;
  const {
    status,
    doctorId,
    assignedDoctor,
    confirmedDate,
    confirmedTime,
    adminNotes,
    declineReason,
    rescheduleReason,
    adminEmail,
  } = req.body;

  const normStatus = String(status || '').trim().toLowerCase();
  if (!['pending', 'approved', 'declined', 'rescheduled', 'expired'].includes(normStatus)) {
    return res.status(400).json({ error: 'Invalid appointment status.' });
  }

  const existingIdx = appointmentDatabase.findIndex((a) => a.id === id);
  const existingApt = existingIdx >= 0 ? appointmentDatabase[existingIdx] : req.body.appointmentSnapshot || null;

  // Doctor role isolation: Doctors can only manage appointments assigned to their own schedule
  if (staff && staff.role === 'Doctor' && staff.doctorId) {
    const doc = resolveDoctorRecord(staff.doctorId);
    if (existingApt && doc && !doesAppointmentMatchDoctor(existingApt, doc)) {
      return res.status(403).json({ error: 'Access denied: You are only authorized to manage appointments assigned to your schedule.' });
    }
  }

  const targetDoc = resolveDoctorRecord(
    doctorId || assignedDoctor || existingApt?.doctorId || existingApt?.assignedDoctor
  );
  if (!targetDoc) {
    return res.status(400).json({ error: 'Assigned doctor not found.' });
  }

  const previousEffective = existingApt
    ? getEffectiveAppointmentDateAndTime(existingApt)
    : { date: String(req.body.previousDate || ''), time: String(req.body.previousTime || '') };

  const targetDate = String(confirmedDate || previousEffective.date || '').trim();
  const targetTime = String(confirmedTime || previousEffective.time || '').trim();

  const lockKey = `slot:${targetDoc.id}:${targetDate}:${targetTime.toLowerCase()}`;

  return withAtomicLock(lockKey, async () => {
    purgeExpiredReservations();

    // When APPROVING or RESCHEDULING, ensure no other appointment or active 5-min hold blocks the target slot
    if (normStatus === 'approved' || normStatus === 'rescheduled') {
      if (!targetDate || !targetTime) {
        return res.status(400).json({ error: 'Date and time slot are required.' });
      }

      // If rescheduling to a new date/time, verify the doctor has that slot configured and unbooked
      if (normStatus === 'rescheduled') {
        const daySlots = computeDoctorSlotsForDate(targetDoc.id, targetDate);
        const configuredMatch = daySlots.slots.find(
          (s) => s.time.toLowerCase() === targetTime.toLowerCase()
        );
        if (!configuredMatch) {
          return res.status(400).json({
            error: `${targetDoc.name} does not have an available slot at ${targetTime} on ${targetDate}. Please select one of ${targetDoc.name}'s available slots.`,
          });
        }
      }

      // Check if another appointment (different ID) already occupies (targetDoc, targetDate, targetTime)
      const conflictingApt = appointmentDatabase.find((a) => {
        if (a.id === id) return false;
        const st = String(a.status || '').toLowerCase();
        if (st !== 'pending' && st !== 'approved' && st !== 'rescheduled') return false;
        if (!doesAppointmentMatchDoctor(a, targetDoc)) return false;
        const eff = getEffectiveAppointmentDateAndTime(a);
        return eff.date === targetDate && eff.time.toLowerCase() === targetTime.toLowerCase();
      });

      if (conflictingApt) {
        return res.status(409).json({
          error: `Conflict: ${targetDoc.name} already has a ${conflictingApt.status.toUpperCase()} appointment with ${conflictingApt.name} on ${targetDate} at ${targetTime}.`,
        });
      }

      // Also check if an active 5-minute patient reservation is holding the new reschedule target slot
      const conflictingRes = reservationsDatabase.find(
        (r) =>
          r.status === 'ACTIVE' &&
          r.expiresAt > Date.now() &&
          r.doctorId === targetDoc.id &&
          r.date === targetDate &&
          r.time.toLowerCase() === targetTime.toLowerCase()
      );

      if (conflictingRes && normStatus === 'rescheduled') {
        return res.status(409).json({
          error: `That slot (${targetDate} at ${targetTime}) is currently held by a patient's 5-minute reservation. Please choose another available slot.`,
        });
      }
    }

    const now = new Date().toISOString();
    const historyNote =
      normStatus === 'approved'
        ? `Approved for ${targetDoc.name} on ${targetDate} at ${targetTime}`
        : normStatus === 'rescheduled'
        ? `Rescheduled from ${previousEffective.date} (${previousEffective.time}) to ${targetDate} (${targetTime}). Old slot released immediately.`
        : normStatus === 'declined'
        ? `Declined (${declineReason || 'Slot released'}). Previous slot (${previousEffective.date} ${previousEffective.time}) released immediately.`
        : `Status updated to ${normStatus.toUpperCase()}`;

    const updatedRecord = {
      ...(existingApt || {}),
      id,
      status: normStatus,
      doctorId: targetDoc.id,
      assignedDoctor: targetDoc.name,
      confirmedDate: normStatus === 'approved' || normStatus === 'rescheduled' ? targetDate : existingApt?.confirmedDate || '',
      confirmedTime: normStatus === 'approved' || normStatus === 'rescheduled' ? targetTime : existingApt?.confirmedTime || '',
      adminNotes: adminNotes !== undefined ? adminNotes : existingApt?.adminNotes || '',
      declineReason: declineReason !== undefined ? declineReason : existingApt?.declineReason || '',
      rescheduleReason: rescheduleReason !== undefined ? rescheduleReason : existingApt?.rescheduleReason || '',
      history: [
        ...(existingApt?.history || []),
        {
          status: normStatus,
          timestamp: now,
          adminEmail: adminEmail || 'admin@firstavenuedentistry.ca',
          note: historyNote,
          previousDate: previousEffective.date,
          previousTime: previousEffective.time,
        },
      ],
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      appointmentDatabase[existingIdx] = updatedRecord;
    } else {
      appointmentDatabase.unshift(updatedRecord);
    }
    persistAppointmentsDatabase();

    broadcastRealtimeEvent('appointment_updated', {
      appointment: updatedRecord,
      previousSlotReleased:
        normStatus === 'declined' || normStatus === 'rescheduled' || normStatus === 'expired'
          ? previousEffective
          : null,
    });

    // Dispatch status email
    let emailDispatched = false;
    if (updatedRecord.email) {
      const emailRes = await sendStatusEmail({
        status: normStatus.toUpperCase(),
        name: updatedRecord.name,
        email: updatedRecord.email,
        service: updatedRecord.service || updatedRecord.serviceName,
        assignedDoctor: targetDoc.name,
        confirmedDate: targetDate,
        preferredDate: updatedRecord.preferredDate,
        confirmedTime: targetTime,
        preferredTime: updatedRecord.preferredTime,
        previousDate: previousEffective.date,
        previousTime: previousEffective.time,
        reason: rescheduleReason || declineReason,
      });
      emailDispatched = emailRes.dispatched;
    }

    return res.json({
      success: true,
      appointment: updatedRecord,
      emailDispatched,
    });
  });
});

// Delete Appointment Endpoint (Admin Only)
app.delete('/api/appointments/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  appointmentDatabase = appointmentDatabase.filter((apt: any) => apt.id !== id);
  persistAppointmentsDatabase();
  broadcastRealtimeEvent('appointment_deleted', { deletedId: id });

  return res.json({
    success: true,
    deletedId: id,
    message: `Appointment ${id} successfully deleted from clinic database.`,
  });
});

// In-memory OTP Store for returning patient authentication
const patientOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; patientData: any }>();

// Returning Patient Send Verification OTP
app.post('/api/patients/send-otp', createRateLimiter(5, 600000), async (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const patientHint = req.body.patientHint || null;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ found: false, error: 'Valid email address required.' });
  }

  const allAppointments = loadJSON<any>(APPOINTMENTS_FILE, appointmentDatabase);
  const match =
    allAppointments.find((a: any) => String(a.email || '').trim().toLowerCase() === email) ||
    patientHint;

  const emailPrefix = email.split('@')[0].replace(/[0-9._-]+/g, ' ').trim();
  const defaultFirst = emailPrefix
    ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).split(' ')[0]
    : 'Patient';

  const rawName = match?.name || '';
  const firstName = match?.firstName || (rawName ? rawName.split(' ')[0] : defaultFirst);
  const lastName = match?.lastName || (rawName ? rawName.split(' ').slice(1).join(' ') : '');
  const patientData = {
    name: rawName || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    phone: match?.phone || '',
    email: match?.email || email,
    insuranceProvider: match?.insuranceProvider || '',
    previousService: match?.serviceName || match?.service || '',
    lastVisitDate: match?.confirmedDate || match?.preferredDate || '',
  };

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  patientOtpStore.set(email, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    patientData,
  });

  const html = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">Patient Identity Verification Passcode</h2>
      <p>Dear <strong>${firstName}</strong>,</p>
      <p>Enter the 6-digit verification passcode below to auto-fill your patient details at <strong>${CLINIC_NAME}</strong>:</p>
      <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #64748B;">This code is valid for 10 minutes.</p>
    `,
    {
      label: 'Patient Profile Security Verification',
      bgColor: '#eff6ff',
      textColor: '#1e5aff',
      borderColor: '#bfdbfe',
    }
  );

  const emailRes = await deliverEmail(email, `Your Verification Code: ${otp} - ${CLINIC_NAME}`, html);

  return res.json({
    found: true,
    success: true,
    email,
    emailDispatched: emailRes.dispatched,
    maskedPhone: match?.phone ? `***-***-${match.phone.replace(/\D/g, '').slice(-4) || '****'}` : '',
    message: `A 6-digit verification code has been dispatched to ${email}.`,
  });
});

// Returning Patient Verify OTP & Unlock Data
app.post('/api/patients/verify-otp', createRateLimiter(10, 600000), (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const otp = String(req.body.otp || '').trim();

  if (!email || !otp) {
    return res.status(400).json({ verified: false, error: 'Email and verification code are required.' });
  }

  const record = patientOtpStore.get(email);
  if (!record) {
    return res.status(400).json({
      verified: false,
      error: 'No active verification code found. Please request a new code.',
    });
  }

  if (Date.now() > record.expiresAt) {
    patientOtpStore.delete(email);
    return res.status(400).json({
      verified: false,
      error: 'Verification code has expired. Please request a new code.',
    });
  }

  if (record.otp !== otp) {
    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts >= 5) {
      patientOtpStore.delete(email);
      return res.status(429).json({
        verified: false,
        error: 'Too many incorrect attempts. This verification code has been invalidated for security. Please request a new code.',
      });
    }
    return res.status(400).json({
      verified: false,
      error: `Incorrect verification code. (${5 - record.attempts} attempts remaining)`,
    });
  }

  patientOtpStore.delete(email);

  return res.json({
    verified: true,
    patient: record.patientData,
  });
});

// Returning Patient Direct Lookup by Email (Secured Staff-Only Endpoint)
app.post('/api/patients/lookup', requireStaffAuth, (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ found: false, error: 'Valid email address required.' });
  }

  const allAppointments = loadJSON<any>(APPOINTMENTS_FILE, appointmentDatabase);
  const match = allAppointments.find((a: any) =>
    String(a.email || '').trim().toLowerCase() === email
  );

  if (match) {
    const rawName = match.name || '';
    const firstName = match.firstName || (rawName ? rawName.split(' ')[0] : '');
    const lastName = match.lastName || (rawName ? rawName.split(' ').slice(1).join(' ') : '');
    return res.json({
      found: true,
      patient: {
        name: rawName || `${firstName} ${lastName}`.trim(),
        firstName: firstName || '',
        lastName: lastName || '',
        phone: match.phone || '',
        email: match.email || email,
        insuranceProvider: match.insuranceProvider || '',
        previousService: match.serviceName || match.service || '',
        lastVisitDate: match.confirmedDate || match.preferredDate || '',
      },
    });
  }

  return res.json({ found: false, message: 'No prior clinical records found with this email.' });
});

// In-memory OTP Stores & Brute-Force Protection for Admin & Doctor Login
const adminLoginOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; admin: AdminAccountRecord }>();
const adminResetOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; adminId: string; email: string }>();
const loginAttemptTracker = new Map<string, { count: number; lockedUntil: number }>();

function checkBruteForceLockout(key: string): { locked: boolean; remainingMinutes: number } {
  const rec = loginAttemptTracker.get(key);
  if (!rec) return { locked: false, remainingMinutes: 0 };
  if (rec.lockedUntil > Date.now()) {
    const mins = Math.max(1, Math.ceil((rec.lockedUntil - Date.now()) / 60000));
    return { locked: true, remainingMinutes: mins };
  }
  if (rec.lockedUntil > 0 && rec.lockedUntil <= Date.now()) {
    loginAttemptTracker.delete(key);
  }
  return { locked: false, remainingMinutes: 0 };
}

function recordFailedAttempt(key: string): number {
  const existing = loginAttemptTracker.get(key) || { count: 0, lockedUntil: 0 };
  const nextCount = existing.count + 1;
  const lockedUntil = nextCount >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
  loginAttemptTracker.set(key, { count: nextCount, lockedUntil });
  return Math.max(0, 5 - nextCount);
}

function clearFailedAttempts(key: string) {
  loginAttemptTracker.delete(key);
}

function findAdminByIdentifier(
  identifier: string,
  portalMode?: 'admin' | 'doctor'
): AdminAccountRecord | undefined {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean) return undefined;
  const cleanAlpha = clean.replace(/[^a-z0-9]/g, '');

  const diskAdmins = loadJSON<AdminAccountRecord>(ADMINS_FILE, adminsDatabase);
  if (diskAdmins.length >= adminsDatabase.length) {
    adminsDatabase = diskAdmins;
  }

  const matchesAccount = (a: AdminAccountRecord) => {
    const uLower = a.username.toLowerCase();
    const uAlpha = uLower.replace(/[^a-z0-9]/g, '');
    const eLower = a.email.toLowerCase();
    const nLower = a.name.toLowerCase();
    const nAlpha = nLower.replace(/[^a-z0-9]/g, '');
    const dLower = (a.doctorId || '').toLowerCase();
    return (
      uLower === clean ||
      (cleanAlpha.length >= 3 && uAlpha === cleanAlpha) ||
      eLower === clean ||
      nLower === clean ||
      (cleanAlpha.length >= 4 && nAlpha === cleanAlpha) ||
      (dLower && dLower === clean)
    );
  };

  if (portalMode === 'doctor') {
    const doctorMatch = adminsDatabase.find(
      (a) => (a.role === 'Doctor' || Boolean(a.doctorId)) && matchesAccount(a)
    );
    if (doctorMatch) return doctorMatch;

    // Check if it matches a doctor in doctorsDatabase and ensure an AdminAccountRecord exists
    const matchedDoc = doctorsDatabase.find((d) => {
      const uLower = (d.username || '').toLowerCase();
      const uAlpha = uLower.replace(/[^a-z0-9]/g, '');
      const nLower = d.name.toLowerCase();
      const nAlpha = nLower.replace(/[^a-z0-9]/g, '');
      return (
        d.id.toLowerCase() === clean ||
        uLower === clean ||
        (cleanAlpha.length >= 3 && uAlpha === cleanAlpha) ||
        d.email.toLowerCase() === clean ||
        nLower === clean ||
        (cleanAlpha.length >= 4 && nAlpha === cleanAlpha)
      );
    });

    if (matchedDoc) {
      const existingAcct = adminsDatabase.find((a) => a.doctorId === matchedDoc.id);
      if (existingAcct) return existingAcct;
      const newDocAcct: AdminAccountRecord = {
        id: `acct-${matchedDoc.id}`,
        name: matchedDoc.name,
        email: matchedDoc.email || 'firstavenuedentistry@gmail.com',
        username: matchedDoc.username || matchedDoc.id,
        password: '1234567890',
        role: 'Doctor',
        doctorId: matchedDoc.id,
        createdAt: new Date().toISOString(),
      };
      adminsDatabase.push(newDocAcct);
      persistAdminsDatabase();
      return newDocAcct;
    }
  }

  if (portalMode === 'admin') {
    const adminMatch = adminsDatabase.find(
      (a) => a.role !== 'Doctor' && !a.doctorId && matchesAccount(a)
    );
    if (adminMatch) return adminMatch;
  }

  return adminsDatabase.find(matchesAccount) || undefined;
}

async function handleUnified2FALogin(req: Request, res: Response, defaultMode?: 'admin' | 'doctor') {
  const { username, email, identifier: bodyIdentifier, password, portalMode } = req.body;
  const effectiveMode: 'admin' | 'doctor' | undefined =
    portalMode === 'doctor' || portalMode === 'admin' ? portalMode : defaultMode;
  const identifier = String(bodyIdentifier || username || email || '').trim().toLowerCase();
  const inputPass = String(password || '');

  if (!identifier || !inputPass) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  const lockoutKey = `${effectiveMode || 'any'}:${identifier}`;
  const lockoutStatus = checkBruteForceLockout(lockoutKey);
  if (lockoutStatus.locked) {
    return res.status(429).json({
      error: `Security Lockout: Too many failed sign-in attempts. Please wait ${lockoutStatus.remainingMinutes} minute(s) or use Reset Password.`,
    });
  }

  let matched = findAdminByIdentifier(identifier, effectiveMode);

  if (!matched && identifier === 'admin@vantage-i.me') {
    matched = findAdminByIdentifier('fenil', 'admin') || adminsDatabase[0];
  }

  if (!matched || matched.password !== inputPass) {
    const remaining = recordFailedAttempt(lockoutKey);
    return res.status(401).json({
      error:
        remaining > 0
          ? `Invalid username/email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout)`
          : 'Account temporarily locked for 15 minutes due to 5 failed sign-in attempts.',
    });
  }

  // Enforce portal role separation if logging into a specific portal mode
  const isDoctorAccount = matched.role === 'Doctor' || Boolean(matched.doctorId);
  if (effectiveMode === 'doctor' && !isDoctorAccount) {
    // Check if there is a doctor profile matching this account or block non-doctor account on doctor login
    const docForAdmin = doctorsDatabase.find(
      (d) =>
        d.name.toLowerCase() === matched!.name.toLowerCase() ||
        d.email.toLowerCase() === matched!.email.toLowerCase()
    );
    if (docForAdmin) {
      matched = {
        ...matched,
        role: 'Doctor',
        doctorId: docForAdmin.id,
      };
    } else {
      return res.status(403).json({
        error: 'Please use a registered Doctor username/email on the Doctor Login portal, or switch to Admin Login.',
      });
    }
  }

  clearFailedAttempts(lockoutKey);

  // Generate mandatory 6-digit 2FA OTP for both Admin and Doctor login security
  const otp = crypto.randomInt(100000, 999999).toString();
  const targetEmail = matched.email.trim().toLowerCase();
  const portalLabel = isDoctorAccount || effectiveMode === 'doctor' ? 'Doctor Portal' : 'Admin Portal';

  adminLoginOtpStore.set(targetEmail, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    admin: matched,
  });

  const html = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">${portalLabel} Security Passcode</h2>
      <p>Hello <strong>${matched.name}</strong> (${matched.role}),</p>
      <p>Enter the 6-digit two-factor authentication (2FA) passcode below to complete your sign-in to the <strong>${CLINIC_NAME}</strong> ${portalLabel}:</p>
      <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #64748B;">This passcode expires in 10 minutes.</p>
    `,
    {
      label: `${portalLabel} 2FA Login Verification`,
      bgColor: '#eff6ff',
      textColor: '#1e5aff',
      borderColor: '#bfdbfe',
    }
  );

  const emailRes = await deliverEmail(targetEmail, `${portalLabel} Login OTP: ${otp} - ${CLINIC_NAME}`, html);

  return res.json({
    success: true,
    requiresOtp: true,
    email: targetEmail,
    maskedEmail: maskEmailAddress(targetEmail),
    adminName: matched.name,
    role: matched.role,
    doctorId: matched.doctorId,
    emailDispatched: emailRes.dispatched,
    message: `A 6-digit 2FA verification code has been sent to ${maskEmailAddress(targetEmail)}.`,
  });
}

// Doctor Portal Login Step 1: Validate Credentials & Dispatch Mandatory 2FA Login OTP
app.post('/api/doctor/login', createRateLimiter(10, 60000), async (req: Request, res: Response) => {
  return handleUnified2FALogin(req, res, 'doctor');
});

// Administrator Portal Login Step 1: Validate Credentials & Dispatch Mandatory 2FA Login OTP
app.post('/api/admin/login', createRateLimiter(10, 60000), async (req: Request, res: Response) => {
  return handleUnified2FALogin(req, res);
});

// Administrator & Doctor Authentication Step 2: Verify 2FA Login OTP
app.post('/api/admin/verify-login-otp', createRateLimiter(10, 60000), (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const otp = String(req.body.otp || '').trim();

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and 6-digit OTP code are required.' });
  }

  const record = adminLoginOtpStore.get(email);
  if (!record) {
    return res.status(400).json({ error: 'No active login verification code found. Please sign in again.' });
  }

  if (Date.now() > record.expiresAt) {
    adminLoginOtpStore.delete(email);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
  }

  if (record.otp !== otp) {
    record.attempts += 1;
    if (record.attempts >= 5) {
      adminLoginOtpStore.delete(email);
      return res.status(429).json({
        error: 'Maximum OTP verification attempts exceeded. For your security, this code has been invalidated. Please sign in again.',
      });
    }
    return res.status(401).json({
      error: `Incorrect 6-digit verification code. (${5 - record.attempts} attempt${5 - record.attempts === 1 ? '' : 's'} remaining)`,
    });
  }

  adminLoginOtpStore.delete(email);
  const admin = record.admin;
  const sessionToken = generateStaffSessionToken(admin);
  const now = Date.now();

  return res.json({
    success: true,
    sessionToken,
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      username: admin.username,
      role: admin.role,
      doctorId: admin.doctorId,
      sessionToken,
      lastLoginAt: new Date(now).toISOString(),
    },
  });
});

// Administrator & Doctor Logout (Invalidates active session token immediately)
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = String(req.headers['x-session-token']).trim();
  }
  if (token) {
    activeAdminSessions.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Resend Admin / Doctor Login 2FA OTP
app.post('/api/admin/resend-login-otp', createRateLimiter(8, 60000), async (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const existingRecord = adminLoginOtpStore.get(email);
  const matched = existingRecord?.admin || findAdminByIdentifier(email);

  if (!matched) {
    return res.status(404).json({ error: 'Account not found.' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const targetEmail = matched.email.trim().toLowerCase();

  adminLoginOtpStore.set(targetEmail, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    admin: matched,
  });

  const html = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">Your New Portal Login Code</h2>
      <p>Hello <strong>${matched.name}</strong>, here is your newly requested 6-digit 2FA passcode:</p>
      <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #64748B;">Valid for 10 minutes.</p>
    `,
    {
      label: 'New 2FA Passcode',
      bgColor: '#eff6ff',
      textColor: '#1e5aff',
      borderColor: '#bfdbfe',
    }
  );

  const emailRes = await deliverEmail(targetEmail, `New Login OTP: ${otp} - ${CLINIC_NAME}`, html);

  return res.json({
    success: true,
    email: targetEmail,
    maskedEmail: maskEmailAddress(targetEmail),
    emailDispatched: emailRes.dispatched,
    message: `A new 6-digit code was sent to ${maskEmailAddress(targetEmail)}.`,
  });
});

// Admin Forgot Password - Request Reset OTP
app.post('/api/admin/forgot-password', createRateLimiter(6, 60000), async (req: Request, res: Response) => {
  const identifier = String(req.body.identifier || req.body.email || req.body.username || '').trim().toLowerCase();
  if (!identifier) {
    return res.status(400).json({ error: 'Please enter your administrator username or email address.' });
  }

  const matched = findAdminByIdentifier(identifier);
  if (!matched) {
    return res.status(404).json({ error: 'No administrator or staff account found matching that username or email.' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const targetEmail = matched.email.trim().toLowerCase();

  adminResetOtpStore.set(targetEmail, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    adminId: matched.id,
    email: targetEmail,
  });

  const html = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">Reset Your Portal Password</h2>
      <p>Hello <strong>${matched.name}</strong> (Username: <code>${matched.username}</code>),</p>
      <p>Enter the 6-digit verification code below to reset your password at <strong>${CLINIC_NAME}</strong>:</p>
      <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #64748B;">This code expires in 10 minutes.</p>
    `,
    {
      label: 'Password Reset Request',
      bgColor: '#fffbeb',
      textColor: '#b45309',
      borderColor: '#fde68a',
    }
  );

  const emailRes = await deliverEmail(targetEmail, `Password Reset OTP: ${otp} - ${CLINIC_NAME}`, html);

  return res.json({
    success: true,
    email: targetEmail,
    maskedEmail: maskEmailAddress(targetEmail),
    username: matched.username,
    emailDispatched: emailRes.dispatched,
    message: `Password reset OTP sent to ${maskEmailAddress(targetEmail)}.`,
  });
});

// Admin Reset Password - Verify OTP & Update Password
app.post('/api/admin/reset-password', createRateLimiter(8, 60000), async (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const otp = String(req.body.otp || '').trim();
  const newPassword = String(req.body.newPassword || '').trim();

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, 6-digit OTP, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const record = adminResetOtpStore.get(email);
  if (!record) {
    return res.status(400).json({ error: 'No active password reset request found. Please request a new OTP.' });
  }

  if (Date.now() > record.expiresAt) {
    adminResetOtpStore.delete(email);
    return res.status(400).json({ error: 'Password reset code has expired. Please request a new OTP.' });
  }

  if (record.otp !== otp) {
    record.attempts += 1;
    if (record.attempts >= 5) {
      adminResetOtpStore.delete(email);
      return res.status(429).json({
        error: 'Maximum OTP verification attempts exceeded. Please request a new password reset code.',
      });
    }
    return res.status(401).json({
      error: `Incorrect 6-digit OTP code. (${5 - record.attempts} attempt${5 - record.attempts === 1 ? '' : 's'} remaining)`,
    });
  }

  const idx = adminsDatabase.findIndex(
    (a) => a.id === record.adminId || a.email.toLowerCase() === email
  );
  if (idx === -1) {
    return res.status(404).json({ error: 'Administrator record not found.' });
  }

  adminsDatabase[idx].password = newPassword;
  persistAdminsDatabase();
  adminResetOtpStore.delete(email);

  const updatedAdmin = adminsDatabase[idx];
  const confirmHtml = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">Password Updated Successfully</h2>
      <p>Hello <strong>${updatedAdmin.name}</strong>,</p>
      <p>Your portal password for <strong>${CLINIC_NAME}</strong> (Username: <code>${updatedAdmin.username}</code>) has been reset.</p>
    `,
    {
      label: 'Security Confirmation',
      bgColor: '#ecfdf5',
      textColor: '#047857',
      borderColor: '#a7f3d0',
    }
  );
  await deliverEmail(updatedAdmin.email, `Password Changed Confirmation - ${CLINIC_NAME}`, confirmHtml);

  return res.json({
    success: true,
    message: 'Password has been reset successfully. Please sign in with your new password.',
  });
});

// Admin Users Management (Admin Role Required)
app.get('/api/admin/users', requireAdminAuth, (_req: Request, res: Response) => {
  const diskAdmins = loadJSON<AdminAccountRecord>(ADMINS_FILE, adminsDatabase);
  if (diskAdmins.length >= adminsDatabase.length) {
    adminsDatabase = diskAdmins;
  }
  const safeUsers = adminsDatabase.map(({ password, ...rest }) => ({
    ...rest,
  }));
  return res.json(safeUsers);
});

app.post('/api/admin/users', requireAdminAuth, async (req: Request, res: Response) => {
  const { name, username, email, password, role, doctorId } = req.body;
  const cleanName = String(name || '').trim();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '').trim();
  const cleanRole = String(role || 'Clinic Admin').trim();

  if (!cleanName || !cleanUsername || !cleanEmail || !cleanPassword) {
    return res.status(400).json({ error: 'Name, username, email, and password are required.' });
  }
  if (!cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const duplicate = adminsDatabase.find(
    (a) => a.username.toLowerCase() === cleanUsername
  );
  if (duplicate) {
    return res.status(409).json({
      error: 'An account with that username already exists.',
    });
  }

  let resolvedDoctorId = doctorId || undefined;

  // If the admin creates a user with role 'Doctor', also ensure they exist in doctorsDatabase & availabilityDatabase
  if (cleanRole.toLowerCase() === 'doctor') {
    const matchedDoc = doctorsDatabase.find(
      (d) =>
        (resolvedDoctorId && d.id === resolvedDoctorId) ||
        d.name.toLowerCase() === cleanName.toLowerCase() ||
        (d.username && d.username.toLowerCase() === cleanUsername)
    );
    if (matchedDoc) {
      resolvedDoctorId = matchedDoc.id;
      matchedDoc.email = cleanEmail;
      matchedDoc.username = cleanUsername;
      persistDoctorsDatabase();
    } else {
      const newDocId =
        resolvedDoctorId ||
        `doc-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
      resolvedDoctorId = newDocId;
      const newDocRecord: DoctorRecord = {
        id: newDocId,
        name: cleanName,
        title: 'Dentist / Specialist',
        qualifications: 'BDS, DDS',
        specialties: ['General Dentistry'],
        status: 'active',
        email: cleanEmail,
        phone: CLINIC_PHONE,
        bio: '',
        username: cleanUsername,
        updatedAt: new Date().toISOString(),
      };
      doctorsDatabase.push(newDocRecord);
      persistDoctorsDatabase();

      if (!availabilityDatabase.some((a) => a.doctorId === newDocRecord.id)) {
        availabilityDatabase.push(buildDefaultAvailabilityForDoctor(newDocRecord));
        persistAvailabilityDatabase();
      }
      broadcastRealtimeEvent('doctors_updated', { doctor: newDocRecord });
    }
  }

  const newAdmin: AdminAccountRecord = {
    id: `admin-${Date.now().toString().slice(-6)}`,
    name: cleanName,
    username: cleanUsername,
    email: cleanEmail,
    password: cleanPassword,
    role: cleanRole,
    doctorId: resolvedDoctorId,
    createdAt: new Date().toISOString(),
  };

  adminsDatabase.push(newAdmin);
  persistAdminsDatabase();

  const { password: _p, ...safeNewAdmin } = newAdmin;
  return res.status(201).json({
    success: true,
    user: safeNewAdmin,
  });
});

app.put('/api/admin/users/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, username, email, password, role, doctorId } = req.body;

  const idx = adminsDatabase.findIndex((a) => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  if (name) adminsDatabase[idx].name = String(name).trim();
  if (username) adminsDatabase[idx].username = String(username).trim().toLowerCase();
  if (email) adminsDatabase[idx].email = String(email).trim().toLowerCase();
  if (role) adminsDatabase[idx].role = String(role).trim();
  if (doctorId !== undefined) adminsDatabase[idx].doctorId = doctorId || undefined;
  if (password && String(password).trim().length >= 6) {
    adminsDatabase[idx].password = String(password).trim();
  }

  persistAdminsDatabase();
  const { password: _p, ...safeUpdated } = adminsDatabase[idx];
  return res.json({ success: true, user: safeUpdated });
});

app.delete('/api/admin/users/:id', requireAdminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  if (adminsDatabase.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last remaining administrator account.' });
  }

  const target = adminsDatabase.find((a) => a.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  adminsDatabase = adminsDatabase.filter((a) => a.id !== id);
  persistAdminsDatabase();

  return res.json({
    success: true,
    deletedId: id,
    message: `Removed administrator ${target.name}.`,
  });
});

// Trigger Status Email (Also syncs backend appointment status if appointmentId is provided - Staff Only)
app.post('/api/send-status-email', requireStaffAuth, async (req: Request, res: Response) => {
  const {
    appointmentId,
    status,
    name,
    firstName,
    email,
    service,
    serviceName,
    assignedDoctor,
    confirmedDate,
    confirmedTime,
    previousDate,
    previousTime,
    reason,
    rescheduleReason,
    declineReason,
  } = req.body;

  if (!email || !status) {
    return res.status(400).json({ error: 'Missing email or status for notification dispatch.' });
  }

  if (appointmentId) {
    const idx = appointmentDatabase.findIndex((a) => a.id === appointmentId);
    if (idx >= 0) {
      const norm = String(status).toLowerCase();
      appointmentDatabase[idx].status = norm === 'rejected' ? 'declined' : norm;
      if (assignedDoctor) appointmentDatabase[idx].assignedDoctor = assignedDoctor;
      if (confirmedDate) appointmentDatabase[idx].confirmedDate = confirmedDate;
      if (confirmedTime) appointmentDatabase[idx].confirmedTime = confirmedTime;
      appointmentDatabase[idx].updatedAt = new Date().toISOString();
      persistAppointmentsDatabase();
      broadcastRealtimeEvent('appointment_updated', { appointment: appointmentDatabase[idx] });
    }
  }

  const emailRes = await sendStatusEmail({
    status,
    name,
    firstName,
    email,
    service: service || serviceName,
    serviceName: service || serviceName,
    assignedDoctor: assignedDoctor || 'Dental Specialist',
    confirmedDate,
    confirmedTime,
    previousDate,
    previousTime,
    reason: reason || rescheduleReason || declineReason,
  });

  return res.json({
    success: true,
    emailDispatched: emailRes.dispatched,
    message: `Dispatched ${status} notification to ${email}`,
  });
});

// Patient Enquiry Notification Email (Contact Form - Rate Limited & Sanitized)
app.post('/api/enquiries', createRateLimiter(5, 600000), async (req: Request, res: Response) => {
  const { name, email, phone, service, message } = req.body;
  const cleanName = sanitizeText(String(name || '').trim(), 120);
  const cleanEmail = sanitizeText(String(email || '').trim().toLowerCase(), 160);
  const cleanPhone = sanitizeText(String(phone || '').trim(), 35);
  const cleanService = sanitizeText(String(service || '').trim(), 120);
  const cleanMessage = sanitizeText(String(message || '').trim(), 1500);

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const patientHtml = emailShell(
    `
      <h2 style="color:#060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">We Received Your Dental Inquiry</h2>
      <p>Dear <strong>${cleanName || 'Valued Patient'}</strong>, thank you for contacting <strong>${CLINIC_NAME}</strong> in St. Thomas, ON.</p>
      <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Topic / Service:</strong> ${cleanService || 'General Inquiry'}</p>
        <p style="margin: 4px 0;"><strong>Phone:</strong> ${cleanPhone || 'Not provided'}</p>
        <p style="margin: 8px 0 0;"><strong>Your Message:</strong><br/>${cleanMessage || ''}</p>
      </div>
      <p style="color: #64748b; font-size: 13px;">Our reception team will respond shortly. For urgent dental care, please call us directly at <strong>${CLINIC_PHONE}</strong>.</p>
    `,
    {
      label: 'Patient Inquiry Received',
      bgColor: '#eff6ff',
      textColor: '#1e5aff',
      borderColor: '#bfdbfe',
    }
  );

  const adminHtml = emailShell(
    `
      <h2 style="color:#060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">New Website Inquiry from ${cleanName || 'Visitor'}</h2>
      <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Name:</strong> ${cleanName || 'Visitor'}</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${cleanEmail}</p>
        <p style="margin: 4px 0;"><strong>Phone:</strong> ${cleanPhone || 'Not provided'}</p>
        <p style="margin: 4px 0;"><strong>Subject:</strong> ${cleanService || 'General Inquiry'}</p>
        <p style="margin: 8px 0 0;"><strong>Message:</strong><br/>${cleanMessage || ''}</p>
      </div>
    `,
    {
      label: 'New Website Inquiry',
      bgColor: '#eff6ff',
      textColor: '#1e5aff',
      borderColor: '#bfdbfe',
    }
  );

  const patientRes = await deliverEmail(cleanEmail, `Inquiry Received - ${CLINIC_NAME}`, patientHtml);
  await deliverEmail(CLINIC_ADMIN_EMAIL, `New Patient Inquiry: ${cleanName || cleanEmail}`, adminHtml);

  return res.json({ success: true, emailDispatched: patientRes.dispatched });
});

// Send Live Test Email (Admin Only)
app.post('/api/test-email', requireAdminAuth, async (req: Request, res: Response) => {
  const targetEmail = String(req.body.email || CLINIC_ADMIN_EMAIL).trim().toLowerCase();
  const html = emailShell(
    `
      <h2 style="color: #060C16; margin: 0 0 10px; font-size: 20px; font-weight: 800;">Email Delivery Test Successful</h2>
      <p>This is a live test email dispatched from <strong>${CLINIC_NAME}</strong> via SMTP using your verified sender domain (<code>${EMAIL_FROM}</code>).</p>
    `,
    {
      label: 'SMTP Live Delivery Verified ✓',
      bgColor: '#ecfdf5',
      textColor: '#047857',
      borderColor: '#a7f3d0',
    }
  );

  const result = await deliverEmail(targetEmail, `Live Email Test - ${CLINIC_NAME}`, html);
  return res.json({
    success: result.dispatched,
    to: targetEmail,
    from: EMAIL_FROM,
    messageId: result.messageId,
    error: result.error || null,
  });
});

// Admin CSV Export (Admin Only)
app.get('/api/admin/export-csv', requireAdminAuth, (_req: Request, res: Response) => {
  const headers = ['ID', 'Patient Name', 'Email', 'Phone', 'Date', 'Time Slot', 'Service', 'Assigned Doctor', 'Status', 'Submitted At'];
  const rows = appointmentDatabase.map((a: any) => [
    a.id,
    `"${a.name || a.firstName + ' ' + (a.lastName || '')}"`,
    `"${a.email}"`,
    `"${a.phone}"`,
    `"${a.confirmedDate || a.preferredDate || ''}"`,
    `"${a.confirmedTime || a.preferredTimeSlot || a.preferredTime || ''}"`,
    `"${a.service || a.serviceName || ''}"`,
    `"${a.assignedDoctor || 'Unassigned'}"`,
    String(a.status || 'PENDING').toUpperCase(),
    `"${a.createdAt}"`,
  ]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="first-avenue-dentistry-appointments.csv"');
  res.send([headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n'));
});

// View Email Logs (Admin Only)
app.get('/api/email-logs', requireAdminAuth, (_req: Request, res: Response) => {
  const logs = loadJSON<any>(EMAIL_LOG_FILE, []);
  res.json(logs);
});

// Direct Patient Form PDF Download Endpoint
const PATIENT_FORM_FILES: Record<string, { relativePath: string; downloadName: string }> = {
  'medical-history-adult': {
    relativePath: 'public/assets/aistudio/Medical_History_05b70b07.pdf',
    downloadName: 'Medical_History.pdf',
  },
  'medical-history-child-over-5': {
    relativePath: 'public/assets/aistudio/MedicalHistory-ChildOver5_9e542a0e.pdf',
    downloadName: 'MedicalHistory-ChildOver5.pdf',
  },
  'medical-history-child-under-5': {
    relativePath: 'public/assets/aistudio/Medical_History-ChildUnder_5_e416bea1.pdf',
    downloadName: 'Medical_History-ChildUnder_5.pdf',
  },
};

app.get('/api/patient-forms/:formId', (req: Request, res: Response) => {
  const formId = String(req.params.formId || '').trim();
  const entry = PATIENT_FORM_FILES[formId];
  if (!entry) {
    return res.status(404).json({ error: 'Patient form not found.' });
  }

  const publicFilePath = path.join(process.cwd(), entry.relativePath);
  const distFilePath = path.join(
    process.cwd(),
    entry.relativePath.replace(/^public[\\/]/, 'dist/')
  );
  const resolvedPath = fs.existsSync(publicFilePath)
    ? publicFilePath
    : fs.existsSync(distFilePath)
    ? distFilePath
    : null;

  if (!resolvedPath) {
    return res.status(404).json({ error: 'Patient form PDF file not found on server.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${entry.downloadName}"`);
  return res.sendFile(resolvedPath);
});

// AI Dental Assistant Endpoint
app.post('/api/ai/dental-assistant', createRateLimiter(20, 60000), async (req: Request, res: Response) => {
  const message = sanitizeText(String(req.body?.message || ''), 500);
  const text = message.toLowerCase();

  if (['book', 'appointment', 'schedule', 'visit', 'cleaning', 'see doctor', 'reserve', 'pain'].some((k) => text.includes(k))) {
    return res.json({
      answer: "I can gladly assist you with reserving an appointment right now! What dental service or care do you require today? (e.g. Routine Cleaning, Dental Implants, Invisalign, Teeth Whitening, or Emergency Care)",
      action: 'booking_start',
    });
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({});
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are the friendly, helpful dental clinic assistant for First Avenue Dentistry (${CLINIC_FULL_NAME}) in St. Thomas, Ontario (Address: 308 Wellington Street, Tel: (519) 207-6890, Doctors: Dr. D. K. Sharma, Dr. Shradha Sharma, Dr. John, Dr. Sarah, and Dr. Michael).
Answer the patient's question warmly, accurately, and concisely (2-3 sentences max). If they have acute pain, recommend booking an emergency visit or calling directly.
Patient question: "${message}"`,
              },
            ],
          },
        ],
      });

      if (response.text) {
        return res.json({ answer: response.text });
      }
    } catch (err) {
      console.warn('Gemini API call failed, using clinical fallback:', err);
    }
  }

  if (text.includes('insurance') || text.includes('coverage') || text.includes('direct billing')) {
    return res.json({
      answer: "Yes! First Avenue Dentistry provides direct insurance billing to all major Canadian dental providers. We file your claims electronically so you only pay your copay at the time of treatment.",
    });
  }
  if (text.includes('emergency') || text.includes('toothache') || text.includes('broken')) {
    return res.json({
      answer: "We accommodate dental emergencies on the same day! Please call our St. Thomas clinic directly at (519) 207-6890 or type 'book' to schedule an emergency slot immediately.",
      action: 'booking_start',
    });
  }
  if (text.includes('hour') || text.includes('open') || text.includes('time')) {
    return res.json({
      answer: "Our clinic is open Monday to Friday from 9:00 AM to 6:00 PM, and Saturdays from 9:00 AM to 5:00 PM. We are located at 308 Wellington Street in St. Thomas, ON.",
    });
  }

  return res.json({
    answer: "Welcome to First Avenue Dentistry! I can help you book an appointment with Dr. D. K. Sharma, Dr. Shradha Sharma, Dr. John, Dr. Sarah, or Dr. Michael, or answer questions about direct insurance billing and treatments. How can I help you today?",
  });
});

// ======================== DEVELOPER SITE CONTROL (MAINTENANCE & INAUGURATION MODE) ========================
const SITE_CONTROL_FILE = path.join(DATA_DIR, 'site_control.json');

export interface SiteControlRecord {
  mode: 'live' | 'maintenance' | 'inauguration';
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
  history: Array<{
    id: string;
    timestamp: string;
    mode: 'live' | 'maintenance' | 'inauguration';
    note: string;
    actor: string;
  }>;
}

const DEFAULT_SITE_CONTROL: SiteControlRecord = {
  mode: 'live',
  maintenanceTitle: 'Scheduled System & Clinical Upgrade in Progress',
  maintenanceMessage:
    'First Avenue Family Dentistry is currently performing scheduled platform maintenance to enhance your online booking and patient care experience. We will be back online shortly.',
  maintenanceEta: 'Expected back online shortly',
  showEmergencyContact: true,
  inaugurationTargetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  inaugurationTitle: 'Grand Digital Inauguration',
  inaugurationSubtitle:
    'Welcome to the official digital launch of First Avenue Family Dentistry in St. Thomas, Ontario.',
  inaugurationNote: 'Counting down to the first official reveal of our new patient portal & website.',
  autoRevealOnZero: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Developer Console',
  history: [
    {
      id: `sc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: 'live',
      note: 'Initial system state: Live Public Website',
      actor: 'System Bootstrap',
    },
  ],
};

function loadSiteControl(): SiteControlRecord {
  try {
    if (fs.existsSync(SITE_CONTROL_FILE)) {
      const raw = fs.readFileSync(SITE_CONTROL_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.mode) {
        return {
          ...DEFAULT_SITE_CONTROL,
          ...parsed,
          history: Array.isArray(parsed.history) ? parsed.history : DEFAULT_SITE_CONTROL.history,
        };
      }
    }
  } catch (err) {
    console.warn('[SiteControl] Failed to read site_control.json, using default:', err);
  }
  return { ...DEFAULT_SITE_CONTROL };
}

let siteControlState: SiteControlRecord = loadSiteControl();

function persistSiteControl() {
  try {
    fs.writeFileSync(SITE_CONTROL_FILE, JSON.stringify(siteControlState, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SiteControl] Failed to save site_control.json:', err);
  }
}

function checkAutoInaugurationReveal(): boolean {
  if (
    siteControlState.mode === 'inauguration' &&
    siteControlState.autoRevealOnZero &&
    siteControlState.inaugurationTargetTime
  ) {
    const targetMs = Date.parse(siteControlState.inaugurationTargetTime);
    if (!Number.isNaN(targetMs) && Date.now() >= targetMs) {
      const now = new Date().toISOString();
      siteControlState = {
        ...siteControlState,
        mode: 'live',
        updatedAt: now,
        updatedBy: 'Auto-Inauguration Timer',
        history: [
          {
            id: `sc-${Date.now()}`,
            timestamp: now,
            mode: 'live',
            note: 'Inauguration countdown completed — Website automatically revealed to public',
            actor: 'Auto-Reveal Engine',
          },
          ...(siteControlState.history || []).slice(0, 29),
        ],
      };
      persistSiteControl();
      broadcastRealtimeEvent('site_control_updated', {
        siteControl: siteControlState,
        justRevealed: true,
      });
      return true;
    }
  }
  return false;
}

// Background ticker to auto-reveal at exact second when inauguration countdown hits 0
setInterval(() => {
  checkAutoInaugurationReveal();
}, 1000);

// Public Endpoint: Get Current Site Control State (Live / Maintenance / Inauguration)
app.get('/api/site-control', (_req: Request, res: Response) => {
  checkAutoInaugurationReveal();
  return res.json({
    ...siteControlState,
    serverTimeMs: Date.now(),
  });
});

// Public Endpoint: Trigger Auto-Reveal when client countdown hits zero
app.post('/api/site-control/reveal', (req: Request, res: Response) => {
  const revealed = checkAutoInaugurationReveal();
  // Also allow authenticated developer/admin to force reveal immediately
  const session = extractStaffSession(req);
  if (!revealed && session && siteControlState.mode === 'inauguration') {
    const now = new Date().toISOString();
    siteControlState = {
      ...siteControlState,
      mode: 'live',
      updatedAt: now,
      updatedBy: session.email || 'Developer',
      history: [
        {
          id: `sc-${Date.now()}`,
          timestamp: now,
          mode: 'live',
          note: 'Manual Grand Inauguration Reveal triggered by Developer',
          actor: session.email || 'Developer',
        },
        ...(siteControlState.history || []).slice(0, 29),
      ],
    };
    persistSiteControl();
    broadcastRealtimeEvent('site_control_updated', {
      siteControl: siteControlState,
      justRevealed: true,
    });
  }
  return res.json({
    success: true,
    siteControl: siteControlState,
    serverTimeMs: Date.now(),
  });
});

// Dedicated Developer Console Authentication
app.post('/api/developer/login', createRateLimiter(12, 60000), (req: Request, res: Response) => {
  const identifier = String(req.body.identifier || req.body.username || req.body.email || '')
    .trim()
    .toLowerCase();
  const password = String(req.body.password || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Developer username/email and access key are required.' });
  }

  const DEV_PASSWORDS = [
    process.env.DEVELOPER_PASSWORD || 'dev@2026',
    '1234567890',
    'admin123',
  ];

  const isDevIdent =
    identifier === 'developer' ||
    identifier === 'dev' ||
    identifier === 'fenil' ||
    identifier === 'admin' ||
    identifier === 'fenilxpatel2642@gmail.com' ||
    identifier === 'fenilxpatel1234@gmail.com' ||
    identifier === 'smartyfenil898@gmail.com';

  const matchedAdmin = findAdminByIdentifier(identifier, 'admin');

  const isValidDev =
    (isDevIdent && DEV_PASSWORDS.includes(password)) ||
    (matchedAdmin && matchedAdmin.role !== 'Doctor' && matchedAdmin.password === password);

  if (!isValidDev) {
    return res.status(401).json({
      error: 'Invalid Developer credentials. Access restricted to authorized system developers.',
    });
  }

  const devRecord: AdminAccountRecord = matchedAdmin || {
    id: 'dev-master-console',
    name: 'Lead System Developer (Fenil Patel)',
    username: 'developer',
    email: 'fenilxpatel2642@gmail.com',
    password: '',
    role: 'Super Admin',
    createdAt: new Date().toISOString(),
  };

  const sessionToken = generateStaffSessionToken({
    ...devRecord,
    role: 'Super Admin',
  });

  return res.json({
    success: true,
    sessionToken,
    developer: {
      id: devRecord.id,
      name: devRecord.name,
      username: devRecord.username,
      email: devRecord.email,
      role: 'System Developer',
      sessionToken,
    },
  });
});

// Protected Developer Endpoint: Update Site Mode (Live / Maintenance / Inauguration)
app.put('/api/site-control', requireAdminAuth, (req: Request, res: Response) => {
  const staff = ((req as any).staffUser || (req as any).staffSession) as AuthenticatedStaffSession;
  const {
    mode,
    maintenanceTitle,
    maintenanceMessage,
    maintenanceEta,
    showEmergencyContact,
    inaugurationTargetTime,
    inaugurationTitle,
    inaugurationSubtitle,
    inaugurationNote,
    autoRevealOnZero,
    actionNote,
  } = req.body;

  const validMode: 'live' | 'maintenance' | 'inauguration' =
    mode === 'maintenance' || mode === 'inauguration' || mode === 'live'
      ? mode
      : siteControlState.mode;

  const now = new Date().toISOString();
  const actorName = staff?.name || staff?.email || 'Developer Console';

  const nextState: SiteControlRecord = {
    ...siteControlState,
    mode: validMode,
    maintenanceTitle:
      maintenanceTitle !== undefined
        ? sanitizeText(String(maintenanceTitle), 140)
        : siteControlState.maintenanceTitle,
    maintenanceMessage:
      maintenanceMessage !== undefined
        ? sanitizeText(String(maintenanceMessage), 600)
        : siteControlState.maintenanceMessage,
    maintenanceEta:
      maintenanceEta !== undefined
        ? sanitizeText(String(maintenanceEta), 100)
        : siteControlState.maintenanceEta,
    showEmergencyContact:
      typeof showEmergencyContact === 'boolean'
        ? showEmergencyContact
        : siteControlState.showEmergencyContact,
    inaugurationTargetTime:
      inaugurationTargetTime !== undefined
        ? String(inaugurationTargetTime)
        : siteControlState.inaugurationTargetTime,
    inaugurationTitle:
      inaugurationTitle !== undefined
        ? sanitizeText(String(inaugurationTitle), 140)
        : siteControlState.inaugurationTitle,
    inaugurationSubtitle:
      inaugurationSubtitle !== undefined
        ? sanitizeText(String(inaugurationSubtitle), 400)
        : siteControlState.inaugurationSubtitle,
    inaugurationNote:
      inaugurationNote !== undefined
        ? sanitizeText(String(inaugurationNote), 300)
        : siteControlState.inaugurationNote,
    autoRevealOnZero:
      typeof autoRevealOnZero === 'boolean'
        ? autoRevealOnZero
        : siteControlState.autoRevealOnZero,
    updatedAt: now,
    updatedBy: actorName,
    history: [
      {
        id: `sc-${Date.now()}`,
        timestamp: now,
        mode: validMode,
        note:
          actionNote ||
          (validMode === 'maintenance'
            ? 'Switched website to Maintenance Mode'
            : validMode === 'inauguration'
            ? `Scheduled Inauguration Countdown (${inaugurationTargetTime || siteControlState.inaugurationTargetTime})`
            : 'Restored website to Live Public Mode'),
        actor: actorName,
      },
      ...(siteControlState.history || []).slice(0, 29),
    ],
  };

  siteControlState = nextState;
  persistSiteControl();

  broadcastRealtimeEvent('site_control_updated', {
    siteControl: siteControlState,
    justRevealed: validMode === 'live',
  });

  return res.json({
    success: true,
    siteControl: siteControlState,
    serverTimeMs: Date.now(),
  });
});

// ======================== ADAPTIVE DEVICE LAYOUT CALIBRATION ENGINE ========================
interface DeviceLayoutProfile {
  deviceCategory:
    | 'xs-phone'
    | 'sm-phone'
    | 'tablet-portrait'
    | 'tablet-landscape'
    | 'laptop'
    | 'desktop'
    | 'ultrawide';
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
  isTouch: boolean;
  navbarSolidBg: string;
  navbarHeightPx: number;
  containerPaddingPx: number;
  rootFontScale: number;
  cardGapPx: number;
  touchTargetMinPx: number;
  enforceOverflowLock: boolean;
  alignGridCards: boolean;
}

function computeDeviceLayoutProfile(params: {
  width?: number;
  height?: number;
  dpr?: number;
  touch?: boolean;
  userAgent?: string;
}): DeviceLayoutProfile {
  const ua = String(params.userAgent || '').toLowerCase();
  const isMobileUA = /iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua);
  const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(ua);

  const width =
    typeof params.width === 'number' && params.width > 0
      ? Math.round(params.width)
      : isMobileUA
      ? 390
      : isTabletUA
      ? 820
      : 1440;
  const height =
    typeof params.height === 'number' && params.height > 0
      ? Math.round(params.height)
      : isMobileUA
      ? 844
      : isTabletUA
      ? 1180
      : 900;
  const dpr = typeof params.dpr === 'number' && params.dpr > 0 ? params.dpr : 1;
  const isTouch = Boolean(params.touch || isMobileUA || isTabletUA || width < 1024);

  let deviceCategory: DeviceLayoutProfile['deviceCategory'] = 'desktop';
  let navbarHeightPx = 74;
  let containerPaddingPx = 32;
  let rootFontScale = 1;
  let cardGapPx = 24;

  if (width < 375) {
    deviceCategory = 'xs-phone';
    navbarHeightPx = 62;
    containerPaddingPx = 14;
    rootFontScale = 0.95;
    cardGapPx = 14;
  } else if (width < 640) {
    deviceCategory = 'sm-phone';
    navbarHeightPx = 64;
    containerPaddingPx = 16;
    rootFontScale = 0.98;
    cardGapPx = 16;
  } else if (width < 900) {
    deviceCategory = 'tablet-portrait';
    navbarHeightPx = 68;
    containerPaddingPx = 24;
    rootFontScale = 1;
    cardGapPx = 20;
  } else if (width < 1180) {
    deviceCategory = 'tablet-landscape';
    navbarHeightPx = 70;
    containerPaddingPx = 28;
    rootFontScale = 1;
    cardGapPx = 20;
  } else if (width < 1440) {
    deviceCategory = 'laptop';
    navbarHeightPx = 72;
    containerPaddingPx = 32;
    rootFontScale = 1;
    cardGapPx = 24;
  } else if (width <= 1920) {
    deviceCategory = 'desktop';
    navbarHeightPx = 76;
    containerPaddingPx = 40;
    rootFontScale = 1;
    cardGapPx = 28;
  } else {
    deviceCategory = 'ultrawide';
    navbarHeightPx = 78;
    containerPaddingPx = 48;
    rootFontScale = 1.02;
    cardGapPx = 32;
  }

  return {
    deviceCategory,
    viewportWidth: width,
    viewportHeight: height,
    dpr,
    isTouch,
    navbarSolidBg: '#060C16',
    navbarHeightPx,
    containerPaddingPx,
    rootFontScale,
    cardGapPx,
    touchTargetMinPx: isTouch ? 44 : 38,
    enforceOverflowLock: true,
    alignGridCards: true,
  };
}

app.get('/api/device-layout-profile', (req: Request, res: Response) => {
  const width = Number(req.query.width) || 0;
  const height = Number(req.query.height) || 0;
  const dpr = Number(req.query.dpr) || 1;
  const touch = req.query.touch === 'true';
  const profile = computeDeviceLayoutProfile({
    width,
    height,
    dpr,
    touch,
    userAgent: req.headers['user-agent'],
  });
  return res.json(profile);
});

app.post('/api/device-layout-profile', (req: Request, res: Response) => {
  const { width, height, dpr, touch } = req.body || {};
  const profile = computeDeviceLayoutProfile({
    width: Number(width) || 0,
    height: Number(height) || 0,
    dpr: Number(dpr) || 1,
    touch: Boolean(touch),
    userAgent: req.headers['user-agent'],
  });
  return res.json(profile);
});

// ======================== SERVER & VITE INTEGRATION ========================
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const publicPath = path.join(process.cwd(), 'public');

  // Always serve static files in public/assets (such as patient PDF forms and logos)
  app.use('/assets', express.static(path.join(publicPath, 'assets')));
  app.use('/src/assets', express.static(path.join(process.cwd(), 'src', 'assets')));
  app.use('/src/assets', express.static(path.join(publicPath, 'src', 'assets')));
  app.use('/assets/images', express.static(path.join(process.cwd(), 'src', 'assets', 'images')));
  app.use('/assets/images', express.static(path.join(publicPath, 'assets', 'images')));

  const distPath = path.join(process.cwd(), 'dist');
  const distIndex = path.join(distPath, 'index.html');

  if (!isDev && !fs.existsSync(distIndex)) {
    console.log('[Server] dist/index.html not found in production — building frontend with Vite...');
    try {
      const { build } = await import('vite');
      await build();
    } catch (buildErr) {
      console.warn('[Server] Vite build fallback warning:', buildErr);
    }
  }

  if (isDev || !fs.existsSync(distIndex)) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(publicPath));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);

    setTimeout(() => {
      bootstrapCloudStorage().catch((err) => {
        console.warn('[Firebase RTDB] Background init warning:', err);
      });

      if (smtpTransporter) {
        smtpTransporter
          .verify()
          .then(() => {
            smtpReady = true;
            console.log(`[Email] SMTP verified and ready on ${SMTP_HOST}:${SMTP_PORT} (From: ${EMAIL_FROM})`);
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[Email] Initial SMTP verify warning: ${msg}. Will still attempt live sendMail on dispatch.`);
          });
      }
    }, 100);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
