import React, { useState, useEffect, useRef } from "react";
import {
  Camera, User, Mail, Phone, Hash, Shield,
  Pencil, Check, X, BookOpen, Star
} from "lucide-react";
import axios from "axios";
import "../styles/myprofile.css";

const permissionsMap = {
  admin:     ["Full System Access", "User Management", "Project Approval"],
  manager:   ["Team Access", "Project View", "Task Management"],
  executive: ["Project View", "Reports Access"],
  finance:   ["Financial View", "Invoicing"],
  viewer:    ["Read Only Access"],
};

const roleColors = {
  admin:     { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.35)',  text: '#fca5a5'  },
  manager:   { bg: 'rgba(37,99,235,0.18)',  border: 'rgba(37,99,235,0.4)',   text: '#93c5fd'  },
  executive: { bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.4)',  text: '#c4b5fd'  },
  finance:   { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.4)',  text: '#6ee7b7'  },
  viewer:    { bg: 'rgba(148,163,184,0.18)',border: 'rgba(148,163,184,0.4)', text: '#cbd5e1'  },
};

const MyProfile = ({ user, onProfileUpdate }) => {
  const [isEditing, setIsEditing]   = useState(false);
  const [ready,     setReady]       = useState(false);
  const [profileData, setProfileData] = useState({
    name: "", phone: "", about: "", avatar: "",
  });
  const [draft, setDraft] = useState({});
  const fileRef = useRef();

  /* ── Fetch ──────────────────────────────────────────── */
  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return;
      try {
        const res = await axios.get(`http://localhost:5000/api/users/${user.id}`);
        if (res.data.success) {
          const u = res.data.user;
          setProfileData({ name: u.name||"", phone: u.phone||"", about: u.about||"", avatar: u.avatar||"" });
        }
      } catch (err) { console.error("Error fetching user:", err); }
    };
    fetch();
    setTimeout(() => setReady(true), 80);
  }, [user?.id]);

  /* ── Edit / Cancel ──────────────────────────────────── */
  const startEdit = () => {
    setDraft({ ...profileData });
    setIsEditing(true);
  };
  const cancelEdit = () => {
    setIsEditing(false);
    setDraft({});
  };

  /* ── Avatar upload ──────────────────────────────────── */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File too large (max 5MB)."); return; }
    const reader = new FileReader();
    reader.onloadend = () => setDraft((p) => ({ ...p, avatar: reader.result }));
    reader.readAsDataURL(file);
  };

  /* ── Save ───────────────────────────────────────────── */
  const handleSave = async () => {
    try {
      const res = await axios.put(`http://localhost:5000/api/users/${user.id}/profile`, {
        name:   draft.name,
        phone:  draft.phone,
        about:  draft.about,
        avatar: draft.avatar,
        email:  user.email,
        role:   user.role,
      });
      if (res.data.success) {
        setProfileData({ ...draft });
        const updatedUser = { ...user, ...draft };
        localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));
        if (onProfileUpdate) onProfileUpdate();
        setIsEditing(false);
        setDraft({});
        alert("Profile updated successfully!");
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to update profile. Check server payload limits for large images.");
    }
  };

  const currentPermissions = permissionsMap[user?.role?.toLowerCase()] || ["Basic Access"];
  const roleStyle = roleColors[user?.role?.toLowerCase()] || roleColors.viewer;
  const displayAvatar = isEditing ? draft.avatar : profileData.avatar;
  const displayName   = (isEditing ? draft.name : profileData.name) || "User Profile";

  return (
    <div className={`mp-page ${ready ? "mp-ready" : ""}`}>

      {/* ── Hero banner ──────────────────────────────── */}
      <div className="mp-hero">

        {/* Avatar */}
        <div className="mp-avatar-wrap">
          <div className="mp-avatar">
            {displayAvatar
              ? <img src={displayAvatar} alt="Profile" />
              : <User size={40} color="rgba(255,255,255,0.5)" />
            }
          </div>
          {isEditing && (
            <label className="mp-avatar-upload" title="Change photo">
              <Camera size={14} />
              <input type="file" hidden accept="image/*" ref={fileRef} onChange={handleImageChange} />
            </label>
          )}
        </div>

        {/* Info */}
        <div className="mp-hero-info">
          <div className="mp-hero-name">{displayName}</div>
          <div className="mp-hero-meta">
            <span className="mp-hero-email">{user?.email}</span>
            <span
              className="mp-role-badge"
              style={{ background: roleStyle.bg, borderColor: roleStyle.border, color: roleStyle.text }}
            >
              {user?.role || "viewer"}
            </span>
          </div>
          <div className="mp-hero-id">ID · {String(user?.id || 0).padStart(5, '0')}</div>
        </div>

        {/* Action buttons */}
        <div className="mp-hero-actions">
          {isEditing ? (
            <>
              <button className="mp-btn-cancel" onClick={cancelEdit}>
                <X size={13} /> Cancel
              </button>
              <button className="mp-btn-save" onClick={handleSave}>
                <Check size={13} /> Save
              </button>
            </>
          ) : (
            <button className="mp-btn-edit" onClick={startEdit}>
              <Pencil size={13} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* ── Body grid ────────────────────────────────── */}
      <div className="mp-body">

        {/* ── Contact info card ── */}
        <div className="mp-card">
          <div className="mp-card-title">
            <div className="mp-card-title-icon"><User size={12} /></div>
            Contact Info
          </div>

          {/* Name */}
          <div className="mp-detail-row">
            <div className="mp-detail-icon"><User size={14} /></div>
            <div className="mp-detail-content">
              <div className="mp-detail-label">Full Name</div>
              {isEditing
                ? <input className="mp-input" value={draft.name} onChange={(e) => setDraft({...draft, name: e.target.value})} placeholder="Your full name" />
                : <div className={`mp-detail-value ${!profileData.name ? 'muted' : ''}`}>{profileData.name || "Not set"}</div>
              }
            </div>
          </div>

          {/* Email */}
          <div className="mp-detail-row">
            <div className="mp-detail-icon"><Mail size={14} /></div>
            <div className="mp-detail-content">
              <div className="mp-detail-label">Email</div>
              <div className="mp-detail-value">{user?.email}</div>
            </div>
          </div>

          {/* Phone */}
          <div className="mp-detail-row">
            <div className="mp-detail-icon"><Phone size={14} /></div>
            <div className="mp-detail-content">
              <div className="mp-detail-label">Phone</div>
              {isEditing
                ? <input className="mp-input" value={draft.phone} onChange={(e) => setDraft({...draft, phone: e.target.value})} placeholder="+63 9XX XXX XXXX" />
                : <div className={`mp-detail-value ${!profileData.phone ? 'muted' : ''}`}>{profileData.phone || "Not set"}</div>
              }
            </div>
          </div>

          {/* ID */}
          <div className="mp-detail-row">
            <div className="mp-detail-icon"><Hash size={14} /></div>
            <div className="mp-detail-content">
              <div className="mp-detail-label">Employee ID</div>
              <div className="mp-detail-value">{String(user?.id || 0).padStart(5, '0')}</div>
            </div>
          </div>
        </div>

        {/* ── Role & permissions card ── */}
        <div className="mp-card">
          <div className="mp-card-title">
            <div className="mp-card-title-icon"><Shield size={12} /></div>
            Role & Permissions
          </div>

          {/* Role row */}
          <div className="mp-detail-row">
            <div className="mp-detail-icon"><Star size={14} /></div>
            <div className="mp-detail-content">
              <div className="mp-detail-label">Current Role</div>
              <div className="mp-detail-value" style={{ textTransform: 'capitalize' }}>
                {user?.role || "Viewer"}
              </div>
            </div>
          </div>

          {/* Permission pills */}
          <div style={{ marginTop: 14 }}>
            <div className="mp-detail-label" style={{ marginBottom: 10 }}>Access Permissions</div>
            <div className="mp-perms">
              {currentPermissions.map((perm, i) => (
                <span key={i} className="mp-perm-pill">{perm}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── About card (full width) ── */}
        <div className="mp-card mp-body-full">
          <div className="mp-card-title">
            <div className="mp-card-title-icon"><BookOpen size={12} /></div>
            About
          </div>
          {isEditing
            ? <textarea
                className="mp-textarea"
                value={draft.about}
                onChange={(e) => setDraft({...draft, about: e.target.value})}
                placeholder="Tell your team a bit about yourself..."
              />
            : <p className={`mp-about-text ${!profileData.about ? 'empty' : ''}`}>
                {profileData.about || "No description yet. Click Edit Profile to add one."}
              </p>
          }
        </div>

      </div>
    </div>
  );
};

export default MyProfile;