import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar";
import TopNav from "../components/topnav";
import UserManagement from "./user";
import MyProfile from "./myprofile";
import Proposal from "./proposal";
import Tasks from "./tasks";
import Company from "./company";
import Client from './client';
import Projects from './projects';
import CPass from "./c-pass";
import Finance from "./finance";
import TimeTree from "./timetree";
import Sheets from "./project-sheets";
import BOM from "./bom";

// --- Chart.js Imports ---
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

import {
  LayoutGrid,
  FileText,
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  Briefcase,
  AlertCircle,
  History,
  RefreshCcw,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpRight
} from "lucide-react";

import "../styles/dashboard.css";

const API_URL = process.env.REACT_APP_API_IP;

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

/* --- Sub-Component: Dashboard Overview --- */
const DashboardOverview = ({ stats, tasks }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [animIn, setAnimIn] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setAnimIn(true), 80);
    return () => clearTimeout(t);
  }, []);

  const statCards = [
    { key: 'leads',              label: 'Lead',                  icon: <LayoutGrid size={18}/>,  colorClass: 'lead',      value: stats?.leads              || 0 },
    { key: 'proposal',           label: 'Proposal',              icon: <FileText size={18}/>,    colorClass: 'proposal',  value: stats?.proposal           || 0 },
    { key: 'purchaseorder',      label: 'Purchase Order',        icon: <Briefcase size={18}/>,   colorClass: 'order',     value: stats?.purchaseorder      || 0 },
    { key: 'sitesurveypoc',      label: 'Site Survey-POC',       icon: <Search size={18}/>,      colorClass: 'poc',       value: stats?.sitesurveypoc      || 0 },
    { key: 'closedlost',         label: 'Closed Lost',           icon: <AlertCircle size={18}/>, colorClass: 'lost',      value: stats?.closedlost         || 0 },
    { key: 'completedproject',   label: 'Completed',             icon: <CheckCircle size={18}/>, colorClass: 'completed', value: stats?.completedproject   || 0 },
    { key: 'inactiveproject',    label: 'Inactive',              icon: <Clock size={18}/>,       colorClass: 'inactive',  value: stats?.inactiveproject    || 0 },
    { key: 'renewalsupport',     label: 'Renewal Support',       icon: <RefreshCcw size={18}/>,  colorClass: 'renewal',   value: stats?.renewalsupport     || 0 },
    { key: 'previousyearproject',label: 'Previous Year',         icon: <History size={18}/>,     colorClass: 'previous',  value: stats?.previousyearproject|| 0 },
    { key: 'recoveredproject',   label: 'Recovered',             icon: <RefreshCcw size={18}/>,  colorClass: 'recovered', value: stats?.recoveredproject   || 0 },
  ];

  const totalProjects = statCards.reduce((s, c) => s + c.value, 0);

  const chartData = {
    labels: statCards.map(c => c.label),
    datasets: [{
      data: statCards.map(c => c.value),
      backgroundColor: [
        "#f59e0b","#3b82f6","#8b5cf6","#10b981",
        "#ef4444","#22c55e","#94a3b8","#f97316","#475569","#ec4899"
      ],
      hoverOffset: 6,
      borderWidth: 0,
      cutout: "72%",
    }],
  };

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: isMobile ? { bottom: 8 } : { right: 8 },
    },
    plugins: {
      legend: {
        display: true,
        position: isMobile ? "bottom" : "right",
        align: isMobile ? "start" : "center",
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: isMobile ? 10 : 14,
          boxWidth: isMobile ? 8 : 10,
          font: { family: "'Poppins', sans-serif", size: isMobile ? 10 : 11 },
          color: '#64748b',
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw} project${ctx.raw !== 1 ? 's' : ''}`,
        },
      },
    },
  }), [isMobile]);

  const priorityColor = (p) => p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : '#3b82f6';

  return (
    <div className={`db-overview ${animIn ? 'db-anim-in' : ''}`}>

      {/* ── Welcome Banner ─────────────────────────────── */}
      <div className="db-banner">
        <div className="db-banner-left">
          <span className="db-banner-eyebrow">Dashboard Overview</span>
          <h1 className="db-banner-title">Project Pipeline</h1>
          <p className="db-banner-sub">{totalProjects} total projects tracked across all stages</p>
        </div>
        <div className="db-banner-right">
          <div className="db-banner-pill">
            <TrendingUp size={14}/>
            <span>{stats?.completedproject || 0} completed</span>
          </div>
          <div className="db-banner-pill db-banner-pill--warn">
            <AlertCircle size={14}/>
            <span>{stats?.closedlost || 0} lost</span>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────── */}
      <div className="db-stat-grid">
        {statCards.map((card, i) => (
          <div
            key={card.key}
            className={`db-stat-card db-stat-card--${card.colorClass}`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <div className="db-stat-icon">
              {card.icon}
            </div>
            <div className="db-stat-body">
              <span className="db-stat-value">{card.value}</span>
              <span className="db-stat-label">{card.label}</span>
            </div>
            <ArrowUpRight size={13} className="db-stat-arrow" />
          </div>
        ))}
      </div>

      {/* ── Money Cards ────────────────────────────────── */}
      <div className="db-money-row">
        <div className="db-money-card db-money-card--green">
          <div className="db-money-icon-wrap">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="db-money-label">Total Paid</p>
            <p className="db-money-value">₱{(Number(stats?.totalPaid) || 0).toLocaleString()}</p>
            <p style={{ fontSize: 10, color: "#16a34a", opacity: 0.75, marginTop: 2, fontWeight: 500, letterSpacing: "0.02em" }}>Purchase Order · Completed</p>
          </div>
          <div className="db-money-badge db-money-badge--green">Collected</div>
        </div>
        <div className="db-money-card db-money-card--red">
          <div className="db-money-icon-wrap">
            <TrendingDown size={20} />
          </div>
          <div>
            <p className="db-money-label">Total Due</p>
            <p className="db-money-value">₱{(Number(stats?.totalDue) || 0).toLocaleString()}</p>
            <p style={{ fontSize: 10, color: "#dc2626", opacity: 0.75, marginTop: 2, fontWeight: 500, letterSpacing: "0.02em" }}>Lead · Proposal · Site Survey · Renewal</p>
          </div>
          <div className="db-money-badge db-money-badge--red">Outstanding</div>
        </div>
      </div>

      {/* ── Bottom: Chart + Tasks ───────────────────────── */}
      <div className="db-bottom">

        {/* Chart */}
        <div className="db-chart-card">
          <div className="db-card-header">
            <span className="db-card-title">Project Status</span>
            <span className="db-card-chip">{totalProjects} total</span>
          </div>
          <div className={`db-chart-wrap${isMobile ? ' db-chart-wrap--mobile' : ''}`}>
            <Doughnut
              key={isMobile ? 'mobile' : 'desktop'}
              data={chartData}
              options={chartOptions}
            />
            {!isMobile && (
              <div className="db-chart-center">
              </div>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="db-tasks-card">
          <div className="db-card-header">
            <span className="db-card-title">My Tasks</span>
            <span className="db-card-chip db-card-chip--blue">{tasks.length} active</span>
          </div>
          <div className="db-task-list">
            {tasks && tasks.length > 0 ? tasks.map((task, i) => (
              <div
                key={i}
                className="db-task-item"
                style={{ '--priority-color': priorityColor(task.priority), animationDelay: `${i * 60}ms` }}
              >
                <div className="db-task-bar" />
                <div className="db-task-content">
                  <div className="db-task-top">
                    <p className="db-task-title">{task.title}</p>
                    {task.status === 'Completed'
                      ? <CheckCircle size={14} color="#22c55e" />
                      : <Clock size={14} color="#94a3b8" />
                    }
                  </div>
                  {task.description && (
                    <p className="db-task-desc">
                      {task.description.substring(0, 55)}{task.description.length > 55 ? '…' : ''}
                    </p>
                  )}
                  <div className="db-task-meta">
                    <span className="db-task-priority" style={{ background: priorityColor(task.priority) + '1a', color: priorityColor(task.priority) }}>
                      {task.priority}
                    </span>
                    <span className={`db-task-status ${task.status === 'Completed' ? 'db-task-status--done' : ''}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="db-task-empty">
                <CheckCircle size={32} color="#e2e8f0"/>
                <p>No tasks assigned to you.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

/* --- Main Dashboard Component --- */
export default function Dashboard() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [stats, setStats] = useState(null);
  const [userTasks, setUserTasks] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("loggedInUser"));
    if (!user) 
      navigate("/");
    else 
      setLoggedInUser(user); 
  }, [navigate]);

  useEffect(() => {
    if (!loggedInUser) return;

    const fetchData = async () => {
      try {
        const statsRes = await fetch(`${API_URL}/api/dashboard-stats`);
        const statsData = await statsRes.json();

        // Also fetch finance data to compute correct totals by status
        const finRes = await fetch(`${API_URL}/api/finance/projects`);
        const finData = await finRes.json();

        if (statsData.success) {
          let totalPaid = 0;
          let totalDue  = 0;

          if (finData.success && finData.projects) {
            const PAID_STATUSES = ['Purchase Order', 'Completed Project'];
            const DUE_STATUSES  = ['Lead', 'For Proposal', 'Proposal', 'Site Survey-POC', 'Renewal Support'];

            finData.projects.forEach(p => {
              const amt = Number(p.total_amount || 0);
              if (PAID_STATUSES.includes(p.status))      totalPaid += amt;
              else if (DUE_STATUSES.includes(p.status))  totalDue  += amt;
            });
          } else {
            // fallback to API-provided values
            totalPaid = Number(statsData.stats?.totalPaid || 0);
            totalDue  = Number(statsData.stats?.totalDue  || 0);
          }

          setStats({ ...statsData.stats, totalPaid, totalDue });
        }

        const taskRes = await fetch(`${API_URL}/api/tasks`);
        const taskData = await taskRes.json();
        
        if (taskData.success) {
          const myTasks = taskData.tasks.filter(t => 
            parseInt(t.user_id) === parseInt(loggedInUser.id)
          );
          setUserTasks(myTasks);
        }
      } catch (err) {
        console.error("Error refreshing dashboard data:", err);
      }
    };

    if (activeIndex === 0) fetchData();
  }, [loggedInUser, activeIndex]);

  const handleLogout = () => {
    localStorage.removeItem("loggedInUser");
    navigate("/");
  };

  const refreshUserData = () => {
    const updatedUser = JSON.parse(localStorage.getItem("loggedInUser"));
    setLoggedInUser(updatedUser);
  };

  const renderContent = () => {
    switch (activeIndex) {
      case 0:
        return <DashboardOverview stats={stats} tasks={userTasks} />;
      case 'project pipeline':
        return <Proposal currentUser={loggedInUser} />;
      case 'project sheets':
        return <Sheets currentUser={loggedInUser} />;
      case 2:
        return <Projects currentUser={loggedInUser} />;
      case 3: 
        return <Finance loggedInUser={loggedInUser?.role} />;
      case 4: 
        return <BOM loggedInUser={loggedInUser} />;
      case 'clients':
        return <Client userRole={loggedInUser?.role} />;
      case 'company':
        return <Company userRole={loggedInUser?.role} />;
      case 'my task':
        return <Tasks loggedInUser={loggedInUser} />;
      case 'time tree':
        return <TimeTree loggedInUser={loggedInUser} />;
      case 7:
        if (loggedInUser?.role === 'admin') {
          return <UserManagement currentUser={loggedInUser} />;
        } else {
          return (
            <div className="dashboard-content">
              <h2>Access Denied</h2>
              <p>You do not have permission to access User Management.</p>
            </div>
          );
        }
      case 99: 
        return <MyProfile user={loggedInUser} onProfileUpdate={refreshUserData} />;
      case 100:
        return <CPass user={loggedInUser} />;
      default:
        return (
          <div className="dashboard-content">
            <h2>Coming Soon</h2>
            <p>This section is currently under development.</p>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-layout">
      
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            zIndex: 999
          }}
        />
      )}

      <Sidebar 
        className={isSidebarOpen ? 'open' : ''}
        activeIndex={activeIndex} 
        setActiveIndex={setActiveIndex} 
        onLogout={handleLogout}
        currentUser={loggedInUser}
      />
      
      <main className="main-area">
        <TopNav 
          loggedInUser={loggedInUser} 
          onNavigate={setActiveIndex}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        
        <div className="view-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
