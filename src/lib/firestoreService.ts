import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { getAdminAuthHeaders } from './authHeaders';
import type {
  Appointment,
  Enquiry,
  Doctor,
  Review,
  ActivityLog,
  PracticeSettings,
  AppointmentStatus,
} from '../types/admin';
import {
  DoctorAvailabilityRecord,
  SlotDurationMinutes,
  ComputedTimeSlot,
  TemporarySlotReservation,
  DateSpecificAvailability,
  DAY_NAMES,
  generateTimeSlotsFromWindow,
  format24hTo12h,
} from '../types/scheduling';

// ======================== REAL-TIME SERVER-SENT EVENTS SUBSCRIPTION ========================
export function subscribeToRealtimeClinicEvents(
  onEvent: (event: { type: string; timestamp?: string; [key: string]: any }) => void
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    try {
      es = new EventSource('/api/realtime/stream');
      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          onEvent(parsed);
        } catch {}
      };
      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    } catch {}
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (es) es.close();
  };
}

// ======================== 1. APPOINTMENTS (ATOMIC + DUAL-SYNCED) ========================
export async function submitAppointmentRequest(
  data: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'history'> & {
    sessionId?: string;
    reservationId?: string;
  }
): Promise<string> {
  const collectionPath = 'appointments';
  const now = new Date().toISOString();

  // 1. First execute atomic backend validation & 5-minute reservation conversion
  const apiRes = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: data.firstName,
      lastName: data.lastName,
      name: data.name,
      email: data.email,
      phone: data.phone,
      preferredDate: data.preferredDate,
      preferredTime: data.preferredTime,
      preferredTimeSlot: data.preferredTime,
      service: data.service,
      serviceName: data.service,
      reason: data.reason || data.notes || data.service,
      doctorId: data.doctorId,
      assignedDoctor: data.assignedDoctor,
      doctorPreference: data.assignedDoctor,
      insuranceProvider: data.insuranceProvider,
      notes: data.notes,
      sessionId: data.sessionId,
      reservationId: data.reservationId,
    }),
  });

  const apiJson = await apiRes.json().catch(() => ({}));
  if (!apiRes.ok) {
    throw new Error(apiJson.error || 'Unable to reserve this appointment slot.');
  }

  const createdApt: Appointment = apiJson.appointment;

  // 2. Persist non-blockingly to Firestore with the same document ID so all portals stay in sync
  void (async () => {
    try {
      const aptDocRef = doc(db, collectionPath, createdApt.id);
      await setDoc(
        aptDocRef,
        {
          name: createdApt.name || '',
          firstName: createdApt.firstName || '',
          lastName: createdApt.lastName || '',
          phone: createdApt.phone || '',
          email: createdApt.email || '',
          service: createdApt.service || 'Dental Consultation',
          reason: createdApt.reason || createdApt.notes || createdApt.service || '',
          preferredDate: createdApt.preferredDate || '',
          preferredTime: createdApt.preferredTime || '',
          notes: createdApt.notes || '',
          insuranceProvider: createdApt.insuranceProvider || '',
          status: 'pending' as AppointmentStatus,
          doctorId: createdApt.doctorId || '',
          assignedDoctor: createdApt.assignedDoctor || 'Unassigned',
          confirmedDate: '',
          confirmedTime: '',
          durationMinutes: createdApt.durationMinutes || 30,
          reservationId: createdApt.reservationId || '',
          adminNotes: '',
          declineReason: '',
          rescheduleReason: '',
          history: createdApt.history || [
            {
              status: 'pending' as AppointmentStatus,
              timestamp: now,
              note: `Booked online for ${createdApt.assignedDoctor} (${createdApt.preferredDate} at ${createdApt.preferredTime})`,
            },
          ],
          createdAt: createdApt.createdAt || now,
          updatedAt: createdApt.updatedAt || now,
        },
        { merge: true }
      );

      await addDoc(collection(db, 'activity_logs'), {
        adminEmail: 'patient-portal@firstavenuedentistry.ca',
        action: 'New Appointment Requested',
        details: `${createdApt.name} booked ${createdApt.service} with ${createdApt.assignedDoctor} for ${createdApt.preferredDate} (${createdApt.preferredTime})`,
        targetId: createdApt.id,
        targetType: 'appointment',
        timestamp: now,
      });
    } catch {}
  })();

  return createdApt.id;
}

