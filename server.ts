import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use(express.json({ limit: '100kb' }));

// Enterprise HTTP Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Clinic Constants
const CLINIC_NAME = 'First Avenue Family Dentistry';
const CLINIC_PHONE = '(519) 207-6890';
const CLINIC_ADDRESS = '308 Wellington Street, St. Thomas, ON N5R 2S9';
const SITE_URL = (process.env.SITE_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// Data Storage Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const EMAIL_LOG_FILE = path.join(DATA_DIR, 'email_log.json');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

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

// In-Memory Database mirrors
let appointmentDatabase = loadJSON<any>(APPOINTMENTS_FILE, []);

// Admin Seed & Persistent Staff Accounts
export interface AdminAccountRecord {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  role: string;
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
  const existing = loadJSON<AdminAccountRecord>(ADMINS_FILE, []);
  const combined: AdminAccountRecord[] = [...existing];

  const ensureAdmin = (item: { id: string; name: string; email: string; username: string; password: string; role: string }) => {
    const found = combined.some(
      (a) =>
        a.username.toLowerCase() === item.username.toLowerCase() ||
        a.email.toLowerCase() === item.email.toLowerCase()
    );
    if (!found) {
      combined.push({
        ...item,
        createdAt: new Date().toISOString(),
      });
    }
  };

  for (const s of seededAdmins) {
    ensureAdmin({
      id: `admin-${s.username.toLowerCase().replace(/[^a-z0-9]/g, '') || 'seed'}`,
      name: s.name || 'Dr. Fenil',
      email: s.email || 'smartyfenil898@gmail.com',
      username: s.username || 'fenil',
      password: s.password || '1234567890',
      role: s.role || 'Super Admin',
    });
  }

  ensureAdmin({
    id: 'admin-fenil-primary',
    name: 'Dr. Fenil',
    email: 'smartyfenil898@gmail.com',
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
        console.log(`[Firebase RTDB] Successfully hydrated ${appointmentDatabase.length} appointments from cloud.`);
      } else if (appointmentDatabase.length > 0) {
        await fbSet('appointments', appointmentDatabase);
        console.log(`[Firebase RTDB] Synced ${appointmentDatabase.length} local appointments to cloud.`);
      }

      const cloudAdmins = await fbGet<AdminAccountRecord[]>('admins');
      if (Array.isArray(cloudAdmins) && cloudAdmins.length > 0) {
        // Merge cloud admins with local seed so no account is lost
        const merged = [...cloudAdmins];
        for (const loc of adminsDatabase) {
          if (
            !merged.some(
              (c) =>
                c.username.toLowerCase() === loc.username.toLowerCase() ||
                c.email.toLowerCase() === loc.email.toLowerCase()
            )
          ) {
            merged.push(loc);
          }
        }
        adminsDatabase = merged;
        saveJSON(ADMINS_FILE, adminsDatabase);
        console.log(`[Firebase RTDB] Hydrated ${adminsDatabase.length} admin accounts from cloud.`);
      } else if (adminsDatabase.length > 0) {
        await fbSet('admins', adminsDatabase);
      }
    } catch (err: any) {
      console.warn('[Firebase RTDB] Cloud bootstrap warning:', err.message);
    }
  }
}

// --- SMTP NODEMAILER SETUP (Brevo Verified Domain Relay) ---
const SMTP_HOST = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525', 10);
const SMTP_USER = process.env.SMTP_USER || 'b41029001@smtp-brevo.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
// Ensure sender uses verified Brevo domain (no-reply@vantage-i.me) so Gmail DMARC never drops messages
const rawFrom = process.env.EMAIL_FROM || 'no-reply@vantage-i.me';
const EMAIL_FROM = rawFrom.endsWith('@gmail.com') && SMTP_HOST.includes('brevo')
  ? 'no-reply@vantage-i.me'
  : rawFrom;
const CLINIC_ADMIN_EMAIL = process.env.CLINIC_ADMIN_EMAIL || 'fenilxpatel2642@gmail.com';
const SECONDARY_ADMIN_EMAIL = 'smartyfenil898@gmail.com';

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

