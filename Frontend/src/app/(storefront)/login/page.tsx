'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { useAuth, isProfileRequired } from '@/hooks/use-auth';

const inputClass =
  'bg-white border border-[#2B1B0C]/40 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-[#9C5A26] focus:outline-none font-body placeholder:text-[#6B5539] transition-colors w-full';

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  return digits.slice(0, 10);
}

type Step = 'phone' | 'otp';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter a valid 10-digit mobile number');

    setSubmitting(true);
    try {
      await sendOtp(phone);
      setStep('otp');
      toast.success('OTP sent');
    } catch {
      toast.error('Could not send OTP — try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(otp)) return toast.error('Enter the OTP');

    setSubmitting(true);
    try {
      await verifyOtp(phone, otp, name.trim() || undefined);
      router.push(redirectTo);
    } catch (err) {
      if (isProfileRequired(err)) {
        toast.error('New here — enter your name above and verify again');
      } else {
        toast.error('Invalid or expired OTP');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 text-[#9C5A26]" />
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[#9C5A26]">Secure Login</p>
      </div>
      <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-6">
        Log in with your phone
      </h1>

      <form onSubmit={step === 'phone' ? handlePhoneSubmit : handleOtpSubmit} className="flex flex-col gap-3">
        <input
          type="tel"
          inputMode="numeric"
          autoFocus={step === 'phone'}
          disabled={step === 'otp'}
          value={phone}
          onChange={(e) => setPhone(normalizePhone(e.target.value))}
          placeholder="10-digit mobile number"
          className={`${inputClass} disabled:opacity-60 disabled:bg-[#2B1B0C]/5`}
        />

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name (if you're new here)"
          className={inputClass}
        />

        {step === 'otp' && (
          <>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setOtp('');
              }}
              className="font-body text-xs text-[#8A7A63] hover:text-[#2B1B0C] transition-colors self-start -mt-1"
            >
              Change phone number
            </button>
            <p className="font-body text-xs text-[#8A7A63] mb-1">OTP sent to +91 {phone}</p>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter OTP"
              className={inputClass}
            />
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="brutal-border bg-[#2B1B0C] text-white rounded-lg px-6 py-3.5 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 disabled:opacity-50"
        >
          {step === 'phone'
            ? submitting
              ? 'Sending...'
              : 'Send OTP'
            : submitting
              ? 'Verifying...'
              : 'Verify & Login'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
