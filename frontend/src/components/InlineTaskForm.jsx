import React, { useState, useRef, useEffect } from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { translations } from '../i18n/translations'
import { Trash2, X, Save, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export const InlineTaskForm = ({ column, initialData, onSave, onCancel, onDelete }) => {
  const { language } = useHabitStore();
  const t = translations[language] || translations.en;

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [priority, setPriority] = useState(initialData?.priority || 'muted');
  const [targetDay, setTargetDay] = useState(initialData?.targetDay || '');
  const [targetMonth, setTargetMonth] = useState(initialData?.targetMonth || '');
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes || '');
  const [taskType, setTaskType] = useState(initialData?.taskType || 'checkbox');
  
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const formRef = useRef(null);

  useEffect(() => {
    if (formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target) && !isSaving) {
        onCancel();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel, isSaving]);

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError(t.error_title_req || 'Title is required');
      return;
    }

    const dayInt = targetDay ? parseInt(targetDay) : null;
    if (dayInt !== null && (dayInt < 1 || dayInt > 31)) {
      setError(t.error_day_range || 'Day must be between 1 and 31');
      return;
    }

    setIsSaving(true);
    const success = await onSave({
      title, description, priority,
      targetDay: dayInt,
      targetMonth: targetMonth ? parseInt(targetMonth) : null,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      taskType,
      currentCount: initialData?.currentCount || 0
    });
    
    if (!success) {
      setIsSaving(false);
      setError(t.error_network || 'Network error. Try again.');
    }
  };

  const priorityColorClass = priority === 'frailejon' ? 'text-paramo-frailejon' : priority === 'tierra' ? 'text-paramo-tierra' : 'text-paramo-muted';

  return (
    <div ref={formRef} className="bg-paramo-card p-4 rounded-xl border border-paramo-frailejon/50 shadow-lg flex flex-col gap-3 animate-fadeIn flex-shrink-0 my-1 relative">
      
      {error && (
        <div className="absolute -top-3 left-4 bg-red-900/90 text-red-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
          <AlertCircle size={10} /> {error}
        </div>
      )}

      <input autoFocus type="text" placeholder={t.title_placeholder || "Task title..."} value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving} className="bg-transparent border-b border-white/10 text-sm font-bold text-white placeholder:text-paramo-muted pb-1 focus:outline-none focus:border-paramo-frailejon disabled:opacity-50" />
      <textarea placeholder={t.desc_placeholder || "Description (optional)..."} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSaving} className="bg-transparent border border-white/10 rounded-md p-2 text-xs text-white placeholder:text-paramo-muted/50 focus:outline-none focus:border-paramo-frailejon resize-y min-h-[4rem] h-24 disabled:opacity-50" />
      
      <div className="flex flex-wrap gap-2 items-center">
        <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={isSaving} className={`bg-paramo-board border border-white/10 rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-paramo-frailejon disabled:opacity-50 ${priorityColorClass}`}>
          <option value="muted" className="text-paramo-muted font-bold">{t.prio_muted}</option>
          <option value="frailejon" className="text-paramo-frailejon font-bold">{t.prio_important}</option>
          <option value="tierra" className="text-paramo-tierra font-bold">{t.prio_critical}</option>
        </select>

        {column.id === 'monthly' && (
          <select 
            value={taskType} onChange={(e) => setTaskType(e.target.value)} disabled={isSaving} 
            className="bg-paramo-board border border-white/10 rounded px-2 py-1 text-xs font-bold text-paramo-muted focus:outline-none focus:border-paramo-frailejon disabled:opacity-50"
          >
            <option value="checkbox">{t.type_once || "Once"}</option>
            <option value="counter">{t.type_counter || "Counter"}</option>
          </select>
        )}

        {column.id === 'daily' && (
          <div className="flex items-center gap-1.5" title="Focus duration">
            <span className="text-[10px] text-paramo-muted tracking-tight">{t.form_during || "during"}</span>
            <div className="flex items-center bg-paramo-board border border-white/10 rounded overflow-hidden h-7">
              <input 
                type="number" min="0" placeholder="0" value={durationMinutes} 
                onChange={(e) => setDurationMinutes(e.target.value)} disabled={isSaving} 
                className="w-10 bg-transparent px-2 py-1 text-xs text-paramo-muted focus:outline-none no-spinner text-center" 
              />
              <div className="flex flex-col border-l border-white/10">
                <button 
                  type="button" disabled={isSaving}
                  onClick={() => setDurationMinutes(prev => Math.max(1, (parseInt(prev) || 0) + 5))}
                  className="px-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors border-b border-white/10 flex items-center justify-center"
                >
                  <ChevronUp size={10} />
                </button>
                <button 
                  type="button" disabled={isSaving}
                  onClick={() => setDurationMinutes(prev => Math.max(0, (parseInt(prev) || 5) - 5) || '')}
                  className="px-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors flex items-center justify-center"
                >
                  <ChevronDown size={10} />
                </button>
              </div>
            </div>
            <span className="text-[10px] text-paramo-muted tracking-tight">min</span>
          </div>
        )}

        {(column.type === 'monthly' || column.type === 'annually') && (
          <div className="flex items-center bg-paramo-board border border-white/10 rounded overflow-hidden h-7">
            <input 
              type="number" min="1" max="31" placeholder={t.day_label || "Day"} value={targetDay} 
              onChange={(e) => setTargetDay(e.target.value)} disabled={isSaving} 
              className="w-10 bg-transparent px-2 py-1 text-xs text-paramo-muted focus:outline-none no-spinner text-center" 
            />
            <div className="flex flex-col border-l border-white/10">
              <button 
                type="button" disabled={isSaving}
                onClick={() => setTargetDay(prev => Math.min(31, Math.max(1, (parseInt(prev) || 0) + 1)))}
                className="px-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors border-b border-white/10 flex items-center justify-center"
              >
                <ChevronUp size={10} />
              </button>
              <button 
                type="button" disabled={isSaving}
                onClick={() => setTargetDay(prev => Math.min(31, Math.max(1, (parseInt(prev) || 2) - 1)))}
                className="px-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors flex items-center justify-center"
              >
                <ChevronDown size={10} />
              </button>
            </div>
          </div>
        )}
        {column.type === 'annually' && (
          <select value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} disabled={isSaving} className="bg-paramo-board border border-white/10 rounded px-2 py-1 text-xs text-paramo-muted focus:outline-none focus:border-paramo-frailejon disabled:opacity-50">
            <option value="" disabled>{t.month_label || "Month"}</option>
            {monthNames.map((m, i) => <option key={m} value={i + 1} className="text-paramo-muted">{m}</option>)}
          </select>
        )}
      </div>
      
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
        <div>{initialData && <button onClick={onDelete} disabled={isSaving} title="Delete task" className="text-paramo-muted hover:text-red-500 p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"><Trash2 size={16} /></button>}</div>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={isSaving} className="text-paramo-muted hover:text-white p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"><X size={16} /></button>
          
          <button onClick={handleSave} disabled={!title.trim() || isSaving} className="text-paramo-frailejon hover:text-teal-400 p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
            <Save size={16} />
            {isSaving && <span className="text-[10px] animate-pulse font-bold uppercase tracking-wider">{t.saving_status || "Saving"}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
