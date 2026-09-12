/**
 * Beepack Reminder Scheduler
 * Checks pending reminders and fires notifications when reminderTime is reached.
 */

const { getDb, saveDb } = require('../database/db');
const { dispatchNotification } = require('./notifications');

let intervalHandle = null;

/**
 * Checks all pending reminders and fires due ones
 */
function checkPendingReminders() {
  const db = getDb();
  if (!db.reminders || !Array.isArray(db.reminders)) return [];

  const now = new Date();
  const firedReminders = [];

  db.reminders.forEach(reminder => {
    if (reminder.status === 'PENDING') {
      const dueTime = new Date(reminder.reminderTime);
      if (!isNaN(dueTime.getTime()) && dueTime <= now) {
        reminder.status = 'FIRED';
        reminder.firedAt = now.toISOString();
        firedReminders.push(reminder);

        const item = (db.items || []).find(i => (i.itemId === reminder.itemId || i.id === reminder.itemId));
        const itemName = item ? item.name : "Tracked Item";

        // Write activity
        const activityRecord = {
          activityId: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          id: `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          userId: reminder.userId,
          type: "REMINDER_CREATED",
          itemId: reminder.itemId || null,
          timestamp: now.toISOString(),
          details: reminder.message || `Reminder due for ${itemName}`
        };

        if (!db.activities) db.activities = [];
        db.activities.unshift(activityRecord);

        // Dispatch notification
        dispatchNotification({
          userId: reminder.userId,
          type: "REMINDER_FIRED",
          title: `Reminder: ${itemName}`,
          message: reminder.message || `Don't forget to pack your ${itemName}!`,
          data: {
            reminderId: reminder.reminderId || reminder.id,
            itemId: reminder.itemId
          }
        });
      }
    }
  });

  if (firedReminders.length > 0) {
    saveDb(db);
  }

  return firedReminders;
}

function startScheduler(intervalMs = 10000) {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(() => {
    try {
      checkPendingReminders();
    } catch (err) {
      console.error("Error in reminder scheduler tick:", err);
    }
  }, intervalMs);
  if (intervalHandle.unref) intervalHandle.unref();
}

function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  checkPendingReminders,
  startScheduler,
  stopScheduler
};
