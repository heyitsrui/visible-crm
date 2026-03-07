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
    { label: 'Dashboard', icon: <Home size={20} /> },
    { label: 'Proposal',
      icon: <Lightbulb size={20} />,
      isDropdown: true,
      subItems: ['Project Pipeline', 'Project Sheets'] 
    },
    
    { 
      label: 'Projects', 
      icon: <FileText size={20} />,
    },
    { 
      label: 'Finance', 
      icon: <DollarSign size={20} />, 
    },
    { 
      label: 'BOM', 
      icon: <LayoutGrid size={20} />, 
    },
    { 
      label: 'Tasks', 
      icon: <Landmark size={20} />, 
      isDropdown: true,
      subItems: ['My Task', 'Time Tree'] 
    },
    { 
      label: 'Contacts', 
      icon: <BarChart3 size={20} />,
      isDropdown: true,
      subItems: ['Clients', 'Company']
    },
    { label: 'User / Employee', icon: <Users size={20} /> },
    { label: 'Logout', icon: <LogOut size={20} />, isLogout: true },
  ];

  const toggleDropdown = (label) => {
    setOpenMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  return (
    <aside className={`sidebar ${className}`}>
      <div className="logo-section">
        <img src="vtic.webp" alt="Visible Logo" />
      </div>

      <nav className="nav-list">
        {menuItems.map((item, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => {
                if (item.isLogout) {
                  onLogout();
                } else if (item.isDropdown) {
                  toggleDropdown(item.label);
                } else {
                  setActiveIndex(index);
                }
              }}
              className={`nav-item ${activeIndex === index ? 'active' : ''} ${item.isLogout ? 'logout-btn' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.isDropdown && (
                <span className="chevron-icon">
                  {openMenus[item.label] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              )}
            </button>
            
            {/* Sub-menu logic */}
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
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;