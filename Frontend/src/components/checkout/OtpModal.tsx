'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { AnimatedTick } from '@/components/ui/AnimatedTick';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
// How long the green tick stays on screen before payment / the confirmation page takes over.
const TICK_HOLD_MS = 900;

interface Props {
  phone: string;
  /** Label of what happens next, e.g. "Place COD Order" / "Pay Securely". */
  actionLabel: string;
  /** Called once the number is verified (after the tick animation). */
  onVerified: () => void;
  onClose: () => void;
}

type Stage = 'sending' | 'entry' | 'verifying' | 'verified';

// Pre-order login. Opens when a logged-out customer taps the order button, texts a 6-digit
// OTP to the number they typed, logs them in on success (same flow as /login), and plays a
// green tick before the order continues
// (Razorpay for prepaid, the confirmation page for COD). Single real <input> drawn as six
// boxes so SMS autofill (one-time-code) and paste both work.
export function OtpModal({ phone, actionLabel, onVerified, onClose }: Props) {
  const { sendOtp: sendLoginOtp, verifyOtp: verifyLoginOtp } = useAuth();
  const [stage, setStage] = useState<Stage>('sending');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentOnce = useRef(false);
  const doneRef = useRef(onVerified);
  doneRef.current = onVerified;

  const verified = useCallback(() => {
    setStage('verified');
    window.setTimeout(() => doneRef.current(), TICK_HOLD_MS);
  }, []);

  const sendOtp = useCallback(async () => {
    setError('');
    setStage('sending');
    try {
      await sendLoginOtp(phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.error : 'Could not send OTP. Check your number and try again.');
      setStage('entry');
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(RESEND_SECONDS);
    setStage('entry');
  }, [phone, sendLoginOtp]);

  // Send once on open (guard against React strict-mode double effect).
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void sendOtp();
  }, [sendOtp]);

  useEffect(() => {
    if (stage === 'entry') inputRef.current?.focus();
  }, [stage]);

  // Lift the sheet above the on-screen keyboard (fixed elements don't resize with it).
  const [kbOffset, setKbOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (stage !== 'entry' || secondsLeft <= 0) return;
    const t = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stage, secondsLeft]);

  const verify = useCallback(
    async (code: string) => {
      setStage('verifying');
      setError('');
      try {
        await verifyLoginOtp(phone, code);
        verified();
      } catch (err) {
        setError(err instanceof ApiError ? err.body.error : 'Could not verify. Please try again.');
        setOtp('');
        setShakeKey((k) => k + 1);
        setStage('entry');
      }
    },
    [phone, verified, verifyLoginOtp],
  );

  function handleChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    if (error) setError('');
    if (digits.length === OTP_LENGTH) void verify(digits);
  }

  const busy = stage === 'sending' || stage === 'verifying';
  const maskedPhone = `+91 ${phone.slice(0, 2)}••••${phone.slice(-4)}`;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Verify your mobile number"
      style={{ paddingBottom: kbOffset + 12 }}
      onClick={stage === 'verified' ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#FFFDF8] border border-[#2B1B0C] p-5 pb-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {stage !== 'verified' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 p-1 text-[#8A7A63] hover:text-[#2B1B0C]"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {stage === 'verified' ? (
          <div className="flex flex-col items-center py-6 text-center">
            <AnimatedTick size={88} />
            <p className="mt-4 font-heading text-lg font-extrabold text-[#2B1B0C]">Logged in</p>
            <p className="mt-1 font-body text-sm text-[#6B5539]">Placing your order…</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1E7B4A]" />
              <p className="font-heading text-base font-extrabold text-[#2B1B0C]">Verify your mobile number</p>
            </div>
            <p className="mt-2 font-body text-sm text-[#6B5539] leading-relaxed">
              {stage === 'sending' ? 'Sending OTP to ' : 'Enter the 6-digit OTP sent to '}
              <span className="font-bold text-[#2B1B0C]">{maskedPhone}</span>
            </p>

            {/* Six boxes drawn over one real input (autofill + paste friendly). */}
            <div
              key={shakeKey}
              className={`relative mt-4 ${shakeKey > 0 ? 'animate-otp-shake' : ''}`}
              onClick={() => inputRef.current?.focus()}
            >
              <div className="flex justify-between gap-2" aria-hidden>
                {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                  const active = stage === 'entry' && i === Math.min(otp.length, OTP_LENGTH - 1);
                  return (
                    <div
                      key={i}
                      className={`flex h-12 flex-1 items-center justify-center rounded-lg border-2 bg-white font-heading text-xl font-extrabold text-[#2B1B0C] transition-colors ${
                        error ? 'border-[#B23A2E]' : active ? 'border-[#9C5A26]' : 'border-[#2B1B0C]/20'
                      }`}
                    >
                      {otp[i] ?? ''}
                    </div>
                  );
                })}
              </div>
              <input
                ref={inputRef}
                value={otp}
                onChange={(e) => handleChange(e.target.value)}
                disabled={busy}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                maxLength={OTP_LENGTH}
                aria-label="One-time password"
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
            </div>

            <p className="mt-2 min-h-[1.25rem] font-body text-xs font-semibold text-[#B23A2E]" role="alert">
              {error}
            </p>

            <button
              type="button"
              onClick={() => otp.length === OTP_LENGTH && void verify(otp)}
              disabled={busy || otp.length !== OTP_LENGTH}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#2B1B0C] px-6 py-3 font-body text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#9C5A26] disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {stage === 'sending' ? 'Sending OTP…' : 'Verifying…'}
                </>
              ) : (
                `Verify & ${actionLabel}`
              )}
            </button>

            <div className="mt-3 flex items-center justify-between font-body text-xs text-[#6B5539]">
              <button type="button" onClick={onClose} className="font-semibold underline underline-offset-2">
                Change number
              </button>
              {secondsLeft > 0 ? (
                <span>Resend OTP in {secondsLeft}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOtp('');
                    void sendOtp();
                  }}
                  disabled={busy}
                  className="font-bold text-[#9C5A26] underline underline-offset-2 disabled:opacity-50"
                >
                  Resend OTP
                </button>
              )}
            </div>
            <p className="mt-3 text-center font-body text-[11px] text-[#8A7A63]">
              Only used to confirm your order &amp; send delivery updates.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
