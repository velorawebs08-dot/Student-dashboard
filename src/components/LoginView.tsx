import { ArrowLeft, ArrowRight, KeyRound, Mail, RefreshCw, ShieldCheck, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabaseClient';
import { siteData } from '../siteData';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { useToast } from './Toast';

interface LoginViewProps {
  onSuccess: (role: 'admin' | 'parent', displayName: string) => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRefs.current[0]?.focus();
    }
  }, [step]);

  async function handleCheckRegistered(e?: FormEvent, isResend = false) {
    if (e) e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      const msg =
        supabaseConfigError ||
        'App configuration is incomplete. Please contact Patil Classes.';
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!normalizedEmail || !normalizedName) {
      setError('Not registered. Please contact Patil Classes.');
      return;
    }

    setLoading(true);
    try {
      const { data: isRegistered, error: rpcError } = await supabase.rpc('check_registered', {
        p_email: normalizedEmail,
        p_name: normalizedName,
      });

      if (rpcError) {
        const msg = 'Unable to verify your details right now. Please try again.';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      if (!isRegistered) {
        setError('Not registered. Please contact Patil Classes.');
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true },
      });

      if (otpError) {
        const msg = 'Unable to send verification code. Please try again.';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      setStep('otp');
      if (isResend) {
        setOtpDigits(['', '', '', '', '', '']);
        showToast('A new verification code has been sent to your email.', 'success');
        window.setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
      }
    } catch {
      const msg = 'Network error. Please check your connection and try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function submitOtpCode(code: string) {
    if (code.length !== 6 || loading) return;
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: 'email',
      });

      if (verifyError) {
        setOtpDigits(['', '', '', '', '', '']);
        setError('Wrong or expired code. Please use the latest code, or tap Resend.');
        window.setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
        return;
      }

      const { data: role, error: linkError } = await supabase.rpc('link_my_account');
      if (linkError || (role !== 'admin' && role !== 'parent')) {
        await supabase.auth.signOut();
        setStep('credentials');
        setOtpDigits(['', '', '', '', '', '']);
        setError('Not registered. Please contact Patil Classes.');
        return;
      }

      if (role === 'parent') {
        void supabase.functions
          .invoke('send-whatsapp', { body: { type: 'welcome' } })
          .then(({ error: fnError }) => {
            if (fnError) console.error('send-whatsapp error:', fnError);
          })
          .catch((err) => {
            console.error('send-whatsapp failed:', err);
          });
      }

      onSuccess(role, name.trim());
    } catch {
      const msg = 'Verification failed. Please try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }

    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      chars.forEach((ch, idx) => {
        next[idx] = ch;
      });
      setOtpDigits(next);
      const focusIdx = Math.min(chars.length, 5);
      otpInputRefs.current[focusIdx]?.focus();
      if (chars.length === 6) {
        void submitOtpCode(next.join(''));
      }
      return;
    }

    const next = [...otpDigits];
    next[index] = cleaned;
    setOtpDigits(next);
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    const joined = next.join('');
    if (joined.length === 6) {
      void submitOtpCode(joined);
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, idx) => {
      next[idx] = ch;
    });
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) {
      void submitOtpCode(next.join(''));
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-between px-4 py-6 sm:px-6 lg:px-8">
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size="sm" />
          <span className="text-base font-bold tracking-tight text-[#0F2A4A] whitespace-nowrap">
            {siteData.tuitionName}
          </span>
        </div>
        <PWAInstallButton variant="compact" />
      </header>

      <main className="w-full max-w-md mx-auto my-auto py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8"
        >
          {step === 'credentials' ? (
            <form onSubmit={(e) => void handleCheckRegistered(e, false)} noValidate>
              <div className="mb-6">
                <p className="text-xs font-semibold text-[#B47109] tracking-wide">
                  {siteData.standard} Standard Marks Portal
                </p>
                <h1 className="mt-1.5 text-2xl font-bold text-[#0F2A4A] tracking-tight">
                  Sign in to your account
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Enter your registered email and name to receive a 6-digit verification code.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-[#0F2A4A] mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm text-[#0F2A4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60 focus:border-[#0F2A4A] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-name" className="block text-sm font-medium text-[#0F2A4A] mb-1.5">
                    Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full registered name"
                      className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm text-[#0F2A4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60 focus:border-[#0F2A4A] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 font-medium"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full min-h-[48px] rounded-xl bg-[#0F2A4A] hover:bg-[#163861] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{loading ? 'Checking details...' : 'Send Verification Code'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setError(null);
                  setOtpDigits(['', '', '', '', '', '']);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F2A4A] min-h-[36px] mb-4 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change email</span>
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 text-[#B47109] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#0F2A4A] tracking-tight">
                    Enter 6-digit code
                  </h1>
                  <p className="text-xs text-slate-500 truncate max-w-[260px]">
                    Sent to {email.trim().toLowerCase()}
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitOtpCode(otpDigits.join(''));
                }}
              >
                <div className="grid grid-cols-6 gap-2 my-5">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                      maxLength={6}
                      aria-label={`Digit ${idx + 1}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="h-12 sm:h-13 w-full text-center font-mono-tabular text-lg font-bold rounded-xl border border-slate-200 bg-[#F7F8FA] text-[#0F2A4A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623] focus:border-[#0F2A4A] transition-colors"
                    />
                  ))}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 font-medium"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6}
                  className="w-full min-h-[48px] rounded-xl bg-[#0F2A4A] hover:bg-[#163861] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{loading ? 'Verifying...' : 'Verify & Sign In'}</span>
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                <span>Code expires in {siteData.otpExpiryMinutes} minutes</span>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleCheckRegistered(undefined, true)}
                  className="inline-flex items-center gap-1 font-semibold text-[#0F2A4A] disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed min-h-[36px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resend code</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Sessions stay active for {siteData.sessionDays} days on your device.
        </p>
      </main>

      <footer className="w-full max-w-4xl mx-auto text-center text-xs text-slate-400">
        {siteData.tuitionName} · {siteData.standard} Standard
      </footer>
    </div>
  );
}