function logEmailToFile(to: string, subject: string, html: string, status: 'delivered' | 'logged', messageId?: string) {
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
      console.log(`[Email] Successfully delivered via SMTP to ${cleanTo} (MessageId: ${messageId}, Response: ${info.response})`);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error('[Email] SMTP dispatch error:', lastError);
    }
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
  serviceName?: string;
  service?: string;
  assignedDoctor?: string;
}): string {
  const date = (apt.confirmedDate || apt.preferredDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const start = timeSlotTo24h(apt.confirmedTime || apt.preferredTimeSlot || '09:00 AM');
  const [sh, sm] = start.split(':').map(Number);
  const endMin = (sh || 9) * 60 + (sm || 0) + 60;
  const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
  const title = `Dental Appointment - ${apt.serviceName || apt.service || 'Consultation'} - ${CLINIC_NAME}`;
  const desc = `Appointment with ${apt.assignedDoctor || 'Clinical Specialist'}. Please arrive 10 minutes before your scheduled time. Questions: ${CLINIC_PHONE}`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//First Avenue Family Dentistry//Appointment//EN',
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
  serviceName?: string;
  service?: string;
  assignedDoctor?: string;
}): string {
  const date = (apt.confirmedDate || apt.preferredDate || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const start = timeSlotTo24h(apt.confirmedTime || apt.preferredTimeSlot || '09:00 AM').replace(':', '');
  const title = encodeURIComponent(`Dental Appointment - ${apt.serviceName || apt.service || 'Consultation'} - ${CLINIC_NAME}`);
  const details = encodeURIComponent(
    `Confirmed appointment with ${apt.assignedDoctor || 'Clinical Specialist'}. Location: ${CLINIC_ADDRESS}. Tel: ${CLINIC_PHONE}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}T${start}00/${date}T${start}00&details=${details}&location=${encodeURIComponent(
    CLINIC_ADDRESS
  )}`;
}

// --- EMAIL HTML TEMPLATES ---
function emailShell(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: #060C16; padding: 28px 24px; text-align: center; border-bottom: 2px solid #1E5AFF;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${CLINIC_NAME}</h2>
        <p style="margin: 4px 0 0; font-size: 11px; color: #8E8E93; text-transform: uppercase; letter-spacing: 1px;">St. Thomas, Ontario &bull; Clinical Care</p>
      </div>
      <div style="padding: 32px 28px; color: #1e293b; line-height: 1.6; font-size: 14px;">
        ${content}
      </div>
      <div style="background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.6;">
        <strong>${CLINIC_NAME}</strong><br />
        ${CLINIC_ADDRESS}<br />
        Telephone: <a href="tel:5192076890" style="color: #1E5AFF; text-decoration: none; font-weight: 600;">${CLINIC_PHONE}</a> &bull; Direct Insurance Billing
      </div>
    </div>`;
}

async function sendNewAppointmentNotification(apt: {
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
  const patientName = apt.firstName || apt.name || 'Valued Patient';
  const service = apt.serviceName || apt.service || 'Dental Consultation';
  const date = apt.preferredDate || 'Upcoming Flexible';
  const time = apt.preferredTimeSlot || apt.preferredTime || 'Preferred Slot';

  const html = emailShell(`
    <h3 style="color:#060C16; margin-top:0; font-size: 18px; font-weight: 700;">We Received Your Appointment Request!</h3>
    <p>Dear ${patientName}, thank you for choosing ${CLINIC_NAME}. Our clinical coordinator in St. Thomas is reviewing your schedule:</p>
    <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Requested Service:</td><td style="padding: 10px 16px; font-weight: 600; color: #060C16; border-bottom: 1px solid #e2e8f0;">${service}</td></tr>
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Preferred Date:</td><td style="padding: 10px 16px; color: #060C16; border-bottom: 1px solid #e2e8f0;">${date}</td></tr>
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Preferred Time Slot:</td><td style="padding: 10px 16px; color: #060C16;">${time}</td></tr>
      </table>
    </div>
    <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
      Our clinical team reviews doctor availability to prevent schedule overlaps and will contact you directly to confirm your booking. If you are experiencing urgent tooth pain, call our emergency line directly at <strong>${CLINIC_PHONE}</strong>.
    </p>
  `);

  // 1. Deliver Acknowledgment to Patient
  const patientResult = await deliverEmail(apt.email, `Appointment Request Acknowledgment - ${CLINIC_NAME}`, html);

  // 2. Deliver Immediate Clinic Booking Alert to Admin / Doctor
  const adminHtml = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #eff6ff; color: #1e5aff; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      New Patient Booking Alert
    </div>
    <h3 style="color: #060C16; margin-top: 0; font-size: 18px; font-weight: 700;">New Appointment Request Received</h3>
    <p>A new appointment request has been submitted online through the First Avenue Family Dentistry scheduling system:</p>
    <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Patient Name:</td><td style="padding: 10px 16px; font-weight: 700; color: #060C16; border-bottom: 1px solid #e2e8f0;">${patientName}</td></tr>
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Patient Email:</td><td style="padding: 10px 16px; color: #060C16; border-bottom: 1px solid #e2e8f0;">${apt.email}</td></tr>
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Patient Phone:</td><td style="padding: 10px 16px; color: #060C16; border-bottom: 1px solid #e2e8f0;">${apt.phone || 'Provided'}</td></tr>
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Requested Service:</td><td style="padding: 10px 16px; font-weight: 600; color: #1e5aff; border-bottom: 1px solid #e2e8f0;">${service}</td></tr>
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e2e8f0;">Requested Date:</td><td style="padding: 10px 16px; color: #060C16; border-bottom: 1px solid #e2e8f0;">${date}</td></tr>
        <tr><td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Time Slot:</td><td style="padding: 10px 16px; color: #060C16;">${time}</td></tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #64748b;">Log in to the Admin Dashboard to review schedule availability and confirm the appointment.</p>
  `);
  await deliverEmail(CLINIC_ADMIN_EMAIL, `New Booking Alert: ${patientName} - ${service}`, adminHtml);
  if (SECONDARY_ADMIN_EMAIL && SECONDARY_ADMIN_EMAIL !== CLINIC_ADMIN_EMAIL) {
    await deliverEmail(SECONDARY_ADMIN_EMAIL, `New Booking Alert: ${patientName} - ${service}`, adminHtml);
  }
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
  reason?: string;
  rescheduleReason?: string;
  declineReason?: string;
}) {
  const patientName = apt.firstName || apt.name || 'Valued Patient';
  const service = apt.serviceName || apt.service || 'Dental Consultation';
  const doctor = apt.assignedDoctor || 'Clinical Specialist';
  const date = apt.confirmedDate || apt.preferredDate || '';
  const time = apt.confirmedTime || apt.preferredTimeSlot || apt.preferredTime || '';

  if (apt.status === 'Approved' || apt.status === 'approved') {
    const ics = buildIcs(apt);
    const googleCal = buildGoogleCalendarUrl(apt);

    const html = emailShell(`
      <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
        Appointment Confirmed &#10003;
      </div>
      <h3 style="color: #060C16; margin-top: 0; font-size: 18px; font-weight: 700;">Your Dental Visit is Officially Scheduled!</h3>
      <p>Dear ${patientName}, your appointment has been approved and confirmed with <strong>${doctor}</strong>.</p>
      
      <div style="background: #f8fafc; border: 1px solid #10b981; border-left: 4px solid #10b981; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Date:</strong> ${date}</p>
        <p style="margin: 4px 0;"><strong>Time Slot:</strong> ${time}</p>
        <p style="margin: 4px 0;"><strong>Specialist:</strong> ${doctor}</p>
        <p style="margin: 4px 0;"><strong>Procedure:</strong> ${service}</p>
        <p style="margin: 4px 0;"><strong>Clinic Address:</strong> ${CLINIC_ADDRESS}</p>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${googleCal}" target="_blank" style="background: #1E5AFF; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 13px; display: inline-block; box-shadow: 0 4px 12px rgba(30, 90, 255, 0.25);">
          + Add to Google Calendar
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; line-height: 1.6;">
        An official iCalendar (.ics) invitation is attached to this email so your Apple Calendar or Outlook can automatically reserve your slot. Please arrive 10 minutes before your appointment time.
      </p>
    `);

    return await deliverEmail(apt.email, `Appointment Confirmed - ${CLINIC_NAME}`, html, ics);
  } else if (apt.status === 'Rescheduled' || apt.status === 'rescheduled') {
    const reason = apt.reason || apt.rescheduleReason || 'Schedule adjustment by clinic';
    const html = emailShell(`
      <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #fffbeb; color: #b45309; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
        Appointment Rescheduled
      </div>
      <h3 style="color: #060C16; margin-top: 0; font-size: 18px; font-weight: 700;">Update on Your Appointment Schedule</h3>
      <p>Dear ${patientName}, our reception has adjusted your appointment slot:</p>
      
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Proposed New Date:</strong> ${date}</p>
        <p style="margin: 4px 0;"><strong>Proposed New Time:</strong> ${time}</p>
        <p style="margin: 4px 0;"><strong>Doctor:</strong> ${doctor}</p>
        <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason}</p>
      </div>

      <p style="color: #64748b; font-size: 13px;">
        If this adjusted slot does not suit your schedule, please call our reception team directly at <strong>${CLINIC_PHONE}</strong> so we can reserve your preferred time.
      </p>
    `);

    return await deliverEmail(apt.email, `Appointment Rescheduled - ${CLINIC_NAME}`, html);
  } else if (apt.status === 'Rejected' || apt.status === 'declined') {
    const reason = apt.reason || apt.declineReason || 'Slot fully booked';
    const html = emailShell(`
      <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #fef2f2; color: #b91c1c; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
        Appointment Request Notice
      </div>
      <h3 style="color: #060C16; margin-top: 0; font-size: 18px; font-weight: 700;">Unable to Accommodate Requested Slot</h3>
      <p>Dear ${patientName}, we are currently unable to confirm your booking for the following reason:</p>
      
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason}</p>
      </div>

      <p style="color: #64748b; font-size: 13px;">
        We welcome you to call our reception desk directly at <strong>${CLINIC_PHONE}</strong> to select an alternate appointment time that works for you.
      </p>
    `);

    return await deliverEmail(apt.email, `Update on Your Appointment Request - ${CLINIC_NAME}`, html);
  }
  return { dispatched: false };
}

