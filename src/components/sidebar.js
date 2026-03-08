import React, { useState } from 'react';
import {
  Home,
  Lightbulb,
  FileText,
  Landmark,
  BarChart3,
  Users,
  LogOut,
  ChevronDown,
  ChevronUp,
  DollarSign,
  LayoutGrid
} from 'lucide-react';
import '../styles/dashboard.css';

const Sidebar = ({ activeIndex, setActiveIndex, onLogout, className }) => {
  const [openMenus, setOpenMenus] = useState({});

  const menuItems = [
    { label: 'Dashboard', icon: <Home size={18} /> },
    {
      label: 'Proposal',
      icon: <Lightbulb size={18} />,
      isDropdown: true,
      subItems: ['Project Pipeline', 'Project Sheets'],
    },
    { label: 'Projects',  icon: <FileText size={18} /> },
    { label: 'Finance',   icon: <DollarSign size={18} /> },
    { label: 'BOM',       icon: <LayoutGrid size={18} /> },
    {
      label: 'Tasks',
      icon: <Landmark size={18} />,
      isDropdown: true,
      subItems: ['My Task', 'Time Tree'],
    },
    {
      label: 'Contacts',
      icon: <BarChart3 size={18} />,
      isDropdown: true,
      subItems: ['Clients', 'Company'],
    },
    { label: 'User / Employee', icon: <Users size={18} /> },
    { label: 'Logout', icon: <LogOut size={18} />, isLogout: true },
  ];

  const toggleDropdown = (label) => {
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Group items for section labels
  const mainItems     = menuItems.slice(0, 5);   // Dashboard → BOM
  const workItems     = menuItems.slice(5, 8);   // Tasks → User
  const bottomItems   = menuItems.slice(8);      // Logout

  const renderItem = (item, index) => (
    <React.Fragment key={index}>
      <button
        onClick={() => {
          if (item.isLogout)        onLogout();
          else if (item.isDropdown) toggleDropdown(item.label);
          else                      setActiveIndex(index);
        }}
        className={`nav-item
          ${activeIndex === index ? 'active' : ''}
          ${item.isLogout ? 'logout-btn' : ''}
        `}
      >
        <span className="nav-icon">{item.icon}</span>
        <span className="nav-label">{item.label}</span>
        {item.isDropdown && (
          <span className="chevron-icon">
            {openMenus[item.label] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </button>

      {item.isDropdown && openMenus[item.label] && (
        <div className="sub-menu">
          {item.subItems.map((sub, subIdx) => (
            <button
              key={subIdx}
              onClick={() => setActiveIndex(sub.toLowerCase())}
              className={`sub-nav-item ${activeIndex === sub.toLowerCase() ? 'sub-active' : ''}`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </React.Fragment>
  );

  return (
    <aside className={`sidebar ${className}`}>
      {/* Logo */}
      <div className="logo-section">
        <img src="vtic.webp" alt="Visible Logo" />
      </div>

      <nav className="nav-list">
        {/* Main section */}
        <span className="nav-section-label">Main</span>
        {mainItems.map((item, i) => renderItem(item, i))}

        {/* Work section */}
        <span className="nav-section-label" style={{ marginTop: 8 }}>Workspace</span>
        {workItems.map((item, i) => renderItem(item, i + 5))}

        {/* Spacer pushes logout down */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* Logout */}
        {bottomItems.map((item, i) => renderItem(item, i + 8))}
      </nav>
    </aside>
  );
};

export default Sidebar;