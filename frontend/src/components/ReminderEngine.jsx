import React, { useEffect, useRef } from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { useHabitStore } from '../store/useHabitStore'

const SLACK_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'; // A clean "pop" sound

export const ReminderEngine = () => {
  const { reminders, userSettings, lastTriggeredAt, setTriggered, fetchReminders, addAlert } = useReminderStore();
  const { isAuthenticated } = useHabitStore();
  const audioRef = useRef(new Audio(SLACK_SOUND_URL));

  // Request notification permissions
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  // Initial fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchReminders();
    }
  }, [isAuthenticated, fetchReminders]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkReminders = () => {
      const now = new Date();
      const currentStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
      
      // 1. Check if we are within the activity window
      if (currentStr < userSettings.dayStartTime || currentStr > userSettings.dayEndTime) {
        return;
      }

      reminders.forEach(reminder => {
        if (!reminder.isActive) return;

        const lastTime = lastTriggeredAt[reminder.id] ? new Date(lastTriggeredAt[reminder.id]) : null;
        const diffMinutes = lastTime ? (now - lastTime) / (1000 * 60) : Infinity;

        if (diffMinutes >= reminder.intervalMinutes) {
          triggerNotification(reminder);
        }
      });
    };

    const triggerNotification = (reminder) => {
      // Audio
      audioRef.current.play().catch(e => console.log("Audio play blocked by browser policy"));

      // Browser Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("🌿 Reminder", {
          body: reminder.title,
          icon: '/favicon.svg'
        });
      }

      // In-app Alert
      addAlert(reminder);

      setTriggered(reminder.id);
    };

    // Check every minute
    const interval = setInterval(checkReminders, 60000);
    // Also run once on mount
    checkReminders();

    return () => clearInterval(interval);
  }, [reminders, userSettings, lastTriggeredAt, isAuthenticated, setTriggered]);

  return null; // Invisible component
}