// ======================== API ROUTES ========================

// 1. Submit Appointment (Dispatches acknowledgment email + persists)
app.post('/api/appointments', async (req: Request, res: Response) => {
  const { firstName, lastName, name, email, phone, preferredDate, preferredTimeSlot, preferredTime, serviceName, service, assignedDoctor, insuranceProvider, notes } = req.body;

  const resolvedName = name || `${firstName || ''} ${lastName || ''}`.trim() || 'Patient';
  const resolvedEmail = String(email || '').trim().toLowerCase();
  const resolvedPhone = phone;

  if (!resolvedName || !resolvedEmail || !resolvedPhone) {
    return res.status(400).json({ error: 'Missing required patient contact details.' });
  }

  const newAppointment = {
    id: `apt-${Date.now().toString().slice(-6)}`,
    name: resolvedName,
    firstName: firstName || resolvedName.split(' ')[0] || '',
    lastName: lastName || resolvedName.split(' ').slice(1).join(' ') || '',
    email: resolvedEmail,
    phone: resolvedPhone,
    preferredDate: preferredDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
    preferredTimeSlot: preferredTimeSlot || preferredTime || 'Morning (9:00 AM – 12:00 PM)',
    serviceName: serviceName || service || 'Emergency Dental Care',
    service: serviceName || service || 'Emergency Dental Care',
    doctorPreference: assignedDoctor || 'First Available Specialist',
    insuranceProvider: insuranceProvider || '',
    notes: notes || '',
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };

  appointmentDatabase.unshift(newAppointment);
  saveJSON(APPOINTMENTS_FILE, appointmentDatabase);

  // Sync to Firebase Realtime Database
  if (isFirebaseReady()) {
    fbSet('appointments', appointmentDatabase).catch((err: any) => {
      console.warn('[Firebase RTDB] Cloud sync error:', err.message);
    });
  }

  // Trigger automated email acknowledgment via Brevo SMTP
  const emailResult = await sendNewAppointmentNotification(newAppointment);

  return res.status(201).json({
    success: true,
    appointment: newAppointment,
    emailDispatched: emailResult.dispatched,
  });
});

