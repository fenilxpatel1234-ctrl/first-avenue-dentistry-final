import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  Users,
  MessageSquare,
  Star,
  BarChart3,
  Settings,
  History,
  LogOut,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Mail,
  ExternalLink,
  Plus,
  Edit2,
  Shield,
  Bell,
  Check,
  X,
  CalendarClock,
  Download,
  Trash2,
  Menu,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  subscribeToAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  subscribeToEnquiries,
  updateEnquiryStatus,
  subscribeToDoctors,
  upsertDoctor,
  deleteDoctor,
  subscribeToReviews,
  updateReviewStatus,
  subscribeToActivityLogs,
  deleteActivityLog,
  clearAllActivityLogs,
  getPracticeSettings,
  savePracticeSettings,
  subscribeToTimeSlots,
  saveTimeSlotGroups,
  TimeSlotGroup,
  DEFAULT_TIME_SLOT_GROUPS,
} from '../../lib/firestoreService';
import type {
  Appointment,
  Enquiry,
  Doctor,
  Review,
  ActivityLog,
  PracticeSettings,
} from '../../types/admin';

type TabType =
  | 'overview'
  | 'appointments'
  | 'enquiries'
  | 'doctors'
  | 'schedule'
  | 'admins'
  | 'reviews'
  | 'analytics'
  | 'settings'
  | 'logs';

interface StaffAdminAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface AdminDashboardPageProps {
  onNavigateToPublic: () => void;
  onNavigateToLogin: () => void;
}

function evaluatePasswordStrength(pass: string): {
  score: number;
  label: string;
  colorClass: string;
} {
  if (!pass) return { score: 0, label: 'Enter password', colorClass: 'bg-slate-200 text-slate-500' };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 10) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/\d/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score: 1, label: 'Basic (6+ chars)', colorClass: 'bg-amber-500 text-amber-700' };
  if (score === 2) return { score: 2, label: 'Good Security', colorClass: 'bg-sky-500 text-sky-700' };
  if (score === 3) return { score: 3, label: 'Strong Security', colorClass: 'bg-[#1E5AFF] text-[#1E5AFF]' };
  return { score: 4, label: 'Clinical-Grade Strong', colorClass: 'bg-emerald-600 text-emerald-700' };
}

