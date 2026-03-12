// utils/notifService.js
import { io } from "socket.io-client";

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io("http://192.168.1.16:5000", { transports: ["websocket"] });
  }
  return socket;
};

// Fire a local notification (current browser tab only)
export const sendNotification = (message) => {
  window.dispatchEvent(new CustomEvent("new-notification", {
    detail: {
      id: Date.now(),
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      targetRoles: null,
    },
  }));
};

// Fire a local notification for specific roles (null = everyone)
export const sendNotificationToRoles = (message, roles = null) => {
  window.dispatchEvent(new CustomEvent("new-notification", {
    detail: {
      id: Date.now(),
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      targetRoles: roles,
    },
  }));
};

// Helper: fire a local notification only if the current user's role is allowed
const dispatchIfAllowed = (message, time, targetRoles, userRole) => {
  // targetRoles null/undefined = broadcast to everyone
  if (targetRoles && targetRoles.length > 0) {
    if (!targetRoles.includes(userRole)) return;
  }
  window.dispatchEvent(new CustomEvent("new-notification", {
    detail: {
      id: Date.now(),
      text: message,
      time,
      read: false,
      targetRoles,
    },
  }));
};

// Call this ONCE in App.jsx: useEffect(() => { initSocketNotifications(currentUser) }, [currentUser])
// Registers all socket event listeners so every browser tab gets real-time updates
let _notifInitialized = false;
export const initSocketNotifications = (currentUser) => {
  if (_notifInitialized) return; // prevent duplicate listener registration
  _notifInitialized = true;
  const s = getSocket();
  const userRole = currentUser?.role || '';

  // ── Deal / Project events ──────────────────────────────────────────────────
  s.off("deal-status-changed");
  s.on("deal-status-changed", ({ dealName, status, changedBy, time }) => {
    // All users see deal status changes
    dispatchIfAllowed(
      `🔄 "${dealName}" moved to ${status} by ${changedBy}`,
      time, null, userRole
    );
  });

  s.off("deal-created");
  s.on("deal-created", ({ dealName, changedBy, time }) => {
    dispatchIfAllowed(`🚀 New deal "${dealName}" created by ${changedBy}`, time, null, userRole);
  });

  s.off("deal-updated");
  s.on("deal-updated", ({ dealName, changedBy, time }) => {
    dispatchIfAllowed(`📝 Deal "${dealName}" updated by ${changedBy}`, time, null, userRole);
  });

  // ── Task events ───────────────────────────────────────────────────────────────
  s.off("task-assigned");
  s.on("task-assigned", ({ taskTitle, assigneeId, assignerName, priority, time }) => {
    // ONLY notify the exact user who was assigned — match by ID, not role
    const myId = currentUser?.id;
    if (!myId || parseInt(myId) !== parseInt(assigneeId)) return;
    window.dispatchEvent(new CustomEvent("new-notification", {
      detail: { id: Date.now(), text: `📋 You've been assigned a new task: "${taskTitle}" (${priority}) by ${assignerName}`, time, read: false }
    }));
  });

  s.off("task-updated");
  s.on("task-updated", ({ taskTitle, actorName, time }) => {
    // ONLY admin gets notified about task updates
    dispatchIfAllowed(
      `📝 Task "${taskTitle}" was updated by ${actorName}`,
      time, ['admin'], userRole
    );
  });

  s.off("task-completed");
  s.on("task-completed", ({ taskTitle, actorName, newStatus, time }) => {
    // ONLY admin gets notified about task completions
    const msg = newStatus === 'Completed'
      ? `✅ "${taskTitle}" marked as completed by ${actorName}`
      : `⏳ "${taskTitle}" reopened by ${actorName}`;
    dispatchIfAllowed(msg, time, ['admin'], userRole);
  });

  // ── Client & Company events ───────────────────────────────────────────────────
  s.off("client-added");
  s.on("client-added", ({ clientName, company, addedBy, time }) => {
    // Everyone gets notified of new clients
    dispatchIfAllowed(
      `👤 New client added: ${clientName}${company ? ` (${company})` : ''} by ${addedBy}`,
      time, null, userRole
    );
  });

  s.off("company-added");
  s.on("company-added", ({ companyName, industry, addedBy, time }) => {
    // Everyone gets notified of new companies
    dispatchIfAllowed(
      `🏢 New company added: "${companyName}"${industry ? ` · ${industry}` : ''} by ${addedBy}`,
      time, null, userRole
    );
  });

  // ── Timetree events ───────────────────────────────────────────────────────────
  s.off("timetree-event-created");
  s.on("timetree-event-created", ({ eventTitle, eventDate, startTime, createdBy, time }) => {
    // Everyone gets notified of new events
    dispatchIfAllowed(
      `📅 New event created: "${eventTitle}" on ${eventDate} at ${startTime} by ${createdBy}`,
      time, null, userRole
    );
  });

  s.off("timetree-event-completed");
  s.on("timetree-event-completed", ({ eventTitle, newStatus, changedBy, time }) => {
    // Everyone gets notified when an event is completed or reopened
    const msg = newStatus === 'completed'
      ? `✅ Event "${eventTitle}" marked as finished by ${changedBy}! 🎉`
      : `🔄 Event "${eventTitle}" reopened by ${changedBy}.`;
    dispatchIfAllowed(msg, time, null, userRole);
  });

  s.off("timetree-chat-sent");
  s.on("timetree-chat-sent", ({ eventTitle, senderName, preview, senderId, time }) => {
    // Everyone EXCEPT the sender sees the chat notification
    if (currentUser?.id && parseInt(currentUser.id) === parseInt(senderId)) return;
    dispatchIfAllowed(
      `💬 ${senderName} sent a message in "${eventTitle}": ${preview}`,
      time, null, userRole
    );
  });

  // ── Finance events ────────────────────────────────────────────────────────────
  s.off("finance-payment-updated");
  s.on("finance-payment-updated", ({ dealName, updaterName, paidAmount, balance, time }) => {
    // All users see payment updates
    dispatchIfAllowed(
      `💰 Payment updated for "${dealName}" by ${updaterName}: ₱${paidAmount} paid · ₱${balance} remaining`,
      time, null, userRole
    );
  });

  // ── Project events ────────────────────────────────────────────────────────────
  s.off("project-comment-added");
  s.on("project-comment-added", ({ projectName, authorName, preview, time }) => {
    dispatchIfAllowed(`💬 ${authorName} commented on "${projectName}": ${preview}`, time, null, userRole);
  });

  s.off("project-attachment-added");
  s.on("project-attachment-added", ({ projectName, uploaderName, fileName, time }) => {
    dispatchIfAllowed(`📎 ${uploaderName} attached "${fileName}" to "${projectName}"`, time, null, userRole);
  });

  s.off("project-data-changed");
  s.on("project-data-changed", ({ changedBy, time }) => {
    // silent refresh — no notification, just triggers fetchData in projects.js
  });

  // ── BOM events ─────────────────────────────────────────────────────────────
  s.off("bom-draft-created");
  s.on("bom-draft-created", ({ draftName, changedBy, targetRoles, time }) => {
    // All users
    dispatchIfAllowed(`📋 New BOM draft "${draftName}" created by ${changedBy}`, time, targetRoles, userRole);
  });

  s.off("bom-moved-to-pricing");
  s.on("bom-moved-to-pricing", ({ draftName, changedBy, targetRoles, time }) => {
    // All users
    dispatchIfAllowed(`💰 BOM "${draftName}" moved to Pricing by ${changedBy}`, time, targetRoles, userRole);
  });

  s.off("bom-pricing-saved");
  s.on("bom-pricing-saved", ({ draftName, changedBy, targetRoles, time }) => {
    // Admin only (targetRoles = ['admin'])
    dispatchIfAllowed(`💾 Pricing saved for "${draftName}" by ${changedBy} — needs approval`, time, targetRoles, userRole);
  });

  s.off("bom-approved");
  s.on("bom-approved", ({ draftName, changedBy, targetRoles, time }) => {
    // manager, executive, finance only
    dispatchIfAllowed(`✅ BOM "${draftName}" approved by ${changedBy}`, time, targetRoles, userRole);
  });

  s.off("bom-rejected");
  s.on("bom-rejected", ({ draftName, changedBy, reason, targetRoles, time }) => {
    // manager, executive, finance only
    dispatchIfAllowed(
      `❌ BOM "${draftName}" rejected by ${changedBy}${reason ? `: "${reason}"` : ''}`,
      time, targetRoles, userRole
    );
  });
};
