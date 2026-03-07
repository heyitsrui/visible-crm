import React, { useState, useEffect } from "react";
import { Camera, User } from "lucide-react";
import axios from "axios";
import "../styles/myprofile.css";

const MyProfile = ({ user, onProfileUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    about: "",
    avatar: "",
  });

  // 1. Fetch fresh data from DB using the ID when the component loads
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;
      try {
        const res = await axios.get(`http://localhost:5000/api/users/${user.id}`);
        if (res.data.success) {
          setProfileData({
            name: res.data.user.name || "",
            phone: res.data.user.phone || "",
            about: res.data.user.about || "",
            avatar: res.data.user.avatar || "",
          });
        }
      } catch (err) {
        console.error("Error fetching user from DB:", err);
      }
    };
    fetchUserData();
  }, [user?.id]);

  // 2. Role-based Permissions Mapping
  const permissionsMap = {
    admin: ["Full System Access", "User Management", "Project Approval"],
    manager: ["Team Access", "Project View", "Task Management"],
    executive: ["Project View", "Reports Access"],
    finance: ["Financial View", "Invoicing"],
    viewer: ["Read Only Access"],
  };
  const currentPermissions = permissionsMap[user?.role] || ["Basic Access"];

  // 3. Handle Image Upload & Convert to Base64 (Integrated from snippet 1)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
        alert("File is too large! Please choose an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData((prev) => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // 4. Save Function: Updates Database, LocalStorage, and Parent State
  const handleSave = async () => {
    try {
      const res = await axios.put(
        `http://localhost:5000/api/users/${user.id}/profile`,
        {
          name: profileData.name,
          phone: profileData.phone,
          about: profileData.about,
          avatar: profileData.avatar,
          email: user.email,
          role: user.role,
        }
      );

      if (res.data.success) {
        // Update local session for persistence
        const updatedUser = { ...user, ...profileData };
        localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));

        // Notify Parent (Dashboard) to refresh TopNav/UI
        if (onProfileUpdate) onProfileUpdate();

        setIsEditing(false);
        alert("Profile updated successfully!");
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to update profile. Check server payload limits for large images.");
    }
  };

  return (
    <div className="dashboard-content">
      <div className="profile-card">
        <div className="profile-header-row">
          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="avatar-circle">
              {profileData.avatar ? (
                <img src={profileData.avatar} alt="Profile" className="avatar-img" />
              ) : (
                <User size={60} color="#ccc" />
              )}
            </div>
            {isEditing && (
              <label className="upload-icon-label">
                <Camera size={18} />
                <span>Change Photo</span>
                <input 
                  type="file" 
                  hidden 
                  onChange={handleImageChange} 
                  accept="image/*" 
                />
              </label>
            )}
          </div>

          {/* Info Section */}
          <div className="info-section">
            {isEditing ? (
              <div className="details-grid">
                <span className="label">Name:</span>
                <input 
                  className="grid-input"
                  value={profileData.name} 
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} 
                />
                <span className="label">Phone:</span>
                <input 
                  className="grid-input"
                  value={profileData.phone} 
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} 
                />
              </div>
            ) : (
              <>
                <h1 className="profile-name">{profileData.name || "User Profile"}</h1>
                <div className="details-grid">
                  <span className="label">Email:</span><span className="value">{user?.email}</span>
                  <span className="label">Phone:</span><span className="value">{profileData.phone || "Not Set"}</span>
                  <span className="label">ID NO:</span><span className="value">000{user?.id}</span>
                  <span className="label">Role:</span><span className="value">{user?.role}</span>
                </div>
              </>
            )}
          </div>

          <button className="edit-btn" onClick={isEditing ? handleSave : () => setIsEditing(true)}>
            {isEditing ? "SAVE" : "EDIT"}
          </button>
        </div>

        <div className="divider" />

        {/* Permissions Section */}
        <div className="profile-section">
          <h3>Permissions:</h3>
          <div className="permissions-list">
            {currentPermissions.map((perm, i) => (
              <span key={i} className="permission-pill">{perm}</span>
            ))}
          </div>
        </div>

        {/* About Section */}
        <div className="profile-section">
          <h3>About</h3>
          <div className="about-box">
            {isEditing ? (
              <textarea
                className="about-textarea"
                value={profileData.about}
                onChange={(e) => setProfileData({ ...profileData, about: e.target.value })}
                placeholder="Tell us about yourself..."
              />
            ) : (
              <p>{profileData.about || "Click EDIT to update your description..."}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
