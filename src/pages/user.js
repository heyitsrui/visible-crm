import React, { useState, useEffect, useMemo } from "react";
import { Search, X, Trash2, Edit3, UserCog, Users, Mail, Phone, Shield } from "lucide-react";
import "../styles/contacts.css";

/* ── Helpers ──────────────────────────────────────────────── */
const userInitials = (name) => {
  const words = (name || "").trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (name || "US").substring(0, 2).toUpperCase();
};

const RoleBadge = ({ role }) => (
  <span className={`ct-role r-${(role || "viewer").toLowerCase()}`}>
    {role || "viewer"}
  </span>
);

/* ── Component ────────────────────────────────────────────── */
export default function UserManagement({ currentUser }) {
  const [users,        setUsers]        = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [ready,        setReady]        = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", role: "viewer",
  });

  const isAdmin = currentUser?.role === "admin";

  /* ── Data ─────────────────────────────────────────────── */
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res  = await fetch("http://localhost:5000/api/users");
      const data = await res.json();
      if (data.success)
        setUsers(data.users.sort((a, b) => a.id - b.id));
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return users;
    return users.filter((u) =>
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term)
    );
  }, [searchQuery, users]);

  /* ── Modal helpers ────────────────────────────────────── */
  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", password: "", role: "viewer" });
    setEditingId(null);
  };

  const toggleModal = () => {
    if (!isAdmin) return;
    setIsModalOpen((v) => !v);
    if (isModalOpen) resetForm();
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, phone: user.phone || "", role: user.role, password: "" });
    setIsModalOpen(true);
  };

  /* ── Submit ───────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const url    = editingId ? `http://localhost:5000/api/users/${editingId}/profile` : "http://localhost:5000/register";
    const method = editingId ? "PUT" : "POST";
    try {
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) { fetchUsers(); toggleModal(); }
      else alert("Error: " + data.message);
    } catch (err) { console.error("Submission error:", err); }
  };

  /* ── Delete ───────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      const res  = await fetch(`http://localhost:5000/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchUsers();
    } catch (err) { console.error(err); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className={`ct-page ${ready ? "ct-ready" : ""}`}>

      {/* ── Top ──────────────────────────────────────── */}
      <div className="ct-top">

        {/* Header */}
        <div className="ct-header">
          <div className="ct-header-left">
            <h1>User Management</h1>
            <p>
              {filtered.length} user{filtered.length !== 1 ? "s" : ""}
              &nbsp;·&nbsp;{users.length} total
            </p>
          </div>

          {isAdmin && (
            <div className="ct-header-right">
              <button className="ct-btn-add" onClick={toggleModal}>
                <UserCog size={14} /> Add User
              </button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="ct-toolbar">
          <div className="ct-search-wrap" style={{ flex: 1 }}>
            <Search size={14} className="ct-search-icon" />
            <input
              className="ct-search"
              type="text"
              placeholder="Search by name, email, or role…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ct-clear" onClick={() => setSearchQuery("")}><X size={11} /></button>
            )}
          </div>
          <span className="ct-result-count">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────── */}
      <div className="ct-body">

        {/* ── Desktop table ───────────────────────── */}
        <div className="ct-table-wrap">
          <div className="ct-table-scroll">
            <table className="ct-table">
              <thead>
                <tr>
                  <th className="ct-center" style={{ width: 48 }}>ID</th>
                  <th style={{ width: 200 }}>Name</th>
                  <th style={{ width: 220 }}>Email</th>
                  <th style={{ width: 140 }}>Phone</th>
                  <th style={{ width: 120 }}>Role</th>
                  {isAdmin && <th className="ct-center" style={{ width: 100 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={isAdmin ? 6 : 5}>
                    <div className="ct-loading"><div className="ct-spinner" /><span>Loading users…</span></div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 6 : 5}>
                    <div className="ct-empty"><Users size={34} /><p>No users found</p></div>
                  </td></tr>
                ) : filtered.map((user, i) => (
                  <tr key={user.id} style={{ animationDelay: `${i * 14}ms` }}>
                    <td className="ct-center ct-id">{user.id}</td>
                    <td>
                      <div className="ct-name-cell">
                        <div className="ct-avatar usr">{userInitials(user.name)}</div>
                        <span
                          className="ct-name-text"
                          style={{ cursor: isAdmin ? "pointer" : "default" }}
                          onClick={() => isAdmin && handleEdit(user)}
                        >
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="ct-muted-cell">{user.email}</td>
                    <td className="ct-muted-cell">{user.phone || "—"}</td>
                    <td><RoleBadge role={user.role} /></td>
                    {isAdmin && (
                      <td className="ct-center">
                        <button className="ct-edit" title="Edit" onClick={() => handleEdit(user)}>
                          <Edit3 size={14} />
                        </button>
                        <button className="ct-del" title="Delete" onClick={() => handleDelete(user.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Mobile cards ─────────────────────────── */}
        <div className="ct-cards">
          {isLoading ? (
            <div className="ct-loading"><div className="ct-spinner" /><span>Loading…</span></div>
          ) : filtered.length === 0 ? (
            <div className="ct-empty"><Users size={34} /><p>No users found</p></div>
          ) : filtered.map((user, i) => (
            <div key={user.id} className="ct-card usr" style={{ animationDelay: `${i * 22}ms` }}>
              <div className="ct-card-top">
                <div className="ct-name-cell">
                  <div className="ct-avatar usr">{userInitials(user.name)}</div>
                  <div>
                    <div className="ct-card-name">{user.name}</div>
                    <div className="ct-card-sub">ID {user.id}</div>
                  </div>
                </div>
                <RoleBadge role={user.role} />
              </div>

              <div className="ct-card-meta">
                <div className="ct-card-row"><Mail size={11} />{user.email}</div>
                {user.phone && <div className="ct-card-row"><Phone size={11} />{user.phone}</div>}
              </div>

              {isAdmin && (
                <div className="ct-card-foot">
                  <span className="ct-card-row" style={{ fontSize: 11 }}>
                    <Shield size={11} /> {user.role}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="ct-edit" onClick={() => handleEdit(user)}><Edit3 size={14} /></button>
                    <button className="ct-del"  onClick={() => handleDelete(user.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="ct-overlay" onClick={(e) => e.target === e.currentTarget && toggleModal()}>
          <div className="ct-modal">

            <div className="ct-modal-head">
              <div className="ct-modal-head-left">
                <div className="ct-modal-icon"><UserCog size={17} /></div>
                <div>
                  <h3 className="ct-modal-title">{editingId ? "Update User" : "Create User"}</h3>
                  <p className="ct-modal-sub">Set permissions and account details</p>
                </div>
              </div>
              <button className="ct-modal-x" onClick={toggleModal}><X size={15} /></button>
            </div>

            <div className="ct-modal-body">
              <form id="ct-user-form" onSubmit={handleSubmit}>

                <div className="ct-section">Account Info</div>
                <div className="ct-form-grid">
                  <div className="ct-field">
                    <label className="ct-label">Full Name *</label>
                    <input className="ct-input" type="text" required placeholder="e.g. John Doe" value={form.name} onChange={set("name")} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Email Address *</label>
                    <input className="ct-input" type="email" required placeholder="john@example.com" disabled={!!editingId} value={form.email} onChange={set("email")} style={editingId ? { background: "#f8fafc", color: "#94a3b8" } : {}} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Phone Number</label>
                    <input className="ct-input" type="tel" placeholder="0912 000 0000" value={form.phone} onChange={set("phone")} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Role</label>
                    <select className="ct-select-field" value={form.role} onChange={set("role")}>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="executive">Executive</option>
                      <option value="finance">Finance</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>

                <div className="ct-section">Security</div>
                <div className="ct-form-grid">
                  <div className="ct-field ct-full">
                    <label className="ct-label">{editingId ? "New Password (leave blank to keep)" : "Password *"}</label>
                    <input className="ct-input" type="password" required={!editingId} placeholder={editingId ? "Leave blank to keep current" : "Set a password"} value={form.password} onChange={set("password")} />
                  </div>
                </div>

              </form>
            </div>

            <div className="ct-modal-foot">
              <button className="ct-btn-cancel" type="button" onClick={toggleModal}>Cancel</button>
              <button className="ct-btn-save" type="submit" form="ct-user-form">
                <UserCog size={13} /> {editingId ? "Update User" : "Create User"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}