export default function AdminDashboardPage({
  onNavigateToPublic,
  onNavigateToLogin,
}: AdminDashboardPageProps) {
  const { user, loading: authLoading, signOut } = useAdminAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(300);

  // Firestore live state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    clinicName: 'First Avenue Family Dentistry',
    phone: '(519) 207-6890',
    email: 'firstavenuedentistry@gmail.com',
    address: '308 Wellington Street, St. Thomas, ON N5R 2S9',
    weekdayHours: '9:00 AM – 6:00 PM',
    saturdayHours: '9:00 AM – 5:00 PM',
    sundayHours: 'Closed',
    emergencyPhone: '(519) 207-6890',
  });

  // Appointment filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // Manage Appointment Modal state
  const [actionTab, setActionTab] = useState<'details' | 'approve' | 'reschedule' | 'decline' | 'history'>('details');
  const [assignedDoctorInput, setAssignedDoctorInput] = useState('');
  const [confirmedDateInput, setConfirmedDateInput] = useState('');
  const [confirmedTimeInput, setConfirmedTimeInput] = useState('09:00 AM');
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [declineReasonInput, setDeclineReasonInput] = useState('');
  const [rescheduleReasonInput, setRescheduleReasonInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Doctor editing / adding modal
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [doctorSaving, setDoctorSaving] = useState(false);
  const [doctorFormError, setDoctorFormError] = useState<string | null>(null);
  const [doctorBannerMessage, setDoctorBannerMessage] = useState<string | null>(null);
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    title: '',
    qualifications: '',
    specialties: '',
    status: 'active' as 'active' | 'on_leave',
    email: '',
    phone: '',
    bio: '',
  });

  // Admin & Staff Accounts Management State
  const [adminAccounts, setAdminAccounts] = useState<StaffAdminAccount[]>([]);
  const [adminAccountsLoading, setAdminAccountsLoading] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editingAdminAccount, setEditingAdminAccount] = useState<StaffAdminAccount | null>(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const [adminBannerMessage, setAdminBannerMessage] = useState<string | null>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'Clinic Admin',
  });

  const fetchAdminAccounts = async () => {
    setAdminAccountsLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAdminAccounts(data);
        }
      }
    } catch (err) {
      console.warn('Error fetching admin accounts:', err);
    } finally {
      setAdminAccountsLoading(false);
    }
  };

  // Settings save feedback
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Time Slots & Scheduling Management State
  const [timeSlotGroups, setTimeSlotGroups] = useState<TimeSlotGroup[]>(DEFAULT_TIME_SLOT_GROUPS);
  const [timeSlotSaving, setTimeSlotSaving] = useState(false);
  const [timeSlotSuccess, setTimeSlotSuccess] = useState<string | null>(null);
  const [newSlotTime, setNewSlotTime] = useState('');
  const [newSlotPeriod, setNewSlotPeriod] = useState<string>('Morning');
  const [editingSlot, setEditingSlot] = useState<{ period: string; oldTime: string; newTime: string } | null>(null);

  // Notifications dropdown
  const [showNotifications, setShowNotifications] = useState(false);

  // Live selected appointment derived from real-time appointments state
  const selectedAppointment = useMemo(
    () => (selectedAppointmentId ? appointments.find((a) => a.id === selectedAppointmentId) || null : null),
    [selectedAppointmentId, appointments]
  );

  // Active doctors list & live doctor name resolver (never returns deleted/old doctors)
  const activeDoctors = useMemo(
    () => doctors.filter((d) => d.status === 'active'),
    [doctors]
  );

  const resolveSyncedDoctor = (rawDoctor?: string): string => {
    const clean = String(rawDoctor || '').trim();
    if (clean && clean !== 'Unassigned' && clean !== 'First Available Specialist') {
      const existsInClinic = doctors.some((d) => d.name.trim().toLowerCase() === clean.toLowerCase());
      if (existsInClinic) {
        const matchedDoc = doctors.find((d) => d.name.trim().toLowerCase() === clean.toLowerCase());
        return matchedDoc ? matchedDoc.name : clean;
      }
    }
    if (activeDoctors.length > 0) {
      return activeDoctors[0].name;
    }
    if (doctors.length > 0) {
      return doctors[0].name;
    }
    return 'Unassigned';
  };

  const isDoctorInLiveDirectory = (rawDoctor?: string): boolean => {
    const clean = String(rawDoctor || '').trim();
    if (!clean || clean === 'Unassigned' || clean === 'First Available Specialist') return false;
    return doctors.some((d) => d.name.trim().toLowerCase() === clean.toLowerCase());
  };

  // All available time slots flattened for fallback check
  const allFlatSlots = useMemo(
    () => timeSlotGroups.flatMap((g) => g.slots),
    [timeSlotGroups]
  );

  // Search Engine Isolation: dynamic noindex, nofollow
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

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigateToLogin();
    }
  }, [user, authLoading, onNavigateToLogin]);

  // 5-Minute Inactivity Auto-Logout Security Guard with Live Countdown
  useEffect(() => {
    if (!user) return;
    const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes = 300,000ms
    let lastActivity = Date.now();

    const onUserActivity = () => {
      lastActivity = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remainingSec = Math.max(0, Math.ceil((IDLE_LIMIT_MS - elapsed) / 1000));
      setIdleSecondsLeft(remainingSec);

      if (elapsed >= IDLE_LIMIT_MS) {
        clearInterval(checkInterval);
        sessionStorage.setItem('admin_idle_timeout', 'true');
        signOut().then(() => {
          onNavigateToLogin();
        });
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      clearInterval(checkInterval);
    };
  }, [user, signOut, onNavigateToLogin]);

  // Subscribe to real Firestore data
  useEffect(() => {
    if (!user) return;

    const unsubAppointments = subscribeToAppointments((items) => {
      setAppointments(items);
    });

    const unsubEnquiries = subscribeToEnquiries((items) => {
      setEnquiries(items);
    });

    const unsubDoctors = subscribeToDoctors((items) => {
      setDoctors(items);
    });

    const unsubReviews = subscribeToReviews((items) => {
      setReviews(items);
    });

    const unsubLogs = subscribeToActivityLogs((items) => {
      setActivityLogs(items);
    });

    const unsubTimeSlots = subscribeToTimeSlots((groups) => {
      if (groups && groups.length > 0) {
        setTimeSlotGroups(groups);
      }
    });

    getPracticeSettings().then((res) => {
      if (res) setPracticeSettings(res);
    });

    fetchAdminAccounts();

    return () => {
      unsubAppointments();
      unsubEnquiries();
      unsubDoctors();
      unsubReviews();
      unsubLogs();
      unsubTimeSlots();
    };
  }, [user]);

  // Reset doctorFilter if the filtered doctor was deleted
  useEffect(() => {
    if (doctorFilter !== 'all' && !doctors.some((d) => d.name === doctorFilter)) {
      setDoctorFilter('all');
    }
  }, [doctors, doctorFilter]);

  // Synchronize modal inputs when an appointment is opened or live doctors/timeSlots update
  useEffect(() => {
    if (selectedAppointment) {
      const syncedDoc = resolveSyncedDoctor(selectedAppointment.assignedDoctor);
      setAssignedDoctorInput(syncedDoc);
      setConfirmedDateInput(
        selectedAppointment.confirmedDate ||
          selectedAppointment.preferredDate ||
          new Date().toISOString().split('T')[0]
      );
      const preferredSlot =
        selectedAppointment.confirmedTime ||
        selectedAppointment.preferredTime ||
        allFlatSlots[0] ||
        '09:00 AM';
      setConfirmedTimeInput(preferredSlot);
      setAdminNoteInput(selectedAppointment.adminNotes || '');
      setDeclineReasonInput(selectedAppointment.declineReason || '');
      setRescheduleReasonInput(selectedAppointment.rescheduleReason || '');
      setActionError(null);
      setActionSuccess(null);
      setActionTab('details');
    }
  }, [selectedAppointmentId, doctors]);

  // Computed metrics
  const metrics = useMemo(() => {
    const total = appointments.length;
    const pending = appointments.filter((a) => a.status === 'pending').length;
    const approved = appointments.filter((a) => a.status === 'approved').length;
    const rescheduled = appointments.filter((a) => a.status === 'rescheduled').length;
    const declined = appointments.filter((a) => a.status === 'declined').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const today = appointments.filter(
      (a) => a.confirmedDate === todayStr || a.preferredDate === todayStr
    ).length;

    const newEnquiriesCount = enquiries.filter((e) => e.status === 'new').length;

    return { total, pending, approved, rescheduled, declined, today, newEnquiriesCount };
  }, [appointments, enquiries]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const effectiveDoctor = isDoctorInLiveDirectory(a.assignedDoctor)
        ? a.assignedDoctor
        : resolveSyncedDoctor(a.assignedDoctor);

      const matchesSearch =
        searchQuery === '' ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.phone.includes(searchQuery) ||
        a.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (effectiveDoctor && effectiveDoctor.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchesDoctor = doctorFilter === 'all' || effectiveDoctor === doctorFilter;

      return matchesSearch && matchesStatus && matchesDoctor;
    });
  }, [appointments, searchQuery, statusFilter, doctorFilter, doctors]);

  // DOUBLE-BOOKING CHECK:
  const doubleBookingConflict = useMemo(() => {
    if (!assignedDoctorInput || !confirmedDateInput || !confirmedTimeInput || !selectedAppointment) {
      return null;
    }
    const conflict = appointments.find(
      (a) =>
        a.id !== selectedAppointment.id &&
        a.status === 'approved' &&
        resolveSyncedDoctor(a.assignedDoctor) === assignedDoctorInput &&
        a.confirmedDate === confirmedDateInput &&
        a.confirmedTime === confirmedTimeInput
    );
    return conflict || null;
  }, [assignedDoctorInput, confirmedDateInput, confirmedTimeInput, selectedAppointment, appointments, doctors]);

  // Handle CSV Export
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Patient Name',
      'Phone',
      'Email',
      'Service',
      'Date',
      'Time Slot',
      'Assigned Doctor',
      'Status',
      'Submitted At',
    ];
    const rows = appointments.map((a) => [
      `"${a.id}"`,
      `"${a.name}"`,
      `"${a.phone}"`,
      `"${a.email}"`,
      `"${a.service}"`,
      `"${a.confirmedDate || a.preferredDate || ''}"`,
      `"${a.confirmedTime || a.preferredTime || ''}"`,
      `"${isDoctorInLiveDirectory(a.assignedDoctor) ? a.assignedDoctor : resolveSyncedDoctor(a.assignedDoctor)}"`,
      `"${a.status}"`,
      `"${a.createdAt}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `first-avenue-dentistry-appointments-${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Approve
  const handleApprove = async () => {
    if (!selectedAppointment) return;
    if (doubleBookingConflict) {
      setActionError(
        `Double booking conflict detected! ${assignedDoctorInput} already has an approved appointment with ${doubleBookingConflict.name} on ${confirmedDateInput} (${confirmedTimeInput}). Please choose an alternate slot or doctor.`
      );
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      const finalDoctor = assignedDoctorInput || resolveSyncedDoctor(selectedAppointment.assignedDoctor);
      await updateAppointmentStatus(
        selectedAppointment.id,
        {
          status: 'approved',
          assignedDoctor: finalDoctor,
          confirmedDate: confirmedDateInput,
          confirmedTime: confirmedTimeInput,
          adminNotes: adminNoteInput,
        },
        selectedAppointment.history
      );

      // Trigger automated email with ICS calendar file & Google Calendar URL
      try {
        await fetch('/api/send-status-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Approved',
            name: selectedAppointment.name,
            email: selectedAppointment.email,
            service: selectedAppointment.service,
            assignedDoctor: finalDoctor,
            confirmedDate: confirmedDateInput,
            confirmedTime: confirmedTimeInput,
          }),
        });
      } catch (emailErr) {
        console.warn('Status email trigger warning:', emailErr);
      }

      setActionSuccess('Appointment approved! Calendar invite & confirmation email dispatched to patient.');
      setTimeout(() => {
        setSelectedAppointmentId(null);
      }, 900);
    } catch (err) {
      console.error(err);
      setActionError('Failed to approve appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reschedule
  const handleReschedule = async () => {
    if (!selectedAppointment) return;
    if (!rescheduleReasonInput.trim()) {
      setActionError('A mandatory reason / patient explanation is required for rescheduling.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      const finalDoctor = assignedDoctorInput || resolveSyncedDoctor(selectedAppointment.assignedDoctor);
      await updateAppointmentStatus(
        selectedAppointment.id,
        {
          status: 'rescheduled',
          assignedDoctor: finalDoctor,
          confirmedDate: confirmedDateInput,
          confirmedTime: confirmedTimeInput,
          rescheduleReason: rescheduleReasonInput.trim(),
          adminNotes: adminNoteInput,
        },
        selectedAppointment.history
      );

      try {
        await fetch('/api/send-status-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Rescheduled',
            name: selectedAppointment.name,
            email: selectedAppointment.email,
            service: selectedAppointment.service,
            assignedDoctor: finalDoctor,
            confirmedDate: confirmedDateInput,
            confirmedTime: confirmedTimeInput,
            reason: rescheduleReasonInput.trim(),
          }),
        });
      } catch (emailErr) {
        console.warn('Reschedule email trigger warning:', emailErr);
      }

      setActionSuccess('Appointment marked as rescheduled and patient notified via email.');
      setTimeout(() => {
        setSelectedAppointmentId(null);
      }, 900);
    } catch (err) {
      console.error(err);
      setActionError('Failed to reschedule appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Decline
  const handleDecline = async () => {
    if (!selectedAppointment) return;
    if (!declineReasonInput.trim()) {
      setActionError('A mandatory reason is required to decline an appointment request.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      await updateAppointmentStatus(
        selectedAppointment.id,
        {
          status: 'declined',
          declineReason: declineReasonInput.trim(),
          adminNotes: adminNoteInput,
        },
        selectedAppointment.history
      );

      try {
        await fetch('/api/send-status-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Rejected',
            name: selectedAppointment.name,
            email: selectedAppointment.email,
            service: selectedAppointment.service,
            reason: declineReasonInput.trim(),
          }),
        });
      } catch (emailErr) {
        console.warn('Decline email trigger warning:', emailErr);
      }

      setActionSuccess('Appointment declined and patient notified.');
      setTimeout(() => {
        setSelectedAppointmentId(null);
      }, 900);
    } catch (err) {
      console.error(err);
      setActionError('Failed to decline appointment.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Doctor Form Modal Handlers
  const handleOpenDoctorModal = (docToEdit?: Doctor) => {
    setDoctorFormError(null);
    if (docToEdit) {
      setEditingDoctor(docToEdit);
      setDoctorForm({
        name: docToEdit.name,
        title: docToEdit.title,
        qualifications: docToEdit.qualifications,
        specialties: Array.isArray(docToEdit.specialties) ? docToEdit.specialties.join(', ') : '',
        status: docToEdit.status,
        email: docToEdit.email || 'firstavenuedentistry@gmail.com',
        phone: docToEdit.phone || '(519) 207-6890',
        bio: docToEdit.bio || '',
      });
    } else {
      setEditingDoctor(null);
      setDoctorForm({
        name: '',
        title: 'Dentist / Specialist',
        qualifications: 'BDS, DDS',
        specialties: 'General Dentistry, Preventive Care',
        status: 'active',
        email: 'firstavenuedentistry@gmail.com',
        phone: '(519) 207-6890',
        bio: '',
      });
    }
    setDoctorModalOpen(true);
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorForm.name.trim()) {
      setDoctorFormError('Doctor full name is required.');
      return;
    }

    setDoctorSaving(true);
    setDoctorFormError(null);

    try {
      const specialtiesArray = doctorForm.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const savedDoc = await upsertDoctor(
        {
          name: doctorForm.name.trim(),
          title: doctorForm.title.trim() || 'Dentist / Specialist',
          qualifications: doctorForm.qualifications.trim() || 'BDS, DDS',
          specialties: specialtiesArray.length > 0 ? specialtiesArray : ['General Dentistry'],
          status: doctorForm.status,
          email: doctorForm.email.trim() || 'firstavenuedentistry@gmail.com',
          phone: doctorForm.phone.trim() || '(519) 207-6890',
          bio: doctorForm.bio.trim(),
        },
        editingDoctor ? editingDoctor.id : undefined,
        user?.email || 'firstavenuedentistry@gmail.com'
      );

      if (savedDoc) {
        setDoctors((prev) => {
          const exists = prev.some((d) => d.id === savedDoc.id);
          if (exists) {
            return prev.map((d) => (d.id === savedDoc.id ? savedDoc : d));
          }
          return [...prev, savedDoc];
        });
      }

      setDoctorModalOpen(false);
      setDoctorBannerMessage(
        editingDoctor
          ? `Updated profile for ${savedDoc.name} and synced active appointments.`
          : `Successfully registered ${savedDoc.name} to the clinical team!`
      );
      setTimeout(() => setDoctorBannerMessage(null), 4000);
    } catch (err: any) {
      console.error('Save doctor error:', err);
      setDoctorFormError(err?.message || 'Failed to save doctor profile. Please try again.');
    } finally {
      setDoctorSaving(false);
    }
  };

  // Admin / Staff Form Modal Handlers
  const handleOpenAdminModal = (accountToEdit?: StaffAdminAccount) => {
    setAdminFormError(null);
    setShowAdminPassword(false);
    if (accountToEdit) {
      setEditingAdminAccount(accountToEdit);
      setAdminForm({
        name: accountToEdit.name,
        username: accountToEdit.username,
        email: accountToEdit.email,
        password: '',
        role: accountToEdit.role || 'Clinic Admin',
      });
    } else {
      setEditingAdminAccount(null);
      setAdminForm({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'Clinic Admin',
      });
    }
    setAdminModalOpen(true);
  };

  const handleSaveAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError(null);
    setAdminSaving(true);

    try {
      if (editingAdminAccount) {
        const res = await fetch(`/api/admin/users/${editingAdminAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: adminForm.name.trim(),
            username: adminForm.username.trim().toLowerCase(),
            email: adminForm.email.trim().toLowerCase(),
            role: adminForm.role,
            ...(adminForm.password.trim() ? { password: adminForm.password.trim() } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update administrator account.');
        }
        await fetchAdminAccounts();
        setAdminModalOpen(false);
        setAdminBannerMessage(`Updated staff account for ${adminForm.name.trim()}.`);
        setTimeout(() => setAdminBannerMessage(null), 4000);
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: adminForm.name.trim(),
            username: adminForm.username.trim().toLowerCase(),
            email: adminForm.email.trim().toLowerCase(),
            password: adminForm.password.trim(),
            role: adminForm.role,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create administrator account.');
        }
        await fetchAdminAccounts();
        setAdminModalOpen(false);
        setAdminBannerMessage(
          `Added new ${adminForm.role} "${adminForm.name.trim()}" (${adminForm.email.trim()}). Welcome & 2FA instructions sent via Gmail!`
        );
        setTimeout(() => setAdminBannerMessage(null), 5000);
      }
    } catch (err: any) {
      setAdminFormError(err?.message || 'Error saving administrator account.');
    } finally {
      setAdminSaving(false);
    }
  };

  // Deletion Modal State & Handler
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'appointment' | 'doctor' | 'audit_single' | 'audit_all' | 'admin_user';
    id?: string;
    name?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'appointment' && deleteTarget.id) {
        await deleteAppointment(deleteTarget.id, deleteTarget.name);
        setAppointments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        if (selectedAppointmentId === deleteTarget.id) {
          setSelectedAppointmentId(null);
        }
      } else if (deleteTarget.type === 'doctor' && deleteTarget.id) {
        await deleteDoctor(deleteTarget.id, deleteTarget.name, user?.email || 'firstavenuedentistry@gmail.com');
        setDoctors((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'admin_user' && deleteTarget.id) {
        const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
        if (res.ok) {
          setAdminAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        }
      } else if (deleteTarget.type === 'audit_single' && deleteTarget.id) {
        await deleteActivityLog(deleteTarget.id);
        setActivityLogs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'audit_all') {
        await clearAllActivityLogs();
        setActivityLogs([]);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete execution error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Schedule & Time Slots Management Handlers
  const handleAddTimeSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTime = newSlotTime.trim();
    if (!cleanTime) return;

    setTimeSlotSaving(true);
    setTimeSlotSuccess(null);
    try {
      const updated = timeSlotGroups.map((group) => {
        if (group.group === newSlotPeriod) {
          if (group.slots.includes(cleanTime)) return group;
          return { ...group, slots: [...group.slots, cleanTime] };
        }
        return group;
      });

      if (!updated.some((g) => g.group === newSlotPeriod)) {
        updated.push({ group: newSlotPeriod, slots: [cleanTime] });
      }

      await saveTimeSlotGroups(updated, user?.email || 'Admin');
      setTimeSlotGroups(updated);
      setNewSlotTime('');
      setTimeSlotSuccess(`Added new slot "${cleanTime}" to ${newSlotPeriod}.`);
      setTimeout(() => setTimeSlotSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to add time slot:', err);
    } finally {
      setTimeSlotSaving(false);
    }
  };

  const handleEditTimeSlot = async (period: string, oldTime: string, newTime: string) => {
    const cleanNew = newTime.trim();
    if (!cleanNew || cleanNew === oldTime) {
      setEditingSlot(null);
      return;
    }

    setTimeSlotSaving(true);
    setTimeSlotSuccess(null);
    try {
      const updated = timeSlotGroups.map((group) => {
        if (group.group === period) {
          return {
            ...group,
            slots: group.slots.map((s) => (s === oldTime ? cleanNew : s)),
          };
        }
        return group;
      });

      await saveTimeSlotGroups(updated, user?.email || 'Admin');
      setTimeSlotGroups(updated);
      setEditingSlot(null);
      setTimeSlotSuccess(`Updated slot to "${cleanNew}".`);
      setTimeout(() => setTimeSlotSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update time slot:', err);
    } finally {
      setTimeSlotSaving(false);
    }
  };

  const handleDeleteTimeSlot = async (period: string, timeToDelete: string) => {
    setTimeSlotSaving(true);
    setTimeSlotSuccess(null);
    try {
      const updated = timeSlotGroups.map((group) => {
        if (group.group === period) {
          return {
            ...group,
            slots: group.slots.filter((s) => s !== timeToDelete),
          };
        }
        return group;
      });

      await saveTimeSlotGroups(updated, user?.email || 'Admin');
      setTimeSlotGroups(updated);
      setTimeSlotSuccess(`Removed slot "${timeToDelete}" from ${period}.`);
      setTimeout(() => setTimeSlotSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to delete time slot:', err);
    } finally {
      setTimeSlotSaving(false);
    }
  };

  const handleResetDefaultSlots = async () => {
    setTimeSlotSaving(true);
    try {
      await saveTimeSlotGroups(DEFAULT_TIME_SLOT_GROUPS, user?.email || 'Admin');
      setTimeSlotGroups(DEFAULT_TIME_SLOT_GROUPS);
      setTimeSlotSuccess('Schedule reset to clinical standard time slots.');
      setTimeout(() => setTimeSlotSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to reset default time slots:', err);
    } finally {
      setTimeSlotSaving(false);
    }
  };

  // Practice Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsSaved(false);
    try {
      await savePracticeSettings(practiceSettings);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error('Settings save error:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onNavigateToLogin();
  };

  const handleSelectNavTab = (tab: TabType) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    if (tab === 'admins') {
      fetchAdminAccounts();
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const adminPassStrength = evaluatePasswordStrength(adminForm.password);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#060C16] flex font-sans antialiased overflow-x-hidden">
      {/* MOBILE SIDEBAR BACKDROP OVERLAY */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-[#060C16]/70 backdrop-blur-xs z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* 1. SIDEBAR (Responsive Drawer on Mobile/Tablet, Fixed Sidebar on Desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 lg:static bg-[#060C16] text-white flex flex-col justify-between shrink-0 border-r border-[#151D2A] transform transition-transform duration-300 ease-in-out ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Clinic Brand & Logo */}
          <div className="p-5 sm:p-6 border-b border-[#151D2A] flex items-center justify-between gap-2">
            <img
              src="/assets/aistudio/VOL_564-ID__1__7ab87ce9.svg"
              alt="First Avenue Dentistry"
              className="h-10 sm:h-11 w-full max-w-[190px] object-contain"
            />
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl bg-white/5 text-[#8E8E93] hover:text-white"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 sm:p-4 space-y-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSelectNavTab('overview')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span className="truncate">Dashboard Overview</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('appointments')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'appointments'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate">Appointments</span>
              </div>
              {metrics.pending > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shrink-0">
                  {metrics.pending}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('enquiries')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'enquiries'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">Patient Inquiries</span>
              </div>
              {metrics.newEnquiriesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E5AFF] text-white shrink-0">
                  {metrics.newEnquiriesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('doctors')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'doctors'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Users className="w-4 h-4 shrink-0" />
                <span className="truncate">Doctors &amp; Specialists</span>
              </div>
              <span className="text-[11px] text-[#8E8E93] shrink-0">{doctors.length}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('schedule')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <CalendarClock className="w-4 h-4 shrink-0" />
                <span className="truncate">Schedule &amp; Time Slots</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold shrink-0">
                Live
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('admins')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Shield className="w-4 h-4 shrink-0" />
                <span className="truncate">Admins &amp; Staff (2FA)</span>
              </div>
              <span className="text-[11px] text-[#8E8E93] shrink-0">{adminAccounts.length}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('reviews')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Star className="w-4 h-4 shrink-0" />
                <span className="truncate">Reviews Moderation</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('analytics')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span className="truncate">Analytics &amp; Reports</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Settings className="w-4 h-4 shrink-0" />
                <span className="truncate">Practice Settings</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelectNavTab('logs')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-[#1E5AFF] text-white shadow-md shadow-[#1E5AFF]/20'
                  : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <History className="w-4 h-4 shrink-0" />
                <span className="truncate">Audit &amp; Activity Log</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#151D2A] space-y-3">
          <button
            type="button"
            onClick={onNavigateToPublic}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>View Public Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center justify-between pt-2 gap-2">
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#1E5AFF] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="truncate min-w-0">
                <span className="block text-[11px] font-semibold text-white truncate">
                  {user?.email || 'Clinical Administrator'}
                </span>
                <span className="block text-[10px] text-[#8E8E93] truncate">2FA Verified Session</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN ADMIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar (Responsive across all devices) */}
        <header className="min-h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#F1F5F9] text-[#060C16] hover:bg-[#E2E8F0] transition-colors cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs text-[#64748B] min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-semibold text-[#060C16] truncate">Clinical Management Live</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline truncate">308 Wellington St, St. Thomas</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Quick search input (Desktop/Tablet) */}
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient, phone, doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-48 lg:w-64 rounded-xl bg-[#F1F5F9] border-0 text-xs text-[#060C16] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#1E5AFF]"
              />
            </div>

            {/* Live 5-Min Security Auto-Lock Countdown & Lock Now Button */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold ${
                idleSecondsLeft <= 60
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]'
              }`}
              title="Automatic security sign-out after 5 minutes of inactivity"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E5AFF] shrink-0" />
              <span className="font-mono">{formatCountdown(idleSecondsLeft)}</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16] transition-colors relative cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {metrics.pending > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </button>

              {showNotifications && (
                <div className="fixed sm:absolute right-4 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-4 space-y-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-xs font-bold text-[#060C16]">Clinical Notifications</span>
                    <span className="text-[10px] text-[#64748B]">
                      {metrics.pending} pending requests
                    </span>
                  </div>
                  {metrics.pending > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {appointments
                        .filter((a) => a.status === 'pending')
                        .slice(0, 4)
                        .map((apt) => (
                          <div
                            key={apt.id}
                            onClick={() => {
                              setSelectedAppointmentId(apt.id);
                              setShowNotifications(false);
                            }}
                            className="p-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#E2E8F0] text-xs cursor-pointer transition-colors"
                          >
                            <div className="font-semibold text-[#060C16] flex items-center justify-between gap-2">
                              <span className="truncate">{apt.name}</span>
                              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold shrink-0">
                                Pending
                              </span>
                            </div>
                            <div className="text-[11px] text-[#64748B] mt-0.5 truncate">
                              {apt.service} • {apt.preferredDate} ({apt.preferredTime})
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-[#94A3B8]">
                      All appointment requests are up to date!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Instant Lock Button */}
            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1.5 rounded-xl bg-[#060C16] hover:bg-[#151D2A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Immediately lock admin session"
            >
              <Lock className="w-3.5 h-3.5 text-[#1E5AFF]" />
              <span className="hidden sm:inline">Lock</span>
            </button>

            {/* Date display */}
            <div className="hidden xl:flex text-xs font-semibold text-[#060C16] bg-[#F1F5F9] px-3 py-1.5 rounded-xl items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-[#1E5AFF]" />
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div className="w-full md:hidden pt-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient, phone, service, doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#F1F5F9] border-0 text-xs text-[#060C16] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#1E5AFF]"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Main View Container */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 sm:space-y-8">
              {/* Top Greeting & Operational Summary */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                    Clinical Practice Overview
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Live operational activity for First Avenue Family Dentistry, St. Thomas, ON.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('admins');
                      handleOpenAdminModal();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#060C16] text-white text-xs font-semibold hover:bg-[#151D2A] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>+ Add Admin / Staff</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('doctors');
                      handleOpenDoctorModal();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#060C16] text-xs font-semibold hover:bg-[#F8FAFC] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>+ Add Doctor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('appointments')}
                    className="px-3.5 py-2 rounded-xl bg-[#1E5AFF] text-white text-xs font-semibold hover:bg-[#0452FF] transition-colors cursor-pointer shadow-sm shadow-[#1E5AFF]/20 flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Manage Appointments</span>
                  </button>
                </div>
              </div>

              {/* KPI Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#64748B]">
                    <span>Total Bookings</span>
                    <Calendar className="w-4 h-4 text-[#1E5AFF]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[#060C16]">
                    {metrics.total}
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    All-time patient submissions
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-600 font-medium">
                    <span>Pending Action</span>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-600">
                    {metrics.pending}
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Requires doctor review &amp; approval
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-emerald-600 font-medium">
                    <span>Confirmed &amp; Approved</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                    {metrics.approved}
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Scheduled in clinical calendar
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#1E5AFF] font-medium">
                    <span>New Enquiries</span>
                    <MessageSquare className="w-4 h-4 text-[#1E5AFF]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[#060C16]">
                    {metrics.newEnquiriesCount}
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    From public contact form
                  </div>
                </div>
              </div>

              {/* Pending Action Callout */}
              {metrics.pending > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs">
                        {metrics.pending} Patient Appointment Request{metrics.pending > 1 ? 's' : ''} Awaiting Review
                      </div>
                      <div className="text-[11px] text-amber-700 mt-0.5">
                        Verify doctor availability, prevent double booking, and confirm appointment slots.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('pending');
                      setActiveTab('appointments');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition-colors shrink-0 cursor-pointer self-start sm:self-center"
                  >
                    Review Pending ({metrics.pending})
                  </button>
                </div>
              )}

              {/* Two-Column Grid: Recent Appointments & Doctor Availability */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Recent Appointments (8 cols) */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs p-4 sm:p-6 space-y-5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-[#060C16]">
                        Recent Patient Submissions
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        Latest bookings submitted through the website.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('appointments')}
                      className="text-xs font-semibold text-[#1E5AFF] hover:underline shrink-0"
                    >
                      View All ({appointments.length})
                    </button>
                  </div>

                  {appointments.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#94A3B8]">
                      No appointments registered yet. Submissions from the public booking modal will appear here in real time.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E2E8F0]">
                      {appointments.slice(0, 5).map((apt) => {
                        const syncedDoc = resolveSyncedDoctor(apt.assignedDoctor);
                        return (
                          <div
                            key={apt.id}
                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] transition-colors rounded-xl px-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1E5AFF] flex items-center justify-center font-bold text-xs shrink-0">
                                {apt.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="block font-semibold text-xs text-[#060C16] truncate">
                                  {apt.name}
                                </span>
                                <span className="block text-[11px] text-[#64748B] truncate">
                                  {apt.service} • {apt.preferredDate} ({apt.preferredTime})
                                </span>
                                <span className="block text-[10px] text-[#1E5AFF] font-medium truncate">
                                  Specialist: {syncedDoc}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-12 sm:pl-0">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  apt.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : apt.status === 'rescheduled'
                                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                    : apt.status === 'declined'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {apt.status}
                              </span>

                              <button
                                type="button"
                                onClick={() => setSelectedAppointmentId(apt.id)}
                                className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold text-[#060C16] transition-colors cursor-pointer"
                              >
                                Manage
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Clinical Specialists On Duty (4 cols) */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs p-4 sm:p-6 space-y-4 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[#060C16]">
                      Specialists On Duty
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('doctors')}
                      className="text-xs font-semibold text-[#1E5AFF] hover:underline shrink-0"
                    >
                      Manage ({doctors.length})
                    </button>
                  </div>

                  {doctors.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] space-y-2">
                      <p className="text-xs text-[#64748B]">No doctors registered currently.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('doctors');
                          handleOpenDoctorModal();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#1E5AFF] text-white text-xs font-semibold cursor-pointer"
                      >
                        + Register Specialist
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {doctors.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-[#060C16] truncate">
                              {doc.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                                doc.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {doc.status === 'active' ? 'Active in Clinic' : 'On Leave'}
                            </span>
                          </div>
                          <span className="block text-[11px] text-[#64748B] truncate">
                            {doc.title}
                          </span>
                          <div className="text-[10px] text-[#94A3B8] truncate">
                            {doc.specialties.slice(0, 2).join(' • ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPOINTMENTS MANAGEMENT */}
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                    Appointment Requests
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Review incoming requests, assign live specialists, prevent overlapping schedules, and track patient approvals.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#060C16] transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#1E5AFF]" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Status Tabs & Filters Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#E2E8F0]">
                {/* Status Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-[#060C16] text-white'
                        : 'text-[#64748B] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    All ({appointments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-white'
                        : 'text-amber-600 hover:bg-amber-50'
                    }`}
                  >
                    Pending ({metrics.pending})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('approved')}
                    className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      statusFilter === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    Approved ({metrics.approved})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('rescheduled')}
                    className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      statusFilter === 'rescheduled'
                        ? 'bg-sky-600 text-white'
                        : 'text-sky-700 hover:bg-sky-50'
                    }`}
                  >
                    Rescheduled ({metrics.rescheduled})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('declined')}
                    className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                      statusFilter === 'declined'
                        ? 'bg-rose-600 text-white'
                        : 'text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    Declined ({metrics.declined})
                  </button>
                </div>

                {/* Doctor Filter (Synced with live doctors) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B] font-medium shrink-0">Specialist:</span>
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                    className="w-full sm:w-auto text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#1E5AFF]"
                  >
                    <option value="all">All Specialists ({doctors.length})</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Appointments Table */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
                {filteredAppointments.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#94A3B8]">
                    No appointments matching the selected filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs min-w-[720px]">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] font-semibold">
                          <th className="py-3.5 px-4">Patient</th>
                          <th className="py-3.5 px-4">Service Required</th>
                          <th className="py-3.5 px-4">Requested Schedule</th>
                          <th className="py-3.5 px-4">Assigned Specialist</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {filteredAppointments.map((apt) => {
                          const displayDoctor = resolveSyncedDoctor(apt.assignedDoctor);
                          return (
                            <tr
                              key={apt.id}
                              className="hover:bg-[#F8FAFC] transition-colors group"
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-[#060C16]">
                                  {apt.name}
                                </div>
                                <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                                  <a
                                    href={`tel:${apt.phone}`}
                                    className="hover:text-[#1E5AFF] flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3 text-[#1E5AFF]" />
                                    <span>{apt.phone}</span>
                                  </a>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-medium text-[#060C16]">
                                {apt.service}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-[#060C16]">
                                  {apt.confirmedDate || apt.preferredDate}
                                </div>
                                <div className="text-[11px] text-[#64748B]">
                                  {apt.confirmedTime || apt.preferredTime}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-[#060C16]">
                                {displayDoctor && displayDoctor !== 'Unassigned' ? (
                                  <span className="font-semibold text-[#1E5AFF]">
                                    {displayDoctor}
                                  </span>
                                ) : (
                                  <span className="text-[#94A3B8] italic">Unassigned</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    apt.status === 'approved'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : apt.status === 'rescheduled'
                                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                      : apt.status === 'declined'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {apt.status}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAppointmentId(apt.id)}
                                    className="px-3.5 py-1.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                                  >
                                    Review &amp; Manage
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: 'appointment',
                                        id: apt.id,
                                        name: `${apt.name} (${apt.service})`,
                                      })
                                    }
                                    className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete Appointment"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PATIENT INQUIRIES */}
          {activeTab === 'enquiries' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                  Patient Contact Inquiries
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Direct inquiries received from the public website contact form.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
                {enquiries.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#94A3B8]">
                    No contact messages received yet. Inquiries submitted on the contact page will appear here instantly.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {enquiries.map((enq) => (
                      <div
                        key={enq.id}
                        className="p-4 sm:p-6 hover:bg-[#F8FAFC] transition-colors space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm text-[#060C16]">
                              {enq.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                enq.status === 'new'
                                  ? 'bg-blue-100 text-blue-800'
                                  : enq.status === 'in_progress'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {enq.status.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#64748B]">
                            {new Date(enq.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B]">
                          <a
                            href={`mailto:${enq.email}`}
                            className="inline-flex items-center gap-1.5 text-[#1E5AFF] hover:underline"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>{enq.email}</span>
                          </a>
                          <a
                            href={`tel:${enq.phone}`}
                            className="inline-flex items-center gap-1.5 text-[#1E5AFF] hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{enq.phone}</span>
                          </a>
                          <span className="text-[#060C16] font-medium bg-[#F1F5F9] px-2.5 py-0.5 rounded-lg">
                            Service: {enq.service}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#334155] leading-relaxed">
                          {enq.message}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          {enq.status !== 'handled' ? (
                            <button
                              type="button"
                              onClick={() => updateEnquiryStatus(enq.id, 'handled')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark as Handled</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateEnquiryStatus(enq.id, 'new')}
                              className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B] text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Reopen Inquiry
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DOCTORS & SPECIALISTS */}
          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                    Clinical Specialists &amp; Dentists
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Manage active staff, credentials, and availability. Changes sync immediately to both the Booking Form and Appointment Management.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenDoctorModal()}
                  className="px-4 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-[#1E5AFF]/20 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Specialist</span>
                </button>
              </div>

              {doctorBannerMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-semibold">{doctorBannerMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-[#060C16] truncate">
                            {doc.name}
                          </h3>
                          <span className="text-xs font-semibold text-[#1E5AFF] block truncate">
                            {doc.title}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            doc.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {doc.status === 'active' ? 'Active / On Duty' : 'On Leave'}
                        </span>
                      </div>

                      <div className="text-xs text-[#64748B] leading-relaxed">
                        <strong className="text-[#060C16]">Qualifications:</strong> {doc.qualifications}
                      </div>

                      <div className="space-y-1">
                        <span className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Clinical Specialties
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {doc.specialties.map((spec, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1E5AFF] text-[11px] font-medium"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>

                      {doc.bio && (
                        <p className="text-xs text-[#64748B] leading-relaxed italic border-t border-[#E2E8F0] pt-2">
                          &ldquo;{doc.bio}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          upsertDoctor(
                            {
                              ...doc,
                              status: doc.status === 'active' ? 'on_leave' : 'active',
                            },
                            doc.id,
                            user?.email || 'firstavenuedentistry@gmail.com'
                          )
                        }
                        className="text-xs font-semibold text-[#64748B] hover:text-[#060C16] cursor-pointer"
                      >
                        Toggle Status ({doc.status === 'active' ? 'Set On Leave' : 'Set Active'})
                      </button>

                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenDoctorModal(doc)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold text-[#060C16] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit Profile</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'doctor',
                              id: doc.id,
                              name: doc.name,
                            })
                          }
                          className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer border border-rose-200"
                          title="Delete Doctor Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4B: SCHEDULE & TIME SLOTS MANAGEMENT */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#1E5AFF] uppercase tracking-wider">
                      Live Dynamic Availability
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Syncs to Booking Modal &amp; Appointment Manager
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                    Clinical Schedule &amp; Time Slots
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Add new appointment slots, modify existing times, or remove slots. Any changes update the patient booking form and admin approval dropdowns immediately.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetDefaultSlots}
                  disabled={timeSlotSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#64748B] hover:text-[#060C16] transition-colors cursor-pointer shadow-xs disabled:opacity-50 self-start sm:self-auto shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${timeSlotSaving ? 'animate-spin' : ''}`} />
                  <span>Reset Standard Slots</span>
                </button>
              </div>

              {timeSlotSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-medium">{timeSlotSuccess}</span>
                </div>
              )}

              {/* Add New Time Slot Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1E5AFF] flex items-center justify-center font-bold shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#060C16]">
                      Add New Bookable Time Slot
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Create a new bookable appointment window for patient self-service booking.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddTimeSlot} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold text-[#64748B] uppercase">
                      Schedule Group / Period
                    </label>
                    <select
                      value={newSlotPeriod}
                      onChange={(e) => setNewSlotPeriod(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] bg-white focus:outline-none focus:border-[#1E5AFF]"
                    >
                      <option value="Morning">Morning (9:00 AM – 12:00 PM)</option>
                      <option value="Afternoon">Afternoon (12:00 PM – 4:00 PM)</option>
                      <option value="Late Afternoon">Late Afternoon (4:00 PM – 6:00 PM)</option>
                      <option value="Saturday Morning">Saturday Morning (9:00 AM – 1:00 PM)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="block text-[11px] font-bold text-[#64748B] uppercase">
                      Time Slot Label (e.g., &ldquo;10:30 AM&rdquo; or &ldquo;02:15 PM&rdquo;)
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={newSlotTime}
                        onChange={(e) => setNewSlotTime(e.target.value)}
                        placeholder="e.g. 10:45 AM or 03:30 PM"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={timeSlotSaving || !newSlotTime.trim()}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{timeSlotSaving ? 'Saving...' : 'Add Slot'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Grouped Time Slots Display */}
              <div className="space-y-5">
                {timeSlotGroups.map((group) => (
                  <div
                    key={group.group}
                    className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                      <div className="flex items-center gap-2.5">
                        <CalendarClock className="w-4 h-4 text-[#1E5AFF]" />
                        <h3 className="font-bold text-sm text-[#060C16]">
                          {group.group} Slots
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F5F9] text-[#64748B]">
                          {group.slots.length} available {group.slots.length === 1 ? 'slot' : 'slots'}
                        </span>
                      </div>
                    </div>

                    {group.slots.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-dashed border-[#E2E8F0]">
                        No active time slots in this period. Use the form above to add one.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {group.slots.map((slotTime) => {
                          const isEditingThis =
                            editingSlot?.period === group.group &&
                            editingSlot?.oldTime === slotTime;

                          return (
                            <div
                              key={slotTime}
                              className={`p-3 rounded-xl border transition-all ${
                                isEditingThis
                                  ? 'bg-[#EFF6FF] border-[#1E5AFF] ring-1 ring-[#1E5AFF]'
                                  : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]'
                              }`}
                            >
                              {isEditingThis ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editingSlot.newTime}
                                    onChange={(e) =>
                                      setEditingSlot({
                                        ...editingSlot,
                                        newTime: e.target.value,
                                      })
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#1E5AFF] bg-white text-xs font-bold text-[#060C16] focus:outline-none"
                                    autoFocus
                                  />
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingSlot(null)}
                                      className="px-2 py-1 rounded-md text-[11px] font-semibold text-[#64748B] hover:text-[#060C16]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEditTimeSlot(
                                          group.group,
                                          editingSlot.oldTime,
                                          editingSlot.newTime
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#1E5AFF] text-white hover:bg-[#0452FF]"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Clock className="w-3.5 h-3.5 text-[#1E5AFF] shrink-0" />
                                    <span className="font-bold text-xs text-[#060C16] truncate">
                                      {slotTime}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingSlot({
                                          period: group.group,
                                          oldTime: slotTime,
                                          newTime: slotTime,
                                        })
                                      }
                                      className="p-1 rounded-lg text-[#64748B] hover:text-[#1E5AFF] hover:bg-white transition-colors cursor-pointer"
                                      title="Edit time slot"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteTimeSlot(group.group, slotTime)
                                      }
                                      className="p-1 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Delete time slot"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4C: ADMINS & STAFF ACCOUNTS MANAGEMENT */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#1E5AFF] uppercase tracking-wider">
                      Role-Based Access &amp; 2FA Security
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Mandatory Login OTP Active
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                    Administrators &amp; Staff Accounts
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Add new administrators, dentists, or receptionists. Every registered staff account requires a 6-digit Gmail OTP verification code at sign-in and is protected against brute-force login attempts.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenAdminModal()}
                  className="px-4 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-[#1E5AFF]/20 self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Admin / Staff</span>
                </button>
              </div>

              {/* Enterprise Security Posture Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1E5AFF] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#060C16]">Mandatory 2FA OTP</span>
                    <span className="block text-[11px] text-[#64748B]">6-digit Gmail code required on every staff sign-in</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#060C16]">Brute-Force Lockout</span>
                    <span className="block text-[11px] text-[#64748B]">Auto-locks account for 15 mins after 5 failed tries</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#060C16]">5-Min Idle Auto-Logout</span>
                    <span className="block text-[11px] text-[#64748B]">Active timer ({formatCountdown(idleSecondsLeft)} remaining)</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-[#060C16]">Tamper-Evident Audit</span>
                    <span className="block text-[11px] text-[#64748B]">Logs all doctor, schedule &amp; status updates</span>
                  </div>
                </div>
              </div>

              {adminBannerMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-semibold">{adminBannerMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {adminAccountsLoading && adminAccounts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-xs text-[#94A3B8]">
                    Loading administrator accounts...
                  </div>
                ) : (
                  adminAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#060C16] text-white flex items-center justify-center font-bold text-sm shrink-0">
                              {acc.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-[#060C16] truncate">
                                {acc.name}
                              </h3>
                              <span className="text-[11px] text-[#64748B] font-mono block truncate">
                                @{acc.username}
                              </span>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EFF6FF] text-[#1E5AFF] border border-[#BFDBFE] shrink-0">
                            {acc.role}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B] text-[11px]">2FA &amp; Reset Email:</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              2FA Enabled
                            </span>
                          </div>
                          <div className="font-semibold text-[#060C16] truncate flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#1E5AFF] shrink-0" />
                            <span className="truncate">{acc.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAdminModal(acc)}
                          className="px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold text-[#060C16] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit / Change Pass</span>
                        </button>

                        {adminAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'admin_user',
                                id: acc.id,
                                name: `${acc.name} (@${acc.username})`,
                              })
                            }
                            className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer border border-rose-200"
                            title="Remove Administrator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: REVIEWS MODERATION */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                  Patient Reviews &amp; Testimonials
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Moderate verified patient feedback displayed on the public website.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#060C16]">
                          {rev.author}
                        </span>
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                      </div>

                      <div className="text-[11px] text-[#64748B] flex items-center justify-between">
                        <span>{rev.source}</span>
                        <span>{rev.date}</span>
                      </div>

                      <p className="text-xs text-[#334155] leading-relaxed">
                        &ldquo;{rev.content}&rdquo;
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rev.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {rev.status}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateReviewStatus(
                            rev.id,
                            rev.status === 'approved' ? 'hidden' : 'approved'
                          )
                        }
                        className="text-xs font-semibold text-[#1E5AFF] hover:underline cursor-pointer"
                      >
                        {rev.status === 'approved' ? 'Unpublish' : 'Approve for Web'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: ANALYTICS & REPORTS */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                  Clinical Analytics &amp; Reporting
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Real metrics aggregated directly from live Firestore appointment and enquiry data.
                </p>
              </div>

              {/* Status Breakdown Bar */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#060C16]">
                  Appointment Status Distribution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-100">
                    <span className="block text-[11px] text-amber-700 font-semibold">
                      Pending Review
                    </span>
                    <span className="text-2xl font-bold text-amber-800">
                      {metrics.pending}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="block text-[11px] text-emerald-700 font-semibold">
                      Approved &amp; Scheduled
                    </span>
                    <span className="text-2xl font-bold text-emerald-800">
                      {metrics.approved}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100">
                    <span className="block text-[11px] text-sky-700 font-semibold">
                      Rescheduled
                    </span>
                    <span className="text-2xl font-bold text-sky-800">
                      {metrics.rescheduled}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100">
                    <span className="block text-[11px] text-rose-700 font-semibold">
                      Declined
                    </span>
                    <span className="text-2xl font-bold text-rose-800">
                      {metrics.declined}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Demand Breakdown */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#060C16]">
                  Most Requested Clinical Services
                </h3>
                <div className="space-y-3">
                  {[
                    'Emergency Dental Care',
                    'Routine Checkup & Cleaning',
                    'Dental Implants',
                    'Invisalign & Orthodontics',
                    'Sedation Sleep Dentistry',
                    'Teeth Whitening & Veneers',
                  ].map((service) => {
                    const count = appointments.filter((a) => a.service === service).length;
                    const percent =
                      appointments.length > 0
                        ? Math.round((count / appointments.length) * 100)
                        : 0;

                    return (
                      <div key={service} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-[#060C16]">
                          <span>{service}</span>
                          <span>
                            {count} requests ({percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                          <div
                            className="h-full bg-[#1E5AFF] rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: PRACTICE SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                  Practice Operational Settings
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Update official clinic details, operating hours, and patient reception phone numbers.
                </p>
              </div>

              <form
                onSubmit={handleSaveSettings}
                className="p-5 sm:p-8 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-5"
              >
                {settingsSaved && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Practice settings updated successfully in Firestore!</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#060C16]">
                    Clinic Registered Name
                  </label>
                  <input
                    type="text"
                    value={practiceSettings.clinicName}
                    onChange={(e) =>
                      setPracticeSettings({
                        ...practiceSettings,
                        clinicName: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#060C16]">
                      Primary Reception Phone
                    </label>
                    <input
                      type="text"
                      value={practiceSettings.phone}
                      onChange={(e) =>
                        setPracticeSettings({
                          ...practiceSettings,
                          phone: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#060C16]">
                      Clinic Email Address
                    </label>
                    <input
                      type="email"
                      value={practiceSettings.email}
                      onChange={(e) =>
                        setPracticeSettings({
                          ...practiceSettings,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#060C16]">
                    Clinic Physical Address
                  </label>
                  <input
                    type="text"
                    value={practiceSettings.address}
                    onChange={(e) =>
                      setPracticeSettings({
                        ...practiceSettings,
                        address: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
                  <h4 className="text-xs font-bold text-[#060C16] uppercase tracking-wider">
                    Operating Schedule
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-[#64748B]">
                        Monday – Friday
                      </label>
                      <input
                        type="text"
                        value={practiceSettings.weekdayHours}
                        onChange={(e) =>
                          setPracticeSettings({
                            ...practiceSettings,
                            weekdayHours: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-[#64748B]">
                        Saturday
                      </label>
                      <input
                        type="text"
                        value={practiceSettings.saturdayHours}
                        onChange={(e) =>
                          setPracticeSettings({
                            ...practiceSettings,
                            saturdayHours: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-[#64748B]">
                        Sunday
                      </label>
                      <input
                        type="text"
                        value={practiceSettings.sundayHours}
                        onChange={(e) =>
                          setPracticeSettings({
                            ...practiceSettings,
                            sundayHours: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs text-[#060C16] focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={settingsLoading}
                    className="px-6 py-2.5 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {settingsLoading ? 'Saving Settings...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 8: AUDIT & ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#060C16] tracking-tight">
                    Activity &amp; Audit Trail
                  </h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Tamper-evident record of all patient actions, status updates, and administrative modifications.
                  </p>
                </div>
                {activityLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: 'audit_all', name: 'All Audit Logs' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Audit Trail</span>
                  </button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
                {activityLogs.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#94A3B8]">
                    No activity logs recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 sm:p-5 flex items-start gap-3.5 hover:bg-[#F8FAFC] transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1E5AFF] flex items-center justify-center shrink-0 mt-0.5">
                          <History className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <span className="font-bold text-xs text-[#060C16]">
                              {log.action}
                            </span>
                            <span className="text-[11px] text-[#64748B]">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-[#475569] leading-relaxed break-words">
                            {log.details}
                          </p>
                          <span className="inline-block text-[10px] text-[#94A3B8]">
                            Executed by: {log.adminEmail}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'audit_single',
                              id: log.id,
                              name: log.action,
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                          title="Delete this audit record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. MODAL: APPOINTMENT MANAGEMENT (APPROVE / RESCHEDULE / DECLINE) */}
      <AnimatePresence>
        {selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAppointmentId(null)}
              className="absolute inset-0 bg-[#060C16]/75 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-[#E2E8F0] z-10 max-h-[92vh] overflow-y-auto space-y-5"
            >
              {/* Modal Top Bar */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#1E5AFF]">
                      Patient Appointment Dossier
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        selectedAppointment.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : selectedAppointment.status === 'rescheduled'
                          ? 'bg-sky-50 text-sky-700'
                          : selectedAppointment.status === 'declined'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {selectedAppointment.status}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#060C16] truncate">
                    {selectedAppointment.name}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAppointmentId(null)}
                  className="p-2 rounded-full bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16] transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Patient Contact & Request Details Box */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block text-[#64748B]">Contact Phone:</span>
                  <a
                    href={`tel:${selectedAppointment.phone}`}
                    className="font-bold text-[#1E5AFF] hover:underline"
                  >
                    {selectedAppointment.phone}
                  </a>
                </div>

                <div className="min-w-0">
                  <span className="block text-[#64748B]">Contact Email:</span>
                  <a
                    href={`mailto:${selectedAppointment.email}`}
                    className="font-bold text-[#1E5AFF] hover:underline block truncate"
                  >
                    {selectedAppointment.email}
                  </a>
                </div>

                <div>
                  <span className="block text-[#64748B]">Requested Service:</span>
                  <span className="font-bold text-[#060C16]">
                    {selectedAppointment.service}
                  </span>
                </div>

                <div>
                  <span className="block text-[#64748B]">Patient Requested Slot:</span>
                  <span className="font-bold text-[#060C16]">
                    {selectedAppointment.preferredDate} ({selectedAppointment.preferredTime})
                  </span>
                </div>

                {selectedAppointment.notes && (
                  <div className="sm:col-span-2 pt-2 border-t border-[#E2E8F0]">
                    <span className="block text-[#64748B]">Patient Medical / Clinical Notes:</span>
                    <span className="italic text-[#334155]">
                      &ldquo;{selectedAppointment.notes}&rdquo;
                    </span>
                  </div>
                )}
              </div>

              {/* Action Tabs Navigation (Scrollable on smaller screens so tabs never overlap) */}
              <div className="flex overflow-x-auto border-b border-[#E2E8F0] text-xs font-bold whitespace-nowrap -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setActionTab('details')}
                  className={`py-2.5 px-3.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'details'
                      ? 'border-[#1E5AFF] text-[#1E5AFF]'
                      : 'border-transparent text-[#64748B] hover:text-[#060C16]'
                  }`}
                >
                  Current Info
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('approve')}
                  className={`py-2.5 px-3.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'approve'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-[#64748B] hover:text-[#060C16]'
                  }`}
                >
                  Approve Appointment
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('reschedule')}
                  className={`py-2.5 px-3.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'reschedule'
                      ? 'border-sky-600 text-sky-600'
                      : 'border-transparent text-[#64748B] hover:text-[#060C16]'
                  }`}
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('decline')}
                  className={`py-2.5 px-3.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'decline'
                      ? 'border-rose-600 text-rose-600'
                      : 'border-transparent text-[#64748B] hover:text-[#060C16]'
                  }`}
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => setActionTab('history')}
                  className={`py-2.5 px-3.5 border-b-2 transition-colors cursor-pointer ${
                    actionTab === 'history'
                      ? 'border-[#060C16] text-[#060C16]'
                      : 'border-transparent text-[#64748B] hover:text-[#060C16]'
                  }`}
                >
                  Audit Trail
                </button>
              </div>

              {/* Feedback messages */}
              {actionError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}
              {actionSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* ACTION TAB 1: DETAILS */}
              {actionTab === 'details' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="block text-[#64748B]">Assigned Specialist (Synced):</span>
                      <span className="font-bold text-[#1E5AFF] mt-0.5 block">
                        {resolveSyncedDoctor(selectedAppointment.assignedDoctor)}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="block text-[#64748B]">Confirmed Schedule:</span>
                      <span className="font-bold text-[#060C16] mt-0.5 block">
                        {selectedAppointment.confirmedDate || 'Pending confirmation'}{' '}
                        {selectedAppointment.confirmedTime ? `(${selectedAppointment.confirmedTime})` : ''}
                      </span>
                    </div>
                  </div>

                  {selectedAppointment.adminNotes && (
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="block text-[#64748B] font-semibold mb-1">
                        Internal Clinical Admin Note:
                      </span>
                      <span className="text-[#060C16]">{selectedAppointment.adminNotes}</span>
                    </div>
                  )}

                  {selectedAppointment.declineReason && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                      <span className="block font-bold mb-1">Decline Reason Recorded:</span>
                      <span>{selectedAppointment.declineReason}</span>
                    </div>
                  )}

                  {selectedAppointment.rescheduleReason && (
                    <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800">
                      <span className="block font-bold mb-1">Reschedule Explanation:</span>
                      <span>{selectedAppointment.rescheduleReason}</span>
                    </div>
                  )}

                  <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: 'appointment',
                          id: selectedAppointment.id,
                          name: `${selectedAppointment.name} (${selectedAppointment.service})`,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Appointment</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActionTab('approve')}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                      >
                        Approve &amp; Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionTab('reschedule')}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionTab('decline')}
                        className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION TAB 2: APPROVE (SYNCED WITH LIVE DOCTORS & TIME SLOTS) */}
              {actionTab === 'approve' && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">
                      Select Clinical Specialist (Synced with Doctors Directory) *
                    </label>
                    <select
                      value={assignedDoctorInput}
                      onChange={(e) => setAssignedDoctorInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF] bg-white"
                    >
                      {doctors.length === 0 ? (
                        <option value="Unassigned">No specialists registered — Register a doctor first</option>
                      ) : (
                        doctors.map((doc) => (
                          <option key={doc.id} value={doc.name}>
                            {doc.name} ({doc.title}){doc.status === 'on_leave' ? ' — On Leave' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#060C16]">
                        Confirmed Date *
                      </label>
                      <input
                        type="date"
                        value={confirmedDateInput}
                        onChange={(e) => setConfirmedDateInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#060C16]">
                        Confirmed Time Slot (Synced) *
                      </label>
                      <select
                        value={confirmedTimeInput}
                        onChange={(e) => setConfirmedTimeInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF] bg-white"
                      >
                        {confirmedTimeInput && !allFlatSlots.includes(confirmedTimeInput) && (
                          <option value={confirmedTimeInput}>
                            {confirmedTimeInput} (Patient Requested)
                          </option>
                        )}
                        {timeSlotGroups.map((group) => (
                          <optgroup key={group.group} label={group.group}>
                            {group.slots.map((slot) => (
                              <option key={`${group.group}-${slot}`} value={slot}>
                                {slot} ({group.group})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* DOUBLE BOOKING WARNING ENGINE */}
                  {doubleBookingConflict && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="block text-xs text-amber-800">
                          Schedule Overlap / Double-Booking Detected
                        </strong>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          <strong>{assignedDoctorInput}</strong> already has an approved appointment with patient <strong>{doubleBookingConflict.name}</strong> ({doubleBookingConflict.service}) on <strong>{confirmedDateInput}</strong> during <strong>{confirmedTimeInput}</strong>.
                        </p>
                        <p className="text-[10px] text-amber-800 font-semibold">
                          Please adjust the time slot or reassign to an alternate doctor to prevent overlapping patient visits.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">
                      Internal Clinical Notes
                    </label>
                    <textarea
                      rows={2}
                      value={adminNoteInput}
                      onChange={(e) => setAdminNoteInput(e.target.value)}
                      placeholder="Add chair notes, chart number, or specific prep instructions..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActionTab('details')}
                      className="px-4 py-2 rounded-xl bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16] font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing || !!doubleBookingConflict}
                      onClick={handleApprove}
                      className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {isProcessing ? 'Confirming...' : 'Confirm & Approve Appointment'}
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION TAB 3: RESCHEDULE */}
              {actionTab === 'reschedule' && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">
                      Proposed Specialist (Synced with Doctors Directory)
                    </label>
                    <select
                      value={assignedDoctorInput}
                      onChange={(e) => setAssignedDoctorInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF] bg-white"
                    >
                      {doctors.length === 0 ? (
                        <option value="Unassigned">No specialists registered</option>
                      ) : (
                        doctors.map((doc) => (
                          <option key={doc.id} value={doc.name}>
                            {doc.name} ({doc.title})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-[#060C16]">
                        New Proposed Date *
                      </label>
                      <input
                        type="date"
                        value={confirmedDateInput}
                        onChange={(e) => setConfirmedDateInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-[#060C16]">
                        New Proposed Time (Synced) *
                      </label>
                      <select
                        value={confirmedTimeInput}
                        onChange={(e) => setConfirmedTimeInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF] bg-white"
                      >
                        {confirmedTimeInput && !allFlatSlots.includes(confirmedTimeInput) && (
                          <option value={confirmedTimeInput}>
                            {confirmedTimeInput}
                          </option>
                        )}
                        {timeSlotGroups.map((group) => (
                          <optgroup key={group.group} label={group.group}>
                            {group.slots.map((slot) => (
                              <option key={`${group.group}-${slot}`} value={slot}>
                                {slot} ({group.group})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">
                      Mandatory Reason for Rescheduling *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={rescheduleReasonInput}
                      onChange={(e) => setRescheduleReasonInput(e.target.value)}
                      placeholder="Explain why the appointment is being moved (e.g., Doctor in emergency surgery, holiday clinic schedule)..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActionTab('details')}
                      className="px-4 py-2 rounded-xl bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16] font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleReschedule}
                      className="px-6 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {isProcessing ? 'Updating...' : 'Save & Record Reschedule'}
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION TAB 4: DECLINE */}
              {actionTab === 'decline' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                    <strong className="block font-bold">Declining Patient Request</strong>
                    <p className="text-[11px]">
                      A mandatory explanation is required. This will be preserved in the audit log.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">
                      Reason for Declining *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={declineReasonInput}
                      onChange={(e) => setDeclineReasonInput(e.target.value)}
                      placeholder="E.g. Requested dental procedure requires hospital surgical facility; outside clinic catchment; duplicate request..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActionTab('details')}
                      className="px-4 py-2 rounded-xl bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16] font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleDecline}
                      className="px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {isProcessing ? 'Declining...' : 'Confirm Decline'}
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION TAB 5: AUDIT TRAIL */}
              {actionTab === 'history' && (
                <div className="space-y-3 text-xs">
                  <span className="font-bold text-[#060C16] block">
                    Appointment Lifecycle History
                  </span>
                  {!selectedAppointment.history || selectedAppointment.history.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#F8FAFC] text-[#94A3B8] text-center">
                      No status transitions recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedAppointment.history.map((entry, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold uppercase text-[10px] text-[#1E5AFF]">
                              {entry.status}
                            </span>
                            <span className="text-[10px] text-[#64748B]">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {entry.note && (
                            <div className="text-[#334155]">{entry.note}</div>
                          )}
                          {entry.adminEmail && (
                            <div className="text-[10px] text-[#94A3B8]">
                              By: {entry.adminEmail}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. MODAL: REGISTER / EDIT DOCTOR */}
      <AnimatePresence>
        {doctorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDoctorModalOpen(false)}
              className="absolute inset-0 bg-[#060C16]/75 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-[#E2E8F0] z-10 max-h-[92vh] overflow-y-auto space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-bold text-[#060C16]">
                  {editingDoctor ? 'Edit Doctor Profile' : 'Register Clinical Specialist'}
                </h3>
                <button
                  type="button"
                  onClick={() => setDoctorModalOpen(false)}
                  className="p-2 rounded-full bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {doctorFormError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{doctorFormError}</span>
                </div>
              )}

              <form onSubmit={handleSaveDoctor} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#060C16]">Doctor Full Name *</label>
                  <input
                    type="text"
                    required
                    value={doctorForm.name}
                    onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                    placeholder="e.g. Dr. D. K. Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">Title / Role *</label>
                    <input
                      type="text"
                      required
                      value={doctorForm.title}
                      onChange={(e) => setDoctorForm({ ...doctorForm, title: e.target.value })}
                      placeholder="Principal Dentist"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">Status</label>
                    <select
                      value={doctorForm.status}
                      onChange={(e) =>
                        setDoctorForm({
                          ...doctorForm,
                          status: e.target.value as 'active' | 'on_leave',
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF] bg-white"
                    >
                      <option value="active">Active in Clinic</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">Email Address</label>
                    <input
                      type="email"
                      value={doctorForm.email}
                      onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                      placeholder="firstavenuedentistry@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">Phone Number</label>
                    <input
                      type="text"
                      value={doctorForm.phone}
                      onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                      placeholder="(519) 207-6890"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#060C16]">Degrees &amp; Qualifications</label>
                  <input
                    type="text"
                    value={doctorForm.qualifications}
                    onChange={(e) =>
                      setDoctorForm({ ...doctorForm, qualifications: e.target.value })
                    }
                    placeholder="BDS, DDS - Registered with RCDSO"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#060C16]">
                    Specialties (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={doctorForm.specialties}
                    onChange={(e) =>
                      setDoctorForm({ ...doctorForm, specialties: e.target.value })
                    }
                    placeholder="Implants, Orthodontics, Emergency, Sedation"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#060C16]">Professional Biography</label>
                  <textarea
                    rows={3}
                    value={doctorForm.bio}
                    onChange={(e) => setDoctorForm({ ...doctorForm, bio: e.target.value })}
                    placeholder="Background and clinical dedication..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <button
                    type="button"
                    disabled={doctorSaving}
                    onClick={() => setDoctorModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={doctorSaving}
                    className="px-6 py-2 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {doctorSaving ? 'Saving Doctor...' : editingDoctor ? 'Update Doctor' : 'Save Doctor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4B. MODAL: ADD / EDIT ADMIN OR STAFF ACCOUNT */}
      <AnimatePresence>
        {adminModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !adminSaving && setAdminModalOpen(false)}
              className="absolute inset-0 bg-[#060C16]/75 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-8 shadow-2xl border border-[#E2E8F0] z-10 max-h-[92vh] overflow-y-auto space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#1E5AFF] uppercase tracking-wider block">
                    2FA Protected Staff Access
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[#060C16]">
                    {editingAdminAccount ? 'Edit Admin / Staff Account' : 'Add New Admin / Staff'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(false)}
                  className="p-2 rounded-full bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {adminFormError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminFormError}</span>
                </div>
              )}

              <form onSubmit={handleSaveAdminAccount} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-[#060C16]">Staff / Admin Full Name *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    placeholder="e.g. Dr. Shradha Sharma or Sarah Jenkins"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">Login Username *</label>
                    <input
                      type="text"
                      required
                      value={adminForm.username}
                      onChange={(e) =>
                        setAdminForm({
                          ...adminForm,
                          username: e.target.value.toLowerCase().replace(/\s+/g, ''),
                        })
                      }
                      placeholder="e.g. shradha"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-[#060C16]">Access Role *</label>
                    <select
                      value={adminForm.role}
                      onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF] bg-white"
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="Clinic Admin">Clinic Admin</option>
                      <option value="Receptionist / Coordinator">Receptionist / Coordinator</option>
                      <option value="Dental Specialist">Dental Specialist</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-[#060C16]">
                    Official Email / Gmail (Receives 2FA Login OTP &amp; Password Reset) *
                  </label>
                  <input
                    type="email"
                    required
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    placeholder="staffmember@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-[#060C16]">
                    {editingAdminAccount
                      ? 'New Password (leave blank to keep existing password)'
                      : 'Initial Login Password (min. 6 characters) *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required={!editingAdminAccount}
                      minLength={6}
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      placeholder={
                        editingAdminAccount ? 'Enter new password to change...' : 'Enter password (min. 6 chars)'
                      }
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#E2E8F0] focus:outline-none focus:border-[#1E5AFF]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-2.5 text-[#64748B] hover:text-[#060C16] cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {adminForm.password && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span className="text-[#64748B]">Password Security Level:</span>
                        <span className={adminPassStrength.colorClass.split(' ')[1]}>
                          {adminPassStrength.label}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex gap-1">
                        {[1, 2, 3, 4].map((lvl) => (
                          <div
                            key={lvl}
                            className={`flex-1 h-full rounded-full transition-colors ${
                              adminPassStrength.score >= lvl
                                ? adminPassStrength.colorClass.split(' ')[0]
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#64748B]">
                  When this staff member logs in with their username/email and password, a 6-digit OTP verification code will automatically be sent to their Gmail before granting access.
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <button
                    type="button"
                    disabled={adminSaving}
                    onClick={() => setAdminModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#F1F5F9] text-[#64748B] hover:text-[#060C16] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adminSaving}
                    className="px-6 py-2 rounded-xl bg-[#1E5AFF] hover:bg-[#0452FF] text-white font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {adminSaving
                      ? 'Saving Account...'
                      : editingAdminAccount
                      ? 'Update Staff Account'
                      : 'Create Admin Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. MODAL: DELETION CONFIRMATION */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setDeleteTarget(null)}
              className="absolute inset-0 bg-[#060C16]/80 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-[#060C16]">
                  {deleteTarget.type === 'appointment'
                    ? 'Delete Appointment Record?'
                    : deleteTarget.type === 'doctor'
                    ? 'Remove Doctor Profile?'
                    : deleteTarget.type === 'admin_user'
                    ? 'Remove Administrator Account?'
                    : deleteTarget.type === 'audit_all'
                    ? 'Clear Complete Audit Trail?'
                    : 'Delete Activity Record?'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {deleteTarget.type === 'appointment' ? (
                    <>
                      Are you sure you want to permanently delete{' '}
                      <strong className="text-slate-900">{deleteTarget.name}</strong>? This action removes the appointment from both Firestore and the clinic system.
                    </>
                  ) : deleteTarget.type === 'doctor' ? (
                    <>
                      Are you sure you want to remove{' '}
                      <strong className="text-slate-900">{deleteTarget.name}</strong> from the clinic directory? Any appointments assigned to this doctor will automatically sync to your active specialist.
                    </>
                  ) : deleteTarget.type === 'admin_user' ? (
                    <>
                      Are you sure you want to revoke admin portal access for{' '}
                      <strong className="text-slate-900">{deleteTarget.name}</strong>?
                    </>
                  ) : deleteTarget.type === 'audit_all' ? (
                    'Are you sure you want to delete all audit and activity records? This action cannot be undone.'
                  ) : (
                    <>
                      Are you sure you want to delete this activity log entry for{' '}
                      <strong className="text-slate-900">{deleteTarget.name}</strong>?
                    </>
                  )}
                </p>
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleExecuteDelete}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Deletion</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
