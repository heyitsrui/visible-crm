import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Trash2, FileSpreadsheet, Filter, Building2, Phone, MapPin, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import '../styles/contacts.css';
import { sendNotification, getSocket } from '../utils/notifService';

/* ── Helpers ──────────────────────────────────────────────── */
const coInitials = (name) => {
  const words = (name || '').trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (name || 'CO').substring(0, 2).toUpperCase();
};

/* ── Industries list ──────────────────────────────────────── */
const INDUSTRIES = [
  'Accounting','Airlines/Aviation','Apparel & Fashion','Automotive','Banking',
  'Broadcast Media','Building Materials','Business Supplies and Equipment','Capital Markets',
  'Chemicals','Civil Engineering','Computer Hardware','Computer Networking',
  'Computer Software','Construction','Consumer Electronics','Consumer Goods',
  'Consumer Services','Defense & Space','Education Management',
  'Electrical/Electronic Manufacturing','Entertainment','Financial Services',
  'Food & Beverages','Food Production','Gambling & Casinos',
  'Government Administration','Higher Education','Hospital & Health Care',
  'Hospitality','Individual & Family Services','Information Technology and Services',
  'Insurance','Legal Services','Leisure, Travel & Tourism',
  'Logistics and Supply Chain','Machinery','Management Consulting','Maritime',
  'Mechanical or Industrial Engineering','Mining & Metals','Oil & Energy',
  'Packaging and Containers','Pharmaceuticals','Photography','Printing',
  'Professional Training & Coaching','Publishing','Real Estate',
  'Renewables & Environment','Restaurants','Retail','Telecommunications',
  'Transportation/Trucking/Railroad','Utilities','Venture Capital & Private Equity','Other',
];

