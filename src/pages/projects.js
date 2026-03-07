import React, { useState, useEffect, useMemo } from "react";
import {
  Clock, MessageSquare, UserCircle, Send,
  DollarSign, Building2, Phone, Search, X,
  Filter, Paperclip, Trash2, ChevronDown, Upload
} from "lucide-react";
import axios from "axios";
import "../styles/projects.css";
import { sendNotification } from "../utils/notifService";

const statusClass = (status) =>
  status?.toLowerCase().replace(/[\s/]+/g, "-") || "";

const StatusBadge = ({ status }) => (
  <span className={`pj-badge ${statusClass(status)}`}>
    <span className="pj-badge-dot" />
    {status || "Lead"}
  </span>
);

const Projects = ({ currentUser }) => {
  const [projects, setProjects]         = useState([]);
  const [visibleDetails, setVisibleDetails] = useState({});
  const [visibleNotes, setVisibleNotes] = useState({});
  const [newComment, setNewComment]     = useState({});
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedFiles, setSelectedFiles] = useState({});
  const [isUploading, setIsUploading]   = useState(false);
  const [ready, setReady]               = useState(false);

  const columns = [
    "All", "Lead", "For Proposal", "Proposal", "Purchase Order",
    "Site Survey-POC", "Closed Lost", "Completed Project",
    "Inactive Project", "Renewal Support", "Previous Year Project", "Recovered Project",
  ];

  useEffect(() => {
    if (currentUser) console.log("Projects loaded. User:", currentUser);
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/projects-detailed");
      if (res.data.success) setProjects(res.data.projects);
    } catch (err) {
      console.error("Project Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleAddComment = async (projId) => {
    const commentText = newComment[projId]?.trim();
    if (!commentText) return;
    if (!currentUser) { alert("You must be logged in to post comments."); return; }

    const authorName = currentUser.name || currentUser.username || currentUser.display_name || "User";
    const project = projects.find((p) => p.id === projId);

    try {
      await axios.post(`http://localhost:5000/api/projects/${projId}/comments`, {
        user_name: authorName,
        comment_text: commentText,
      });
      sendNotification(`💬 ${authorName} commented on "${project?.deal_name || "Project"}": ${commentText.substring(0, 30)}${commentText.length > 30 ? "..." : ""}`);
      setNewComment((prev) => ({ ...prev, [projId]: "" }));
      fetchData();
    } catch (err) {
      console.error("Comment Error:", err);
      alert("Failed to post comment.");
    }
  };

  const handleFileUpload = async (projId) => {
    const file = selectedFiles[projId];
    if (!file) return;

    const uploaderName = currentUser?.name || "User";
    const project = projects.find((p) => p.id === projId);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploaded_by", uploaderName);

    try {
      setIsUploading(true);
      await axios.post(`http://localhost:5000/api/projects/${projId}/attachments`, formData);
      sendNotification(`📎 ${uploaderName} attached "${file.name}" to "${project?.deal_name || "Project"}"`);
      setSelectedFiles((prev) => ({ ...prev, [projId]: null }));
      fetchData();
    } catch (err) {
      alert("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (fileId) => {
    if (!window.confirm("Delete this file?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/attachments/${fileId}`);
      fetchData();
    } catch (err) {
      alert("Delete failed");
    }
  };

  const toggleDetails = (id) =>
    setVisibleDetails((prev) => ({ ...prev, [id]: !prev[id] }));

  const filteredData = useMemo(() => {
    return projects.filter((p) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        (p.deal_name || "").toLowerCase().includes(term) ||
        (p.company || "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, projects]);

  // Summary stats
  const stats = useMemo(() => ([
    { label: "Total",     color: "#8b5cf6", count: projects.length },
    { label: "Lead",      color: "#f59e0b", count: projects.filter(p => p.status === "Lead").length },
    { label: "Active",    color: "#3b82f6", count: projects.filter(p => ["Proposal","Purchase Order","Site Survey-POC"].includes(p.status)).length },
    { label: "Completed", color: "#22c55e", count: projects.filter(p => p.status === "Completed Project").length },
    { label: "Lost",      color: "#ef4444", count: projects.filter(p => p.status === "Closed Lost").length },
  ]), [projects]);

  const getInitial = (name) => (name || "U")[0].toUpperCase();

  return (
    <div className={`projects-page-wrapper ${ready ? "pj-ready" : ""}`}>

      {/* ── Fixed top ─────────────────────────────── */}
      <div className="pj-top">
        {/* Header */}
        <div className="pj-header">
          <div className="pj-header-left">
            <h1>All Projects</h1>
            <p>{filteredData.length} project{filteredData.length !== 1 ? "s" : ""} · {projects.length} total</p>
          </div>

          <div className="pj-header-actions">
            {/* Filter */}
            <div className="pj-filter-wrap">
              <Filter size={14} className="pj-filter-icon" />
              <select
                className="pj-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="pj-search-wrap">
              <Search size={14} className="pj-search-icon" />
              <input
                className="pj-search"
                placeholder="Search name or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="pj-clear" onClick={() => setSearch("")}>
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="pj-stats">
          {stats.map((s) => (
            <div className="pj-stat" key={s.label}>
              <div className="pj-stat-dot" style={{ background: s.color }} />
              <div>
                <div className="pj-stat-val">{s.count}</div>
                <div className="pj-stat-lbl">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────── */}
      <div className="pj-body">
        <div className="pj-section-title">
          Project Pipelines &amp; Tracking
          <span className="pj-count-pill">{filteredData.length}</span>
        </div>

        <div className="pj-stack">
          {filteredData.length === 0 ? (
            <div className="pj-empty">
              <Building2 size={36} />
              <p>No projects found</p>
              <span>Try adjusting your search or filter</span>
            </div>
          ) : (
            filteredData.map((proj, i) => (
              <div
                key={proj.id}
                className={`pj-card ${statusClass(proj.status)} ${visibleDetails[proj.id] ? "expanded" : ""}`}
                style={{ animationDelay: `${i * 20}ms` }}
                onClick={() => toggleDetails(proj.id)}
              >
                {/* Card main row */}
                <div className="pj-card-main">
                  <div className="pj-avatar">{getInitial(proj.deal_owner)}</div>

                  <div className="pj-card-info">
                    <div className="pj-card-title-row">
                      <span className="pj-card-name">{proj.deal_name || "Untitled Project"}</span>
                      <StatusBadge status={proj.status} />
                    </div>

                    <div className="pj-meta">
                      <span className="pj-meta-item">
                        <Building2 size={12} />
                        {proj.company || "No Company"}
                      </span>
                      <span className="pj-meta-item">
                        <UserCircle size={12} />
                        <strong>{proj.deal_owner || "Unassigned"}</strong>
                      </span>
                      <span className="pj-meta-item pj-amount">
                        <DollarSign size={12} />
                        ₱{Number(proj.total_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <ChevronDown size={16} className="pj-chevron" />
                </div>

                {/* Expanded details */}
                {visibleDetails[proj.id] && (
                  <div
                    className="pj-expanded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pj-expanded-inner">
                      {/* Details grid */}
                      <div className="pj-details-grid">
                        <div className="pj-detail-item">
                          <span className="pj-detail-label">Date Created</span>
                          <span className="pj-detail-value">
                            {proj.created_at ? new Date(proj.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </span>
                        </div>
                        <div className="pj-detail-item">
                          <span className="pj-detail-label">Contact</span>
                          <span className="pj-detail-value">{proj.contact || "N/A"}</span>
                        </div>
                        <div className="pj-detail-item">
                          <span className="pj-detail-label">Site Address</span>
                          <span className="pj-detail-value">{proj.address || "N/A"}</span>
                        </div>
                      </div>

                      {proj.description && (
                        <div className="pj-description">
                          <strong>Project Notes:</strong> {proj.description}
                        </div>
                      )}

                      {/* Attachments */}
                      <div className="pj-attachments">
                        <div className="pj-subsection-title">
                          <Paperclip size={12} /> Attachments
                          {proj.attachments?.length > 0 && ` (${proj.attachments.length})`}
                        </div>

                        {proj.attachments?.length > 0 && (
                          <div className="pj-file-list">
                            {proj.attachments.map((file) => (
                              <div key={file.id} className="pj-file-item">
                                <a
                                  href={`http://localhost:5000/uploads/${file.file_path}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="pj-file-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Paperclip size={11} />
                                  {file.file_name}
                                </a>
                                <button
                                  className="pj-file-delete"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(file.id); }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pj-upload-row">
                          <input
                            type="file"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setSelectedFiles({ ...selectedFiles, [proj.id]: e.target.files[0] })}
                          />
                          {selectedFiles[proj.id] && (
                            <button
                              className="pj-upload-btn"
                              onClick={(e) => { e.stopPropagation(); handleFileUpload(proj.id); }}
                              disabled={isUploading}
                            >
                              <Upload size={12} />
                              {isUploading ? "Uploading…" : "Upload"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Discussion */}
                      <div className="pj-discussion">
                        <button
                          className={`pj-discussion-toggle ${visibleNotes[proj.id] ? "open" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setVisibleNotes((prev) => ({ ...prev, [proj.id]: !prev[proj.id] }));
                          }}
                        >
                          <MessageSquare size={12} />
                          Discussion ({proj.comments?.length || 0})
                        </button>

                        {visibleNotes[proj.id] && (
                          <div className="pj-comments-thread">
                            <div className="pj-comments-list">
                              {proj.comments?.length > 0 ? (
                                proj.comments.map((c, i) => (
                                  <div key={i} className="pj-comment-item">
                                    <span className="pj-comment-author">{c.user_name || "Unknown"}:</span>
                                    <span className="pj-comment-text">{c.comment_text}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="pj-no-comments">No updates yet.</p>
                              )}
                            </div>
                            <div className="pj-comment-input-row">
                              <input
                                className="pj-comment-input"
                                type="text"
                                placeholder="Type a project update…"
                                value={newComment[proj.id] || ""}
                                onChange={(e) => setNewComment({ ...newComment, [proj.id]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); handleAddComment(proj.id); }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                className="pj-comment-send"
                                onClick={(e) => { e.stopPropagation(); handleAddComment(proj.id); }}
                              >
                                <Send size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Projects;