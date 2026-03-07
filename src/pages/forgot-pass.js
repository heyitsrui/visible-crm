import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Loader2, ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import '../styles/forgot-pass.css';
import bgVideo from '../assets/video/background.mp4';

const STEP_META = [
  { icon: Mail,        label: 'Step 1 of 3', title: 'Forgot Password?',  sub: 'Enter the email address linked to your account.'       },
  { icon: ShieldCheck, label: 'Step 2 of 3', title: 'Verify Your Email', sub: 'Enter the 6-digit code we sent to your inbox.'          },
  { icon: KeyRound,    label: 'Step 3 of 3', title: 'Reset Password',    sub: 'Choose a new password to secure your account.'          },
];

function ForgotPassword() {
  const [step,            setStep]            = useState(1);
  const [email,           setEmail]           = useState('');
  const [otp,             setOtp]             = useState(['', '', '', '', '', '']);
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [error,           setError]           = useState('');
  const [successMessage,  setSuccessMessage]  = useState('');
  const [otpMessage,      setOtpMessage]      = useState('');
  const [canResend,       setCanResend]       = useState(true);
  const [timer,           setTimer]           = useState(0);
  const [isLoading,       setIsLoading]       = useState(false);

  const inputRefs = useRef([]);
  const API = 'http://localhost:5000';

  const meta = STEP_META[step - 1];
  const StepIcon = meta.icon;

  /* ── Timer for resend ───────────────────────────────── */
  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return; }
    const id = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  /* ── OTP input handlers ─────────────────────────────── */
  const handleOtpChange = (value, index) => {
    if (value !== '' && !/^[a-zA-Z0-9]$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1].focus();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0)
      inputRefs.current[index - 1].focus();
  };

  const clearMessages = () => { setError(''); setOtpMessage(''); setSuccessMessage(''); };

  /* ── Step 1 — Send OTP ──────────────────────────────── */
  const handleGetOtp = async () => {
    clearMessages();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Please enter a valid email address.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch(`${API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'reset' }),
      });
      const data = await res.json();
      if (data.success) { setStep(2); }
      else setError(data.message || 'Email not registered.');
    } catch { setError('Cannot connect to server.'); }
    finally { setIsLoading(false); }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    await handleGetOtp();
    setCanResend(false);
    setTimer(60);
  };

  /* ── Step 2 — Verify OTP ────────────────────────────── */
  const handleConfirmOtp = async () => {
    clearMessages();
    const otpString = otp.join('');
    if (otpString.length < 6) { setError('Please enter all 6 digits.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch(`${API}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpString }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpMessage('Code verified! Setting up your new password…');
        setTimeout(() => { setStep(3); setOtpMessage(''); setIsLoading(false); }, 800);
      } else {
        setError(data.message || 'Invalid or expired OTP.');
        setIsLoading(false);
      }
    } catch { setError('Cannot connect to server.'); setIsLoading(false); }
  };

  /* ── Step 3 — Reset password ────────────────────────── */
  const handleResetPassword = async () => {
    clearMessages();
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch(`${API}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Password updated! Redirecting to login…');
        setTimeout(() => { window.location.href = '/'; }, 3000);
      } else { setError(data.message || 'Failed to reset password.'); setIsLoading(false); }
    } catch { setError('Server error.'); setIsLoading(false); }
  };

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="fp-container">

      {/* Background */}
      <video autoPlay loop muted playsInline className="bg-video">
        <source src={bgVideo} type="video/mp4" />
      </video>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Nav — logo only */}
      <div className="header-nav">
        <img src="/vtic.webp" alt="VTIC Logo" className="logo-white" />
      </div>

      {/* Main */}
      <div className="fp-content">

        {/* Branding */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="fp-branding"
        >
          <div className="branding-eyebrow">Account Recovery</div>
          <h1 className="fp-title">RESET<br />YOUR<br />ACCESS.</h1>
          <p className="fp-desc">
            Follow the steps to verify your identity and set a new password for your account.
          </p>

          <div className="fp-steps">
            {['Enter your email', 'Verify with OTP', 'Set new password'].map((label, i) => {
              const state = step > i + 1 ? 'done' : step === i + 1 ? 'active' : '';
              return (
                <div className="fp-step" key={i}>
                  <div className={`fp-step-num ${state}`}>
                    {state === 'done' ? '✓' : i + 1}
                  </div>
                  <div className={`fp-step-text ${state}`}>
                    <strong>{label}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="fp-card"
        >
          {/* Fixed head */}
          <div className="fp-card-head">
            <Link to="/" className="card-back-link">
              <ArrowLeft size={12} /> Back to Login
            </Link>

            <div className="fp-step-icon"><StepIcon size={20} /></div>
            <p className="card-label">{meta.label}</p>
            <h2 className="fp-card-title">{meta.title}</h2>
            <p className="fp-card-sub">{meta.sub}</p>
            <hr className="fp-divider" />
          </div>

          {/* Scrollable body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.22 }}
              className="fp-card-body"
            >
              {/* ── Messages ── */}
              {error        && <div className="fp-error">{error}</div>}
              {otpMessage   && <div className="fp-info">{otpMessage}</div>}
              {successMessage && <div className="fp-success">{successMessage}</div>}

              {/* ── Step 1 ── */}
              {step === 1 && (
                <>
                  <label className="fp-label">Email Address</label>
                  <input
                    type="email"
                    className="fp-input"
                    placeholder="you@vtic.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => e.key === 'Enter' && handleGetOtp()}
                  />
                  <button className="fp-btn" onClick={handleGetOtp} disabled={isLoading}>
                    {isLoading ? <Loader2 className="spinner-icon" size={18} /> : 'Send OTP'}
                  </button>
                </>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <>
                  <label className="fp-label">6-digit code</label>
                  <div className="otp-input-container">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        type="text"
                        maxLength="1"
                        className="otp-box"
                        value={digit}
                        ref={(el) => (inputRefs.current[i] = el)}
                        onChange={(e) => handleOtpChange(e.target.value, i)}
                        onKeyDown={(e) => handleKeyDown(e, i)}
                        disabled={isLoading}
                      />
                    ))}
                  </div>

                  <button className="fp-btn" onClick={handleConfirmOtp} disabled={isLoading}>
                    {isLoading ? <Loader2 className="spinner-icon" size={18} /> : 'Verify Code'}
                  </button>

                  <div className="resend-container">
                    <span className="resend-text">Didn't receive a code?</span>
                    <button
                      type="button"
                      className={`resend-link ${(!canResend || isLoading) ? 'disabled' : ''}`}
                      onClick={handleResendOtp}
                      disabled={!canResend || isLoading}
                    >
                      {canResend ? 'Resend Code' : `Wait ${timer}s`}
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 3 ── */}
              {step === 3 && (
                <>
                  <label className="fp-label">New Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="fp-input"
                      placeholder="8+ characters with a number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <label className="fp-label">Confirm Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="fp-input"
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowConfirm(!showConfirm)} disabled={isLoading}>
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <button className="fp-btn" onClick={handleResetPassword} disabled={isLoading}>
                    {isLoading ? <Loader2 className="spinner-icon" size={18} /> : 'Update Password'}
                  </button>
                </>
              )}

            </motion.div>
          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  );
}

export default ForgotPassword;