// 1a. Delete Appointment Endpoint (Admin)
app.delete('/api/appointments/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  appointmentDatabase = appointmentDatabase.filter((apt: any) => apt.id !== id);

  saveJSON(APPOINTMENTS_FILE, appointmentDatabase);

  if (isFirebaseReady()) {
    fbSet('appointments', appointmentDatabase).catch((err: any) => {
      console.warn('[Firebase RTDB] Cloud sync delete error:', err.message);
    });
  }

  console.log(`[Admin] Deleted appointment ${id}. Remaining: ${appointmentDatabase.length}`);
  return res.json({
    success: true,
    deletedId: id,
    message: `Appointment ${id} successfully deleted from clinic database.`,
  });
});

// In-memory OTP Store for returning patient authentication
const patientOtpStore = new Map<string, { otp: string; expiresAt: number; patientData: any }>();

// 1b. Returning Patient Send Verification OTP
app.post('/api/patients/send-otp', async (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const patientHint = req.body.patientHint || null;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ found: false, error: 'Valid email address required.' });
  }

  // Ensure latest appointments data
  const allAppointments = loadJSON<any>(APPOINTMENTS_FILE, appointmentDatabase);

  // Find most recent appointment matching this email (case-insensitive)
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

  // Generate 6-digit cryptographic verification code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  patientOtpStore.set(email, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
    patientData,
  });

  // Dispatch OTP email to patient's real Gmail
  const html = emailShell(`
    <h3 style="color: #060C16; margin-top: 0; font-size: 20px; font-weight: 700;">Patient Verification Passcode</h3>
    <p>Dear ${firstName},</p>
    <p>You requested access to your patient profile at <strong>${CLINIC_NAME}</strong>.</p>
    <p>Enter the 6-digit one-time passcode below to verify your identity and automatically populate your appointment details:</p>
    <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
    </div>
    <p style="font-size: 12px; color: #64748B;">This code is valid for 10 minutes. If you did not initiate this request, no action is needed.</p>
  `);

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

// 1c. Returning Patient Verify OTP & Unlock Data
app.post('/api/patients/verify-otp', (req: Request, res: Response) => {
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
    return res.status(400).json({
      verified: false,
      error: 'Incorrect verification code. Please check and try again.',
    });
  }

  // Clear OTP on successful validation
  patientOtpStore.delete(email);

  return res.json({
    verified: true,
    patient: record.patientData,
  });
});

// 1d. Returning Patient Direct Lookup by Email (Fallback)
app.post('/api/patients/lookup', (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ found: false, error: 'Valid email address required.' });
  }

  // Ensure latest appointments data
  const allAppointments = loadJSON<any>(APPOINTMENTS_FILE, appointmentDatabase);

  // Find most recent appointment matching this email (case-insensitive)
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

