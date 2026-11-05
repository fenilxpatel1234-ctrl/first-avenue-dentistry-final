export type AppointmentStatus =
  | 'pending'
  | 'approved'
  | 'rescheduled'
  | 'declined'
  | 'expired';

export interface StatusHistoryEntry {
  status: AppointmentStatus;
  timestamp: string;
  adminEmail?: string;
  note?: string;
  previousDate?: string;
  previousTime?: string;
}

export interface Appointment {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email: string;
  service: string;
  reason?: string;
  preferredTime: string;
  preferredDate: string;
  insuranceProvider?: string;
  notes?: string;
  status: AppointmentStatus;
  doctorId?: string;
  assignedDoctor?: string;
  confirmedDate?: string;
  confirmedTime?: string;
  durationMinutes?: number;
  reservationId?: string;
  adminNotes?: string;
  declineReason?: string;
  rescheduleReason?: string;
  history?: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type EnquiryStatus = 'new' | 'in_progress' | 'handled';

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  qualifications: string;
  specialties: string[];
  status: 'active' | 'on_leave';
  email?: string;
  phone?: string;
  bio?: string;
  username?: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  content: string;
  source: string;
  status: 'approved' | 'pending' | 'hidden';
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  adminEmail: string;
  action: string;
  details: string;
  targetId?: string;
  targetType?: 'appointment' | 'enquiry' | 'doctor' | 'review' | 'settings' | 'availability';
  timestamp: string;
}

export interface PracticeSettings {
  clinicName: string;
  phone: string;
  email: string;
  address: string;
  weekdayHours: string;
  saturdayHours: string;
  sundayHours: string;
  emergencyPhone: string;
  updatedAt?: string;
}