/* ── Component ────────────────────────────────────────────── */
const Company = ({ userRole }) => {
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [companies,      setCompanies]      = useState([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [industryFilter, setIndustryFilter] = useState('All');
  const [ready,          setReady]          = useState(false);
  const fileInputRef = useRef(null);

  const allowedRoles = ['admin', 'manager', 'executive'];
  const canEdit = allowedRoles.includes(userRole?.toLowerCase());

  const blankForm = { name: '', owner: '', phone: '', city: '', country: '', industry: '' };
  const [formData, setFormData] = useState(blankForm);

  /* ── Data ─────────────────────────────────────────────── */
  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const res  = await fetch('http://192.168.1.16:5000/api/companies');
      const data = await res.json();
      if (data.success) setCompanies(data.companies || []);
    } catch (err) { console.error('Fetch failed:', err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    fetchCompanies();
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  // ─── SOCKET: auto-refresh for all users when a company is added ──────────
  useEffect(() => {
    const socket = getSocket();
    const onRefresh = () => fetchCompanies();
    socket.on('company-added', onRefresh);
    return () => socket.off('company-added', onRefresh);
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return companies.filter((co) => {
      const matchSearch =
        !term ||
        co.name?.toLowerCase().includes(term) ||
        co.owner?.toLowerCase().includes(term) ||
        co.city?.toLowerCase().includes(term);
      const matchIndustry = industryFilter === 'All' || co.industry === industryFilter;
      return matchSearch && matchIndustry;
    });
  }, [searchQuery, industryFilter, companies]);

  /* ── Excel import ─────────────────────────────────────── */
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb  = XLSX.read(evt.target.result, { type: 'binary' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const mapped = raw.map((row) => {
          const rawId = row['Record ID'] || row['record_id'];
          return {
            record_id:     (!isNaN(rawId) && rawId) ? rawId : null,
            company_name:  row['Company name'],
            company_owner: row['Company owner'] || null,
            phone:         row['Phone Number']?.toString() || null,
            city:          row['City'] || null,
            country:       row['Country/Region'] || 'Philippines',
            industry:      row['Industry'] || 'Other',
          };
        });
        const valid = mapped.filter((c) => c.company_name?.toString().trim());
        if (!valid.length) return alert('Import failed: No valid company names found.');
        const res    = await fetch('http://192.168.1.16:5000/api/companies/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companies: valid }),
        });
        const result = await res.json();
        if (result.success) { alert(`Processed ${valid.length} companies!`); fetchCompanies(); }
      } catch (err) { alert('Error reading Excel: ' + err.message); }
      finally { e.target.value = null; }
    };
    reader.readAsBinaryString(file);
  };

  /* ── CRUD ─────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!canEdit) return;
    if (!window.confirm('Delete this company?')) return;
    try {
      const res  = await fetch(`http://192.168.1.16:5000/api/companies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchCompanies();
    } catch (err) { console.error('Delete error:', err); }
  };

  const toggleModal = () => {
    if (!canEdit && !isModalOpen) return;
    setIsModalOpen((v) => !v);
    if (!isModalOpen) setFormData(blankForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const res  = await fetch('http://192.168.1.16:5000/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        const addedBy = JSON.parse(localStorage.getItem('loggedInUser'))?.name || 'Someone';
        // Local notif for the creator
        sendNotification(`🏢 New company added: "${formData.name}"${formData.industry ? ` · ${formData.industry}` : ''}`);
        // Broadcast to all other users
        await fetch('http://192.168.1.16:5000/api/projects/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'company-added',
            companyName: formData.name,
            industry: formData.industry || '',
            addedBy,
            changedBy: addedBy,
          }),
        });
        await fetchCompanies();
        toggleModal();
      }
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
            <h1>All Companies</h1>
            <p>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              &nbsp;·&nbsp;{companies.length} total
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
                <Building2 size={14} /> Add Company
              </button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="ct-toolbar">
          <div className="ct-filter-wrap">
            <Filter size={14} className="ct-filter-icon" />
            <select className="ct-select" value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}>
              <option value="All">All Industries</option>
              {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>

          <div className="ct-search-wrap">
            <Search size={14} className="ct-search-icon" />
            <input
              className="ct-search"
              type="text"
              placeholder="Search name, owner, or city…"
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
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Owner</th>
                  <th>Industry</th>
                  <th>Phone</th>
                  <th>Location</th>
                  {canEdit && <th className="ct-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={canEdit ? 6 : 5}>
                    <div className="ct-loading"><div className="ct-spinner" /><span>Loading companies…</span></div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={canEdit ? 6 : 5}>
                    <div className="ct-empty"><Building2 size={34} /><p>No companies found</p></div>
                  </td></tr>
                ) : filtered.map((co, i) => (
                  <tr key={co.record_id} style={{ animationDelay: `${i * 14}ms` }}>
                    <td>
                      <div className="ct-name-cell">
                        <div className="ct-avatar co">{coInitials(co.name)}</div>
                        <span className="ct-name-text">{co.name}</span>
                      </div>
                    </td>
                    <td className="ct-muted-cell">{co.owner || '—'}</td>
                    <td><span className="ct-industry">{co.industry || 'N/A'}</span></td>
                    <td className="ct-muted-cell">{co.phone || '—'}</td>
                    <td className="ct-muted-cell">
                      {[co.city, co.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    {canEdit && (
                      <td className="ct-center">
                        <button className="ct-del" title="Delete" onClick={() => handleDelete(co.record_id)}>
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
            <div className="ct-empty"><Building2 size={34} /><p>No companies found</p></div>
          ) : filtered.map((co, i) => (
            <div key={co.record_id} className="ct-card co" style={{ animationDelay: `${i * 22}ms` }}>
              <div className="ct-card-top">
                <div className="ct-name-cell">
                  <div className="ct-avatar co">{coInitials(co.name)}</div>
                  <div>
                    <div className="ct-card-name">{co.name}</div>
                    {co.industry && <div className="ct-card-sub">{co.industry}</div>}
                  </div>
                </div>
                <span className="ct-industry">{co.industry || 'N/A'}</span>
              </div>

              <div className="ct-card-meta">
                {co.owner && <div className="ct-card-row"><User size={11} />{co.owner}</div>}
                {co.phone && <div className="ct-card-row"><Phone size={11} />{co.phone}</div>}
                {(co.city || co.country) && (
                  <div className="ct-card-row">
                    <MapPin size={11} />{[co.city, co.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>

              <div className="ct-card-foot">
                {canEdit && (
                  <button className="ct-del" onClick={() => handleDelete(co.record_id)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal ────────────────────────────────────── */}
      {isModalOpen && canEdit && (
        <div className="ct-overlay" onClick={(e) => e.target === e.currentTarget && toggleModal()}>
          <div className="ct-modal">

            <div className="ct-modal-head">
              <div className="ct-modal-head-left">
                <div className="ct-modal-icon"><Building2 size={17} /></div>
                <div>
                  <h3 className="ct-modal-title">Create Company</h3>
                  <p className="ct-modal-sub">Add a new organization to your records</p>
                </div>
              </div>
              <button className="ct-modal-x" onClick={toggleModal}><X size={15} /></button>
            </div>

            <div className="ct-modal-body">
              <form id="ct-company-form" onSubmit={handleSubmit}>

                <div className="ct-section">Company Details</div>
                <div className="ct-form-grid">
                  <div className="ct-field ct-full">
                    <label className="ct-label">Company Name *</label>
                    <input className="ct-input" type="text" required placeholder="e.g. Visible Corp." value={formData.name} onChange={set('name')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Company Owner</label>
                    <input className="ct-input" type="text" placeholder="e.g. Resil Fuscablo" value={formData.owner} onChange={set('owner')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Phone</label>
                    <input className="ct-input" type="text" placeholder="+63 2 000 0000" value={formData.phone} onChange={set('phone')} />
                  </div>
                  <div className="ct-field ct-full">
                    <label className="ct-label">Industry *</label>
                    <select className="ct-select-field" required value={formData.industry} onChange={set('industry')}>
                      <option value="">Select Industry</option>
                      {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ct-section">Location</div>
                <div className="ct-form-grid">
                  <div className="ct-field">
                    <label className="ct-label">City</label>
                    <input className="ct-input" type="text" placeholder="Manila" value={formData.city} onChange={set('city')} />
                  </div>
                  <div className="ct-field">
                    <label className="ct-label">Country</label>
                    <input className="ct-input" type="text" placeholder="Philippines" value={formData.country} onChange={set('country')} />
                  </div>
                </div>

              </form>
            </div>

            <div className="ct-modal-foot">
              <button className="ct-btn-cancel" type="button" onClick={toggleModal}>Cancel</button>
              <button className="ct-btn-save" type="submit" form="ct-company-form">
                <Building2 size={13} /> Create Company
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Company;
