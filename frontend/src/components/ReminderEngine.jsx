import { useEffect, useRef } from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { useHabitStore } from '../store/useHabitStore'
import { stripMarkdown } from '../utils/textUtils'

const SLACK_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

export const ReminderEngine = () => {
  const { reminders, userSettings, lastTriggeredAt, setTriggered, fetchReminders, addAlert } = useReminderStore();
  const { tasks, isAuthenticated } = useHabitStore();
  const audioRef = useRef(new Audio(SLACK_SOUND_URL));

  // 1. Pedir permisos (Estándar)
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  // 2. Cargar datos iniciales
  useEffect(() => {
    if (isAuthenticated) {
      fetchReminders();
    }
  }, [isAuthenticated, fetchReminders]);

  // 3. LOGICA LOCAL (Para Toasts inmediatos cuando la app está abierta)
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkReminders = () => {
      const now = new Date();
      // Usamos hora local del navegador para el motor de Toasts
      const currentStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const todayStr = now.toLocaleDateString('en-CA');
      
      if (currentStr < userSettings.dayStartTime || currentStr > userSettings.dayEndTime) {
        return;
      }

      reminders.forEach(reminder => {
        if (!reminder.isActive) return;

        // Intervalos
        if (!reminder.task_id) {
          const lastTime = lastTriggeredAt[reminder.id] ? new Date(lastTriggeredAt[reminder.id]) : null;
          const diffMinutes = lastTime ? (now - lastTime) / (1000 * 60) : Infinity;
          if (diffMinutes >= reminder.intervalMinutes) {
            triggerNotification(reminder);
          }
          return;
        }

        // Tareas (Slots)
        const task = tasks.find(t => t.id === reminder.task_id);
        if (!task || task.completed) return;

        const dayOfMonth = now.getDate();
        const monthOfYear = now.getMonth() + 1;
        const isDueToday = (
          (task.columnId === 'monthly' && task.targetDay === dayOfMonth) ||
          (task.columnId === 'annually' && task.targetDay === dayOfMonth && task.targetMonth === monthOfYear)
        );

        if (!isDueToday) return;

        // Reutilizamos la lógica de slots que teníamos
        const slots = calculateSlots(userSettings.dayStartTime, userSettings.dayEndTime);
        slots.forEach((slotTime, index) => {
          if (currentStr >= slotTime) {
            const slotKey = `slot_${reminder.id}_${index}_${todayStr}`;
            if (!localStorage.getItem(slotKey)) {
              triggerNotification(reminder);
              localStorage.setItem(slotKey, 'true');
            }
          }
        });
      });
    };

    const calculateSlots = (start, end) => {
      const [hStart, mStart] = start.split(':').map(Number);
      const [hEnd, mEnd] = end.split(':').map(Number);
      const startMin = hStart * 60 + mStart;
      const endMin = hEnd * 60 + mEnd;
      const duration = endMin - startMin;
      const format = (totalMin) => {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };
      return [start, format(startMin + duration / 2), format(endMin - 30)];
    };

    const interval = setInterval(checkReminders, 60000);
    checkReminders();
    return () => clearInterval(interval);
  }, [reminders, userSettings, lastTriggeredAt, isAuthenticated, tasks, addAlert, setTriggered]);

  // 4. LOGICA PUSH (Para Toasts cuando llega un mensaje del servidor)
  useEffect(() => {
    const channel = new BroadcastChannel('reminders-channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        const { title, body, data } = event.data.payload;
        // Solo sonar y mostrar toast si no se acaba de mostrar localmente
        triggerNotification({ title, body, id: data?.reminder_id, task_id: data?.task_id });
      }
    };
    return () => channel.close();
  }, [addAlert]);

  const triggerNotification = (reminder) => {
    const plainTitle = stripMarkdown(reminder.title);
    
    // Sonido
    try {
      const audio = new Audio(SLACK_SOUND_URL);
      audio.play().catch(e => {});
    } catch (e) {}

    // Toast UI
    addAlert({ ...reminder, title: plainTitle });
    if (reminder.id) setTriggered(reminder.id);
  };

  return null;
}
