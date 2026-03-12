import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './App.css';
import bgVideo from './assets/video/background.mp4';
import CreateAccount from './pages/create-account';
import ConfirmEmail from './pages/confirm-email';
import ForgotPassword from './pages/forgot-pass';
import AdminDashboard from './pages/admin-dashboard';

// ==================== LOGIN VIEW ====================
const LoginView = () => {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('http://192.168.1.16:5000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('loggedInUser', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Cannot connect to server. Check if backend is running.');
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
          <div className="branding-eyebrow">Visible Technology International Corp.</div>

          <h1 className="main-title">
            THINK<br />DIGITAL.<br />BUILD<br />SMART.
          </h1>

          <p className="sub-text">
            Your trusted partner in navigating the digital landscape — from IT solutions to scalable digital infrastructure.
          </p>

          <div className="branding-stats">
            <div className="stat-item">
              <span className="stat-num">10+</span>
              <span className="stat-label">Years Active</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-num">200+</span>
              <span className="stat-label">Projects Done</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-num">50+</span>
              <span className="stat-label">Clients Served</span>
            </div>
          </div>
        </motion.div>

        {/* Login card */}
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="login-card"
          >
          <p className="card-label">Secure Portal</p>
          <h2 className="card-title">Get Started</h2>
          <p className="card-welcome">Welcome back — sign in to your account.</p>
          <hr className="divider" />

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="error-msg"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@vtic.ph"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="forgot-container">
              <a href="/forgot-password">Forgot Password?</a>
            </div>

            <button type="submit" className="login-btn">Sign In</button>
          </form>

          <p className="signup-footer">
            Don't have an account? <Link to="/signup">Sign up here</Link>
          </p>
        </motion.div>

      </div>
    </div>
  );
};

// ==================== APP ====================
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"               element={<LoginView />} />
        <Route path="/signup"         element={<CreateAccount />} />
        <Route path="/confirm-email"  element={<ConfirmEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard"      element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
