import React, { useState, useEffect, useRef } from "react";
import { User, Lock, Bell, CheckCheck, Menu } from "lucide-react";

const TopNav = ({ loggedInUser, onNavigate, onLogout, toggleSidebar }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem("app_notifications");
    return saved ? JSON.parse(saved) : [];
  });
  
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

  useEffect(() => {
    // Handle responsive state
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener("resize", handleResize);

    const handleNewNotif = (event) => {
      setNotifications((prev) => [event.detail, ...prev]);
    };

    window.addEventListener("new-notification", handleNewNotif);

    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("new-notification", handleNewNotif);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("app_notifications", JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    if (window.confirm("Clear all notifications?")) setNotifications([]);
  };

  // Logic for dynamic mobile dropdown styling
  const dropdownStyle = isMobile 
    ? { ...styles.dropdown, position: "fixed", top: "60px", left: "5%", width: "90%", right: "5%" }
    : styles.dropdown;

  return (
    <header className="top-nav" style={styles.header}>
      <button 
        className="hamburger-btn" 
        onClick={toggleSidebar}
        style={{ marginRight: '50px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <Menu size={24} color="#333" />
      </button>
      <div style={styles.rightSection}>
        {/* --- NOTIFICATION DROPDOWN --- */}
        <div className="notif-block" ref={notifRef} style={styles.relative}>
          <div className="notif-icon" onClick={() => setIsNotifOpen(!isNotifOpen)} style={styles.iconWrapper}>
            <Bell size={24} color="#555" />
            {unreadCount > 0 && <span className="badge" style={styles.badge}>{unreadCount}</span>}
          </div>

          {isNotifOpen && (
            <div className="notif-dropdown" style={dropdownStyle}>
              <div style={styles.dropdownHeader}>
                <span style={{ fontWeight: "600" }}>Notifications</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} style={styles.markReadBtn}>
                      <CheckCheck size={14} /> Read All
                    </button>
                  )}
                  <button onClick={clearAll} style={{...styles.markReadBtn, color: '#ef4444'}}>Clear</button>
                </div>
              </div>
              <div style={styles.scrollArea}>
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div key={n.id} style={{ ...styles.notifItem, backgroundColor: n.read ? "#fff" : "#f4faff" }}>
                      <p style={styles.notifText}>{n.text}</p>
                      <span style={styles.notifTime}>{n.time}</span>
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyState}>No new notifications</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- USER PROFILE DROPDOWN --- */}
        <div className="user-block" ref={profileRef} style={styles.userBlock}>
          <div className="user-info" onClick={() => setIsProfileOpen(!isProfileOpen)} style={styles.userInfo}>
            <span className="user-name" style={styles.userName}>{loggedInUser?.name || "User"}</span>
            <span className="user-email" style={styles.userEmail}>{loggedInUser?.email}</span>
          </div>
          
          <div className="user-avatar" onClick={() => setIsProfileOpen(!isProfileOpen)} style={styles.avatarWrapper}>
            <img 
              src={loggedInUser?.avatar && (loggedInUser.avatar.includes("data:image") || loggedInUser.avatar.startsWith("http")) ? loggedInUser.avatar : DEFAULT_AVATAR}
              alt="User" 
              style={styles.avatarImg}
              onError={(e) => { e.target.onerror = null; e.target.src = DEFAULT_AVATAR; }}
            />
          </div>

          {isProfileOpen && (
            <div className="profile-dropdown" style={{ ...styles.dropdown, right: 0, width: "200px", top: "55px" }}>
              <button className="dropdown-item" onClick={() => { if (onNavigate) onNavigate(99); setIsProfileOpen(false); }} style={styles.dropItem}>
                <User size={18} /> <span>My Profile</span>
              </button>
              <button className="dropdown-item" onClick={() => { if (onNavigate) onNavigate(100); setIsProfileOpen(false); }} style={styles.dropItem}>
                <Lock size={18} /> <span>Change Password</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const styles = {
  header: { display: "flex", justifyContent: "flex-end", padding: "12px 30px", background: "#fff", borderBottom: "1px solid #eee", alignItems: "center" },
  rightSection: { display: "flex", alignItems: "center", gap: "25px" },
  relative: { position: "relative" },
  iconWrapper: { cursor: "pointer", position: "relative", display: "flex", alignItems: "center" },
  badge: { position: "absolute", top: "-6px", right: "-6px", background: "#ef4444", color: "white", fontSize: "10px", borderRadius: "10px", padding: "2px 5px", minWidth: "18px", textAlign: "center", border: "2px solid #fff" },
  dropdown: { position: "absolute", top: "45px", right: "-10px", width: "300px", background: "white", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", borderRadius: "12px", zIndex: 1000, border: "1px solid #eee", overflow: "hidden" },
  dropdownHeader: { padding: "12px 15px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" },
  markReadBtn: { background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" },
  scrollArea: { maxHeight: "350px", overflowY: "auto" },
  notifItem: { padding: "12px 15px", borderBottom: "1px solid #f9f9f9", transition: "0.2s" },
  notifText: { margin: "0 0 4px 0", fontSize: "13px", color: "#333", lineHeight: "1.4" },
  notifTime: { fontSize: "11px", color: "#999" },
  emptyState: { padding: "30px", textAlign: "center", color: "#aaa", fontSize: "14px" },
  userBlock: { display: "flex", alignItems: "center", position: "relative" },
  userInfo: { textAlign: "right", marginRight: "12px", cursor: "pointer" },
  userName: { fontSize: "15px", fontWeight: "600", fontFamily: "Poppins", display: "block", color: "#333" },
  userEmail: { fontSize: "12px", color: "#777" },
  avatarWrapper: { width: "40px", height: "40px", cursor: "pointer" },
  avatarImg: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "1px solid #eee" },
  dropItem: { display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "12px 15px", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontSize: "14px", color: "#444" }
};

export default TopNav;