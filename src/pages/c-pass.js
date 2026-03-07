import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "../styles/c-pass.css";

const CPass = ({ user }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");

    // Validation: 8+ characters, includes a number
    const passwordRegex = /^(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return setError("Password must be at least 8 characters and include a number.");
    }
    
    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match!");
    }
    
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
    } catch (err) {
      setError("System error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cpass-wrapper">
      <div className="cpass-card">
        <h2 className="cpass-title">Change Password</h2>
        <p className="cpass-subtitle">Update your account credentials below.</p>

        {error && <div className="cpass-error" style={{ color: '#ff4d4d', marginBottom: '15px' }}>{error}</div>}

        <form onSubmit={handlePasswordChange}>
          <div className="cpass-group">
            <label className="cpass-label">New Password <span>*</span></label>
            <div className="cpass-input-wrapper">
              <input
                type={showPass ? "text" : "password"}
                className="cpass-input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <div className="cpass-eye-icon" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </div>
            </div>
          </div>

          <div className="cpass-group">
            <label className="cpass-label">Confirm Password <span>*</span></label>
            <div className="cpass-input-wrapper">
              <input
                type={showPass ? "text" : "password"}
                className="cpass-input"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="cpass-button" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CPass;
