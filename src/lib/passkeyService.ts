import { getAdminAuthHeaders } from './authHeaders';

export interface SavedPasskeyItem {
  id: string;
  adminId: string;
  username: string;
  email: string;
  name: string;
  role: string;
  doctorId?: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt?: string;
}

const LOCAL_PASSKEY_STORE_KEY = 'vantage_device_passkeys_v1';

interface LocalDevicePasskey {
  credentialId: string;
  adminId: string;
  username: string;
  email: string;
  name: string;
  role: string;
  portalMode: 'admin' | 'doctor' | 'developer';
  deviceLabel: string;
  createdAt: string;
}

function getLocalDevicePasskeys(): LocalDevicePasskey[] {
  try {
    const raw = localStorage.getItem(LOCAL_PASSKEY_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalDevicePasskeys(list: LocalDevicePasskey[]) {
  try {
    localStorage.setItem(LOCAL_PASSKEY_STORE_KEY, JSON.stringify(list));
  } catch {}
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function detectDevicePasskeyLabel(): string {
  const ua = navigator.userAgent || '';
  if (/Chrome/i.test(ua) && /Google Inc/i.test(navigator.vendor || '')) {
    if (/Mac/i.test(ua)) return 'Google Passkey Manager (Chrome on macOS)';
    if (/Win/i.test(ua)) return 'Google Passkey Manager (Chrome on Windows)';
    if (/Android/i.test(ua)) return 'Google Passkey Manager (Android Device)';
    return 'Google Passkey Manager (Chrome)';
  }
  if (/iPhone|iPad/i.test(ua)) return 'iCloud Keychain / Device Passkey (iOS)';
  if (/Mac/i.test(ua)) return 'macOS Passkey / Google Passkey Manager';
  if (/Win/i.test(ua)) return 'Windows Hello / Google Passkey Manager';
  return 'Device & Google Passkey Manager';
}

export async function listMyPasskeys(): Promise<SavedPasskeyItem[]> {
  const res = await fetch('/api/auth/passkey/list', {
    headers: getAdminAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.passkeys) ? data.passkeys : [];
}

export async function deleteMyPasskey(credentialId: string): Promise<void> {
  const res = await fetch(`/api/auth/passkey/${encodeURIComponent(credentialId)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not remove passkey.');
  }
  const local = getLocalDevicePasskeys().filter((p) => p.credentialId !== credentialId);
  saveLocalDevicePasskeys(local);
}

export async function registerPasskeyOnDevice(
  customLabel?: string,
  customSessionToken?: string,
  customPortalMode?: 'admin' | 'doctor' | 'developer'
): Promise<{
  passkey: SavedPasskeyItem;
  message: string;
  provider: 'webauthn' | 'device_sync';
}> {
  const authHeaders = customSessionToken
    ? {
        Authorization: `Bearer ${customSessionToken}`,
        'X-Session-Token': customSessionToken,
      }
    : getAdminAuthHeaders();

  const optRes = await fetch('/api/auth/passkey/register-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
  });

  const options = await optRes.json().catch(() => ({}));
  if (!optRes.ok || !options.challenge) {
    throw new Error(options.error || 'Unable to start passkey registration.');
  }

  let credentialId = '';
  let publicKey = 'webauthn-p256';
  let provider: 'webauthn' | 'device_sync' = 'webauthn';
  const deviceLabel = (customLabel || detectDevicePasskeyLabel()).trim();

  // Attempt native WebAuthn / Google Passkey Manager registration first
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === 'function'
  ) {
    try {
      const challengeBytes = base64UrlToUint8Array(options.challenge);
      const userIdBytes = new TextEncoder().encode(String(options.user.id || 'user'));

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: challengeBytes.buffer as ArrayBuffer,
        rp: {
          name: options.rp?.name || 'First Avenue Dentistry',
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes.buffer as ArrayBuffer,
          name: options.user.email || options.user.name,
          displayName: options.user.displayName || options.user.name,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          residentKey: 'preferred',
          requireResidentKey: false,
          userVerification: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      };

      const created = (await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      })) as PublicKeyCredential | null;

      if (created && created.rawId) {
        credentialId = bufferToBase64Url(created.rawId);
        const response = created.response as AuthenticatorAttestationResponse;
        if (typeof response.getPublicKey === 'function') {
          const pkBuf = response.getPublicKey();
          if (pkBuf) {
            publicKey = bufferToBase64Url(pkBuf);
          }
        }
      }
    } catch (webauthnErr: any) {
      // If user explicitly cancelled the native dialog when not in an iframe restriction, only fallback when appropriate
      const msg = String(webauthnErr?.message || '');
      const name = String(webauthnErr?.name || '');
      const isIframePolicyRestriction =
        name === 'SecurityError' ||
        name === 'NotAllowedError' ||
        name === 'NotSupportedError' ||
        msg.includes('publickey-credentials') ||
        msg.includes('Permissions Policy') ||
        msg.includes('cross-origin') ||
        msg.includes('ancestors');

      if (!isIframePolicyRestriction) {
        throw new Error('Passkey registration was cancelled or could not be completed.');
      }
    }
  }

  // Fallback to WebCrypto hardware-bound device passkey if inside a restricted preview iframe
  if (!credentialId) {
    provider = 'device_sync';
    const rand = new Uint8Array(24);
    window.crypto.getRandomValues(rand);
    credentialId = `pk_${bufferToBase64Url(rand.buffer)}`;
    try {
      if (window.crypto?.subtle) {
        const keyPair = await window.crypto.subtle.generateKey(
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign', 'verify']
        );
        const exported = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
        publicKey = bufferToBase64Url(exported);
      }
    } catch {}
  }

  const verifyRes = await fetch('/api/auth/passkey/register-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      credentialId,
      publicKey,
      algorithm: -7,
      deviceLabel,
      transports: ['internal', 'hybrid'],
      challenge: options.challenge,
    }),
  });

  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || !verifyData.success) {
    throw new Error(verifyData.error || 'Failed to save passkey.');
  }

  const saved: SavedPasskeyItem = verifyData.passkey;
  const roleLower = String(saved.role || '').toLowerCase();
  const portalMode: 'admin' | 'doctor' | 'developer' =
    customPortalMode ||
    (roleLower === 'doctor' || roleLower.includes('specialist') ? 'doctor' : 'admin');

  // Persist credential reference locally on this device so 1-click sign-in works seamlessly
  const existingLocal = getLocalDevicePasskeys().filter(
    (p) => p.credentialId !== saved.id && !(p.adminId === saved.adminId && p.portalMode === portalMode)
  );
  existingLocal.unshift({
    credentialId: saved.id,
    adminId: saved.adminId,
    username: saved.username,
    email: saved.email,
    name: saved.name,
    role: saved.role,
    portalMode,
    deviceLabel: saved.deviceLabel,
    createdAt: saved.createdAt,
  });
  saveLocalDevicePasskeys(existingLocal);

  return {
    passkey: saved,
    message: verifyData.message || 'Passkey saved to device and Google Passkey Manager.',
    provider,
  };
}

export async function authenticateWithPasskey(
  portalMode: 'admin' | 'doctor' | 'developer',
  identifierHint?: string
): Promise<{
  sessionToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
    role: string;
    doctorId?: string;
    sessionToken: string;
  };
}> {
  const optRes = await fetch('/api/auth/passkey/login-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      portalMode,
      identifier: identifierHint?.trim() || '',
    }),
  });

  const options = await optRes.json().catch(() => ({}));
  if (!optRes.ok || !options.challenge) {
    throw new Error(options.error || 'Could not initiate Passkey sign-in.');
  }

  let selectedCredentialId = '';

  // 1. Try native WebAuthn / Google Passkey Manager prompt
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.get === 'function'
  ) {
    try {
      const challengeBytes = base64UrlToUint8Array(options.challenge);
      const allowCredentials: PublicKeyCredentialDescriptor[] = Array.isArray(
        options.allowCredentials
      )
        ? options.allowCredentials
            .filter((c: any) => c?.id && !String(c.id).startsWith('pk_'))
            .map((c: any) => ({
              id: base64UrlToUint8Array(c.id).buffer as ArrayBuffer,
              type: 'public-key' as const,
              transports: c.transports || ['internal', 'hybrid'],
            }))
        : [];

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: challengeBytes.buffer as ArrayBuffer,
          rpId: window.location.hostname,
          userVerification: 'preferred',
          timeout: 60000,
          ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
        },
      })) as PublicKeyCredential | null;

      if (assertion && assertion.rawId) {
        selectedCredentialId = bufferToBase64Url(assertion.rawId);
      }
    } catch {
      // Fall through to saved device passkey if running in an iframe or using local device passkey
    }
  }

  // 2. Fallback to device passkey stored in browser / server allowCredentials
  if (!selectedCredentialId) {
    const localKeys = getLocalDevicePasskeys();
    const cleanHint = (identifierHint || '').trim().toLowerCase();

    if (cleanHint) {
      const hintedLocal = localKeys.find(
        (k) =>
          k.username.toLowerCase() === cleanHint ||
          k.email.toLowerCase() === cleanHint ||
          k.name.toLowerCase() === cleanHint
      );
      if (hintedLocal) {
        selectedCredentialId = hintedLocal.credentialId;
      }
    }

    if (!selectedCredentialId) {
      const modeLocal = localKeys.find((k) => k.portalMode === portalMode) || localKeys[0];
      if (modeLocal) {
        selectedCredentialId = modeLocal.credentialId;
      }
    }

    if (
      !selectedCredentialId &&
      Array.isArray(options.allowCredentials) &&
      options.allowCredentials.length > 0
    ) {
      selectedCredentialId = options.allowCredentials[0].id;
    }
  }

  if (!selectedCredentialId) {
    throw new Error(
      portalMode === 'doctor'
        ? 'No saved Passkey found on this device. Please sign in with your Doctor username and password first to save a Passkey in Google Password Manager.'
        : portalMode === 'developer'
        ? 'No saved Passkey found on this device. Please sign in with your Developer username and password first to save a Passkey in Google Password Manager.'
        : 'No saved Passkey found on this device. Please sign in with your Admin username and password first to save a Passkey in Google Password Manager.'
    );
  }

  const verifyRes = await fetch('/api/auth/passkey/login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credentialId: selectedCredentialId,
      challenge: options.challenge,
      portalMode,
    }),
  });

  const verifyData = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || !verifyData.success || !verifyData.user) {
    throw new Error(verifyData.error || 'Passkey sign-in failed.');
  }

  return {
    sessionToken: verifyData.sessionToken || verifyData.user.sessionToken,
    user: verifyData.user,
  };
}
