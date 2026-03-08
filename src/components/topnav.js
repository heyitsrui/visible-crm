import React, { useState, useEffect, useRef } from "react";
import { User, Lock, Bell, CheckCheck, Menu, Trash2 } from "lucide-react";

const DEFAULT_AVATAR =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

const TopNav = ({ loggedInUser, onNavigate, onLogout, toggleSidebar }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen,   setIsNotifOpen]   = useState(false);
  const [isMobile,      setIsMobile]      = useState(window.innerWidth < 768);

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem("app_notifications");
    return saved ? JSON.parse(saved) : [];
  });

  const profileRef = useRef(null);
  const notifRef   = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);

    const onNewNotif = (e) => setNotifications((p) => [e.detail, ...p]);
    window.addEventListener("new-notification", onNewNotif);

    const onClickOutside = (e) => {
      if (notifRef.current   && !notifRef.current.contains(e.target))   setIsNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("new-notification", onNewNotif);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("app_notifications", JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const markAllRead = () => setNotifications((p) => p.map((n) => ({ ...n, read: true })));
  const clearAll    = () => { if (window.confirm("Clear all notifications?")) setNotifications([]); };

  const avatarSrc =
    loggedInUser?.avatar &&
    (loggedInUser.avatar.includes("data:image") || loggedInUser.avatar.startsWith("http"))
      ? loggedInUser.avatar
      : DEFAULT_AVATAR;

  return (
    <header style={{ ...S.header, left: isMobile ? 0 : 260 }}>

      {/* Hamburger — left side, mobile only */}
      {isMobile && (
        <button className="hamburger-btn" onClick={toggleSidebar} style={S.hamburger} aria-label="Open menu">
          <Menu size={20} color="#475569" />
        </button>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right controls */}
      <div style={S.right}>

        {/* Bell */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setIsNotifOpen((p) => !p); setIsProfileOpen(false); }}
            style={{ ...S.iconBtn, ...(isNotifOpen ? S.iconBtnActive : {}) }}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span style={S.badge}>{unreadCount}</span>}
          </button>

          {isNotifOpen && (
            <div style={{
              ...S.dropdown,
              ...(isMobile
                ? { position: "fixed", top: 64, left: 8, right: 8, width: "auto" }
                : { right: 0, width: 320 }),
            }}>
              <div style={S.ddHead}>
                <div>
                  <div style={S.ddTitle}>Notifications</div>
                  {unreadCount > 0 && <div style={S.ddSub}>{unreadCount} unread</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={S.ddAction}>
                      <CheckCheck size={12} /> Read all
                    </button>
                  )}
                  <button onClick={clearAll} style={{ ...S.ddAction, color: "#ef4444", borderColor: "#fecaca" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div style={S.ddScroll}>
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div key={n.id} style={{ ...S.notifRow, background: n.read ? "#fff" : "#f0f6ff" }}>
                      <div style={S.notifDot(n.read)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={S.notifText}>{n.text}</p>
                        <span style={S.notifTime}>{n.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={S.empty}>
                    <Bell size={28} color="#cbd5e1" />
                    <span>No notifications yet</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={S.divider} />

        {/* User */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setIsProfileOpen((p) => !p); setIsNotifOpen(false); }}
            style={S.userBtn}
            aria-label="Profile menu"
          >
            {!isMobile && (
              <div style={S.userText}>
                <span style={S.userName}>{loggedInUser?.name || "User"}</span>
                <span style={S.userEmail}>{loggedInUser?.email}</span>
              </div>
            )}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={avatarSrc}
                alt="User"
                style={S.avatar}
                onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
              />
              <span style={S.onlineDot} />
            </div>
          </button>

          {isProfileOpen && (
            <div style={{
              ...S.dropdown,
              ...(isMobile
                ? { position: "fixed", top: 64, right: 8, width: 210 }
                : { right: 0, width: 210, top: 54 }),
            }}>
              <div style={S.profileHead}>
                <img src={avatarSrc} alt="" style={S.profileHeadAvatar}
                  onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }} />
                <div style={{ minWidth: 0 }}>
                  <div style={S.profileName}>{loggedInUser?.name || "User"}</div>
                  <div style={S.profileRole}>{loggedInUser?.role || "Member"}</div>
                </div>
              </div>
              <div style={S.ddDivider} />
              <button
                style={S.dropItem}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                onClick={() => { onNavigate?.(99); setIsProfileOpen(false); }}
              >
                <span style={S.dropIcon}><User size={14} /></span>
                My Profile
              </button>
              <button
                style={{ ...S.dropItem, marginBottom: 4 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                onClick={() => { onNavigate?.(100); setIsProfileOpen(false); }}
              >
                <span style={S.dropIcon}><Lock size={14} /></span>
                Change Password
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

const S = {
  header: {
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    height: 64,
    background: "#ffffff",
    borderBottom: "1px solid #e4e8f0",
    position: "fixed",
    top: 0,
    right: 0,
    zIndex: 50,
    boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
    fontFamily: "'Poppins', sans-serif",
    boxSizing: "border-box",
  },
  hamburger: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    flexShrink: 0,
    marginRight: 4,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  divider: {
    width: 1,
    height: 28,
    background: "#e4e8f0",
    margin: "0 4px",
    flexShrink: 0,
  },
  iconBtn: {
    position: "relative",
    width: 38, height: 38,
    borderRadius: "10px",
    border: "1.5px solid #e4e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    transition: "all 0.15s",
    outline: "none",
    flexShrink: 0,
  },
  iconBtnActive: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#2563eb",
  },
  badge: {
    position: "absolute",
    top: -5, right: -5,
    background: "#ef4444",
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    borderRadius: "10px",
    padding: "2px 5px",
    minWidth: 16,
    textAlign: "center",
    border: "2px solid #fff",
    lineHeight: 1,
  },
  dropdown: {
    position: "absolute",
    top: 48,
    background: "#fff",
    boxShadow: "0 8px 28px rgba(0,0,0,0.13)",
    borderRadius: "14px",
    zIndex: 9999,
    border: "1px solid #e4e8f0",
    overflow: "hidden",
    animation: "topnav-dd-in 0.18s ease",
  },
  ddHead: {
    padding: "14px 16px 12px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ddTitle: {
    fontSize: 13, fontWeight: 700, color: "#1a202c",
    fontFamily: "'Poppins', sans-serif",
  },
  ddSub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  ddAction: {
    background: "none",
    border: "1.5px solid #e4e8f0",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 11, fontWeight: 600,
    display: "flex", alignItems: "center", gap: 4,
    padding: "4px 9px", borderRadius: 7,
    fontFamily: "'Poppins', sans-serif",
  },
  ddScroll: { maxHeight: 320, overflowY: "auto" },
  ddDivider: { height: 1, background: "#f1f5f9", margin: "4px 0" },
  notifRow: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "11px 16px", borderBottom: "1px solid #f8fafc",
  },
  notifDot: (read) => ({
    width: 7, height: 7, borderRadius: "50%",
    background: read ? "#cbd5e1" : "#2563eb",
    flexShrink: 0, marginTop: 5,
  }),
  notifText: {
    margin: "0 0 3px", fontSize: 12.5, color: "#1a202c",
    lineHeight: 1.45, fontFamily: "'Poppins', sans-serif",
  },
  notifTime: { fontSize: 10.5, color: "#94a3b8", fontFamily: "'Poppins', sans-serif" },
  empty: {
    padding: "32px 0", textAlign: "center", color: "#94a3b8", fontSize: 12.5,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    fontFamily: "'Poppins', sans-serif",
  },
  userBtn: {
    display: "flex", alignItems: "center", gap: 10,
    background: "none", border: "none", cursor: "pointer",
    padding: "5px 6px", borderRadius: 10, outline: "none", flexShrink: 0,
  },
  userText: { textAlign: "right" },
  userName: {
    display: "block", fontSize: 13, fontWeight: 700, color: "#1a202c",
    fontFamily: "'Poppins', sans-serif", lineHeight: 1.3, whiteSpace: "nowrap",
  },
  userEmail: {
    display: "block", fontSize: 11, color: "#64748b",
    fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap",
  },
  avatar: {
    width: 36, height: 36, borderRadius: "50%",
    objectFit: "cover", border: "2px solid #e4e8f0", display: "block",
  },
  onlineDot: {
    position: "absolute", bottom: 1, right: 1,
    width: 9, height: 9, borderRadius: "50%",
    background: "#10b981", border: "2px solid #fff",
  },
  profileHead: {
    display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 12px",
  },
  profileHeadAvatar: {
    width: 38, height: 38, borderRadius: "50%",
    objectFit: "cover", border: "2px solid #e4e8f0", flexShrink: 0,
  },
  profileName: {
    fontSize: 13, fontWeight: 700, color: "#1a202c",
    fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130,
  },
  profileRole: {
    fontSize: 11, color: "#64748b",
    fontFamily: "'Poppins', sans-serif", textTransform: "capitalize",
  },
  dropItem: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "10px 16px",
    border: "none", background: "none", cursor: "pointer",
    textAlign: "left", fontSize: 13, color: "#374151",
    fontFamily: "'Poppins', sans-serif", fontWeight: 500,
  },
  dropIcon: {
    width: 26, height: 26, borderRadius: 7,
    background: "#f0f6ff", color: "#2563eb",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
};

export default TopNav;