function normalizeAppointmentRecord(raw: any, fallbackId?: string): Appointment {
  const fullName = String(
    raw?.name || `${raw?.firstName || ''} ${raw?.lastName || ''}`.trim() || 'Patient'
  ).trim();
  const rawStatus = String(raw?.status || 'pending').trim().toLowerCase();
  const status: AppointmentStatus = (
    ['pending', 'approved', 'rescheduled', 'declined', 'expired'].includes(rawStatus)
      ? rawStatus
      : rawStatus === 'rejected'
      ? 'declined'
      : 'pending'
  ) as AppointmentStatus;

  return {
    ...raw,
    id: String(raw?.id || fallbackId || `apt-${Date.now()}`),
    name: fullName || 'Patient',
    email: String(raw?.email || '').trim(),
    phone: String(raw?.phone || '').trim(),
    service: String(raw?.service || raw?.serviceName || raw?.reason || 'Dental Consultation').trim(),
    preferredDate: String(raw?.preferredDate || raw?.confirmedDate || '').trim(),
    preferredTime: String(
      raw?.preferredTime || raw?.preferredTimeSlot || raw?.confirmedTime || '09:00 AM'
    ).trim(),
    assignedDoctor: String(raw?.assignedDoctor || raw?.doctorPreference || 'Unassigned').trim(),
    status,
    notes: String(raw?.notes || ''),
    createdAt: String(raw?.createdAt || new Date().toISOString()),
    updatedAt: String(raw?.updatedAt || raw?.createdAt || new Date().toISOString()),
  };
}

export function subscribeToAppointments(
  onUpdate: (appointments: Appointment[]) => void,
  onError?: (error: Error) => void
) {
  const collectionPath = 'appointments';
  const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'));

  let latestFirestore: Appointment[] = [];

  const mergeWithBackend = async () => {
    try {
      const res = await fetch('/api/appointments', {
        headers: getAdminAuthHeaders(),
      });
      if (res.ok) {
        const backendList: any[] = await res.json();
        const byId = new Map<string, Appointment>();
        for (const item of latestFirestore) {
          const norm = normalizeAppointmentRecord(item, item.id);
          byId.set(norm.id, norm);
        }
        for (const bItem of backendList) {
          const normB = normalizeAppointmentRecord(bItem, bItem?.id);
          const existing = byId.get(normB.id);
          if (
            !existing ||
            new Date(normB.updatedAt || normB.createdAt || 0) >=
              new Date(existing.updatedAt || existing.createdAt || 0)
          ) {
            byId.set(normB.id, normB);
          }
        }
        const combined = Array.from(byId.values()).sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        onUpdate(combined);
        return;
      }
    } catch {}
    onUpdate(latestFirestore.map((item) => normalizeAppointmentRecord(item, item.id)));
  };

  const unsubFs = onSnapshot(
    q,
    (snapshot) => {
      latestFirestore = snapshot.docs.map((docSnap) =>
        normalizeAppointmentRecord(docSnap.data(), docSnap.id)
      );
      mergeWithBackend();
    },
    (error) => {
      if (onError) onError(error);
      mergeWithBackend();
    }
  );

  const unsubSse = subscribeToRealtimeClinicEvents((ev) => {
    if (
      ev.type === 'appointment_created' ||
      ev.type === 'appointment_updated' ||
      ev.type === 'appointment_deleted'
    ) {
      mergeWithBackend();
    }
  });

  // Initial backend fetch
  mergeWithBackend();

  return () => {
    unsubFs();
    unsubSse();
  };
}

