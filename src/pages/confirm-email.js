import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck, RefreshCw } from "lucide-react";
import axios from "axios";
import "../styles/create-account.css";
import bgVideo from "../assets/video/background.mp4";

function ConfirmEmail() {
  const navigate = useNavigate();

  const [otp,       setOtp]       = useState(new Array(6).fill(""));
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef([]);
  const email = localStorage.getItem("userEmail");

  const handleChange = (element, index) => {
    const value = element.value.replace(/[^a-zA-Z0-9]/g, "");
    if (!value) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1].focus();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      if (otp[index]) {
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1].focus();
      }
    }
  };

  const handlePaste = (e) => {
    const data = e.clipboardData.getData("text").slice(0, 6).split("");
    if (data.length === 6) {
      setOtp(data);
      inputRefs.current[5].focus();
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) { setError("Please enter all 6 digits."); return; }

    try {
      setLoading(true);
      setError("");
      const verifyRes = await axios.post("http://localhost:5000/verify-otp", { email, otp: fullOtp });

      if (verifyRes.data.success) {
        const savedData = JSON.parse(localStorage.getItem("pendingUserData"));
        if (!savedData) { setError("Registration session expired. Please go back."); return; }

        await axios.post("http://localhost:5000/register", {
          name:     savedData.name,
          email:    savedData.email,
          phone:    savedData.phone,
          password: savedData.password,
          role:     savedData.position,
        });

        alert("Account created and email verified successfully!");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("pendingUserData");
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP or registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      setError("");
      await axios.post("http://localhost:5000/send-otp", { email });
      alert("New OTP sent to your email.");
    } catch (err) {
      setError("Failed to resend OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="login-container">

      <video autoPlay loop muted playsInline className="bg-video">
        <source src={bgVideo} type="video/mp4" />
      </video>

      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="header-nav">
        <img src="/vtic.webp" alt="VTIC Logo" className="logo-white" />
      </div>

      <div className="content-wrapper">

        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="branding-box"
        >
          <div className="branding-eyebrow">Almost there</div>
          <h1 className="main-title">CHECK<br />YOUR<br />EMAIL.</h1>
          <p className="sub-text">
            We sent a 6-digit verification code to your inbox. Enter it to confirm your identity and activate your account.
          </p>

          <div className="reg-steps">
            <div className="reg-step">
              <div className="reg-step-num" style={{ background: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.5)', color: '#6ee7b7' }}>✓</div>
              <div className="reg-step-text"><strong>Details submitted</strong> — your info is saved</div>
            </div>
            <div className="reg-step">
              <div className="reg-step-num" style={{ background: 'rgba(37,99,235,0.4)', borderColor: 'rgba(37,99,235,0.8)', color: '#93c5fd' }}>2</div>
              <div className="reg-step-text"><strong>Verify your email</strong> — enter the OTP below</div>
            </div>
            <div className="reg-step">
              <div className="reg-step-num">3</div>
              <div className="reg-step-text"><strong>Start working</strong> — access your dashboard</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="register-card"
        >
          <div className="card-fixed-head">
            <Link to="/signup" className="card-back-link">
              <ArrowLeft size={12} /> Back to Registration
            </Link>
            <div className="otp-icon-wrap">
              <MailCheck size={22} />
            </div>
            <p className="card-label">Step 2 of 3</p>
            <h2 className="card-title">Confirm Email</h2>
            <p className="card-welcome">
              Code sent to <span className="otp-email-highlight">{email}</span>
            </p>
            <hr className="divider" />
          </div>

          <div className="card-scroll-body">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="error-bubble"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleConfirm} className="login-form">
              <div className="input-group">
                <label>Enter 6-digit code</label>
                <div className="otp-input-container">
                  {otp.map((data, index) => (
                    <input
                      key={index}
                      type="text"
                      className="otp-box"
                      maxLength="1"
                      value={data}
                      ref={(el) => (inputRefs.current[index] = el)}
                      onChange={(e) => handleChange(e.target, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      required
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="register-btn" disabled={loading}>
                {loading
                  ? <Loader2 className="spinner-icon" size={18} />
                  : "Confirm & Continue"
                }
              </button>

              <div className="resend-wrapper">
                <button type="button" onClick={handleResend} disabled={resending} className="resend-btn">
                  {resending
                    ? <><Loader2 className="spinner-icon" size={13} style={{ display:'inline', marginRight:5 }} /> Sending…</>
                    : <><RefreshCw size={12} style={{ display:'inline', marginRight:5 }} /> Resend OTP</>
                  }
                </button>
              </div>
            </form>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default ConfirmEmail;