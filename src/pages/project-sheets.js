import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, User, Filter, FileText, TrendingUp, X, Download } from 'lucide-react';
import axios from 'axios';
import '../styles/project-sheets.css';

const statusColors = {
  'Lead':                 { bg: '#fef3c7', color: '#b45309', dot: '#f59e0b' },
  'For Proposal':         { bg: '#ede9fe', color: '#6d28d9', dot: '#8b5cf6' },
  'Proposal':             { bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  'Purchase Order':       { bg: '#ede9fe', color: '#6d28d9', dot: '#8b5cf6' },
  'Site Survey-POC':      { bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  'Closed Lost':          { bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  'Completed Project':    { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  'Inactive Project':     { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  'Renewal Support':      { bg: '#ffedd5', color: '#c2410c', dot: '#f97316' },
  'Previous Year Project':{ bg: '#e2e8f0', color: '#334155', dot: '#475569' },
  'Recovered Project':    { bg: '#fce7f3', color: '#9d174d', dot: '#ec4899' },
};

const StatusBadge = ({ status }) => {
  const s = statusColors[status] || { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' };
  return (
    <span className="ps-badge" style={{ background: s.bg, color: s.color }}>
      <span className="ps-badge-dot" style={{ background: s.dot }} />
      {status || '—'}
    </span>
  );
};

const Projects = ({ loggedInUser }) => {
  const [projects, setProjects]       = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [animIn, setAnimIn]           = useState(false);

  const [docData, setDocData] = useState({
    prefix: '', client_name: '', company_name: '', salesrep_name: '',
    contact_number: '', position: '', project_name: '', date: ''
  });

  const API_BASE_URL = process.env.REACT_APP_API_IP;

  const statusOptions = [
    'All', 'Lead', 'For Proposal', 'Proposal', 'Purchase Order',
    'Site Survey-POC', 'Closed Lost', 'Completed Project',
    'Inactive Project', 'Renewal Support', 'Previous Year Project', 'Recovered Project'
  ];

  useEffect(() => {
    fetchProjects();
    const t = setTimeout(() => setAnimIn(true), 60);
    return () => clearTimeout(t);
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/projects`);
      if (res.data.success) setProjects(res.data.projects);
    } catch (err) {
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const term = searchQuery.toLowerCase().trim();
      const matchesSearch = !term ||
        p.deal_name?.toLowerCase().includes(term) ||
        p.deal_owner?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, projects]);

  // Quick summary counts
  const summary = useMemo(() => ({
    total:     projects.length,
    active:    projects.filter(p => ['Proposal','Purchase Order','Site Survey-POC'].includes(p.status)).length,
    completed: projects.filter(p => p.status === 'Completed Project').length,
    totalValue: projects.reduce((s, p) => s + (Number(p.total_amount) || 0), 0),
  }), [projects]);

  const handleInputChange = (e) => setDocData({ ...docData, [e.target.name]: e.target.value });

  const generateDocument = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/generate-document`, docData, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Proposal.docx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShowModal(false);
    } catch (err) {
      console.error('Generate error:', err);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
  const formatAmount = (n) => `₱${Number(n || 0).toLocaleString()}`;

  return (
    <div className={`ps-page ${animIn ? 'ps-anim-in' : ''}`}>

      {/* ── Top fixed section ─────────────────────── */}
      <div className="ps-top">

        {/* Header row */}
        <div className="ps-header">
          <div className="ps-header-left">
            <div className="ps-header-icon"><FileText size={18} /></div>
            <div>
              <h1 className="ps-title">Project Sheets</h1>
              <p className="ps-subtitle">{summary.total} projects · ₱{summary.totalValue.toLocaleString()} total value</p>
            </div>
          </div>
          <button className="ps-gen-btn" onClick={() => setShowModal(true)}>
            <Download size={15} />
            <span>Generate Proposal</span>
          </button>
        </div>

        {/* Summary chips */}
        <div className="ps-summary-row">
          <div className="ps-chip">
            <span className="ps-chip-dot" style={{ background: '#3b82f6' }} />
            <span className="ps-chip-val">{summary.total}</span>
            <span className="ps-chip-lbl">Total</span>
          </div>
          <div className="ps-chip">
            <span className="ps-chip-dot" style={{ background: '#f59e0b' }} />
            <span className="ps-chip-val">{projects.filter(p => p.status === 'Lead').length}</span>
            <span className="ps-chip-lbl">Lead</span>
          </div>
          <div className="ps-chip">
            <span className="ps-chip-dot" style={{ background: '#8b5cf6' }} />
            <span className="ps-chip-val">{summary.active}</span>
            <span className="ps-chip-lbl">Active</span>
          </div>
          <div className="ps-chip">
            <span className="ps-chip-dot" style={{ background: '#22c55e' }} />
            <span className="ps-chip-val">{summary.completed}</span>
            <span className="ps-chip-lbl">Completed</span>
          </div>
          <div className="ps-chip">
            <span className="ps-chip-dot" style={{ background: '#ef4444' }} />
            <span className="ps-chip-val">{projects.filter(p => p.status === 'Closed Lost').length}</span>
            <span className="ps-chip-lbl">Lost</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="ps-toolbar">
          <div className="ps-filter-wrap">
            <Filter size={14} className="ps-filter-icon" />
            <select
              className="ps-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="ps-search-wrap">
            <Search size={14} className="ps-search-icon" />
            <input
              className="ps-search"
              type="text"
              placeholder="Search project or owner…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ps-clear" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>

          <span className="ps-result-count">{filteredProjects.length} result{filteredProjects.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Table (desktop) / Cards (mobile) ─────── */}
      <div className="ps-body">
        {loading ? (
          <div className="ps-loading">
            <div className="ps-spinner" />
            <span>Loading projects…</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="ps-empty">
            <FileText size={36} />
            <p>No projects found</p>
            <span>Try adjusting your search or filter</span>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Deal Name</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Total Amount</th>
                    <th>Closed Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((proj, i) => (
                    <tr key={proj.id} className="ps-row" style={{ animationDelay: `${i * 18}ms` }}>
                      <td className="ps-td-num">{i + 1}</td>
                      <td>
                        <div className="ps-deal-name">{proj.deal_name}</div>
                        <div className="ps-deal-id">#{proj.id}</div>
                      </td>
                      <td><StatusBadge status={proj.status} /></td>
                      <td>
                        <div className="ps-owner">
                          <div className="ps-owner-avatar">{(proj.deal_owner || 'U')[0].toUpperCase()}</div>
                          <span>{proj.deal_owner || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="ps-amount">{formatAmount(proj.total_amount)}</td>
                      <td className="ps-date">
                        <Calendar size={12} style={{ opacity: 0.4, marginRight: 5 }} />
                        {formatDate(proj.closed_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="ps-cards">
              {filteredProjects.map((proj, i) => (
                <div key={proj.id} className="ps-card" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="ps-card-top">
                    <div className="ps-card-name">{proj.deal_name}</div>
                    <StatusBadge status={proj.status} />
                  </div>
                  <div className="ps-card-id">#{proj.id}</div>
                  <div className="ps-card-meta">
                    <div className="ps-card-meta-row">
                      <User size={12} />
                      <span>{proj.deal_owner || 'Unassigned'}</span>
                    </div>
                    <div className="ps-card-meta-row">
                      <Calendar size={12} />
                      <span>{formatDate(proj.closed_date)}</span>
                    </div>
                  </div>
                  <div className="ps-card-amount">{formatAmount(proj.total_amount)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Generate Proposal Modal ───────────────── */}
      {showModal && (
        <div className="ps-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="ps-modal">
            <div className="ps-modal-header">
              <div className="ps-modal-title">
                <Download size={16} />
                <span>Generate Proposal Document</span>
              </div>
              <button className="ps-modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <div className="ps-modal-body">
              <div className="ps-modal-section">
                <span className="ps-modal-section-label">Client Info</span>
                <div className="ps-modal-grid">
                  <input className="ps-input" name="prefix"      placeholder="Prefix (Mr./Mrs.)" onChange={handleInputChange} />
                  <input className="ps-input" name="client_name" placeholder="Client Name"        onChange={handleInputChange} />
                  <input className="ps-input" name="position"    placeholder="Client Position"    onChange={handleInputChange} />
                  <input className="ps-input" name="company_name" placeholder="Company Name"      onChange={handleInputChange} />
                </div>
              </div>

              <div className="ps-modal-section">
                <span className="ps-modal-section-label">Project Info</span>
                <div className="ps-modal-grid">
                  <input className="ps-input ps-input-full" name="project_name"   placeholder="Project Name"          onChange={handleInputChange} />
                  <input className="ps-input" name="salesrep_name"   placeholder="Sales Representative"  onChange={handleInputChange} />
                  <input className="ps-input" name="contact_number"  placeholder="Contact Number"         onChange={handleInputChange} />
                  <input className="ps-input" name="date" type="date"             onChange={handleInputChange} />
                </div>
              </div>
            </div>

            <div className="ps-modal-footer">
              <button className="ps-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="ps-btn-generate" onClick={generateDocument}>
                <Download size={14} /> Generate .docx
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