export async function updateAppointmentStatus(
  id: string,
  update: {
    status: AppointmentStatus;
    doctorId?: string;
    assignedDoctor?: string;
    confirmedDate?: string;
    confirmedTime?: string;
    adminNotes?: string;
    declineReason?: string;
    rescheduleReason?: string;
  },
  existingHistory: Appointment['history'] = [],
  existingAppointmentSnapshot?: Appointment
) {
  const docPath = `appointments/${id}`;
  const adminEmail = auth.currentUser?.email || 'firstavenuedentistry@gmail.com';
  const now = new Date().toISOString();

  // 1. Validate & execute atomically on backend first (releases old slot on reschedule/decline, checks conflicts, sends email)
  const apiRes = await fetch(`/api/appointments/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminAuthHeaders(),
    },
    body: JSON.stringify({
      ...update,
      adminEmail,
      appointmentSnapshot: existingAppointmentSnapshot,
      previousDate:
        existingAppointmentSnapshot?.confirmedDate || existingAppointmentSnapshot?.preferredDate,
      previousTime:
        existingAppointmentSnapshot?.confirmedTime || existingAppointmentSnapshot?.preferredTime,
    }),
  });

  const apiData = await apiRes.json().catch(() => ({}));
  if (!apiRes.ok) {
    throw new Error(apiData.error || 'Failed to update appointment status.');
  }

  const prevDate =
    existingAppointmentSnapshot?.confirmedDate || existingAppointmentSnapshot?.preferredDate || '';
  const prevTime =
    existingAppointmentSnapshot?.confirmedTime || existingAppointmentSnapshot?.preferredTime || '';

  const note =
    update.status === 'approved'
      ? `Approved by ${adminEmail} (Doctor: ${update.assignedDoctor || 'Assigned'}, ${update.confirmedDate} ${update.confirmedTime})`
      : update.status === 'rescheduled'
      ? `Rescheduled from ${prevDate} (${prevTime}) to ${update.confirmedDate} (${update.confirmedTime}). Old slot released: ${update.rescheduleReason || 'Schedule updated'}`
      : update.status === 'declined'
      ? `Declined & slot released: ${update.declineReason || 'Reason provided'}`
      : `Status updated to ${update.status.toUpperCase()}`;

  const newHistory = [
    ...(existingHistory || []),
    {
      status: update.status,
      timestamp: now,
      adminEmail,
      note,
      previousDate: prevDate,
      previousTime: prevTime,
    },
  ];

  // 2. Sync to Firestore non-blockingly
  void (async () => {
    try {
      const ref = doc(db, 'appointments', id);
      await setDoc(
        ref,
        {
          ...(existingAppointmentSnapshot || {}),
          ...update,
          history: newHistory,
          updatedAt: now,
        },
        { merge: true }
      );

      await addDoc(collection(db, 'activity_logs'), {
        adminEmail,
        action: `Appointment ${update.status.toUpperCase()}`,
        details: note,
        targetId: id,
        targetType: 'appointment',
        timestamp: now,
      });
    } catch {}
  })();

  return apiData.appointment;
}

export async function deleteAppointment(id: string, appointmentDetails?: string) {
  const adminEmail = auth.currentUser?.email || 'firstavenuedentistry@gmail.com';
  const now = new Date().toISOString();

  try {
    await fetch(`/api/appointments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
    });
  } catch (e) {
    console.warn('Backend appointment sync deletion warning:', e);
  }

  void (async () => {
    try {
      const ref = doc(db, 'appointments', id);
      await deleteDoc(ref);

      await addDoc(collection(db, 'activity_logs'), {
        adminEmail,
        action: 'Appointment Deleted',
        details: appointmentDetails
          ? `Deleted appointment: ${appointmentDetails}`
          : `Deleted appointment #${id.slice(0, 8)}`,
        targetId: id,
        targetType: 'appointment',
        timestamp: now,
      });
    } catch {}
  })();
}

// ======================== 2. DOCTOR AVAILABILITY & 5-MINUTE RESERVATIONS ========================

