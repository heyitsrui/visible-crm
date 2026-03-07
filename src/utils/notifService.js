// utils/notifService.js
export const sendNotification = (message) => {
  const event = new CustomEvent("new-notification", {
    detail: {
      id: Date.now(),
      text: message, // Ensure this matches what TopNav looks for
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    },
  });
  window.dispatchEvent(event);
};
