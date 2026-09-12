/**
 * Beepack Notification Service
 * Dispatches alerts on:
 * - BAG_OPENED / BAG_CLOSED
 * - ITEM_REMOVED / ITEM_RETURNED
 * - REMINDER_CREATED / REMINDER_FIRED
 * - MISSING_ITEM
 */

const { getDb, saveDb } = require('../database/db');

const { 
  sendEmail, 
  sendBagOpenedEmail, 
  sendBagClosedEmail, 
  sendReminderEmail 
} = require('./email_service');

// In-memory subscribers for live SSE/WebSockets or test listeners
const notificationListeners = new Set();

function addNotificationListener(listener) {
  notificationListeners.add(listener);
  return () => notificationListeners.delete(listener);
}

/**
 * Dispatch notification for a given user & event
 */
function dispatchNotification({ userId, type, title, message, data = {} }) {
  const db = getDb();
  const user = db.users.find(u => (u.userId === userId || u.id === userId)) || db.users[0];
  const settings = db.notificationSettings.find(n => (n.userId === userId || n.id === userId)) || {
    emailEnabled: true,
    pushEnabled: true,
    notifyOnMissing: true,
    notifyOnBagEvents: true,
    notifyOnItemRemoved: true,
    notifyOnReminders: true
  };

  // Preference check
  let shouldDispatch = true;
  if (type === 'BAG_OPENED' || type === 'BAG_CLOSED') {
    if (settings.notifyOnBagEvents === false) shouldDispatch = false;
  } else if (type === 'ITEM_REMOVED' || type === 'ITEM_RETURNED') {
    if (settings.notifyOnItemRemoved === false) shouldDispatch = false;
  } else if (type === 'REMINDER_CREATED' || type === 'REMINDER_FIRED') {
    if (settings.notifyOnReminders === false) shouldDispatch = false;
  } else if (type === 'MISSING_ITEM') {
    if (settings.notifyOnMissing === false) shouldDispatch = false;
  }

  const recipientEmail = (user && user.email) ? user.email : "murtazajamali07@gmail.com";
  const recipientName = (user && user.name) ? user.name : "Murtaza Jamali";

  const notificationRecord = {
    id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId: user ? (user.userId || user.id) : (userId || "usr_demo_01"),
    type,
    title: title || `Beepack Alert: ${type}`,
    message: message || `Notification for event: ${type}`,
    recipient: recipientEmail,
    data,
    status: shouldDispatch ? "delivered" : "suppressed_by_preference",
    timestamp: new Date().toISOString()
  };

  // Persist into notifications collection
  db.notifications.unshift(notificationRecord);
  if (db.notifications.length > 100) db.notifications = db.notifications.slice(0, 100);
  saveDb(db);

  // Send real email if preferences allow
  if (shouldDispatch && settings.emailEnabled !== false) {
    const bag = (db.bags || []).find(b => b.userId === (user ? user.userId : userId)) || { name: 'My College Bag', hardwareId: 'ESP32-BAG-01' };

    if (type === 'BAG_OPENED') {
      sendBagOpenedEmail({
        to: recipientEmail,
        userName: recipientName,
        bagName: (data && data.bagName) || bag.name,
        timestamp: notificationRecord.timestamp,
        hardwareId: (data && data.hardwareId) || bag.hardwareId
      }).then(emailRec => {
        notificationRecord.emailSent = true;
        notificationRecord.emailId = emailRec.id;
      }).catch(err => {
        console.error("Failed to send BAG_OPENED email:", err);
      });
    } else if (type === 'BAG_CLOSED') {
      sendBagClosedEmail({
        to: recipientEmail,
        userName: recipientName,
        bagName: (data && data.bagName) || bag.name,
        timestamp: notificationRecord.timestamp,
        hardwareId: (data && data.hardwareId) || bag.hardwareId
      }).then(emailRec => {
        notificationRecord.emailSent = true;
        notificationRecord.emailId = emailRec.id;
      }).catch(err => {
        console.error("Failed to send BAG_CLOSED email:", err);
      });
    } else if (type === 'REMINDER_FIRED') {
      const item = (db.items || []).find(i => i.id === data.itemId || i.itemId === data.itemId) || { name: "Essential Item" };
      sendReminderEmail({
        to: recipientEmail,
        userName: recipientName,
        itemName: item.name,
        reminderMessage: message,
        dueTime: notificationRecord.timestamp,
        bagName: bag.name
      }).then(emailRec => {
        notificationRecord.emailSent = true;
        notificationRecord.emailId = emailRec.id;
      }).catch(err => {
        console.error("Failed to send REMINDER_FIRED email:", err);
      });
    }
  }

  // Notify active listeners
  notificationListeners.forEach(listener => {
    try {
      listener(notificationRecord);
    } catch (e) {
      console.error("Error in notification listener:", e);
    }
  });

  return notificationRecord;
}

module.exports = {
  dispatchNotification,
  addNotificationListener
};