export function normalizeAvailabilityRecord(raw: any): DoctorAvailabilityRecord {
  const defaultDuration: SlotDurationMinutes = [15, 30, 45, 60].includes(Number(raw?.defaultDuration))
    ? (Number(raw.defaultDuration) as SlotDurationMinutes)
    : 30;

  const rawWeekly = Array.isArray(raw?.weeklySchedule)
    ? raw.weeklySchedule
    : Array.isArray(raw?.recurringWeekly)
    ? raw.recurringWeekly
    : [];

  const normalizedWeekly = rawWeekly.map((w: any, idx: number) => ({
    dayOfWeek: typeof w.dayOfWeek === 'number' ? w.dayOfWeek : idx,
    dayName: w.dayName || DAY_NAMES[typeof w.dayOfWeek === 'number' ? w.dayOfWeek : idx] || 'Monday',
    enabled: Boolean(w.enabled),
    startTime: format24hTo12h(w.startTime || '09:00 AM'),
    endTime: format24hTo12h(w.endTime || '05:00 PM'),
    slotDuration: ([15, 30, 45, 60].includes(Number(w.slotDuration))
      ? Number(w.slotDuration)
      : defaultDuration) as SlotDurationMinutes,
    slots: Array.isArray(w.slots) ? w.slots : [],
  }));

  const specificMap: Record<string, DateSpecificAvailability> = {};
  if (Array.isArray(raw?.specificDates)) {
    for (const d of raw.specificDates) {
      if (d && d.date) {
        const isEnabled =
          d.enabled !== undefined ? Boolean(d.enabled) : d.isAvailable !== false;
        specificMap[d.date] = {
          id: d.id || `spec-${d.date}`,
          date: d.date,
          isAvailable: isEnabled,
          enabled: isEnabled,
          startTime: format24hTo12h(d.startTime || '09:00 AM'),
          endTime: format24hTo12h(d.endTime || '05:00 PM'),
          slotDuration: ([15, 30, 45, 60].includes(Number(d.slotDuration))
            ? Number(d.slotDuration)
            : defaultDuration) as SlotDurationMinutes,
          slots: Array.isArray(d.slots) ? d.slots : [],
          note: d.note,
          updatedAt: d.updatedAt,
        };
      }
    }
  } else if (raw?.specificDates && typeof raw.specificDates === 'object') {
    for (const [k, d] of Object.entries(raw.specificDates as Record<string, any>)) {
      if (d) {
        const dt = d.date || k;
        const isEnabled =
          d.enabled !== undefined ? Boolean(d.enabled) : d.isAvailable !== false;
        specificMap[dt] = {
          id: d.id || `spec-${dt}`,
          date: dt,
          isAvailable: isEnabled,
          enabled: isEnabled,
          startTime: format24hTo12h(d.startTime || '09:00 AM'),
          endTime: format24hTo12h(d.endTime || '05:00 PM'),
          slotDuration: ([15, 30, 45, 60].includes(Number(d.slotDuration))
            ? Number(d.slotDuration)
            : defaultDuration) as SlotDurationMinutes,
          slots: Array.isArray(d.slots) ? d.slots : [],
          note: d.note,
          updatedAt: d.updatedAt,
        };
      }
    }
  }

  return {
    doctorId: String(raw?.doctorId || 'doc-1'),
    doctorName: String(raw?.doctorName || 'Doctor'),
    defaultDuration,
    recurringWeekly: normalizedWeekly,
    weeklySchedule: normalizedWeekly,
    specificDates: specificMap,
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

export async function saveDoctorAvailability(
  recordOrDoctorId: DoctorAvailabilityRecord | string,
  payloadOrActorEmail?: any,
  maybeActorEmail?: string
): Promise<DoctorAvailabilityRecord> {
  let doctorId: string;
  let doctorName: string | undefined;
  let defaultDuration: SlotDurationMinutes;
  let weeklyList: any[];
  let specificList: any[];
  let actorEmail: string | undefined;

  if (typeof recordOrDoctorId === 'string') {
    doctorId = recordOrDoctorId;
    doctorName = payloadOrActorEmail?.doctorName;
    defaultDuration = payloadOrActorEmail?.defaultDuration || 30;
    weeklyList =
      payloadOrActorEmail?.recurringWeekly || payloadOrActorEmail?.weeklySchedule || [];
    const rawSpec = payloadOrActorEmail?.specificDates || [];
    specificList = Array.isArray(rawSpec) ? rawSpec : Object.values(rawSpec);
    actorEmail = maybeActorEmail;
  } else {
    doctorId = recordOrDoctorId.doctorId;
    doctorName = recordOrDoctorId.doctorName;
    defaultDuration = recordOrDoctorId.defaultDuration || 30;
    weeklyList =
      recordOrDoctorId.weeklySchedule || recordOrDoctorId.recurringWeekly || [];
    const rawSpec = recordOrDoctorId.specificDates || {};
    specificList = Array.isArray(rawSpec) ? rawSpec : Object.values(rawSpec);
    actorEmail = typeof payloadOrActorEmail === 'string' ? payloadOrActorEmail : undefined;
  }

  const res = await fetch(`/api/doctors/${encodeURIComponent(doctorId)}/availability`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminAuthHeaders(),
    },
    body: JSON.stringify({
      doctorName,
      defaultDuration,
      recurringWeekly: weeklyList,
      weeklySchedule: weeklyList,
      specificDates: specificList.map((d: any) => ({
        ...d,
        isAvailable: d.enabled !== undefined ? Boolean(d.enabled) : d.isAvailable !== false,
      })),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save doctor availability.');
  }

  const normalized = normalizeAvailabilityRecord(data.availability);

  // Sync to Firestore `doctor_availability/{doctorId}` non-blockingly
  void (async () => {
    try {
      await setDoc(doc(db, 'doctor_availability', normalized.doctorId), normalized);
      await addDoc(collection(db, 'activity_logs'), {
        adminEmail: actorEmail || auth.currentUser?.email || normalized.doctorName,
        action: 'Doctor Availability Updated',
        details: `Updated schedule for ${normalized.doctorName} (${normalized.defaultDuration} min slots)`,
        targetId: normalized.doctorId,
        targetType: 'availability',
        timestamp: new Date().toISOString(),
      });
    } catch {}
  })();

  return normalized;
}

export function subscribeToDoctorAvailabilities(
  onUpdate: (availabilities: DoctorAvailabilityRecord[]) => void
) {
  let latestFs: DoctorAvailabilityRecord[] = [];

  const syncFromBackend = async () => {
    try {
      const res = await fetch('/api/availability');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.availabilities)) {
          onUpdate(
            json.availabilities
              .filter((a: any) => !isLegacyDummyDoctorRecord(a?.doctorId, a?.doctorName))
              .map((a: any) => normalizeAvailabilityRecord(a))
          );
          return;
        }
      }
    } catch {}
    onUpdate(latestFs);
  };

  const unsubFs = onSnapshot(
    collection(db, 'doctor_availability'),
    (snap) => {
      latestFs = snap.docs
        .map((d) => normalizeAvailabilityRecord(d.data()))
        .filter((a) => !isLegacyDummyDoctorRecord(a.doctorId, a.doctorName));
      syncFromBackend();
    },
    () => {
      syncFromBackend();
    }
  );

  const unsubSse = subscribeToRealtimeClinicEvents((ev) => {
    if (
      ev.type === 'availability_updated' ||
      ev.type === 'doctors_updated' ||
      ev.type === 'reservation_locked' ||
      ev.type === 'reservation_released' ||
      ev.type === 'reservations_expired' ||
      ev.type === 'appointment_created' ||
      ev.type === 'appointment_updated'
    ) {
      syncFromBackend();
    }
  });

  syncFromBackend();

  return () => {
    unsubFs();
    unsubSse();
  };
}

