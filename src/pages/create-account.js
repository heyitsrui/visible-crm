import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import '../styles/create-account.css';
import bgVideo from '../assets/video/background.mp4';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_IP;

function CreateAccount() {
  const [formData, setFormData] = useState({
    position: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const validate = () => {
    const { phone, password, confirmPassword } = formData;
    const passwordRegex = /^(?=.*[0-9]).{8,}$/;
    const phoneRegex    = /^[0-9+]{10,15}$/;
    if (!phoneRegex.test(phone)) {
      setError('Please enter a valid phone number.');
      return false;
    }
    if (!passwordRegex.test(password)) {
      setError('Password must be at least 8 characters and include a number.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError('');

    try {
      await axios.post(`${API_URL}/send-otp`, {
        email: formData.email,
        type: 'signup',
      });
      localStorage.setItem('pendingUserData', JSON.stringify(formData));
      localStorage.setItem('userEmail', formData.email);
      navigate('/confirm-email');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">

      {/* ── Background video ── */}
      <video autoPlay loop muted playsInline className="bg-video">
        <source src={bgVideo} type="video/mp4" />
      </video>

      {/* ── Ambient orbs ── */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* ── Header nav ── */}
      <div className="header-nav">
        <img src="/vtic.webp" alt="VTIC Logo" className="logo-white" />

      </div>

      {/* ── Main content ── */}
      <div className="content-wrapper">

        {/* Branding */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="branding-box"
        >
          <div className="branding-eyebrow">New Account</div>

          <h1 className="main-title">
            JOIN<br />THE<br />TEAM.
          </h1>

          <p className="sub-text">
            Create your account to access the Visible dashboard and start collaborating with your team.
          </p>

          <div className="reg-steps">
            <div className="reg-step">
              <div className="reg-step-num">1</div>
              <div className="reg-step-text"><strong>Fill in your details</strong> — name, email, and role</div>
            </div>
            <div className="reg-step">
              <div className="reg-step-num">2</div>
              <div className="reg-step-text"><strong>Verify your email</strong> — we'll send you an OTP</div>
            </div>
            <div className="reg-step">
              <div className="reg-step-num">3</div>
              <div className="reg-step-text"><strong>Start working</strong> — access your dashboard</div>
            </div>
          </div>
        </motion.div>

        {/* Register card */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="register-card"
        >
          {/* Fixed header — never scrolls */}
          <div className="card-fixed-head">
            <Link to="/" className="card-back-link">
              <ArrowLeft size={12} /> Back to Login
            </Link>
            <p className="card-label">Registration</p>
            <h2 className="card-title">Create Account</h2>
            <p className="card-welcome">Fill in the details below to get started.</p>
            <hr className="divider" />
          </div>

          {/* Scrollable body */}
          <div className="card-scroll-body">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="error-bubble"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleRegister} className="login-form">

            <div className="input-group">
              <label>Position</label>
              <select
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
                className="custom-select"
                disabled={isLoading}
              >
                <option value="" disabled>Select your position</option>
                <option value="manager">Sales Manager</option>
                <option value="executive">Sales Executive</option>
                <option value="finance">Finance</option>
              </select>
            </div>

            <div className="input-group">
              <label>Full Name</label>
              <input
                name="name"
                type="text"
                placeholder="Your full name"
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <input
                name="email"
                type="email"
                placeholder="you@vtic.ph"
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label>Phone Number</label>
              <input
                name="phone"
                type="tel"
                placeholder="09XXXXXXXXX"
                value={formData.phone}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="password-stack">
                <div className="password-input-wrapper">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="8+ characters with a number"
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                <input
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="register-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="spinner-icon" size={18} />
              ) : (
                'Create Account'
              )}
            </button>

            </form>
          </div>{/* end card-scroll-body */}
        </motion.div>

      </div>
    </div>
  );
}

export default CreateAccount;
