import React, { useState, useEffect } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, AlertCircle, Check } from "lucide-react";
import "../styles/c-pass.css";

/* ── Password strength helper ───────────────────────────── */
const getStrength = (pwd) => {
  if (!pwd) return { score: 0, label: "", cls: "" };
  let score = 0;
  if (pwd.length >= 8)              score++;
  if (/[0-9]/.test(pwd))            score++;
  if (/[A-Z]/.test(pwd))            score++;
  if (/[^a-zA-Z0-9]/.test(pwd))    score++;
  const map = [
    { label: "Weak",   cls: "weak"   },
    { label: "Fair",   cls: "fair"   },
    { label: "Good",   cls: "good"   },
    { label: "Strong", cls: "strong" },
  ];
  return { score, ...map[score - 1] || map[0] };
};

const tipItems = [
  { text: "At least 8 characters",          check: (p) => p.length >= 8       },
  { text: "Contains a number",              check: (p) => /[0-9]/.test(p)     },
  { text: "Contains an uppercase letter",   check: (p) => /[A-Z]/.test(p)     },
  { text: "Contains a special character",   check: (p) => /[^a-zA-Z0-9]/.test(p) },
];

const CPass = ({ user }) => {
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [ready,           setReady]           = useState(false);

  useEffect(() => { setTimeout(() => setReady(true), 80); }, []);

  const strength = getStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");

    const passwordRegex = /^(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword))
      return setError("Password must be at least 8 characters and include a number.");
    if (newPassword !== confirmPassword)
      return setError("Passwords do not match.");

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: newPassword }),
      });
      const data = await response.json();
      if (data.success) {
        alert("Success! Your password is now secure.");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(data.message || "Failed to update password.");
      }
    } catch {
      setError("System error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`cpass-wrapper ${ready ? "cp-ready" : ""}`}>
      <div className="cpass-col">

        {/* ── Hero banner ──────────────────────────── */}
        <div className="cpass-hero">
          <div className="cpass-hero-icon">
            <KeyRound size={24} />
          </div>
          <div className="cpass-hero-text">
            <div className="cpass-hero-title">Change Password</div>
            <div className="cpass-hero-sub">
              Keep your account secure by updating your credentials regularly.
            </div>
          </div>
        </div>

        {/* ── Form card ────────────────────────────── */}
        <div className="cpass-card">
          <div className="cpass-section-label">
            <div className="cpass-section-icon"><ShieldCheck size={13} /></div>
            Update Credentials
          </div>

          {error && (
            <div className="cpass-error">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <form onSubmit={handlePasswordChange}>

            {/* New password */}
            <div className="cpass-group">
              <label className="cpass-label">New Password <span>*</span></label>
              <div className="cpass-input-wrapper">
                <input
                  type={showPass ? "text" : "password"}
                  className="cpass-input"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button type="button" className="cpass-eye-icon" onClick={() => setShowPass(!showPass)} disabled={loading}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength meter */}
              {newPassword.length > 0 && (
                <div className="cpass-strength">
                  <div className="cpass-strength-bars">
                    {[1,2,3,4].map((n) => (
                      <div
                        key={n}
                        className={`cpass-strength-bar ${strength.score >= n ? `active-${strength.cls}` : ""}`}
                      />
                    ))}
                  </div>
                  <span className={`cpass-strength-label ${strength.cls}`}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="cpass-group">
              <label className="cpass-label">Confirm Password <span>*</span></label>
              <div className="cpass-input-wrapper">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="cpass-input"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button type="button" className="cpass-eye-icon" onClick={() => setShowConfirm(!showConfirm)} disabled={loading}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Match indicator */}
              {passwordsMatch   && <div className="cpass-match ok"><Check size={11}/> Passwords match</div>}
              {passwordsMismatch && <div className="cpass-match err"><AlertCircle size={11}/> Passwords don't match</div>}
            </div>

            <button type="submit" className="cpass-button" disabled={loading}>
              {loading
                ? <><Loader2 className="cp-spinner" size={16} /> Updating…</>
                : "Update Password"
              }
            </button>
          </form>
        </div>

        {/* ── Tips card ────────────────────────────── */}
        <div className="cpass-tips">
          <div className="cpass-tips-title">Password Requirements</div>
          <ul>
            {tipItems.map((tip, i) => (
              <li key={i} className={newPassword.length > 0 && tip.check(newPassword) ? "met" : ""}>
                {tip.text}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default CPass;