export async function fetchDoctorDateSlotStatuses(
  doctorIdOrName: string,
  date: string,
  sessionId?: string
): Promise<{
  doctorId: string;
  doctorName: string;
  date: string;
  durationMinutes: SlotDurationMinutes;
  slots: ComputedTimeSlot[];
}> {
  const qs = new URLSearchParams({
    doctorId: doctorIdOrName,
    date,
    ...(sessionId ? { sessionId } : {}),
  });
  const res = await fetch(`/api/availability?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load doctor slots for date.');
  }

  const mappedSlots: ComputedTimeSlot[] = (Array.isArray(data.slots) ? data.slots : []).map(
    (s: any) => {
      let status: ComputedTimeSlot['status'] = 'available';
      if (s.reason === 'HELD_BY_YOU' || s.status === 'reserved_self') {
        status = 'reserved_self';
      } else if (s.reason === 'TEMPORARILY_RESERVED' || s.status === 'reserved_other') {
        status = 'reserved_other';
      } else if (!s.available || s.reason === 'BOOKED' || s.reason === 'PENDING_APPROVAL') {
        status = 'booked';
      }
      return {
        time: String(s.time),
        durationMinutes: (s.durationMinutes || data.durationMinutes || 30) as SlotDurationMinutes,
        available: Boolean(s.available),
        status,
        reason: s.reason,
        reservationId: s.reservationId,
        expiresAt: s.expiresAt,
      };
    }
  );

  return {
    doctorId: data.doctorId || doctorIdOrName,
    doctorName: data.doctorName || doctorIdOrName,
    date: data.date || date,
    durationMinutes: (data.durationMinutes || 30) as SlotDurationMinutes,
    slots: mappedSlots,
  };
}

export async function lockTemporarySlotReservation(params: {
  doctorId: string;
  doctorName?: string;
  date: string;
  time: string;
  sessionId: string;
  patientName?: string;
  patientEmail?: string;
}): Promise<TemporarySlotReservation> {
  const res = await fetch('/api/reservations/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Could not reserve the selected time slot.');
  }
  const r = data.reservation || {};
  const expiresAt = Number(r.expiresAt || r.expiresAtMs || Date.now() + 5 * 60 * 1000);
  return {
    id: r.id,
    doctorId: r.doctorId || params.doctorId,
    doctorName: r.doctorName || params.doctorName || 'Doctor',
    date: r.date || params.date,
    time: r.time || params.time,
    sessionId: r.sessionId || params.sessionId,
    patientName: r.patientName || params.patientName,
    patientEmail: r.patientEmail || params.patientEmail,
    createdAt: Number(r.createdAt || Date.now()),
    expiresAt,
    expiresAtMs: expiresAt,
    status: r.status || 'ACTIVE',
  };
}

export async function releaseTemporarySlotReservation(
  reservationIdOrParams?: string | { reservationId?: string; sessionId?: string },
  sessionId?: string
) {
  try {
    const payload =
      typeof reservationIdOrParams === 'string'
        ? { reservationId: reservationIdOrParams, sessionId }
        : reservationIdOrParams || { sessionId };
    await fetch('/api/reservations/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

// ======================== 3. CONTACT ENQUIRIES ========================
export async function submitEnquiry(
  data: Omit<Enquiry, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const collectionPath = 'enquiries';
  try {
    const now = new Date().toISOString();
    const newEnquiry = {
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      service: data.service || 'General Inquiry',
      message: data.message || '',
      status: 'new' as const,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, collectionPath), newEnquiry);

    try {
      await addDoc(collection(db, 'activity_logs'), {
        adminEmail: 'patient-contact@firstavenuedentistry.ca',
        action: 'New Contact Inquiry',
        details: `Inquiry from ${data.name} (${data.email}) regarding ${data.service}`,
        targetId: docRef.id,
        targetType: 'enquiry',
        timestamp: now,
      });
    } catch {}

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionPath);
  }
}

export function subscribeToEnquiries(
  onUpdate: (enquiries: Enquiry[]) => void,
  onError?: (error: Error) => void
) {
  const collectionPath = 'enquiries';
  const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Enquiry[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Enquiry, 'id'>),
      }));
      onUpdate(items);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function updateEnquiryStatus(id: string, status: Enquiry['status']) {
  const docPath = `enquiries/${id}`;
  try {
    const ref = doc(db, 'enquiries', id);
    const now = new Date().toISOString();
    await updateDoc(ref, {
      status,
      updatedAt: now,
    });

    await addDoc(collection(db, 'activity_logs'), {
      adminEmail: auth.currentUser?.email || 'firstavenuedentistry@gmail.com',
      action: 'Inquiry Status Updated',
      details: `Marked inquiry #${id.slice(0, 6)} as ${status}`,
      targetId: id,
      targetType: 'enquiry',
      timestamp: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

// ======================== 4. DOCTORS MANAGEMENT ========================
const LEGACY_DUMMY_DOCTOR_IDS = new Set([
  'doc-dk-sharma',
  'doc-shradha-sharma',
  'doc-john',
  'doc-sarah',
  'doc-michael',
]);

function isLegacyDummyDoctorRecord(id?: string, name?: string): boolean {
  const cleanId = String(id || '').trim().toLowerCase();
  const cleanName = String(name || '').trim().toLowerCase();
  if (LEGACY_DUMMY_DOCTOR_IDS.has(cleanId)) return true;
  if (
    cleanName === 'dr. d. k. sharma' ||
    cleanName === 'dr. shradha sharma' ||
    cleanName === 'dr. john' ||
    cleanName === 'dr. sarah' ||
    cleanName === 'dr. michael'
  ) {
    return true;
  }
  return false;
}

function normalizeDoctorItem(raw: any, fallbackId?: string): Doctor {
  const cleanName = String(raw?.name || 'Doctor').trim() || 'Doctor';
  const cleanSpecialties = Array.isArray(raw?.specialties)
    ? raw.specialties.map((s: any) => String(s).trim()).filter(Boolean)
    : typeof raw?.specialties === 'string' && raw.specialties.trim()
    ? raw.specialties.split(',').map((s: string) => s.trim()).filter(Boolean)
    : ['General Dentistry'];

  const fallbackUsername =
    cleanName
      .toLowerCase()
      .replace(/^dr\.?\s*/i, 'dr.')
      .replace(/[^a-z0-9.]/g, '') || 'doctor';

  return {
    id: String(raw?.id || fallbackId || `doc-${Date.now()}`),
    name: cleanName,
    title: String(raw?.title || 'Dentist / Specialist').trim(),
    qualifications: String(raw?.qualifications || 'BDS, DDS').trim(),
    specialties: cleanSpecialties.length > 0 ? cleanSpecialties : ['General Dentistry'],
    status: raw?.status === 'on_leave' ? 'on_leave' : 'active',
    email: String(raw?.email || '').trim(),
    phone: String(raw?.phone || '(519) 207-6890').trim(),
    bio: String(raw?.bio || '').trim(),
    username: String(raw?.username || fallbackUsername).trim().toLowerCase(),
    updatedAt: String(raw?.updatedAt || new Date().toISOString()),
  };
}

export function subscribeToDoctors(
  onUpdate: (doctors: Doctor[]) => void,
  onError?: (error: Error) => void
) {
  const collectionPath = 'doctors';
  let fsDoctors: Doctor[] = [];

  const syncWithBackend = async () => {
    try {
      const res = await fetch('/api/doctors');
      if (res.ok) {
        const data = await res.json();
        const backendDocs: Doctor[] = (Array.isArray(data.doctors) ? data.doctors : [])
          .filter((d: any) => d && d.name && !isLegacyDummyDoctorRecord(d.id, d.name))
          .map((d: any) => normalizeDoctorItem(d, d.id));

        onUpdate(backendDocs);
        return;
      }
    } catch {}
    onUpdate(fsDoctors);
  };

  const unsubFs = onSnapshot(
    collection(db, collectionPath),
    (snapshot) => {
      fsDoctors = snapshot.docs
        .map((docSnap) => normalizeDoctorItem(docSnap.data(), docSnap.id))
        .filter((d) => !isLegacyDummyDoctorRecord(d.id, d.name));
      syncWithBackend();
    },
    (error) => {
      if (onError) onError(error);
      syncWithBackend();
    }
  );

  const unsubSse = subscribeToRealtimeClinicEvents((ev) => {
    if (ev.type === 'doctors_updated' || ev.type === 'availability_updated') {
      syncWithBackend();
    }
  });

  syncWithBackend();

  return () => {
    unsubFs();
    unsubSse();
  };
}

export async function upsertDoctor(
  doctor: Omit<Doctor, 'id'> & { username?: string; password?: string },
  id?: string,
  adminEmailOverride?: string
): Promise<Doctor & { emailDispatched?: boolean }> {
  const collectionPath = 'doctors';
  try {
    const now = new Date().toISOString();
    const cleanSpecialties = Array.isArray(doctor.specialties)
      ? doctor.specialties.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const fallbackUsername =
      String(doctor.name || '')
        .trim()
        .toLowerCase()
        .replace(/^dr\.?\s*/i, 'dr.')
        .replace(/[^a-z0-9.]/g, '') || 'doctor';

    const cleanUsername = String(doctor.username || fallbackUsername).trim().toLowerCase();
    const cleanPassword = String(doctor.password || '').trim();

    const dataToSave = {
      name: String(doctor.name || '').trim(),
      title: String(doctor.title || 'Dentist / Specialist').trim(),
      qualifications: String(doctor.qualifications || '').trim(),
      specialties: cleanSpecialties.length > 0 ? cleanSpecialties : ['General Dentistry'],
      status: (doctor.status === 'on_leave' ? 'on_leave' : 'active') as 'active' | 'on_leave',
      email: String(doctor.email || '').trim().toLowerCase(),
      phone: String(doctor.phone || '(519) 207-6890').trim(),
      bio: String(doctor.bio || '').trim(),
      username: cleanUsername,
      updatedAt: now,
    };

    // Sync to backend first to create/update doctor record, portal login credentials, and dispatch credential email
    let savedId = id || `doc-${dataToSave.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    let emailDispatched = false;

    const apiRes = await fetch('/api/doctors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders(),
      },
      body: JSON.stringify({
        id: savedId,
        ...dataToSave,
        ...(cleanPassword ? { password: cleanPassword } : {}),
      }),
    });

    const apiJson = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) {
      throw new Error(apiJson.error || 'Failed to save doctor profile.');
    }

    if (apiJson.doctor?.id) {
      savedId = apiJson.doctor.id;
    }
    if (apiJson.doctor?.username) {
      dataToSave.username = apiJson.doctor.username;
    }
    if (typeof apiJson.emailDispatched === 'boolean') {
      emailDispatched = apiJson.emailDispatched;
    }

    // Sync to Firestore non-blockingly so UI completes immediately after backend save & email
    void (async () => {
      try {
        await setDoc(doc(db, collectionPath, savedId), dataToSave, { merge: true });

        await addDoc(collection(db, 'activity_logs'), {
          adminEmail: adminEmailOverride || auth.currentUser?.email || 'firstavenuedentistry@gmail.com',
          action: id ? 'Doctor Profile Updated' : 'New Doctor Registered',
          details: `${dataToSave.name} (@${dataToSave.username}) - Status: ${dataToSave.status}`,
          targetId: savedId,
          targetType: 'doctor',
          timestamp: now,
        });
      } catch {}
    })();

    return {
      id: savedId,
      ...dataToSave,
      emailDispatched,
    };
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, collectionPath);
  }
}

export async function deleteDoctor(id: string, doctorName?: string, adminEmailOverride?: string) {
  const adminEmail = adminEmailOverride || auth.currentUser?.email || 'firstavenuedentistry@gmail.com';
  const now = new Date().toISOString();

  try {
    await fetch(`/api/doctors/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminAuthHeaders(),
    });
  } catch {}

  void (async () => {
    try {
      await deleteDoc(doc(db, 'doctors', id));
      await deleteDoc(doc(db, 'doctor_availability', id));

      await addDoc(collection(db, 'activity_logs'), {
        adminEmail,
        action: 'Doctor Removed',
        details: doctorName ? `Removed doctor profile: ${doctorName}` : `Removed doctor record #${id.slice(0, 8)}`,
        targetId: id,
        targetType: 'doctor',
        timestamp: now,
      });
    } catch {}
  })();
}

