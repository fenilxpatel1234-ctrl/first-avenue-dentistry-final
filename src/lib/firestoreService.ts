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
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import type {
  Appointment,
  Enquiry,
  Doctor,
  Review,
  ActivityLog,
  PracticeSettings,
  AppointmentStatus,
} from '../types/admin';

// 1. APPOINTMENTS
export async function submitAppointmentRequest(
  data: Omit<Appointment, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'history'>
): Promise<string> {
  const collectionPath = 'appointments';
  try {
    const now = new Date().toISOString();
    const newAppointment = {
      name: data.name || '',
      phone: data.phone || '',
      email: data.email || '',
      service: data.service || 'Emergency Dental Care',
      preferredDate: data.preferredDate || '',
      preferredTime: data.preferredTime || '',
      notes: data.notes || '',
      status: 'pending' as AppointmentStatus,
      assignedDoctor:
        data.assignedDoctor && data.assignedDoctor !== 'First Available Specialist'
          ? data.assignedDoctor
          : 'Unassigned',
      confirmedDate: '',
      confirmedTime: '',
      adminNotes: '',
      declineReason: '',
      rescheduleReason: '',
      history: [
        {
          status: 'pending' as AppointmentStatus,
          timestamp: now,
          note: 'Request submitted online by patient',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, collectionPath), newAppointment);

    // Also log to activity logs if possible
    try {
      await addDoc(collection(db, 'activity_logs'), {
        adminEmail: 'patient-portal@firstavenuedentistry.ca',
        action: 'New Appointment Requested',
        details: `${data.name} booked ${data.service} for ${data.preferredDate || 'flexible'} (${data.preferredTime})`,
        targetId: docRef.id,
        targetType: 'appointment',
        timestamp: now,
      });
    } catch {
      // Activity log fail is non-fatal for public request
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionPath);
  }
}

export function subscribeToAppointments(
  onUpdate: (appointments: Appointment[]) => void,
  onError?: (error: Error) => void
) {
  const collectionPath = 'appointments';
  const q = query(collection(db, collectionPath), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Appointment[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Appointment, 'id'>),
      }));
      onUpdate(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

export async function updateAppointmentStatus(
  id: string,
  update: {
    status: AppointmentStatus;
    assignedDoctor?: string;
    confirmedDate?: string;
    confirmedTime?: string;
    adminNotes?: string;
    declineReason?: string;
    rescheduleReason?: string;
  },
  existingHistory: Appointment['history'] = []
) {
  const docPath = `appointments/${id}`;
  try {
    const adminEmail = auth.currentUser?.email || 'firstavenuedentistry@gmail.com';
    const now = new Date().toISOString();

    const note =
      update.status === 'approved'
        ? `Approved by ${adminEmail} (Doctor: ${update.assignedDoctor || 'Assigned'}, ${update.confirmedDate} ${update.confirmedTime})`
        : update.status === 'rescheduled'
        ? `Rescheduled: ${update.rescheduleReason || 'Date changed'}`
        : update.status === 'declined'
        ? `Declined: ${update.declineReason || 'Reason provided'}`
        : 'Status updated';

    const newHistory = [
      ...(existingHistory || []),
      {
        status: update.status,
        timestamp: now,
        adminEmail,
        note,
      },
    ];

    const ref = doc(db, 'appointments', id);
    await updateDoc(ref, {
      ...update,
      history: newHistory,
      updatedAt: now,
    });

    // Write audit log
    await addDoc(collection(db, 'activity_logs'), {
      adminEmail,
      action: `Appointment ${update.status.toUpperCase()}`,
      details: note,
      targetId: id,
      targetType: 'appointment',
      timestamp: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteAppointment(id: string, appointmentDetails?: string) {
  const docPath = `appointments/${id}`;
  try {
    const adminEmail = auth.currentUser?.email || 'firstavenuedentistry@gmail.com';
    const now = new Date().toISOString();

    // 1. Delete from Firestore
    const ref = doc(db, 'appointments', id);
    await deleteDoc(ref);

    // 2. Audit log entry
    await addDoc(collection(db, 'activity_logs'), {
      adminEmail,
      action: 'Appointment Deleted',
      details: appointmentDetails ? `Deleted appointment: ${appointmentDetails}` : `Deleted appointment #${id.slice(0, 8)}`,
      targetId: id,
      targetType: 'appointment',
      timestamp: now,
    });

    // 3. Mirror deletion to backend API / Realtime Database
    try {
      await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend appointment sync deletion non-fatal warning:', e);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// 2. CONTACT ENQUIRIES
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

    // Activity log entry
    try {
      await addDoc(collection(db, 'activity_logs'), {
        adminEmail: 'patient-contact@firstavenuedentistry.ca',
        action: 'New Contact Inquiry',
        details: `Inquiry from ${data.name} (${data.email}) regarding ${data.service}`,
        targetId: docRef.id,
        targetType: 'enquiry',
        timestamp: now,
      });
    } catch {
      // Non-blocking
    }

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
      handleFirestoreError(error, OperationType.LIST, collectionPath);
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

// 3. DOCTORS MANAGEMENT
export function subscribeToDoctors(
  onUpdate: (doctors: Doctor[]) => void,
  onError?: (error: Error) => void
) {
  const collectionPath = 'doctors';
  return onSnapshot(
    collection(db, collectionPath),
    (snapshot) => {
      const items: Doctor[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Doctor, 'id'>),
      }));
      onUpdate(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

export async function upsertDoctor(
  doctor: Omit<Doctor, 'id'>,
  id?: string,
  adminEmailOverride?: string
): Promise<Doctor> {
  const collectionPath = 'doctors';
  try {
    const now = new Date().toISOString();
    const cleanSpecialties = Array.isArray(doctor.specialties)
      ? doctor.specialties.map((s) => String(s).trim()).filter(Boolean)
      : [];

    // Firestore rejects `undefined` property values; always use defined strings
    const dataToSave = {
      name: String(doctor.name || '').trim(),
      title: String(doctor.title || 'Dentist / Specialist').trim(),
      qualifications: String(doctor.qualifications || '').trim(),
      specialties: cleanSpecialties.length > 0 ? cleanSpecialties : ['General Dentistry'],
      status: (doctor.status === 'on_leave' ? 'on_leave' : 'active') as 'active' | 'on_leave',
      email: String(doctor.email || 'firstavenuedentistry@gmail.com').trim(),
      phone: String(doctor.phone || '(519) 207-6890').trim(),
      bio: String(doctor.bio || '').trim(),
      updatedAt: now,
    };

    let savedId = id || '';
    let oldDoctorName = '';
    if (id) {
      try {
        const existingSnap = await getDoc(doc(db, collectionPath, id));
        if (existingSnap.exists()) {
          oldDoctorName = String(existingSnap.data()?.name || '').trim();
        }
      } catch {}
      await updateDoc(doc(db, collectionPath, id), dataToSave);

      // Sync any appointments assigned to the old doctor name
      if (oldDoctorName && oldDoctorName !== dataToSave.name) {
        try {
          const aptsSnap = await getDocs(collection(db, 'appointments'));
          const syncPromises = aptsSnap.docs
            .filter((aDoc) => String(aDoc.data()?.assignedDoctor || '').trim() === oldDoctorName)
            .map((aDoc) =>
              updateDoc(aDoc.ref, {
                assignedDoctor: dataToSave.name,
                updatedAt: now,
              })
            );
          await Promise.all(syncPromises);
        } catch {}
      }
    } else {
      const docRef = await addDoc(collection(db, collectionPath), dataToSave);
      savedId = docRef.id;
    }

    try {
      await addDoc(collection(db, 'activity_logs'), {
        adminEmail: adminEmailOverride || auth.currentUser?.email || 'firstavenuedentistry@gmail.com',
        action: id ? 'Doctor Profile Updated' : 'New Doctor Registered',
        details: `${dataToSave.name} (${dataToSave.title}) - Status: ${dataToSave.status}`,
        targetId: savedId,
        targetType: 'doctor',
        timestamp: now,
      });
    } catch {
      // Non-fatal if activity log write fails
    }

    return {
      id: savedId,
      ...dataToSave,
    };
  } catch (error) {
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, collectionPath);
  }
}

export async function deleteDoctor(id: string, doctorName?: string, adminEmailOverride?: string) {
  const docPath = `doctors/${id}`;
  try {
    const adminEmail = adminEmailOverride || auth.currentUser?.email || 'firstavenuedentistry@gmail.com';
    const now = new Date().toISOString();

    const ref = doc(db, 'doctors', id);
    await deleteDoc(ref);

    // Sync appointments that were assigned to the deleted doctor so stale doctor names never remain
    try {
      const remainingDocsSnap = await getDocs(collection(db, 'doctors'));
      const remainingDocs = remainingDocsSnap.docs.map((d) => d.data() as Omit<Doctor, 'id'>);
      const validNames = new Set(remainingDocs.map((d) => String(d.name || '').trim()).filter(Boolean));
      const fallbackDoctor =
        remainingDocs.find((d) => d.status === 'active')?.name ||
        remainingDocs[0]?.name ||
        'Unassigned';

      const aptsSnap = await getDocs(collection(db, 'appointments'));
      const reassignPromises = aptsSnap.docs
        .filter((aDoc) => {
          const currentAssigned = String(aDoc.data()?.assignedDoctor || '').trim();
          return (
            currentAssigned &&
            currentAssigned !== 'Unassigned' &&
            (currentAssigned === doctorName || !validNames.has(currentAssigned))
          );
        })
        .map((aDoc) =>
          updateDoc(aDoc.ref, {
            assignedDoctor: fallbackDoctor,
            updatedAt: now,
          })
        );
      await Promise.all(reassignPromises);
    } catch {}

    try {
      await addDoc(collection(db, 'activity_logs'), {
        adminEmail,
        action: 'Doctor Removed',
        details: doctorName ? `Removed doctor profile: ${doctorName}` : `Removed doctor record #${id.slice(0, 8)}`,
        targetId: id,
        targetType: 'doctor',
        timestamp: now,
      });
    } catch {
      // Non-fatal
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// 4. REVIEWS MANAGEMENT
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
      handleFirestoreError(error, OperationType.LIST, collectionPath);
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

// 5. ACTIVITY LOGS
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
      handleFirestoreError(error, OperationType.LIST, collectionPath);
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

// 6. PRACTICE SETTINGS
export async function getPracticeSettings(): Promise<PracticeSettings> {
  const defaultSettings: PracticeSettings = {
    clinicName: 'First Avenue Family Dentistry',
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

// 7. TIME SLOTS CONFIGURATION & SCHEDULING
export interface TimeSlotGroup {
  group: string;
  slots: string[];
}

export const DEFAULT_TIME_SLOT_GROUPS: TimeSlotGroup[] = [
  { group: 'Morning', slots: ['09:00 AM', '10:15 AM', '11:30 AM'] },
  { group: 'Afternoon', slots: ['01:15 PM', '02:30 PM', '03:45 PM'] },
  { group: 'Late Afternoon', slots: ['04:45 PM', '05:30 PM'] },
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

// 8. SEED INITIAL VERIFIED CLINICAL DATA (ONLY ONCE ON INITIAL BOOT)
export async function seedInitialClinicalDataIfEmpty() {
  try {
    // Check seed marker so we NEVER resurrect deleted doctors or reviews
    const markerRef = doc(db, 'practice_settings', 'seed_marker');
    const markerSnap = await getDoc(markerRef);
    if (markerSnap.exists()) {
      return; // Already initialized once; respect all administrator deletions!
    }

    // Check doctors
    const doctorsSnap = await getDocs(collection(db, 'doctors'));
    if (doctorsSnap.empty) {
      const initialDoctors: Omit<Doctor, 'id'>[] = [
        {
          name: 'Dr. D. K. Sharma',
          title: 'Principal Dentist & Clinical Director',
          qualifications: 'BDS, DDS - Registered with Royal College of Dental Surgeons of Ontario',
          specialties: ['Comprehensive Restorative Dentistry', 'Dental Implants', 'Oral Surgery', 'Cosmetic Transformations'],
          status: 'active',
          email: 'firstavenuedentistry@gmail.com',
          phone: '(519) 207-6890',
          bio: 'Leading First Avenue Dentistry in St. Thomas with decades of clinical excellence, specialized implant procedures, and patient-first compassionate care.',
          updatedAt: new Date().toISOString(),
        },
        {
          name: 'Dr. Shradha Sharma',
          title: 'Associate Dentist & Orthodontics Lead',
          qualifications: 'BDS, DDS - Member of Ontario Dental Association',
          specialties: ['Invisalign Clear Aligners', 'Pediatric & Family Dentistry', 'Preventive Care', 'Teeth Whitening'],
          status: 'active',
          email: 'firstavenuedentistry@gmail.com',
          phone: '(519) 207-6890',
          bio: 'Dedicated to gentle, stress-free family dentistry and modern aesthetic smile alignment for children, teens, and adults in Elgin County.',
          updatedAt: new Date().toISOString(),
        },
      ];

      for (const docData of initialDoctors) {
        await addDoc(collection(db, 'doctors'), docData);
      }
    }

    // Check reviews
    const reviewsSnap = await getDocs(collection(db, 'reviews'));
    if (reviewsSnap.empty) {
      const initialReviews: Omit<Review, 'id'>[] = [
        {
          author: 'Michael R.',
          rating: 5,
          date: 'Recent Google Review',
          content: 'Dr. Sharma and the entire First Avenue team are amazing. They fit me in for an emergency root canal on the same day with virtually no pain. Truly the best dental clinic in St. Thomas!',
          source: 'Google Reviews',
          status: 'approved',
          createdAt: new Date().toISOString(),
        },
        {
          author: 'Amanda K.',
          rating: 5,
          date: 'Recent Google Review',
          content: 'Brought both my kids for their checkup and cleanings. The hygienists are so gentle and patient. The direct insurance billing makes everything completely seamless.',
          source: 'Google Reviews',
          status: 'approved',
          createdAt: new Date().toISOString(),
        },
        {
          author: 'David L.',
          rating: 5,
          date: 'Recent Google Review',
          content: 'Completed my Invisalign treatment here with Dr. Shradha Sharma. My smile looks incredible and the whole process was so convenient. High-tech equipment and wonderful atmosphere.',
          source: 'Google Reviews',
          status: 'approved',
          createdAt: new Date().toISOString(),
        },
      ];

      for (const rev of initialReviews) {
        await addDoc(collection(db, 'reviews'), rev);
      }
    }

    // Set seed marker so it never re-seeds over deletions
    await setDoc(markerRef, {
      seededAt: new Date().toISOString(),
      version: '1.0',
    });
  } catch (err) {
    console.warn('Clinical seed check completed or restricted:', err);
  }
}
