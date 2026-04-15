import React, { useState } from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { CheckCircle2, Circle, PartyPopper, ArrowRight } from 'lucide-react'

export const DailyReviewModal = () => {
  const { tasks, confirmReview, isLoading } = useHabitStore();
  const dailyTasks = tasks.filter(t => t.columnId === 'daily');
  
  // Track which tasks the user says they completed yesterday
  const [completedIds, setCompletedIds] = useState(
    dailyTasks.filter(t => t.completed).map(t => t.id)
  );

  const toggleTask = (id) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    confirmReview(completedIds);
  };

  if (dailyTasks.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paramo-bg/90 backdrop-blur-sm animate-fadeIn">
      <div className="bg-paramo-card w-full max-w-md rounded-2xl border border-paramo-frailejon/30 shadow-2xl p-6 flex flex-col gap-6 max-h-[80vh]">
        
        <div className="flex flex-col gap-1 items-center text-center">
          <div className="bg-paramo-frailejon/10 p-3 rounded-full text-paramo-frailejon mb-2">
            <PartyPopper size={32} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">¡Nuevo día en el Páramo!</h2>
          <p className="text-sm text-paramo-muted">¿Lograste completar alguna de estas tareas ayer?</p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex flex-col gap-2">
            {dailyTasks.map(task => {
              const isSelected = completedIds.includes(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left
                    ${isSelected 
                      ? 'bg-paramo-frailejon/10 border-paramo-frailejon/40 text-white' 
                      : 'bg-white/5 border-white/5 text-paramo-muted hover:border-white/10'}
                  `}
                >
                  {isSelected 
                    ? <CheckCircle2 size={20} className="text-paramo-frailejon shrink-0" /> 
                    : <Circle size={20} className="text-paramo-muted shrink-0" />
                  }
                  <span className="text-sm font-medium line-clamp-1">{task.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="w-full bg-paramo-frailejon hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-paramo-bg font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors group"
        >
          {isLoading ? (
            <span className="animate-pulse">Sincronizando...</span>
          ) : (
            <>
              Empezar nuevo día
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};