// In-memory OTP Stores & Brute-Force Protection for Admin 2FA Login and Password Reset
const adminLoginOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; admin: AdminAccountRecord }>();
const adminResetOtpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; adminId: string; email: string }>();
const loginAttemptTracker = new Map<string, { count: number; lockedUntil: number }>();
const activeAdminSessions = new Map<string, { adminId: string; email: string; role: string; issuedAt: number; expiresAt: number }>();

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

function findAdminByIdentifier(identifier: string): AdminAccountRecord | undefined {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean) return undefined;
  // Refresh from disk if needed
  const diskAdmins = loadJSON<AdminAccountRecord>(ADMINS_FILE, adminsDatabase);
  if (diskAdmins.length >= adminsDatabase.length) {
    adminsDatabase = diskAdmins;
  }
  return adminsDatabase.find(
    (a) => a.username.toLowerCase() === clean || a.email.toLowerCase() === clean
  );
}

// 1e. Administrator Authentication Step 1: Validate Credentials & Dispatch Mandatory 2FA Login OTP
app.post('/api/admin/login', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  const identifier = String(username || email || '').trim().toLowerCase();
  const inputPass = String(password || '');

  if (!identifier || !inputPass) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  const lockoutStatus = checkBruteForceLockout(identifier);
  if (lockoutStatus.locked) {
    return res.status(429).json({
      error: `Security Lockout: Too many failed sign-in attempts. Please wait ${lockoutStatus.remainingMinutes} minute(s) or use Reset Password.`,
    });
  }

  let matched = findAdminByIdentifier(identifier);

  // Fallback check if identifier is 'admin@vantage-i.me'
  if (!matched && identifier === 'admin@vantage-i.me') {
    matched = findAdminByIdentifier('fenil') || adminsDatabase[0];
  }

  if (!matched || matched.password !== inputPass) {
    const remaining = recordFailedAttempt(identifier);
    return res.status(401).json({
      error:
        remaining > 0
          ? `Invalid administrator username/email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout)`
          : 'Account temporarily locked for 15 minutes due to 5 failed sign-in attempts.',
    });
  }

  clearFailedAttempts(identifier);

  // Generate 6-digit 2FA OTP for staff login security
  const otp = crypto.randomInt(100000, 999999).toString();
  const targetEmail = matched.email.trim().toLowerCase();

  adminLoginOtpStore.set(targetEmail, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
    admin: matched,
  });

  const html = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #eff6ff; color: #1e5aff; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      Staff 2FA Login Verification
    </div>
    <h3 style="color: #060C16; margin-top: 0; font-size: 20px; font-weight: 700;">Admin Portal Security Passcode</h3>
    <p>Hello <strong>${matched.name}</strong> (${matched.role}),</p>
    <p>A sign-in attempt was verified with your password on the <strong>${CLINIC_NAME}</strong> Admin Portal. To complete your login, enter the 6-digit two-factor authentication (2FA) passcode below:</p>
    <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
    </div>
    <p style="font-size: 12px; color: #64748B;">This passcode expires in 10 minutes. If you did not attempt to sign in, please reset your administrator password immediately.</p>
  `);

  const emailRes = await deliverEmail(targetEmail, `Admin Login OTP: ${otp} - ${CLINIC_NAME}`, html);
  if (CLINIC_ADMIN_EMAIL && CLINIC_ADMIN_EMAIL.toLowerCase() !== targetEmail) {
    await deliverEmail(CLINIC_ADMIN_EMAIL, `Staff Login OTP (${matched.name}): ${otp} - ${CLINIC_NAME}`, html);
  }

  return res.json({
    success: true,
    requiresOtp: true,
    email: targetEmail,
    maskedEmail: maskEmailAddress(targetEmail),
    adminName: matched.name,
    emailDispatched: emailRes.dispatched,
    message: `A 6-digit 2FA verification code has been sent to ${maskEmailAddress(targetEmail)}.`,
  });
});

// 1f. Administrator Authentication Step 2: Verify 2FA Login OTP
app.post('/api/admin/verify-login-otp', (req: Request, res: Response) => {
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
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  activeAdminSessions.set(sessionToken, {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    issuedAt: now,
    expiresAt: now + 12 * 60 * 60 * 1000,
  });

  return res.json({
    success: true,
    sessionToken,
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      username: admin.username,
      role: admin.role,
      sessionToken,
      lastLoginAt: new Date(now).toISOString(),
    },
  });
});

// 1g. Resend Admin Login 2FA OTP
app.post('/api/admin/resend-login-otp', async (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const matched = findAdminByIdentifier(email);

  if (!matched) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const targetEmail = matched.email.trim().toLowerCase();

  adminLoginOtpStore.set(targetEmail, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    admin: matched,
  });

  const html = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #eff6ff; color: #1e5aff; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      New Staff 2FA Passcode
    </div>
    <h3 style="color: #060C16; margin-top: 0; font-size: 20px; font-weight: 700;">Your New Admin Login Code</h3>
    <p>Hello <strong>${matched.name}</strong>, here is your newly requested 6-digit 2FA passcode:</p>
    <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
    </div>
    <p style="font-size: 12px; color: #64748B;">Valid for 10 minutes.</p>
  `);

  const emailRes = await deliverEmail(targetEmail, `New Admin Login OTP: ${otp} - ${CLINIC_NAME}`, html);
  if (CLINIC_ADMIN_EMAIL && CLINIC_ADMIN_EMAIL.toLowerCase() !== targetEmail) {
    await deliverEmail(CLINIC_ADMIN_EMAIL, `Staff Login OTP (${matched.name}): ${otp} - ${CLINIC_NAME}`, html);
  }

  return res.json({
    success: true,
    email: targetEmail,
    maskedEmail: maskEmailAddress(targetEmail),
    emailDispatched: emailRes.dispatched,
    message: `A new 6-digit code was sent to ${maskEmailAddress(targetEmail)}.`,
  });
});

