import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Trash2, FileSpreadsheet, Filter, UserPlus, Users, Mail, Phone, Building2, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import '../styles/contacts.css';

/* ── Helpers ──────────────────────────────────────────────── */
const toSlug  = (s) => s?.toLowerCase().replace(/[\s/]+/g, '-') || 'new';
const initials = (a, b) =>
  `${(a || '')[0] || ''}${(b || '')[0] || ''}`.toUpperCase() || 'CL';

const StatusBadge = ({ status }) => (
  <span className={`ct-status s-${toSlug(status)}`}>
    <span className="ct-dot" />
    {status || 'New'}
  </span>
);

/* ── Component ────────────────────────────────────────────── */
const Client = ({ userRole }) => {
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [clients,       setClients]       = useState([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [statusFilter,  setStatusFilter]  = useState('All');
  const [ready,         setReady]         = useState(false);
  const fileInputRef = useRef(null);

  const canEdit = userRole !== 'finance' && userRole !== 'viewer';
  const statusOptions = [
    'All', 'New', 'In Progress', 'Connected',
    'Open Deal', 'Open', 'Attempted to Contact',
  ];

  const blankForm = {
    first_name: '', last_name: '', email: '',
    phone: '', contact_owner: '', assoc_company: '', lead_status: 'New',
  };
  const [formData, setFormData] = useState(blankForm);

  /* ── Data ─────────────────────────────────────────────── */
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const res  = await fetch('http://localhost:5000/api/clients');
      const data = await res.json();
      if (data.success)
        setClients(data.clients.sort((a, b) => a.record_id - b.record_id));
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return clients.filter((cl) => {
      const matchSearch =
        !term ||
        cl.first_name?.toLowerCase().includes(term) ||
        cl.last_name?.toLowerCase().includes(term) ||
        cl.email?.toLowerCase().includes(term) ||
        cl.assoc_company?.toLowerCase().includes(term);
      const matchStatus =
        statusFilter === 'All' || cl.lead_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [searchQuery, statusFilter, clients]);

  /* ── Excel import ─────────────────────────────────────── */
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb  = XLSX.read(evt.target.result, { type: 'binary' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const mapped = raw.map((row) => ({
          record_id:     row['Record ID'] || null,
          first_name:    row['First Name']  || row['first_name']  || '',
          last_name:     row['Last Name']   || row['last_name']   || '',
          email:         row['Email']       || row['email']       || '',
          phone:         row['Phone Number']?.toString() || row['phone']?.toString() || null,
          contact_owner: row['Contact owner'] || row['Contact Owner'] || row['contact_owner'] || null,
          assoc_company: row['Associated Company'] || row['Company'] || row['assoc_company'] || null,
          lead_status:   row['Lead Status'] || row['lead_status'] || 'New',
        }));
        const valid = mapped.filter((c) => c.email && c.first_name);
        if (!valid.length) return alert('Import failed: No valid data found.');
        const res = await fetch('http://localhost:5000/api/clients/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clients: valid }),
        });
        const result = await res.json();
        if (result.success) { alert(`Imported ${valid.length} clients!`); fetchClients(); }
      } catch (err) {
        alert('Error reading Excel: ' + err.message);
      } finally {
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  /* ── CRUD ─────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!canEdit) return alert('No permission.');
    if (!window.confirm('Delete this client?')) return;
    try {
      const res  = await fetch(`http://localhost:5000/api/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchClients();
    } catch (err) { console.error('Delete error:', err); }
  };

  const toggleModal = () => {
    if (!canEdit) return;
    setIsModalOpen((v) => !v);
    if (!isModalOpen) setFormData(blankForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res  = await fetch('http://localhost:5000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) { await fetchClients(); toggleModal(); }
    } catch (err) { console.error('Submission error:', err); }
  };

  const set = (k) => (e) => setFormData((f) => ({ ...f, [k]: e.target.value }));

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className={`ct-page ${ready ? 'ct-ready' : ''}`}>

      {/* ── Top ──────────────────────────────────────── */}
      <div className="ct-top">

        {/* Header */}
        <div className="ct-header">
          <div className="ct-header-left">
            <h1>All Clients</h1>
            <p>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              &nbsp;·&nbsp;{clients.length} total
            </p>
          </div>

          {canEdit && (
            <div className="ct-header-right">
              <input
                type="file" ref={fileInputRef}
                onChange={handleExcelImport}
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
              />
              <button className="ct-btn-import" onClick={() => fileInputRef.current.click()}>
                <FileSpreadsheet size={14} /> Import Excel
              </button>
              <button className="ct-btn-add" onClick={toggleModal}>
                <UserPlus size={14} /> Add Client
              </button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="ct-toolbar">
          <div className="ct-filter-wrap">
            <Filter size={14} className="ct-filter-icon" />
            <select className="ct-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="ct-search-wrap">
            <Search size={14} className="ct-search-icon" />
            <input
              className="ct-search"
              type="text"
              placeholder="Search name, company, or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ct-clear" onClick={() => setSearchQuery('')}><X size={11} /></button>
            )}
          </div>

          <span className="ct-result-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────── */}
      <div className="ct-body">

        {/* ── Desktop table ───────────────────────── */}
        <div className="ct-table-wrap">
          <div className="ct-table-scroll">
            <table className="ct-table">
              <colgroup>
                <col style={{ width: '52px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '220px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '160px' }} />
                {canEdit && <col style={{ width: '60px' }} />}
              </colgroup>
              <thead>
                <tr>
                  <th className="ct-center">ID</th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Owner</th>
                  {canEdit && <th className="ct-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={canEdit ? 8 : 7}>
                    <div className="ct-loading"><div className="ct-spinner" /><span>Loading clients…</span></div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={canEdit ? 8 : 7}>
                    <div className="ct-empty"><Users size={34} /><p>No clients found</p></div>
                  </td></tr>
                ) : filtered.map((cl, i) => (
                  <tr key={cl.record_id} style={{ animationDelay: `${i * 14}ms` }}>
                    <td className="ct-center ct-id">{cl.record_id}</td>
                    <td>
                      <div className="ct-name-cell">
                        <div className="ct-avatar">{initials(cl.first_name, cl.last_name)}</div>
                        <span className="ct-name-text">{cl.first_name} {cl.last_name}</span>
                      </div>
                    </td>
                    <td className="ct-muted-cell">{cl.assoc_company || '—'}</td>
                    <td className="ct-muted-cell">{cl.email}</td>
                    <td className="ct-muted-cell">{cl.phone || '—'}</td>
                    <td><StatusBadge status={cl.lead_status} /></td>
                    <td className="ct-muted-cell">{cl.contact_owner || 'Unassigned'}</td>
                    {canEdit && (
                      <td className="ct-center">
                        <button className="ct-del" title="Delete" onClick={() => handleDelete(cl.record_id)}>
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
            <div className="ct-empty"><Users size={34} /><p>No clients found</p></div>
          ) : filtered.map((cl, i) => (
            <div key={cl.record_id} className="ct-card" style={{ animationDelay: `${i * 22}ms` }}>
              <div className="ct-card-top">
                <div className="ct-name-cell">
                  <div className="ct-avatar">{initials(cl.first_name, cl.last_name)}</div>
                  <div>
                    <div className="ct-card-name">{cl.first_name} {cl.last_name}</div>
                    {cl.assoc_company && <div className="ct-card-sub">{cl.assoc_company}</div>}
                  </div>
                </div>
                <StatusBadge status={cl.lead_status} />
              </div>

              <div className="ct-card-meta">
                <div className="ct-card-row"><Mail size={11} />{cl.email}</div>
                {cl.phone && <div className="ct-card-row"><Phone size={11} />{cl.phone}</div>}
              </div>

              <div className="ct-card-foot">
                <span className="ct-card-row" style={{ fontSize: 11 }}>
                  <User size={11} /> {cl.contact_owner || 'Unassigned'}
                </span>
                {canEdit && (
                  <button className="ct-del" onClick={() => handleDelete(cl.record_id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
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
                <div className="ct-modal-icon"><UserPlus size={17} /></div>
                <div>
                  <h3 className="ct-modal-title">Create Client</h3>
                  <p className="ct-modal-sub">Add a new contact to your records</p>
                </div>
              </div>
              <button className="ct-modal-x" onClick={toggleModal}><X size={15} /></button>
            </div>

            <div className="ct-modal-body">
              <form id="ct-client-form" onSubmit={handleSubmit}>
                <div className="ct-section">Personal Info</div>
                <div className="ct-form-grid">
                  <div className="ct-field">
                    <label className="ct-label">First Name *</label>
                    <input className="ct-input" type="text" required placeholder="e.g. Juan" value={formData.first_name} onChange={set('first_name')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Last Name *</label>
                    <input className="ct-input" type="text" required placeholder="e.g. Dela Cruz" value={formData.last_name} onChange={set('last_name')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Email *</label>
                    <input className="ct-input" type="email" required placeholder="e.g. juan@company.ph" value={formData.email} onChange={set('email')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Phone</label>
                    <input className="ct-input" type="text" placeholder="+63 917 000 0000" value={formData.phone} onChange={set('phone')} />
                  </div>
                </div>

                <div className="ct-section">Assignment</div>
                <div className="ct-form-grid">
                  <div className="ct-field">
                    <label className="ct-label">Associated Company</label>
                    <input className="ct-input" type="text" placeholder="e.g. Visible Corp." value={formData.assoc_company} onChange={set('assoc_company')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Contact Owner</label>
                    <input className="ct-input" type="text" placeholder="e.g. Resil Fuscablo" value={formData.contact_owner} onChange={set('contact_owner')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Lead Status</label>
                    <select className="ct-select-field" value={formData.lead_status} onChange={set('lead_status')}>
                      <option value="New">New</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Connected">Connected</option>
                      <option value="Open Deal">Open Deal</option>
                      <option value="Open">Open</option>
                      <option value="Attempted to Contact">Attempted to Contact</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>

            <div className="ct-modal-foot">
              <button className="ct-btn-cancel" type="button" onClick={toggleModal}>Cancel</button>
              <button className="ct-btn-save"   type="submit" form="ct-client-form">
                <UserPlus size={13} /> Create Client
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Client;
