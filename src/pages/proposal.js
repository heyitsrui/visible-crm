import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "../styles/proposal.css";
import { sendNotification, getSocket } from "../utils/notifService";
import { FileUp, Lock, Unlock, User, DollarSign, Pencil, Trash2 } from "lucide-react";

const Proposal = ({ currentUser }) => {
  const [projects, setProjects]       = useState([]);
  const [search, setSearch]           = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Mode Toggle (Default Read-Only)
  const [isEditMode, setIsEditMode] = useState(false);

  // Permissions
  const allowedRoles = ['admin', 'manager', 'executive'];
  const userHasPermission = currentUser?.role && allowedRoles.includes(currentUser.role.toLowerCase());
  const canModify = userHasPermission && isEditMode;

  const initialForm = {
    deal_name: "", status: "Lead", paid_amount: 0,
    due_amount: 0, total_amount: 0, deal_owner: "",
    contact: "", company: "", description: "", closed_date: ""
  };

  const [form, setForm] = useState(initialForm);

  const columns = [
    'Lead', 'Proposal', 'Purchase Order', 'Site Survey-POC', 'Closed Lost',
    'Completed Project', 'Inactive Project', 'Renewal Support',
    'Previous Year Project', 'Recovered Project'
  ];

  // Map column names to CSS class names
  const statusClass = (status) => status.toLowerCase().replace(/[\s/]+/g, '-');

  // Pipeline summary stats (top 4 most actionable)
  const pipelineStats = [
    { label: 'Lead',      color: '#f59e0b', count: projects.filter(p => p.status === 'Lead').length },
    { label: 'Active',    color: '#3b82f6', count: projects.filter(p => ['Proposal','Purchase Order','Site Survey-POC'].includes(p.status)).length },
    { label: 'Completed', color: '#22c55e', count: projects.filter(p => p.status === 'Completed Project').length },
    { label: 'Lost',      color: '#ef4444', count: projects.filter(p => p.status === 'Closed Lost').length },
    { label: 'Renewal',   color: '#f97316', count: projects.filter(p => p.status === 'Renewal Support').length },
    { label: 'Total',     color: '#8b5cf6', count: projects.length },
  ];

  useEffect(() => { fetchProjects(); }, []);

  // ─── SOCKET: auto-refresh board + show notif on ALL clients ───────────────
  useEffect(() => {
    const socket = getSocket();

    const handleDealStatusChanged = ({ dealName, status, changedBy, time }) => {
      fetchProjects();
      sendNotification(`🔄 "${dealName}" moved to ${status} by ${changedBy}`);
    };

    const handleDealCreated = ({ dealName, changedBy, time }) => {
      fetchProjects();
      sendNotification(`🚀 New deal "${dealName}" created by ${changedBy}`);
    };

    const handleDealUpdated = ({ dealName, changedBy, time }) => {
      fetchProjects();
      sendNotification(`📝 Deal "${dealName}" was updated by ${changedBy}`);
    };

    socket.off("deal-status-changed");
    socket.off("deal-created");
    socket.off("deal-updated");
    socket.on("deal-status-changed", handleDealStatusChanged);
    socket.on("deal-created", handleDealCreated);
    socket.on("deal-updated", handleDealUpdated);

    return () => {
      socket.off("deal-status-changed", handleDealStatusChanged);
      socket.off("deal-created", handleDealCreated);
      socket.off("deal-updated", handleDealUpdated);
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const total = parseFloat(form.total_amount) || 0;
    const paid  = parseFloat(form.paid_amount)  || 0;
    setForm(prev => ({ ...prev, due_amount: (total - paid).toFixed(2) }));
  }, [form.total_amount, form.paid_amount]);

  const fetchProjects = async () => {
    try {
      const res = await axios.get("http://192.168.1.16:5000/api/projects");
      if (res.data.success) setProjects(res.data.projects);
    } catch (err) { console.error("Failed to fetch projects:", err); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb  = XLSX.read(evt.target.result, { type: "binary", cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws);

      const formattedDeals = raw.map(row => {
        let dateVal = null;
        if (row["Closed Date"]) {
          const d = new Date(row["Closed Date"]);
          if (!isNaN(d)) dateVal = d.toISOString().split('T')[0];
        }
        return {
          deal_name:    row["Deal Name"],
          status:       row["Deal Status"],
          total_amount: row["Total Amount"] || 0,
          deal_owner:   row["Deal owner"]   || "Unassigned",
          closed_date:  dateVal,
          paid_amount:  0
        };
      });

      try {
        const res = await axios.post("http://192.168.1.16:5000/api/projects/bulk", { deals: formattedDeals });
        if (res.data.success) { alert(res.data.message); fetchProjects(); }
      } catch (err) {
        alert("Upload failed. Check console for error details.");
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const submitDeal = async () => {
    if (!canModify) return;
    if (!form.deal_name) return alert("Deal name required");
    try {
      if (editing) {
        await axios.put(`http://192.168.1.16:5000/api/projects/${editing.id}`, form);
        await axios.post("http://192.168.1.16:5000/api/projects/notify", {
          event: "deal-updated",
          dealName: form.deal_name,
          changedBy: currentUser?.name || "Admin",
        });
        sendNotification(`📝 Updated deal: ${form.deal_name}`);
      } else {
        const res = await axios.post("http://192.168.1.16:5000/api/projects", form);
        // Broadcast to all clients so board refreshes + notification appears
        await axios.post("http://192.168.1.16:5000/api/projects/notify", {
          event: "deal-created",
          dealName: form.deal_name,
          changedBy: currentUser?.name || "Admin",
        });
        sendNotification(`🚀 New deal created: ${form.deal_name}`);
      }
      setShowModal(false); setEditing(null); setForm(initialForm); fetchProjects();
    } catch (err) { console.error("Failed to save deal:", err); }
  };

  const updateStatus = async (id, status) => {
    if (!canModify) return;
    try {
      const project = projects.find(p => p.id === id);
      const dealName = project?.deal_name || "Unknown Deal"; // ← fixes "undefined"
      const changedBy = currentUser?.name || "Admin";

      await axios.put(`http://192.168.1.16:5000/api/projects/${id}/status`, {
        status,
        dealName,   // ← send dealName so server can include it in the broadcast
        changedBy,
      });

      // Local notif for the person who made the change
      sendNotification(`🔄 "${dealName}" moved to ${status}`);
      fetchProjects();
    } catch (err) { console.error("Failed to update status:", err); }
  };

  const deleteDeal = async (id) => {
    if (!canModify) return;
    const project = projects.find(p => p.id === id);
    if (!window.confirm("Are you sure you want to delete this deal?")) return;
    try {
      await axios.delete(`http://192.168.1.16:5000/api/projects/${id}`);
      sendNotification(`🗑️ Deleted deal: ${project?.deal_name}`);
      fetchProjects();
    } catch (err) { console.error("Failed to delete deal:", err); }
  };

  const onDragStart = (e, id) => {
    if (!canModify) return e.preventDefault();
    e.dataTransfer.setData("id", id);
  };

  const onDrop = (e, status) => {
    if (!canModify) return;
    const id = Number(e.dataTransfer.getData("id")); // parse to number so find() matches DB id
    setDragOverCol(null);
    updateStatus(id, status);
  };

  const handleEditClick = (p) => {
    if (!canModify) return;
    setEditing(p);
    setForm({
      deal_name:    p.deal_name   || "",
      status:       p.status      || "Lead",
      paid_amount:  p.paid_amount || 0,
      due_amount:   p.due_amount  || 0,
      total_amount: p.total_amount || 0,
      deal_owner:   p.deal_owner  || "",
      contact:      p.contact     || "",
      company:      p.company     || "",
      description:  p.description || "",
      closed_date:  p.closed_date ? p.closed_date.split('T')[0] : ""
    });
    setShowModal(true);
  };

  const totalActive = projects.filter(p =>
    !['Closed Lost','Inactive Project','Previous Year Project'].includes(p.status)
  ).length;

  return (
    <div className="proposal-page">

      {/* ── Fixed top: header + stats ────────────── */}
      <div className="proposal-top">
      <div className="proposal-header">
        <div className="proposal-header-left">
          <h1>Project Pipeline</h1>
          <p>{totalActive} active deal{totalActive !== 1 ? 's' : ''} · {projects.length} total</p>
        </div>

        <div className="header-actions">
          {userHasPermission && (
            <button
              className={`mode-toggle ${isEditMode ? 'active' : ''}`}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? <Unlock size={15} /> : <Lock size={15} />}
              <span>{isEditMode ? "Edit Mode" : "Read-Only"}</span>
            </button>
          )}

          <input
            className="search-input"
            placeholder="Search deals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {canModify && (
            <div className="import-wrapper">
              <label htmlFor="excel-upload" className="import-btn">
                <FileUp size={15} /> Import Excel
              </label>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {canModify && (
            <button
              className="create-btn"
              onClick={() => { setEditing(null); setForm(initialForm); setShowModal(true); }}
            >
              + Create Deal
            </button>
          )}
        </div>
      </div>
      </div>{/* end .proposal-top */}

      {/* ── Kanban Board ────────────────────────── */}
      <div className="kanban-wrapper">
        <div className="kanban-table">
          {columns.map((col) => {
            const colCards = projects.filter(
              (p) => p.status === col && p.deal_name.toLowerCase().includes(search.toLowerCase())
            );
            const cls = statusClass(col);

            return (
              <div
                key={col}
                className={`column ${dragOverCol === col ? 'drag-over' : ''}`}
                onDragOver={(e) => { if (canModify) { e.preventDefault(); setDragOverCol(col); } }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => canModify && onDrop(e, col)}
              >
                {/* Column header */}
                <div className={`column-header ${cls}`}>
                  <span className="dot" />
                  <span className="column-header-title">{col}</span>
                  <span className="column-count">{colCards.length}</span>
                </div>

                {/* Cards */}
                <div className="column-body">
                  {colCards.length === 0 ? (
                    <div className="column-empty">No deals here</div>
                  ) : (
                    colCards.map((p) => (
                      <div
                        key={p.id}
                        className={`card ${cls} ${!isEditMode ? 'readonly-card' : ''}`}
                        draggable={canModify}
                        onDragStart={(e) => canModify ? onDragStart(e, p.id) : e.preventDefault()}
                      >
                        <div className="card-top">
                          <h4>{p.deal_name}</h4>
                          {canModify && (
                            <div className="menu">
                              ⋮
                              <div className="menu-dropdown">
                                <span onClick={() => handleEditClick(p)}>
                                  <Pencil size={12} /> Edit
                                </span>
                                <span className="delete-action" onClick={() => deleteDeal(p.id)}>
                                  <Trash2 size={12} /> Delete
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="card-body">
                          {p.deal_owner && (
                            <div className="card-meta-row">
                              <User size={12} className="card-meta-icon" />
                              <span>{p.deal_owner}</span>
                            </div>
                          )}
                          {p.company && (
                            <div className="card-meta-row">
                              <svg className="card-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                              <span>{p.company}</span>
                            </div>
                          )}
                          <div className="card-amount">
                            <span className="card-amount-label">Balance</span>
                            <DollarSign size={12} style={{ opacity: 0.5 }} />
                            ₱{parseFloat(p.due_amount).toLocaleString()}
                          </div>
                          <div className="card-footer">
                            <span className={`status-badge ${cls}`}>{p.status}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create / Edit Modal ──────────────────── */}
      {showModal && canModify && (
        <div className="modali-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modali-content">

            {/* Header */}
            <div className="modali-header">
              <div className="modali-header-left">
                <div className="modali-icon">{editing ? <Pencil size={15} /> : <span>+</span>}</div>
                <div>
                  <h3>{editing ? "Edit Deal" : "Create New Deal"}</h3>
                  <p className="modali-subtitle">{editing ? `Editing: ${editing.deal_name}` : "Fill in the details below"}</p>
                </div>
              </div>
              <button className="close-x" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modali-body">

              {/* Section: Deal Info */}
              <div className="modali-section-label">Deal Info</div>
              <div className="modali-grid">
                <div className="modali-field modali-field-full">
                  <label>Deal Name <span className="required">*</span></label>
                  <input
                    placeholder="e.g. Tagaytay Highlands CCTV"
                    value={form.deal_name}
                    onChange={(e) => setForm({ ...form, deal_name: e.target.value })}
                  />
                </div>
                <div className="modali-field">
                  <label>Company</label>
                  <input
                    placeholder="Company name"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                  />
                </div>
                <div className="modali-field">
                  <label>Contact Person</label>
                  <input
                    placeholder="Contact name"
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  />
                </div>
                <div className="modali-field">
                  <label>Deal Owner</label>
                  <input
                    placeholder="Assigned to"
                    value={form.deal_owner}
                    onChange={(e) => setForm({ ...form, deal_owner: e.target.value })}
                  />
                </div>
                <div className="modali-field">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              </div>

              {/* Section: Financials */}
              <div className="modali-section-label">Financials</div>
              <div className="modali-grid">
                <div className="modali-field">
                  <label>Total Amount</label>
                  <div className="input-prefix-wrap">
                    <span className="input-prefix">₱</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.total_amount}
                      onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modali-field">
                  <label>Amount Paid</label>
                  <div className="input-prefix-wrap">
                    <span className="input-prefix">₱</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.paid_amount}
                      onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modali-field modali-field-full">
                  <div className="balance-info">
                    <div className="balance-info-left">
                      <span className="balance-label">Outstanding Balance</span>
                      <span className="balance-amount">₱{parseFloat(form.due_amount || 0).toLocaleString()}</span>
                    </div>
                    <DollarSign size={18} className="balance-icon" />
                  </div>
                </div>
              </div>

              {/* Section: Schedule */}
              <div className="modali-section-label">Schedule</div>
              <div className="modali-grid">
                <div className="modali-field">
                  <label>Closed Date</label>
                  <input
                    type="date"
                    value={form.closed_date}
                    onChange={(e) => setForm({ ...form, closed_date: e.target.value })}
                  />
                </div>
                <div className="modali-field modali-field-full">
                  <label>Description</label>
                  <textarea
                    placeholder="Add any notes or project details…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="modali-actions">
              <button className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="save-btn" onClick={submitDeal}>
                {editing ? "Save Changes" : "Create Deal"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Proposal;