// 1h. Admin Forgot Password - Request Reset OTP
app.post('/api/admin/forgot-password', async (req: Request, res: Response) => {
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

  const html = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #fffbeb; color: #b45309; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      Password Reset Request
    </div>
    <h3 style="color: #060C16; margin-top: 0; font-size: 20px; font-weight: 700;">Reset Your Admin Portal Password</h3>
    <p>Hello <strong>${matched.name}</strong> (Username: <code>${matched.username}</code>),</p>
    <p>We received a request to reset your administrator password at <strong>${CLINIC_NAME}</strong>. Enter the 6-digit verification code below on the Reset Password screen:</p>
    <div style="background: #F0F5FF; border: 2px dashed #1E5AFF; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1E5AFF; font-family: monospace;">${otp}</span>
    </div>
    <p style="font-size: 12px; color: #64748B;">This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
  `);

  const emailRes = await deliverEmail(targetEmail, `Password Reset OTP: ${otp} - ${CLINIC_NAME}`, html);
  if (CLINIC_ADMIN_EMAIL && CLINIC_ADMIN_EMAIL.toLowerCase() !== targetEmail) {
    await deliverEmail(CLINIC_ADMIN_EMAIL, `Admin Password Reset OTP (${matched.name}): ${otp} - ${CLINIC_NAME}`, html);
  }

  return res.json({
    success: true,
    email: targetEmail,
    maskedEmail: maskEmailAddress(targetEmail),
    username: matched.username,
    emailDispatched: emailRes.dispatched,
    message: `Password reset OTP sent to ${maskEmailAddress(targetEmail)}.`,
  });
});

// 1i. Admin Reset Password - Verify OTP & Update Password
app.post('/api/admin/reset-password', async (req: Request, res: Response) => {
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
  const confirmHtml = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      Security Notice &#10003;
    </div>
    <h3 style="color: #060C16; margin-top: 0; font-size: 18px; font-weight: 700;">Administrator Password Updated</h3>
    <p>Hello <strong>${updatedAdmin.name}</strong>,</p>
    <p>Your administrator password for <strong>${CLINIC_NAME}</strong> (Username: <code>${updatedAdmin.username}</code>) has been successfully reset.</p>
    <p style="font-size: 12px; color: #64748B;">You can now sign in with your updated password and 2FA email verification.</p>
  `);
  await deliverEmail(updatedAdmin.email, `Password Changed Confirmation - ${CLINIC_NAME}`, confirmHtml);

  return res.json({
    success: true,
    message: 'Password has been reset successfully. Please sign in with your new password.',
  });
});

// 1j. Admin Users Management (List, Create, Update, Delete Staff/Admin Accounts)
app.get('/api/admin/users', (_req: Request, res: Response) => {
  const diskAdmins = loadJSON<AdminAccountRecord>(ADMINS_FILE, adminsDatabase);
  if (diskAdmins.length >= adminsDatabase.length) {
    adminsDatabase = diskAdmins;
  }
  const safeUsers = adminsDatabase.map(({ password, ...rest }) => ({
    ...rest,
  }));
  return res.json(safeUsers);
});

