import React, { useState, useEffect, useMemo } from 'react';
import { Edit, Search, X, Filter } from 'lucide-react';
import axios from 'axios';
import '../styles/dashboard.css';
import { sendNotification } from "../utils/notifService";

const Finance = ({ loggedInUser }) => {
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState("All");

  const API_BASE_URL = `http://${window.location.hostname}:5000`;
  const canManageFinance = loggedInUser === 'admin' || loggedInUser === 'finance';

  const statusOptions = [
    'All', 'Lead', 'For Proposal', 'Proposal', 'Purchase Order', 'Site Survey-POC', 
    'Closed Lost', 'Completed Project', 'Inactive Project', 
    'Renewal Support', 'Previous Year Project', 'Recovered Project'
  ];

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const term = searchQuery.toLowerCase().trim();
      
      const matchesSearch = !term || 
        proj.deal_name?.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "All" || proj.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, projects]);

  const fetchFinanceData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/finance/projects`);
      if (res.data.success) {
        setProjects(res.data.projects);
      }
    } catch (err) {
      console.error("Error fetching finance data:", err);
    }
  };

  const handleOpenModal = (project) => {
    setSelectedProject(project);
    setPaidAmount(project.paid_amount); 
    setIsModalOpen(true);
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      const res = await axios.put(`${API_BASE_URL}/api/finance/update/${selectedProject.id}`, {
        paid_amount: paidAmount,
        role: loggedInUser 
      });

      if (res.data.success) {
        const formattedAmount = Number(paidAmount).toLocaleString();
        const formattedBalance = Number(res.data.balance).toLocaleString();
        
        sendNotification(
          `💰 Payment Updated for "${selectedProject.deal_name}": ` +
          `New Paid Total: ₱${formattedAmount} (Remaining Balance: ₱${formattedBalance})`
        );
        
        alert(`Payment Updated! New Balance: ₱${Number(res.data.balance).toLocaleString()}`);
        setIsModalOpen(false);
        fetchFinanceData(); 
      }
    } catch (err) {
      console.error("Update error:", err.response?.data || err.message);
      alert("Failed to update finance record.");
    }
  };

  return (
    <div className="view-container">
      <div className="view-header-tabs" style={{ padding: '20px' }}>
        <div style={{ fontWeight: 'bold'}}>Financial Management</div>
      </div>

      <div className="toolbar project-toolbar" style={{ display: 'flex', alignItems: 'center'}}>
        <div className="filter-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '5px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <Filter size={18} style={{ color: '#64748b' }} />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '14px', color: '#1e293b', cursor: 'pointer', background: 'transparent' }}
          >
            {statusOptions.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div className="search-container" style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search project name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 40px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
          />
          {searchQuery && (
            <X
              size={18}
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#94a3b8' }}
            />
          )}
        </div>
      </div>

      <div className="table-responsive-wrapper">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Total Contract</th>
              <th>Paid Amount</th>
              <th>Due Amount</th>
              <th>Status</th>
              {canManageFinance && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length > 0 ? (
              filteredProjects.map((proj) => (
                <tr key={proj.id}>
                  <td className="company-name-cell">
                    <span className="link-text">{proj.deal_name}</span>
                  </td>
                  <td>₱{Number(proj.total_amount).toLocaleString()}</td>
                  <td>₱{Number(proj.paid_amount).toLocaleString()}</td>
                  <td style={{ color: proj.due_amount > 0 ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
                    ₱{Number(proj.due_amount).toLocaleString()}
                  </td>
                  <td>
                    <span className={`status-pill ${proj.status?.toLowerCase().replace(/[\s/]+/g, '-')}`}>
                      {proj.status || 'N/A'}
                    </span>
                  </td>

                  {canManageFinance && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="delete-icon-btn"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleOpenModal(proj)}
                      >
                        <Edit size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={canManageFinance ? 6 : 5} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  No projects found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-body">
            <h3>Update Payment</h3>
            <p className="modal-subtitle">Project: {selectedProject?.deal_name}</p>
            
            <form onSubmit={handleUpdatePayment}>
              <div className="form-group">
                <label>Total Contract: ₱{Number(selectedProject?.total_amount).toLocaleString()}</label>
                <input 
                  type="number" 
                  placeholder="Enter New Paid Amount"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  required
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-save">Update Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
