import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import '../styles/timetree.css';
import { sendNotification, getSocket } from "../utils/notifService";

const API_URL = process.env.REACT_APP_API_IP;

const API_BASE_URL = `${API_URL}/api/timetree`;
const ROW_HEIGHT = 60;

const formatDateToISO = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const parseDbDate = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
};

const TimeTree = () => {
    const [events, setEvents]               = useState([]);
    const [selectedDate, setSelectedDate]   = useState(new Date());
    const [activeEvent, setActiveEvent]     = useState(null);
    const [newMessage, setNewMessage]       = useState("");
    const [showModal, setShowModal]         = useState(false);
    const [showFullEvents, setShowFullEvents] = useState(false);
    const [currentUser, setCurrentUser]     = useState("");
    const [isMobile, setIsMobile]           = useState(window.innerWidth <= 768);
    const [showSidebar, setShowSidebar]     = useState(window.innerWidth > 768);
    const [showMobileCal, setShowMobileCal] = useState(false);
    const [editingChatId, setEditingChatId] = useState(null);
    const [editValue, setEditValue]         = useState("");
    const [formData, setFormData] = useState({
        title: '',
        startTime: '08:00',
        deadline: '',
        deadlineTime: '',
        date: formatDateToISO(new Date())
    });

    const chatEndRef = useRef(null);

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const selectMonth = (monthIndex) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(monthIndex);
        setSelectedDate(newDate);
    };

    const changeYear = (offset) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(selectedDate.getFullYear() + offset);
        setSelectedDate(newDate);
    };

    const renderMonthSelector = () => (
        <div className="month-selector-sidebar">
            {months.map((m, idx) => (
                <div
                    key={m}
                    className={`month-item ${selectedDate.getMonth() === idx ? 'active' : ''}`}
                    onClick={() => selectMonth(idx)}
                >
                    {m}
                </div>
            ))}
        </div>
    );

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) setShowSidebar(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchEvents = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API_BASE_URL}/events`);
            if (data.success) {
                // Auto-complete status changes are now broadcast via socket (timetree-event-completed)
                setEvents(data.events);
                setActiveEvent(current => {
                    if (!current) return null;
                    const updated = data.events.find(ev => ev.id === current.id);
                    return updated || null;
                });
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    }, [events]);

    useEffect(() => {
        const rawStorage = localStorage.getItem('loggedInUser');
        if (rawStorage) {
            const loggedInUser = JSON.parse(rawStorage);
            setCurrentUser(loggedInUser.name || loggedInUser.username || "Guest");
        } else {
            setCurrentUser("Guest_User");
        }
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    // ─── SOCKET: auto-refresh for all timetree events ─────────────────────────
    useEffect(() => {
        const socket = getSocket();
        const onRefresh = () => fetchEvents();
        socket.on('timetree-event-created',   onRefresh);
        socket.on('timetree-event-completed', onRefresh);
        socket.on('timetree-chat-sent',       onRefresh);
        return () => {
            socket.off('timetree-event-created',   onRefresh);
            socket.off('timetree-event-completed', onRefresh);
            socket.off('timetree-chat-sent',       onRefresh);
        };
    }, []);
    // ─────────────────────────────────────────────────────────────────────────

    // ─── "Event is near" deadline reminders ──────────────────────────────────
    useEffect(() => {
        const notifiedSet = new Set(); // prevent duplicate notifications per event per session

        const checkUpcoming = () => {
            const now = new Date();
            const todayStr = formatDateToISO(now);
            const nowMinutes = now.getHours() * 60 + now.getMinutes();

            events.forEach(ev => {
                if (ev.status === 'completed') return;
                const eventDate = ev.event_date?.substring(0, 10);
                if (eventDate !== todayStr) return;

                const [h, m] = (ev.start_time || '00:00').split(':').map(Number);
                const eventMinutes = h * 60 + m;
                const diff = eventMinutes - nowMinutes;

                const key15  = `${ev.id}-15min`;
                const keyNow = `${ev.id}-now`;

                // 15-minute warning (fires when diff is between 14 and 15 mins)
                if (diff >= 14 && diff < 15 && !notifiedSet.has(key15)) {
                    notifiedSet.add(key15);
                    sendNotification(`⏰ Reminder: "${ev.title}" starts in 15 minutes!`);
                }
                // Starting now (fires when diff is between 0 and 1 min)
                if (diff >= 0 && diff < 1 && !notifiedSet.has(keyNow)) {
                    notifiedSet.add(keyNow);
                    sendNotification(`🚀 "${ev.title}" is starting now!`);
                }
            });
        };

        const timer = setInterval(checkUpcoming, 60000); // check every minute
        checkUpcoming(); // run immediately on mount
        return () => clearInterval(timer);
    }, [events]);
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeEvent?.chats]);

    const deleteEvent = async (id) => {
        if (!window.confirm("Delete event and chat history?")) return;
        try {
            const { data } = await axios.delete(`${API_BASE_URL}/events/${id}`);
            if (data.success) {
                if (activeEvent?.id === id) setActiveEvent(null);
                fetchEvents();
            }
        } catch (err) {
            alert(err.response?.data?.error || "Delete failed");
        }
    };

    const toggleEventCompletion = async (event) => {
        const newStatus = event.status === 'completed' ? 'pending' : 'completed';
        setEvents(events.map(ev => ev.id === event.id ? {...ev, status: newStatus} : ev));
        try {
            await axios.put(`${API_BASE_URL}/events/${event.id}/status`, { status: newStatus });
            const msg = newStatus === 'completed'
                ? `✅ Event Completed: "${event.title}" marked as finished by ${currentUser}! 🎉`
                : `🔄 Event Reopened: "${event.title}" is back on the list by ${currentUser}.`;
            // Local notif for the person who toggled
            sendNotification(msg);
            // Broadcast to all other users
            await axios.post(`${API_URL}/api/projects/notify`, {
                event: 'timetree-event-completed',
                eventTitle: event.title,
                newStatus,
                changedBy: currentUser,
            });
        } catch (err) {
            console.error("Status update failed", err);
            fetchEvents();
        }
    };

    const deleteChat = async (chatId) => {
        if (!window.confirm("Delete this message?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/chat/${chatId}`);
            fetchEvents();
        } catch (err) { console.error(err); }
    };

    const updateChat = async (chatId) => {
        try {
            await axios.put(`${API_BASE_URL}/chat/${chatId}`, { message_text: editValue });
            setEditingChatId(null);
            fetchEvents();
        } catch (err) { console.error(err); }
    };

    const formatChatMessageTime = (timestamp) => {
        if (!timestamp) return "Just now";
        const date = new Date(timestamp);
        return date.toLocaleString([], {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        const timeStr = formData.startTime.length === 5 ? `${formData.startTime}:00` : formData.startTime;
        const dTimeStr = (formData.deadlineTime && formData.deadlineTime.length === 5) ? `${formData.deadlineTime}:00` : formData.deadlineTime;
        const payload = { ...formData, startTime: timeStr, deadline_date: formData.deadline || null, deadlineTime: dTimeStr || null };
        try {
            const { data } = await axios.post(`${API_BASE_URL}/events`, payload);
            if (data.success) {
                // Local notif for creator
                sendNotification(`📅 New Event Created: "${formData.title}" scheduled for ${formData.date} at ${formData.startTime}`);
                // Broadcast to all other users
                await axios.post(`${API_URL}/api/projects/notify`, {
                    event: 'timetree-event-created',
                    eventTitle: formData.title,
                    eventDate: formData.date,
                    startTime: formData.startTime,
                    createdBy: currentUser,
                    changedBy: currentUser,
                });
                setShowModal(false);
                setFormData({ title: '', startTime: '08:00', deadline: '', deadlineTime: '', date: formatDateToISO(new Date()) });
                fetchEvents();
            }
        } catch (err) { alert("Save error: " + (err.response?.data?.error || "Server error")); }
    };

    const sendMessage = async (e) => {
        if (e.key === 'Enter' && newMessage.trim() && activeEvent) {
            e.preventDefault();
            const msgText = newMessage;
            setNewMessage("");
            const rawStorage = localStorage.getItem('loggedInUser');
            const userObj = rawStorage ? JSON.parse(rawStorage) : {};
            try {
                await axios.post(`${API_BASE_URL}/events/${activeEvent.id}/chat`, {
                    sender_id: userObj.id,
                    sender_name: userObj.name || "Guest",
                    sender_email: userObj.email,
                    message_text: msgText,
                    sent_at: new Date().toISOString()
                });
                // Broadcast to all other users — sender sees their own message already
                await axios.post(`${API_URL}/api/projects/notify`, {
                    event: 'timetree-chat-sent',
                    eventTitle: activeEvent.title,
                    senderName: currentUser,
                    preview: msgText.substring(0, 40) + (msgText.length > 40 ? '...' : ''),
                    senderId: userObj.id,
                    changedBy: currentUser,
                });
                fetchEvents();
            } catch (err) { console.error("Message failed", err); }
        }
    };

    const changeMonth = (offset) => {
        setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
    };

    const getMonthDays = () => {
        const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
        const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
        return { firstDay, daysInMonth };
    };

    const getWeekDays = () => {
        if (isMobile) return [new Date(selectedDate)];
        const startPoint = new Date(selectedDate);
        startPoint.setDate(selectedDate.getDate() - selectedDate.getDay());
        return [...Array(7)].map((_, i) => {
            const d = new Date(startPoint);
            d.setDate(startPoint.getDate() + i);
            return d;
        });
    };

    const getEventStyle = (startTime) => {
        if (!startTime) return { display: 'none' };
        const [hours, minutes] = startTime.split(':').map(Number);
        const topOffset = ((hours * 60 + minutes) / 60) * ROW_HEIGHT;
        return {
            top: `${topOffset}px`,
            height: isMobile ? 'auto' : `${ROW_HEIGHT}px`,
            position: 'absolute',
            zIndex: 10,
            width: isMobile ? '90%' : '92%',
            left: isMobile ? '5%' : '4%',
        };
    };

    const { firstDay, daysInMonth } = getMonthDays();
    const currentWeek = getWeekDays();

    return (
        <div className="tt-container">

            {/* ── Left Sidebar ─────────────────────────── */}
            {showSidebar && !isMobile && (
                <aside className="tt-sidebar-left">
                    <div className="tt-sidebar-inner">
                        <button className="btn-create" onClick={() => setShowModal(true)}>
                            ＋ Create Event
                        </button>

                        <div className="sidebar-month-header">
                            <span className="month-label">
                                {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                            <div className="month-nav-btns">
                                <button onClick={() => changeMonth(-1)}>‹</button>
                                <button onClick={() => changeMonth(1)}>›</button>
                            </div>
                        </div>

                        <div className="mini-calendar-container">
                            <div className="mini-cal-days-header">
                                {['S','M','T','W','T','F','S'].map((day, idx) => (
                                    <div key={`${day}-${idx}`} className="mini-day-name">{day}</div>
                                ))}
                            </div>
                            <div className="mini-cal-grid">
                                {[...Array(firstDay)].map((_, i) => <div key={`empty-${i}`} />)}
                                {[...Array(daysInMonth)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`mini-day-num ${selectedDate.getDate() === (i + 1) ? 'active' : ''}`}
                                        onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1))}
                                    >
                                        {i + 1}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {renderMonthSelector()}

                        <div className="event-list-sidebar">
                            <h3>Events</h3>
                            {events.map(ev => (
                                <div
                                    key={ev.id}
                                    className={`sidebar-event-card ${activeEvent?.id === ev.id ? 'active' : ''} ${ev.status === 'completed' ? 'completed' : ''}`}
                                    onClick={() => { setSelectedDate(parseDbDate(ev.event_date)); setActiveEvent(ev); }}
                                >
                                    <div className="sidebar-event-info">
                                        <strong>{ev.title}</strong>
                                        <div>{ev.start_time?.substring(0, 5)} · {ev.event_date?.substring(5, 10)}</div>
                                    </div>
                                    <button
                                        className="btn-delete"
                                        onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            )}

            {/* ── Main ─────────────────────────────────── */}
            <main className="tt-main">
                <header className="tt-main-header">
                    <div className="header-controls">
                        {!isMobile && (
                            <button className="btn-toggle" onClick={() => setShowSidebar(!showSidebar)}>☰</button>
                        )}
                        <div
                            className="mobile-title-container"
                            onClick={() => isMobile && setShowMobileCal(!showMobileCal)}
                        >
                            <span className="month-display">
                                {selectedDate.toLocaleString('default', { month: 'long' })}
                            </span>
                            {isMobile && <span className="dropdown-arrow">▼</span>}
                        </div>
                        <div className="gmt-label">GMT+8</div>
                    </div>

                    <div className="top-header-icons">
                        <button
                            className="btn-task-fullscreen"
                            onClick={() => setShowFullEvents(true)}
                            title="View All Events"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 7h7"/><path d="M12 12h7"/><path d="M12 17h7"/>
                                <path d="m5 7 2 2 4-4"/><path d="m5 17 2 2 4-4"/>
                            </svg>
                        </button>
                    </div>

                    {/* Mobile calendar dropdown */}
                    {isMobile && showMobileCal && (
                        <div className="mobile-calendar-dropdown">
                            <div className="year-selector-container">
                                <button className="year-nav-arrow" onClick={() => changeYear(-1)}>❮</button>
                                <span className="current-year-label">{selectedDate.getFullYear()}</span>
                                <button className="year-nav-arrow" onClick={() => changeYear(1)}>❯</button>
                            </div>
                            {renderMonthSelector()}
                            <div className="mini-calendar-container">
                                <div className="mini-cal-grid">
                                    {[...Array(firstDay)].map((_, i) => <div key={`empty-${i}`} />)}
                                    {[...Array(daysInMonth)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={`mini-day-num ${selectedDate.getDate() === (i + 1) ? 'active' : ''}`}
                                            onClick={() => { setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1)); setShowMobileCal(false); }}
                                        >
                                            {i + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Week days header */}
                    <div
                        className="week-days"
                        style={{ gridTemplateColumns: `repeat(${currentWeek.length}, 1fr)` }}
                    >
                        {currentWeek.map((day, i) => (
                            <div key={i} className="day-col-head" onClick={() => isMobile && setSelectedDate(day)}>
                                <div className="day-name">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div className={`day-num ${day.toDateString() === selectedDate.toDateString() ? 'active' : ''}`}>
                                    {day.getDate()}
                                </div>
                            </div>
                        ))}
                    </div>
                </header>

                {/* Grid */}
                <div className="grid-viewport weekly-layout">
                    <div className="time-labels-column">
                        {[...Array(24)].map((_, i) => (
                            <div key={i} className="hour-label-cell">{i}:00</div>
                        ))}
                    </div>
                    <div
                        className="days-columns-container"
                        style={{ gridTemplateColumns: `repeat(${currentWeek.length}, 1fr)` }}
                    >
                        {currentWeek.map((dayDate, i) => (
                            <div key={i} className="day-column">
                                {[...Array(24)].map((_, j) => <div key={j} className="hour-grid-cell" />)}
                                {events
                                    .filter(ev => ev.event_date?.substring(0, 10) === formatDateToISO(dayDate))
                                    .map(ev => (
                                        <div
                                            key={ev.id}
                                            className={`event-card ${activeEvent?.id === ev.id ? 'selected' : ''} ${ev.status === 'completed' ? 'completed' : ''}`}
                                            style={getEventStyle(ev.start_time)}
                                            onClick={() => setActiveEvent(ev)}
                                        >
                                            <div className="event-title">{ev.title}</div>
                                            <div className="event-time">
                                                {ev.start_time?.substring(0, 5)}
                                                {ev.deadline_time && ` – ${ev.deadline_time.substring(0, 5)}`}
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        ))}
                    </div>
                </div>

                {isMobile && (
                    <button className="fab-create" onClick={() => setShowModal(true)}>+</button>
                )}
            </main>

            {/* ── Chat Popup ───────────────────────────── */}
            {activeEvent && (
                <div className="chat-popup-overlay" onClick={() => setActiveEvent(null)}>
                    <aside className="tt-sidebar-chat" onClick={(e) => e.stopPropagation()}>
                        <div className="chat-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={activeEvent.status === 'completed'}
                                    disabled={activeEvent.status === 'completed'}
                                    onChange={() => toggleEventCompletion(activeEvent)}
                                    style={{ cursor: activeEvent.status === 'completed' ? 'not-allowed' : 'pointer' }}
                                />
                                <span className={`chat-header-title ${activeEvent.status === 'completed' ? 'completed' : ''}`}>
                                    {activeEvent.title}
                                </span>
                            </div>
                            <div className="chat-header-actions">
                                <button onClick={() => deleteEvent(activeEvent.id)} className="btn-delete-event">🗑</button>
                                <button onClick={() => setActiveEvent(null)} className="btn-close-chat">✕</button>
                            </div>
                        </div>

                        <div className="chat-messages messenger-layout">
                            {activeEvent.chats?.map((msg, i) => {
                                const currentEmail = JSON.parse(localStorage.getItem('loggedInUser'))?.email;
                                const isMe = msg.sender_email === currentEmail;
                                return (
                                    <div key={i} className={`chat-row ${isMe ? "me" : "them"}`}>
                                        <div className="bubble-wrapper">
                                            {!isMe && <div className="chat-sender-name">{msg.sender_name}</div>}
                                            <div className={`chat-bubble ${isMe ? 'me' : 'them'}`}>
                                                {editingChatId === msg.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && updateChat(msg.id)}
                                                    />
                                                ) : (
                                                    msg.message_text
                                                )}
                                            </div>
                                            {isMe && (
                                                <div className="chat-actions">
                                                    <span onClick={() => { setEditingChatId(msg.id); setEditValue(msg.message_text); }}>Edit</span>
                                                    <span onClick={() => deleteChat(msg.id)}>Delete</span>
                                                </div>
                                            )}
                                            <div className="chat-timestamp">{formatChatMessageTime(msg.sent_at)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="chat-input-container">
                            <input
                                className="chat-input"
                                placeholder={`Message as ${currentUser}…`}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={sendMessage}
                            />
                        </div>
                    </aside>
                </div>
            )}

            {/* ── Fullscreen Events ───────────────────── */}
            {showFullEvents && (
                <div className="fullscreen-events-overlay">
                    <button className="fs-close-btn" onClick={() => setShowFullEvents(false)}>×</button>

                    <div className="year-selector-container" style={{ alignSelf: 'flex-start', marginBottom: '8px' }}>
                        <button className="year-nav-arrow" onClick={() => changeYear(-1)}>❮</button>
                        <span className="current-year-label">{selectedDate.getFullYear()}</span>
                        <button className="year-nav-arrow" onClick={() => changeYear(1)}>❯</button>
                    </div>

                    <h2>All Tasks & Events</h2>

                    <div className="fs-events-grid">
                        {events.map(ev => (
                            <div
                                key={ev.id}
                                className={`sidebar-event-card ${ev.status === 'completed' ? 'completed' : ''}`}
                                onClick={() => {
                                    setSelectedDate(parseDbDate(ev.event_date));
                                    setActiveEvent(ev);
                                    setShowFullEvents(false);
                                }}
                            >
                                <div className="sidebar-event-info">
                                    <strong>{ev.title}</strong>
                                    <div>Date: {ev.event_date?.substring(5, 10)}</div>
                                    <div>Start: {ev.start_time?.substring(0, 5)}</div>
                                    {ev.deadline_time && <div>Deadline: {ev.deadline_time.substring(0, 5)}</div>}
                                </div>
                                <button
                                    className="btn-delete"
                                    onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Create Event Modal ───────────────────── */}
            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal-content">
                        <h3>New Event</h3>
                        <form onSubmit={handleCreateSubmit}>
                            <label>Title *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Team Meeting"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />

                            <div className="modal-date-row">
                                <div>
                                    <label>Start Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label>Start Time *</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="modal-date-row">
                                <div>
                                    <label>Deadline Date</label>
                                    <input
                                        type="date"
                                        value={formData.deadline}
                                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label>Deadline Time</label>
                                    <input
                                        type="time"
                                        value={formData.deadlineTime}
                                        onChange={e => setFormData({ ...formData, deadlineTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-save">Save Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeTree;