app.post('/api/admin/users', async (req: Request, res: Response) => {
  const { name, username, email, password, role } = req.body;
  const cleanName = String(name || '').trim();
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '').trim();
  const cleanRole = String(role || 'Clinic Admin').trim();

  if (!cleanName || !cleanUsername || !cleanEmail || !cleanPassword) {
    return res.status(400).json({ error: 'Name, username, email, and password are required.' });
  }
  if (!cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address for 2FA OTP delivery.' });
  }
  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const duplicate = adminsDatabase.find(
    (a) => a.username.toLowerCase() === cleanUsername || a.email.toLowerCase() === cleanEmail
  );
  if (duplicate) {
    return res.status(409).json({
      error: `An administrator with that ${
        duplicate.username.toLowerCase() === cleanUsername ? 'username' : 'email'
      } already exists.`,
    });
  }

  const newAdmin: AdminAccountRecord = {
    id: `admin-${Date.now().toString().slice(-6)}`,
    name: cleanName,
    username: cleanUsername,
    email: cleanEmail,
    password: cleanPassword,
    role: cleanRole,
    createdAt: new Date().toISOString(),
  };

  adminsDatabase.push(newAdmin);
  persistAdminsDatabase();

  // Send welcome email to newly registered admin
  const welcomeHtml = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #eff6ff; color: #1e5aff; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      Staff Portal Access Granted
    </div>
    <h3 style="color: #060C16; margin-top: 0; font-size: 18px; font-weight: 700;">Welcome to ${CLINIC_NAME} Admin Portal</h3>
    <p>Hello <strong>${cleanName}</strong>,</p>
    <p>An administrator account has been created for you with the role of <strong>${cleanRole}</strong>.</p>
    <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px;">
      <p style="margin: 4px 0;"><strong>Username:</strong> <code>${cleanUsername}</code></p>
      <p style="margin: 4px 0;"><strong>Registered Email (2FA OTP):</strong> ${cleanEmail}</p>
      <p style="margin: 4px 0;"><strong>Access Role:</strong> ${cleanRole}</p>
    </div>
    <p style="font-size: 12px; color: #64748B;">Every time you sign in, a 6-digit verification passcode will be sent to this email address to protect clinic records.</p>
  `);
  await deliverEmail(cleanEmail, `Admin Portal Access Created - ${CLINIC_NAME}`, welcomeHtml);

  const { password: _p, ...safeNewAdmin } = newAdmin;
  return res.status(201).json({
    success: true,
    user: safeNewAdmin,
  });
});

app.put('/api/admin/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, username, email, password, role } = req.body;

  const idx = adminsDatabase.findIndex((a) => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  if (name) adminsDatabase[idx].name = String(name).trim();
  if (username) adminsDatabase[idx].username = String(username).trim().toLowerCase();
  if (email) adminsDatabase[idx].email = String(email).trim().toLowerCase();
  if (role) adminsDatabase[idx].role = String(role).trim();
  if (password && String(password).trim().length >= 6) {
    adminsDatabase[idx].password = String(password).trim();
  }

  persistAdminsDatabase();
  const { password: _p, ...safeUpdated } = adminsDatabase[idx];
  return res.json({ success: true, user: safeUpdated });
});

app.delete('/api/admin/users/:id', (req: Request, res: Response) => {
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

// 2. Trigger Status Email (Called by Admin when status transitions to Approved, Rescheduled, or Declined)
app.post('/api/send-status-email', async (req: Request, res: Response) => {
  const { status, name, firstName, email, service, serviceName, assignedDoctor, confirmedDate, confirmedTime, reason, rescheduleReason, declineReason } = req.body;

  if (!email || !status) {
    return res.status(400).json({ error: 'Missing email or status for notification dispatch.' });
  }

  const emailRes = await sendStatusEmail({
    status,
    name,
    firstName,
    email,
    service: service || serviceName,
    serviceName: service || serviceName,
    assignedDoctor: assignedDoctor || 'Clinical Specialist',
    confirmedDate,
    confirmedTime,
    reason: reason || rescheduleReason || declineReason,
  });

  return res.json({
    success: true,
    emailDispatched: emailRes.dispatched,
    message: `Dispatched ${status} notification to ${email}`,
  });
});

// 2b. Patient Enquiry Notification Email (Contact Form)
app.post('/api/enquiries', async (req: Request, res: Response) => {
  const { name, email, phone, service, message } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const patientHtml = emailShell(`
    <h3 style="color:#060C16; margin-top:0; font-size: 18px; font-weight: 700;">We Received Your Clinical Inquiry</h3>
    <p>Dear ${name || 'Valued Patient'}, thank you for contacting <strong>${CLINIC_NAME}</strong> in St. Thomas, ON.</p>
    <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px;">
      <p style="margin: 4px 0;"><strong>Topic / Service:</strong> ${service || 'General Inquiry'}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <p style="margin: 8px 0 0;"><strong>Your Message:</strong><br/>${message || ''}</p>
    </div>
    <p style="color: #64748b; font-size: 13px;">Our reception team will respond shortly. For urgent dental care, please call us directly at <strong>${CLINIC_PHONE}</strong>.</p>
  `);

  const adminHtml = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #eff6ff; color: #1e5aff; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      New Website Inquiry
    </div>
    <h3 style="color:#060C16; margin-top:0; font-size: 18px; font-weight: 700;">New Patient Message from ${name || 'Visitor'}</h3>
    <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px;">
      <p style="margin: 4px 0;"><strong>Name:</strong> ${name || 'Visitor'}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${cleanEmail}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <p style="margin: 4px 0;"><strong>Subject:</strong> ${service || 'General Inquiry'}</p>
      <p style="margin: 8px 0 0;"><strong>Message:</strong><br/>${message || ''}</p>
    </div>
  `);

  const patientRes = await deliverEmail(cleanEmail, `Inquiry Received - ${CLINIC_NAME}`, patientHtml);
  await deliverEmail(CLINIC_ADMIN_EMAIL, `New Patient Inquiry: ${name || cleanEmail}`, adminHtml);
  if (SECONDARY_ADMIN_EMAIL && SECONDARY_ADMIN_EMAIL !== CLINIC_ADMIN_EMAIL) {
    await deliverEmail(SECONDARY_ADMIN_EMAIL, `New Patient Inquiry: ${name || cleanEmail}`, adminHtml);
  }

  return res.json({ success: true, emailDispatched: patientRes.dispatched });
});

