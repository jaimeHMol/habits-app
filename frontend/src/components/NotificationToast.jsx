import React from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { X, BellRing } from 'lucide-react'

export const NotificationToast = () => {
  const { activeAlerts, removeAlert } = useReminderStore();

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      {activeAlerts.map(alert => (
        <div 
          key={alert.alertId}
          className="pointer-events-auto bg-paramo-card border-l-4 border-paramo-frailejon shadow-2xl rounded-xl p-4 min-w-[280px] animate-slideInRight flex items-start gap-4 ring-1 ring-white/10"
        >
          <div className="bg-paramo-frailejon/10 p-2 rounded-full text-paramo-frailejon shrink-0">
            <BellRing size={20} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white uppercase tracking-tight">Recuerda</h4>
            <p className="text-sm text-paramo-muted mt-0.5 line-clamp-2">{alert.title}</p>
          </div>

          <button 
            onClick={() => removeAlert(alert.alertId)}
            className="text-paramo-muted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
};
