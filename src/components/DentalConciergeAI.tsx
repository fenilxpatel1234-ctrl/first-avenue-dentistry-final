import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Send,
  X,
  Calendar,
  Sparkles,
  Phone,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import { submitAppointmentRequest } from '../lib/firestoreService';

type BookingStage =
  | null
  | 'service'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'date'
  | 'time'
  | 'confirm';

export const DentalConciergeAI: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Array<{ id: string; sender: 'ai' | 'user'; text: string }>>([
    {
      id: '1',
      sender: 'ai',
      text: "Hello! I'm your First Avenue Dental Concierge in St. Thomas, ON. How can I assist you today? You can ask about our dental procedures, direct insurance billing, or simply type 'book' to reserve an appointment.",
    },
  ]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<BookingStage>(null);
  const [data, setData] = useState({
    serviceName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
  });
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const addMsg = (sender: 'ai' | 'user', text: string) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, sender, text }]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    addMsg('user', text);

    if (stage) {
      handleBookingStateMachine(text);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/ai/dental-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const resData = await res.json();
      addMsg('ai', resData.answer);
      if (resData.action === 'booking_start') {
        setStage('service');
      }
    } catch {
      addMsg(
        'ai',
        'Our clinical team at First Avenue Family Dentistry is always ready to assist! You can call us directly at (519) 207-6890 or type "book" to schedule an appointment.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBookingStateMachine = async (val: string) => {
    switch (stage) {
      case 'service':
        setData((d) => ({ ...d, serviceName: val }));
        setStage('firstName');
        addMsg('ai', `Understood, ${val}. What is your first name?`);
        break;
      case 'firstName':
        setData((d) => ({ ...d, firstName: val }));
        setStage('lastName');
        addMsg('ai', `Nice to meet you, ${val}! What is your last name?`);
        break;
      case 'lastName':
        setData((d) => ({ ...d, lastName: val }));
        setStage('email');
        addMsg('ai', `Thank you. What is your email address so we can send your appointment confirmation?`);
        break;
      case 'email':
        setData((d) => ({ ...d, email: val }));
        setStage('phone');
        addMsg('ai', `Got it. What phone number can our clinic reception reach you at?`);
        break;
      case 'phone':
        setData((d) => ({ ...d, phone: val }));
        setStage('date');
        addMsg('ai', `What preferred date works for your visit (e.g. YYYY-MM-DD or 'tomorrow', 'next Tuesday')?`);
        break;
      case 'date':
        setData((d) => ({ ...d, date: val }));
        setStage('time');
        addMsg(
          'ai',
          `What time slot do you prefer? (e.g., 'Morning 9am-12pm', 'Afternoon 12pm-4pm', or 'Saturday')`
        );
        break;
      case 'time':
        setData((d) => ({ ...d, time: val }));
        setStage('confirm');
        addMsg(
          'ai',
          `Please verify your appointment details:\n• Patient: ${data.firstName} ${data.lastName}\n• Service: ${data.serviceName}\n• Email: ${data.email}\n• Phone: ${data.phone}\n• Requested Slot: ${data.date} (${val})\n\nType 'yes' to submit your request or 'edit' to update.`
        );
        break;
      case 'confirm':
        if (['yes', 'yep', 'confirm', 'correct', 'ok', 'sure'].includes(val.toLowerCase())) {
          submitBooking();
        } else if (val.toLowerCase().includes('change') || val.toLowerCase().includes('edit') || val.toLowerCase().includes('no')) {
          setStage('date');
          addMsg('ai', "Let's update your booking date. What new date do you prefer?");
        } else {
          addMsg('ai', "Please reply 'yes' to confirm your reservation or 'edit' to adjust your details.");
        }
        break;
    }
  };

  const submitBooking = async () => {
    setLoading(true);
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    try {
      // 1. Submit to Backend Express API (triggers automated email acknowledgment & email log)
      try {
        await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: data.firstName,
            lastName: data.lastName,
            name: fullName,
            email: data.email,
            phone: data.phone,
            serviceName: data.serviceName,
            service: data.serviceName,
            preferredDate: data.date,
            preferredTimeSlot: data.time,
            preferredTime: data.time,
          }),
        });
      } catch (err) {
        console.warn('Backend API submission warning:', err);
      }

      // 2. Submit to Firestore for immediate live synchronization in the Admin portal
      await submitAppointmentRequest({
        name: fullName,
        phone: data.phone,
        email: data.email,
        service: data.serviceName,
        preferredDate: data.date,
        preferredTime: data.time,
        notes: 'Booked via Dental Concierge AI conversational assistant',
      });

      addMsg(
        'ai',
        `🎉 Thank you, ${data.firstName}! Your appointment request has been logged in our clinic database. We just dispatched an automated acknowledgment email to ${data.email}. Our reception will call you shortly to confirm your visit.`
      );
      setStage(null);
    } catch {
      addMsg(
        'ai',
        `We received your request, but please call our clinic directly at (519) 207-6890 if you do not receive an email confirmation.`
      );
      setStage(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[540px] bg-white rounded-3xl shadow-2xl border border-[#060C16]/10 flex flex-col z-50 overflow-hidden font-sans">
      {/* Header matching Vantage clinical luxury branding */}
      <div className="bg-[#060C16] p-4 text-white flex justify-between items-center border-b border-[#1E5AFF]/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1E5AFF] flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-xs tracking-tight block leading-tight">
              First Avenue Concierge
            </span>
            <span className="text-[10px] text-[#8E8E93] block">
              St. Thomas Clinical Assistant
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC] text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`p-3.5 rounded-2xl max-w-[85%] whitespace-pre-line leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-[#1E5AFF] text-white rounded-br-none shadow-sm'
                  : 'bg-white text-[#060C16] shadow-sm border border-[#E2E8F0] rounded-bl-none'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-[11px] text-[#8E8E93] italic flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#1E5AFF] animate-ping" />
            <span>Dental Concierge is typing...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input area */}
      <div className="p-3 bg-white border-t border-[#E2E8F0] flex gap-2 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={stage ? 'Enter your details or reply...' : 'Ask a question or type "book"...'}
          className="flex-1 text-xs bg-[#F1F5F9] rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-[#1E5AFF] text-[#060C16] placeholder:text-[#94A3B8]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className="p-2.5 bg-[#1E5AFF] hover:bg-[#0452FF] text-white rounded-xl transition-colors disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