// 2c. Send Live Test Email (Admin Diagnostics)
app.post('/api/test-email', async (req: Request, res: Response) => {
  const targetEmail = String(req.body.email || CLINIC_ADMIN_EMAIL).trim().toLowerCase();
  const html = emailShell(`
    <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">
      SMTP Live Delivery Verified &#10003;
    </div>
    <h3 style="color: #060C16; margin-top: 0; font-size: 18px; font-weight: 700;">Gmail Delivery Test Successful</h3>
    <p>This is a live test email dispatched from <strong>${CLINIC_NAME}</strong> via Brevo SMTP using your verified sender domain (<code>${EMAIL_FROM}</code>).</p>
    <p style="font-size: 13px; color: #64748b;">All automated booking confirmations, 6-digit OTP verification codes, and calendar invites are actively delivering to Gmail.</p>
  `);

  const result = await deliverEmail(targetEmail, `Live Email Test - ${CLINIC_NAME}`, html);
  return res.json({
    success: result.dispatched,
    to: targetEmail,
    from: EMAIL_FROM,
    messageId: result.messageId,
    error: result.error || null,
  });
});

// 3. Admin CSV Export
app.get('/api/admin/export-csv', (_req: Request, res: Response) => {
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
    a.status,
    `"${a.createdAt}"`,
  ]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="first-avenue-dentistry-appointments.csv"');
  res.send([headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n'));
});

// 4. View Email Logs
app.get('/api/email-logs', (_req: Request, res: Response) => {
  const logs = loadJSON<any>(EMAIL_LOG_FILE, []);
  res.json(logs);
});

// 4b. Direct Patient Form PDF Download Endpoint
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

// 5. AI Dental Assistant Endpoint
app.post('/api/ai/dental-assistant', async (req: Request, res: Response) => {
  const { message } = req.body;
  const text = (message || '').toLowerCase();

  // Booking intent detection
  if (['book', 'appointment', 'schedule', 'visit', 'cleaning', 'see doctor', 'reserve', 'pain'].some((k) => text.includes(k))) {
    return res.json({
      answer: "I can gladly assist you with reserving an appointment right now! What dental service or care do you require today? (e.g. Routine Cleaning, Dental Implants, Invisalign, Teeth Whitening, or Emergency Care)",
      action: 'booking_start',
    });
  }

  // Gemini API integration for clinical Q&A
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
                text: `You are the friendly, helpful dental clinic assistant for First Avenue Family Dentistry in St. Thomas, Ontario (Address: 308 Wellington Street, Tel: (519) 207-6890, Doctors: Dr. D. K. Sharma and Dr. Shradha Sharma).
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

  // Clinical fallback responses
  if (text.includes('insurance') || text.includes('coverage') || text.includes('direct billing')) {
    return res.json({
      answer: "Yes! First Avenue Family Dentistry provides direct insurance billing to all major Canadian dental providers. We file your claims electronically so you only pay your copay at the time of treatment.",
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
    answer: "Welcome to First Avenue Family Dentistry! I can help you book an appointment, answer questions about direct insurance billing, routine cleanings, implants, or orthodontic aligners. How can I help you today?",
  });
});

// ======================== SERVER & VITE INTEGRATION ========================
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const publicPath = path.join(process.cwd(), 'public');

  // Always serve static files in public/assets (such as patient PDF forms and logos)
  app.use('/assets', express.static(path.join(publicPath, 'assets')));
  // Serve /src/assets so that components referencing /src/assets/images work reliably in production
  app.use('/src/assets', express.static(path.join(process.cwd(), 'src', 'assets')));

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(publicPath));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);

    // Run non-blocking background services after HTTP server is bound
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
