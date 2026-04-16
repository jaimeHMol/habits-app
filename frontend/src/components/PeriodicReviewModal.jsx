import React, { useState, useEffect, useCallback } from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { CheckCircle2, Circle, PartyPopper, ArrowRight, CalendarDays, CalendarClock, CalendarRange, Minus, Plus } from 'lucide-react'

export const PeriodicReviewModal = () => {
  const { tasks, pendingResets, confirmReview, isLoading, incrementTask, decrementTask } = useHabitStore();
  
  // Tasks to review from all pending reset columns
  const tasksToReview = tasks.filter(t => pendingResets.includes(t.columnId) && !t.completed);
  
  // Track which tasks the user says they completed
  const [completedIds, setCompletedIds] = useState([]);

  const toggleTask = (id) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = useCallback(() => {
    confirmReview(completedIds);
  }, [confirmReview, completedIds]);

  // If there are no uncompleted tasks to review, auto-confirm 
  // to update the date and run resets in the background
  useEffect(() => {
    if (tasksToReview.length === 0 && !isLoading) {
      handleConfirm();
    }
  }, [tasksToReview.length, isLoading, handleConfirm]);

  if (tasksToReview.length === 0) return null;

  const groupedTasks = {
    daily: tasksToReview.filter(t => t.columnId === 'daily'),
    monthly: tasksToReview.filter(t => t.columnId === 'monthly'),
    annually: tasksToReview.filter(t => t.columnId === 'annually'),
  };

  const Section = ({ title, icon: Icon, tasks, colorClass }) => {
    if (tasks.length === 0) return null;
    return (
      <div className="space-y-3">
        <h3 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${colorClass}`}>
          <Icon size={14} /> {title}
        </h3>
        <div className="flex flex-col gap-2">
          {tasks.map(task => {
            if (task.taskType === 'counter') {
              return (
                <div 
                  key={task.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/5 text-white"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium line-clamp-1 italic">{task.title}</span>
                    <span className="text-[10px] text-paramo-muted uppercase font-black">Added this cycle: {task.currentCount}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1 border border-white/5">
                    <button 
                      onClick={() => decrementTask(task.id)}
                      className="p-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors"
                      title="Remove"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-xs font-bold tabular-nums">{task.currentCount}</span>
                    <button 
                      onClick={() => incrementTask(task.id, true)}
                      className="p-1 hover:bg-white/5 text-paramo-frailejon hover:text-teal-400 transition-colors"
                      title="Add"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            }

            const isSelected = completedIds.includes(task.id);
            return (
              <button
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left
                  ${isSelected 
                    ? 'bg-paramo-frailejon/10 border-paramo-frailejon/40 text-white shadow-lg shadow-paramo-frailejon/5' 
                    : 'bg-white/5 border-white/5 text-paramo-muted hover:border-white/10'}
                `}
              >
                {isSelected 
                  ? <CheckCircle2 size={18} className="text-paramo-frailejon shrink-0" /> 
                  : <Circle size={18} className="text-paramo-muted shrink-0" />
                }
                <span className="text-sm font-medium line-clamp-1 italic">{task.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-paramo-bg/95 backdrop-blur-md animate-fadeIn">
      <div className="bg-paramo-card w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col gap-8 max-h-[85vh]">
        
        <div className="flex flex-col gap-2 items-center text-center">
          <div className="bg-paramo-frailejon/10 p-4 rounded-full text-paramo-frailejon mb-2">
            <PartyPopper size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight italic">Cycles Renewed!</h2>
          <p className="text-sm text-paramo-muted">Time to review your progress. Did you complete any of these before the reset?</p>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
          <Section 
            title="Daily Tasks" 
            icon={CalendarClock} 
            tasks={groupedTasks.daily} 
            colorClass="text-paramo-frailejon"
          />
          <Section 
            title="Monthly Goals" 
            icon={CalendarDays} 
            tasks={groupedTasks.monthly} 
            colorClass="text-paramo-tierra"
          />
          <Section 
            title="Annual Milestones" 
            icon={CalendarRange} 
            tasks={groupedTasks.annually} 
            colorClass="text-white/40"
          />
        </div>

        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="w-full bg-paramo-frailejon hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-paramo-bg font-black uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-paramo-frailejon/20 group"
        >
          {isLoading ? (
            <span className="animate-pulse">Syncing...</span>
          ) : (
            <>
              Start New Cycle
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};