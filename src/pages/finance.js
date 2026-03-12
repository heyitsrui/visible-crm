import React, { useState, useEffect, useMemo } from 'react';
import { Edit, Search, X, Filter, DollarSign, TrendingUp, AlertCircle, CheckCircle, Save } from 'lucide-react';
import axios from 'axios';
import '../styles/finance.css';
import { sendNotification } from "../utils/notifService";

const statusClass = (status) =>
  status?.toLowerCase().replace(/[\s/]+/g, '-') || '';

const StatusBadge = ({ status }) => (
  <span className={`fn-badge ${statusClass(status)}`}>
    <span className="fn-badge-dot" />
    {status || 'N/A'}
  </span>
);

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0 });

const Finance = ({ loggedInUser }) => {
  const [projects, setProjects]             = useState([]);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [paidAmount, setPaidAmount]         = useState('');
  const [searchQuery, setSearchQuery]       = useState('');
  const [statusFilter, setStatusFilter]     = useState('All');
  const [ready, setReady]                   = useState(false);

  const API_BASE_URL = `http://${window.location.hostname}:5000`;
  const canManageFinance = loggedInUser === 'admin' || loggedInUser === 'finance';

  const statusOptions = [
    'All', 'Lead', 'For Proposal', 'Proposal', 'Purchase Order', 'Site Survey-POC',
    'Closed Lost', 'Completed Project', 'Inactive Project',
    'Renewal Support', 'Previous Year Project', 'Recovered Project',
  ];

  useEffect(() => {
    fetchFinanceData();
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  const fetchFinanceData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/finance/projects`);
      if (res.data.success) setProjects(res.data.projects);
    } catch (err) {
      console.error('Error fetching finance data:', err);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const term = searchQuery.toLowerCase().trim();
      const matchesSearch = !term || proj.deal_name?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'All' || proj.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, projects]);

  // Status groups for money totals
  const PAID_STATUSES = ['Purchase Order', 'Completed Project'];
  const DUE_STATUSES  = ['Lead', 'For Proposal', 'Proposal', 'Site Survey-POC', 'Renewal Support'];

  // KPI summary
  const kpis = useMemo(() => {
    // Total Paid = total_amount of Purchase Order + Completed Project projects
    const paid = projects
      .filter(p => PAID_STATUSES.includes(p.status))
      .reduce((s, p) => s + Number(p.total_amount || 0), 0);

    // Total Due = total_amount of Lead + Proposal + Site Survey-POC + Renewal Support projects
    const due = projects
      .filter(p => DUE_STATUSES.includes(p.status))
      .reduce((s, p) => s + Number(p.total_amount || 0), 0);

    const total = paid + due;
    const pct   = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, due, pct };
  }, [projects]);

  const handleOpenModal = (project) => {
    setSelectedProject(project);
    setPaidAmount(project.paid_amount);
    setIsModalOpen(true);
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/finance/update/${selectedProject.id}`,
        { paid_amount: paidAmount, role: loggedInUser }
      );

      if (res.data.success) {
        sendNotification(
          `💰 Payment Updated for "${selectedProject.deal_name}": ` +
          `New Paid Total: ₱${fmt(paidAmount)} (Remaining Balance: ₱${fmt(res.data.balance)})`
        );
        alert(`Payment Updated! New Balance: ₱${fmt(res.data.balance)}`);
        setIsModalOpen(false);
        fetchFinanceData();
      }
    } catch (err) {
      console.error('Update error:', err.response?.data || err.message);
      alert('Failed to update finance record.');
    }
  };

  // Computed balance for modal preview
  const previewBalance = useMemo(() => {
    if (!selectedProject) return 0;
    return Number(selectedProject.total_amount || 0) - Number(paidAmount || 0);
  }, [paidAmount, selectedProject]);

  const paidPct = (proj) => {
    const t = Number(proj.total_amount || 0);
    const p = Number(proj.paid_amount  || 0);
    return t > 0 ? Math.min(100, Math.round((p / t) * 100)) : 0;
  };

  return (
    <div className={`fn-page ${ready ? 'fn-ready' : ''}`}>

      {/* ── Fixed top ──────────────────────────── */}
      <div className="fn-top">

        {/* Header */}
        <div className="fn-header">
          <div className="fn-header-left">
            <h1>Financial Management</h1>
            <p>{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} · {projects.length} total</p>
          </div>

          <div className="fn-header-actions">
            {/* Status filter */}
            <div className="fn-filter-wrap">
              <Filter size={14} className="fn-filter-icon" />
              <select
                className="fn-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statusOptions.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="fn-search-wrap">
              <Search size={14} className="fn-search-icon" />
              <input
                className="fn-search"
                type="text"
                placeholder="Search project name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="fn-clear" onClick={() => setSearchQuery('')}>
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="fn-kpis">
          <div className="fn-kpi">
            <div className="fn-kpi-icon blue"><DollarSign size={18} /></div>
            <div className="fn-kpi-body">
              <div className="fn-kpi-val">₱{fmt(kpis.total)}</div>
              <div className="fn-kpi-lbl">Total Contract</div>
            </div>
          </div>
          <div className="fn-kpi">
            <div className="fn-kpi-icon green"><CheckCircle size={18} /></div>
            <div className="fn-kpi-body">
              <div className="fn-kpi-val">₱{fmt(kpis.paid)}</div>
              <div className="fn-kpi-lbl">Total Paid</div>
              <div style={{ fontSize: 10, color: "#16a34a", opacity: 0.8, marginTop: 2, fontWeight: 500 }}>Purchase Order · Completed</div>
            </div>
          </div>
          <div className="fn-kpi">
            <div className="fn-kpi-icon red"><AlertCircle size={18} /></div>
            <div className="fn-kpi-body">
              <div className="fn-kpi-val">₱{fmt(kpis.due)}</div>
              <div className="fn-kpi-lbl">Total Due</div>
              <div style={{ fontSize: 10, color: "#dc2626", opacity: 0.8, marginTop: 2, fontWeight: 500 }}>Lead · Proposal · Site Survey · Renewal</div>
            </div>
          </div>
          <div className="fn-kpi">
            <div className="fn-kpi-icon amber"><TrendingUp size={18} /></div>
            <div className="fn-kpi-body">
              <div className="fn-kpi-val">{kpis.pct}%</div>
              <div className="fn-kpi-lbl">Collection Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────── */}
      <div className="fn-body">
        <div className="fn-section-label">
          Project Ledger
          <span className="fn-count-pill">{filteredProjects.length}</span>
        </div>

        {/* ── Desktop table ── */}
        <div className="fn-table-wrap">
          <div className="fn-table-scroll">
            <table className="fn-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th className="fn-th-right">Total Contract</th>
                  <th className="fn-th-right">Paid Amount</th>
                  <th>Paid Progress</th>
                  <th className="fn-th-right">Due Amount</th>
                  <th>Status</th>
                  {canManageFinance && <th className="fn-th-center">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((proj, i) => (
                    <tr key={proj.id} style={{ animationDelay: `${i * 18}ms` }}>
                      <td>
                        <span className="fn-proj-name">{proj.deal_name}</span>
                      </td>
                      <td className="fn-td-right fn-amt fn-amt-total">
                        ₱{fmt(proj.total_amount)}
                      </td>
                      <td className="fn-td-right fn-amt fn-amt-paid">
                        ₱{fmt(proj.paid_amount)}
                      </td>
                      <td>
                        <div className="fn-progress-wrap">
                          <div className="fn-progress-bar">
                            <div
                              className="fn-progress-fill"
                              style={{ width: `${paidPct(proj)}%` }}
                            />
                          </div>
                          <span className="fn-progress-pct">{paidPct(proj)}%</span>
                        </div>
                      </td>
                      <td className={`fn-td-right fn-amt ${Number(proj.due_amount) > 0 ? 'fn-amt-due-pos' : 'fn-amt-due-zero'}`}>
                        ₱{fmt(proj.due_amount)}
                      </td>
                      <td>
                        <StatusBadge status={proj.status} />
                      </td>
                      {canManageFinance && (
                        <td className="fn-td-center">
                          <button
                            className="fn-edit-btn"
                            title="Update Payment"
                            onClick={() => handleOpenModal(proj)}
                          >
                            <Edit size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr className="fn-empty-row">
                    <td colSpan={canManageFinance ? 7 : 6}>
                      <div className="fn-empty-inner">
                        <DollarSign size={36} />
                        <p>No projects found</p>
                        <span>Try adjusting your search or filter</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Mobile cards ── */}
        <div className="fn-cards">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((proj, i) => (
              <div
                key={proj.id}
                className="fn-card"
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <div className="fn-card-header">
                  <span className="fn-card-name">{proj.deal_name}</span>
                  <StatusBadge status={proj.status} />
                </div>

                <div className="fn-card-amounts">
                  <div className="fn-card-amt-item">
                    <span className="fn-card-amt-label">Contract</span>
                    <span className="fn-card-amt-val fn-amt-total">₱{fmt(proj.total_amount)}</span>
                  </div>
                  <div className="fn-card-amt-item">
                    <span className="fn-card-amt-label">Paid</span>
                    <span className="fn-card-amt-val fn-amt-paid">₱{fmt(proj.paid_amount)}</span>
                  </div>
                  <div className="fn-card-amt-item">
                    <span className="fn-card-amt-label">Due</span>
                    <span className={`fn-card-amt-val ${Number(proj.due_amount) > 0 ? 'fn-amt-due-pos' : 'fn-amt-due-zero'}`}>
                      ₱{fmt(proj.due_amount)}
                    </span>
                  </div>
                </div>

                <div className="fn-card-footer">
                  <div className="fn-card-progress">
                    <div className="fn-progress-wrap">
                      <div className="fn-progress-bar">
                        <div className="fn-progress-fill" style={{ width: `${paidPct(proj)}%` }} />
                      </div>
                      <span className="fn-progress-pct">{paidPct(proj)}%</span>
                    </div>
                  </div>
                  {canManageFinance && (
                    <button
                      className="fn-edit-btn"
                      title="Update Payment"
                      onClick={() => handleOpenModal(proj)}
                    >
                      <Edit size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="fn-empty-inner" style={{ padding: '40px 0' }}>
              <DollarSign size={36} />
              <p>No projects found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Payment Modal ─────────────────────────── */}
      {isModalOpen && (
        <div
          className="fn-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
        >
          <div className="fn-modal">
            {/* Header */}
            <div className="fn-modal-header">
              <div className="fn-modal-header-left">
                <div className="fn-modal-icon">
                  <DollarSign size={18} />
                </div>
                <div>
                  <h3 className="fn-modal-title">Update Payment</h3>
                  <p className="fn-modal-subtitle">{selectedProject?.deal_name}</p>
                </div>
              </div>
              <button className="fn-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="fn-modal-body">
              {/* Summary */}
              <div className="fn-modal-summary">
                <div className="fn-modal-summary-item">
                  <span className="fn-modal-summary-label">Total Contract</span>
                  <span className="fn-modal-summary-val">₱{fmt(selectedProject?.total_amount)}</span>
                </div>
                <div className="fn-modal-summary-item">
                  <span className="fn-modal-summary-label">Previously Paid</span>
                  <span className="fn-modal-summary-val fn-amt-paid">₱{fmt(selectedProject?.paid_amount)}</span>
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleUpdatePayment} id="fn-payment-form">
                <div className="fn-input-group">
                  <label className="fn-label">
                    <DollarSign size={12} /> New Paid Amount
                  </label>
                  <div className="fn-input-prefix-wrap">
                    <span className="fn-prefix">₱</span>
                    <input
                      className="fn-input"
                      type="number"
                      placeholder="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Balance preview */}
                <div className="fn-balance-preview">
                  <div>
                    <div className="fn-balance-label">Remaining Balance</div>
                    <div className={`fn-balance-val ${previewBalance > 0 ? 'positive' : 'zero'}`}>
                      ₱{fmt(previewBalance)}
                    </div>
                  </div>
                  <DollarSign size={28} color={previewBalance > 0 ? '#dc2626' : '#16a34a'} opacity={0.2} />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="fn-modal-footer">
              <button className="fn-btn-cancel" type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="fn-btn-save" type="submit" form="fn-payment-form">
                <Save size={13} /> Update Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
