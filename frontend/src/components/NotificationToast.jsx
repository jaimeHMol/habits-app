import React from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { stripMarkdown } from '../utils/textUtils'
import { X, BellRing } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export const NotificationToast = () => {
  const { activeAlerts, removeAlert } = useReminderStore();

  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {activeAlerts.map(alert => {
          const isUrgent = !!alert.task_id;
          return (
            <motion.div 
              key={alert.alertId}
              layout
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100, transition: { duration: 0.2 } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              onDragEnd={(e, { offset, velocity }) => {
                if (Math.abs(offset.x) > 100 || Math.abs(velocity.x) > 500) {
                  removeAlert(alert.alertId);
                }
              }}
              className={`pointer-events-auto shadow-2xl rounded-xl p-4 min-w-[280px] flex items-start gap-4 ring-1 ring-white/10 bg-paramo-card border-l-4 ${isUrgent ? 'border-orange-500' : 'border-paramo-frailejon'}`}
            >
              <div className={`p-2 rounded-full shrink-0 ${isUrgent ? 'bg-orange-500/10 text-orange-500' : 'bg-paramo-frailejon/10 text-paramo-frailejon'}`}>
                <BellRing size={20} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white uppercase tracking-tight">
                  RECUERDA
                </h4>
                <p className="text-sm text-paramo-muted mt-0.5 line-clamp-2">{stripMarkdown(alert.title)}</p>
              </div>

              <button 
                onClick={() => removeAlert(alert.alertId)}
                className="text-paramo-muted hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