// ======================== 5. REVIEWS MANAGEMENT ========================
export function subscribeToReviews(
  onUpdate: (reviews: Review[]) => void,
  onError?: (error: Error) => void
) {
  const collectionPath = 'reviews';
  return onSnapshot(
    collection(db, collectionPath),
    (snapshot) => {
      const items: Review[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Review, 'id'>),
      }));
      onUpdate(items);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function updateReviewStatus(id: string, status: Review['status']) {
  const docPath = `reviews/${id}`;
  try {
    const ref = doc(db, 'reviews', id);
    await updateDoc(ref, { status });

    await addDoc(collection(db, 'activity_logs'), {
      adminEmail: auth.currentUser?.email || 'firstavenuedentistry@gmail.com',
      action: 'Review Moderation',
      details: `Review #${id.slice(0, 6)} status changed to ${status}`,
      targetId: id,
      targetType: 'review',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

// ======================== 6. ACTIVITY LOGS ========================
export function subscribeToActivityLogs(
  onUpdate: (logs: ActivityLog[]) => void,
  onError?: (error: Error) => void
) {
  const collectionPath = 'activity_logs';
  const q = query(collection(db, collectionPath), orderBy('timestamp', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ActivityLog[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ActivityLog, 'id'>),
      }));
      onUpdate(items);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function deleteActivityLog(id: string) {
  const docPath = `activity_logs/${id}`;
  try {
    const ref = doc(db, 'activity_logs', id);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function clearAllActivityLogs() {
  const collectionPath = 'activity_logs';
  try {
    const snap = await getDocs(collection(db, collectionPath));
    const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, collectionPath);
  }
}

// ======================== 7. PRACTICE SETTINGS ========================
export async function getPracticeSettings(): Promise<PracticeSettings> {
  const defaultSettings: PracticeSettings = {
    clinicName: 'First Avenue Dentistry',
    phone: '(519) 207-6890',
    email: 'firstavenuedentistry@gmail.com',
    address: '308 Wellington Street, St. Thomas, ON N5R 2S9',
    weekdayHours: '9:00 AM – 6:00 PM',
    saturdayHours: '9:00 AM – 5:00 PM',
    sundayHours: 'Closed',
    emergencyPhone: '(519) 207-6890',
  };

  try {
    const docSnap = await getDocs(collection(db, 'practice_settings'));
    if (!docSnap.empty) {
      return { ...defaultSettings, ...(docSnap.docs[0].data() as PracticeSettings) };
    }
  } catch (error) {
    console.warn('Using default clinic settings:', error);
  }
  return defaultSettings;
}

export async function savePracticeSettings(settings: PracticeSettings) {
  const docPath = 'practice_settings/general';
  try {
    const ref = doc(db, 'practice_settings', 'general');
    await setDoc(ref, {
      ...settings,
      updatedAt: new Date().toISOString(),
    });

    await addDoc(collection(db, 'activity_logs'), {
      adminEmail: auth.currentUser?.email || 'firstavenuedentistry@gmail.com',
      action: 'Practice Settings Updated',
      details: 'Updated operational hours and clinic contact information',
      targetType: 'settings',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// ======================== 8. TIME SLOTS CONFIGURATION ========================
export interface TimeSlotGroup {
  group: string;
  slots: string[];
}

export const DEFAULT_TIME_SLOT_GROUPS: TimeSlotGroup[] = [
  { group: 'Morning', slots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'] },
  { group: 'Afternoon', slots: ['12:00 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM'] },
  { group: 'Late Afternoon', slots: ['04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'] },
];

export function subscribeToTimeSlots(
  onUpdate: (groups: TimeSlotGroup[]) => void,
  onError?: (error: Error) => void
) {
  const docRef = doc(db, 'practice_settings', 'time_slots');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists() && Array.isArray(snapshot.data()?.groups)) {
        onUpdate(snapshot.data()?.groups);
      } else {
        onUpdate(DEFAULT_TIME_SLOT_GROUPS);
      }
    },
    (error) => {
      if (onError) onError(error);
      onUpdate(DEFAULT_TIME_SLOT_GROUPS);
    }
  );
}

export async function saveTimeSlotGroups(groups: TimeSlotGroup[], adminEmail?: string) {
  const docPath = 'practice_settings/time_slots';
  try {
    const ref = doc(db, 'practice_settings', 'time_slots');
    await setDoc(ref, {
      groups,
      updatedAt: new Date().toISOString(),
    });

    await addDoc(collection(db, 'activity_logs'), {
      adminEmail: adminEmail || auth.currentUser?.email || 'firstavenuedentistry@gmail.com',
      action: 'Time Slots Updated',
      details: `Updated clinic booking slots (${groups.reduce((acc, g) => acc + g.slots.length, 0)} slots)`,
      targetType: 'settings',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// ======================== 9. SEED INITIAL VERIFIED CLINICAL DATA ========================
export async function seedInitialClinicalDataIfEmpty() {
  void (async () => {
    try {
      // Purge legacy dummy doctor documents from Firestore non-blockingly so they never reappear
      for (const dummyId of LEGACY_DUMMY_DOCTOR_IDS) {
        deleteDoc(doc(db, 'doctors', dummyId)).catch(() => {});
        deleteDoc(doc(db, 'doctor_availability', dummyId)).catch(() => {});
      }

      // Sync from backend `/api/doctors` into Firestore non-blockingly
      const res = await fetch('/api/doctors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.doctors)) {
          for (const d of data.doctors) {
            if (!isLegacyDummyDoctorRecord(d.id, d.name)) {
              setDoc(doc(db, 'doctors', d.id), d, { merge: true }).catch(() => {});
            }
          }
        }
        if (Array.isArray(data.availabilities)) {
          for (const av of data.availabilities) {
            if (isLegacyDummyDoctorRecord(av.doctorId, av.doctorName)) continue;
            setDoc(doc(db, 'doctor_availability', av.doctorId), normalizeAvailabilityRecord(av), {
              merge: true,
            }).catch(() => {});
          }
        }
      }
    } catch {}
  })();
}

export { DAY_NAMES, generateTimeSlotsFromWindow };
