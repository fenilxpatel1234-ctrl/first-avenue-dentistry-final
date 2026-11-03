import admin, { cert } from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import type { ServiceAccount } from 'firebase-admin';

let adminApp: admin.App | null = null;

function parseCredentials(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    // Decodes both raw JSON string and Base64-encoded string
    const trimmed = raw.trim();
    const json = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf-8');
    return JSON.parse(json) as ServiceAccount;
  } catch (err: any) {
    console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
    return null;
  }
}

export function initFirebase(): boolean {
  const url = process.env.FIREBASE_DATABASE_URL;
  const credentials = parseCredentials();

  if (!url || !credentials) {
    console.warn('[Firebase Admin] Credentials missing. Running in local-only fallback mode.');
    return false;
  }

  try {
    if (!adminApp) {
      adminApp = admin.initializeApp(
        {
          credential: cert(credentials),
          databaseURL: url,
        },
        'vantage-realtime-admin'
      );
      console.log('[Firebase Admin] Successfully connected to Realtime Database:', url);
    }
    return true;
  } catch (err: any) {
    console.error('[Firebase Admin] Initialization error:', err.message);
    return false;
  }
}

export function isFirebaseReady(): boolean {
  return adminApp !== null;
}

// Read any path from Firebase Realtime Database
export async function fbGet<T>(path: string): Promise<T | null> {
  if (!adminApp) return null;
  try {
    const snap = await getDatabase(adminApp).ref(path).once('value');
    return snap.val() as T | null;
  } catch (err: any) {
    console.error(`[Firebase Admin] Read failed at "${path}":`, err.message);
    return null;
  }
}

// Write/Overwrite any path in Firebase Realtime Database
export async function fbSet(path: string, value: unknown): Promise<void> {
  if (!adminApp) return;
  try {
    await getDatabase(adminApp).ref(path).set(value);
  } catch (err: any) {
    console.error(`[Firebase Admin] Write failed at "${path}":`, err.message);
  }
}
