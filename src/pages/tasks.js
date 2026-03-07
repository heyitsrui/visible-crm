import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit, Trash2, CheckCircle, LayoutGrid, CheckSquare,
  UserPlus, User, Clock, X, Save, ListTodo
} from 'lucide-react';
import axios from 'axios';
import '../styles/tasks.css';
import { sendNotification } from "../utils/notifService";

const API_BASE_URL = `http://${window.location.hostname}:5000`;

const priorityClass = (p) => p?.toLowerCase() || 'low';

const PriorityBadge = ({ priority }) => (
  <span className={`tk-priority-badge ${priorityClass(priority)}`}>
    {priority || 'Low'}
  </span>
);

const Tasks = ({ loggedInUser }) => {
  const [tasks, setTasks]           = useState([]);
  const [users, setUsers]           = useState([]);
  const [filter, setFilter]         = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [ready, setReady]           = useState(false);

  const isAdminOrManager = ['admin', 'manager'].includes(loggedInUser?.role?.toLowerCase());

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Low',
    assigned_to: '',
  });

  useEffect(() => {
    fetchData();
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, [loggedInUser]);

  const fetchData = async () => {
    try {
      const taskRes = await axios.get(`${API_BASE_URL}/api/tasks`);
      if (taskRes.data.success) {
        const allTasks = taskRes.data.tasks;
        const visibleTasks = isAdminOrManager
          ? allTasks
          : allTasks.filter(t => parseInt(t.user_id) === parseInt(loggedInUser.id));
        setTasks(visibleTasks);
      }

      if (isAdminOrManager) {
        const userRes = await axios.get(`${API_BASE_URL}/api/users`);
        if (userRes.data.success) setUsers(userRes.data.users);
      }
    } catch (err) {
      console.error("Data fetch error:", err);
    }
  };

  const handleToggleComplete = async (task) => {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await axios.put(`${API_BASE_URL}/api/tasks/${task.id}/status`, { status: newStatus });
      const message = newStatus === 'Completed'
        ? `✅ Task Completed: ${task.title}`
        : `⏳ Task Reopened: ${task.title}`;
      sendNotification(message);
      fetchData();
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loggedInUser?.id) return alert("Session expired.");

    const targetUserId = (isAdminOrManager && formData.assigned_to)
      ? formData.assigned_to
      : loggedInUser.id;

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        user_id: targetUserId,
      };

      if (editingTask) {
        await axios.put(`${API_BASE_URL}/api/tasks/${editingTask.id}`, payload);
        sendNotification(`📝 Updated task: ${formData.title}`);
      } else {
        await axios.post(`${API_BASE_URL}/api/tasks`, payload);
        if (isAdminOrManager && parseInt(targetUserId) !== parseInt(loggedInUser.id)) {
          const assignedUser = users.find(u => parseInt(u.id) === parseInt(targetUserId));
          sendNotification(`📤 Assigned "${formData.title}" to ${assignedUser?.name || 'Employee'}`);
        } else {
          sendNotification(`🆕 New task created: ${formData.title}`);
        }
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error("Save Error:", err);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setFormData({ title: '', description: '', priority: 'Low', assigned_to: '' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this task?")) {
      try {
        await axios.delete(`${API_BASE_URL}/api/tasks/${id}`);
        fetchData();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigned_to: task.user_id,
    });
    setIsModalOpen(true);
  };

  const filteredTasks = useMemo(() =>
    tasks.filter(t => filter === 'All' || t.priority === filter),
    [tasks, filter]
  );

  // Stats
  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const pendingCount   = tasks.filter(t => t.status !== 'Completed').length;
  const progressPct    = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className={`tk-page ${ready ? 'tk-ready' : ''}`}>

      {/* ── Fixed top ──────────────────────────── */}
      <div className="tk-top">

        {/* Header */}
        <div className="tk-header">
          <div className="tk-header-left">
            <h1>{isAdminOrManager ? "All Employee Tasks" : "My Tasks"}</h1>
            <p>{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} shown · {tasks.length} total</p>
          </div>

          <div className="tk-header-actions">
            {/* Priority filter */}
            <div className="tk-filter-group">
              {['All', 'Low', 'Medium', 'High'].map(f => (
                <button
                  key={f}
                  className={`tk-filter-btn ${filter === f ? 'active ' + f.toLowerCase() : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* CTA button */}
            {isAdminOrManager ? (
              <button className="tk-btn-new" onClick={() => setIsModalOpen(true)}>
                <UserPlus size={15} /> Assign Task
              </button>
            ) : (
              <button className="tk-btn-new" onClick={() => setIsModalOpen(true)}>
                + New Task
              </button>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <div className="tk-stats">
          <div className="tk-stat">
            <div className="tk-stat-icon blue"><LayoutGrid size={18} /></div>
            <div className="tk-stat-body">
              <div className="tk-stat-val">{tasks.length}</div>
              <div className="tk-stat-lbl">Total Tasks</div>
            </div>
          </div>
          <div className="tk-stat">
            <div className="tk-stat-icon green"><CheckSquare size={18} /></div>
            <div className="tk-stat-body">
              <div className="tk-stat-val">{completedCount}</div>
              <div className="tk-stat-lbl">Completed</div>
              <div className="tk-progress-bar">
                <div className="tk-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
          <div className="tk-stat">
            <div className="tk-stat-icon amber"><Clock size={18} /></div>
            <div className="tk-stat-body">
              <div className="tk-stat-val">{pendingCount}</div>
              <div className="tk-stat-lbl">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────── */}
      <div className="tk-body">
        <div className="tk-section-label">
          Task Board
          <span className="tk-count-pill">{filteredTasks.length}</span>
        </div>

        <div className="tk-grid">
          {filteredTasks.length === 0 ? (
            <div className="tk-empty">
              <ListTodo size={38} />
              <p>No tasks found</p>
              <span>Try a different filter or create a new task</span>
            </div>
          ) : (
            filteredTasks.map((task, i) => (
              <div
                key={task.id}
                className={`tk-card ${priorityClass(task.priority)} ${task.status === 'Completed' ? 'completed' : ''}`}
                style={{ animationDelay: `${i * 22}ms` }}
              >
                <div className="tk-card-body">
                  <div className="tk-card-title-row">
                    <span className="tk-card-title">{task.title}</span>
                    <PriorityBadge priority={task.priority} />
                  </div>

                  {task.description && (
                    <p className="tk-card-desc">{task.description}</p>
                  )}

                  {isAdminOrManager && (
                    <div className="tk-owner-tag">
                      <User size={11} />
                      {parseInt(task.user_id) === parseInt(loggedInUser.id)
                        ? <strong>Me (Admin)</strong>
                        : <span>→ <strong>{task.user_name || `User #${task.user_id}`}</strong></span>
                      }
                    </div>
                  )}
                </div>

                <div className="tk-card-footer">
                  <div className="tk-card-meta">
                    <Clock size={11} />
                    <span className={`tk-status-pill ${task.status === 'Completed' ? 'completed' : 'pending'}`}>
                      {task.status || 'Pending'}
                    </span>
                  </div>

                  <div className="tk-actions">
                    <button
                      className={`tk-action-btn check ${task.status === 'Completed' ? 'done' : ''}`}
                      title={task.status === 'Completed' ? 'Mark pending' : 'Mark complete'}
                      onClick={() => handleToggleComplete(task)}
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button
                      className="tk-action-btn edit"
                      title="Edit task"
                      onClick={() => openEdit(task)}
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      className="tk-action-btn del"
                      title="Delete task"
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Modal ────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="tk-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="tk-modal">
            {/* Header */}
            <div className="tk-modal-header">
              <div className="tk-modal-header-left">
                <div className="tk-modal-icon">
                  {editingTask ? <Edit size={17} /> : <UserPlus size={17} />}
                </div>
                <div>
                  <h3 className="tk-modal-title">
                    {editingTask ? 'Edit Task' : isAdminOrManager ? 'Assign Task' : 'New Task'}
                  </h3>
                  <p className="tk-modal-subtitle">
                    {editingTask ? `Editing: ${editingTask.title}` : 'Fill in the task details below'}
                  </p>
                </div>
              </div>
              <button className="tk-modal-close" onClick={closeModal}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} id="tk-task-form">
              <div className="tk-modal-body">
                {/* Title */}
                <div className="tk-field">
                  <label className="tk-label">Task Title *</label>
                  <input
                    className="tk-input"
                    type="text"
                    placeholder="e.g. Prepare CCTV proposal for client"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                {/* Description */}
                <div className="tk-field">
                  <label className="tk-label">Instructions</label>
                  <textarea
                    className="tk-textarea"
                    placeholder="Add task details or instructions…"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Priority + Assign */}
                <div className={`tk-form-row`}>
                  <div className="tk-field">
                    <label className="tk-label">Priority</label>
                    <select
                      className="tk-select"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  {isAdminOrManager && (
                    <div className="tk-field">
                      <label className="tk-label">Assign To</label>
                      <select
                        className="tk-select"
                        value={formData.assigned_to}
                        onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                        required
                      >
                        <option value="">Select employee…</option>
                        <option value={loggedInUser.id}>Myself (Admin)</option>
                        {users.filter(u => u.id !== loggedInUser.id).map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="tk-modal-footer">
              <button className="tk-btn-cancel" type="button" onClick={closeModal}>
                Cancel
              </button>
              <button className="tk-btn-save" type="submit" form="tk-task-form">
                <Save size={13} />
                {editingTask ? 'Save Changes' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;