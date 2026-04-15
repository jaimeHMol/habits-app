import React, { useState, useRef, useEffect } from 'react'
import { Trash2, X, Save, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export const InlineTaskForm = ({ column, initialData, onSave, onCancel, onDelete }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [priority, setPriority] = useState(initialData?.priority || 'muted');
  const [targetDay, setTargetDay] = useState(initialData?.targetDay || '');
  const [targetMonth, setTargetMonth] = useState(initialData?.targetMonth || '');
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes || '');
  
  // NEW: Local error state for form validation
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const formRef = useRef(null);

  useEffect(() => {
    if (formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    
    // Only allow clicking outside to cancel if we aren't currently trying to save
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
      setError('Title is required');
      return;
    }

    // Explicit Front-end validation to match Backend rules
    const dayInt = targetDay ? parseInt(targetDay) : null;
    if (dayInt !== null && (dayInt < 1 || dayInt > 31)) {
      setError('Day must be between 1 and 31');
      return;
    }

    setIsSaving(true);
    // Let the parent component execute the store action and tell us if it succeeded
    const success = await onSave({
      title, description, priority,
      targetDay: dayInt,
      targetMonth: targetMonth ? parseInt(targetMonth) : null,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
    });
    
    // If it failed in the backend, stop the saving state but DO NOT close the form
    if (!success) {
      setIsSaving(false);
      setError('Network error. Try again.');
    }
    // If success === true, the parent will unmount this component anyway
  };

  const priorityColorClass = priority === 'frailejon' ? 'text-paramo-frailejon' : priority === 'tierra' ? 'text-paramo-tierra' : 'text-paramo-muted';

  return (
    <div ref={formRef} className="bg-paramo-card p-4 rounded-xl border border-paramo-frailejon/50 shadow-lg flex flex-col gap-3 animate-fadeIn flex-shrink-0 my-1 relative">
      
      {/* Show error message if validation fails */}
      {error && (
        <div className="absolute -top-3 left-4 bg-red-900/90 text-red-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
          <AlertCircle size={10} /> {error}
        </div>
      )}

      <input autoFocus type="text" placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving} className="bg-transparent border-b border-white/10 text-sm font-bold text-white placeholder:text-paramo-muted pb-1 focus:outline-none focus:border-paramo-frailejon disabled:opacity-50" />
      <textarea placeholder="Description (optional)..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSaving} className="bg-transparent border border-white/10 rounded-md p-2 text-xs text-white placeholder:text-paramo-muted/50 focus:outline-none focus:border-paramo-frailejon resize-y min-h-[4rem] h-24 disabled:opacity-50" />
      
      <div className="flex flex-wrap gap-2 items-center">
        <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={isSaving} className={`bg-paramo-board border border-white/10 rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-paramo-frailejon disabled:opacity-50 ${priorityColorClass}`}>
          <option value="muted" className="text-paramo-muted font-bold">Optional</option>
          <option value="frailejon" className="text-paramo-frailejon font-bold">Important</option>
          <option value="tierra" className="text-paramo-tierra font-bold">Critical</option>
        </select>

        {/* Focus Duration Input - Only for Daily column */}
        {column.id === 'daily' && (
          <div className="flex items-center gap-1.5" title="Focus duration">
            <span className="text-[10px] font-bold text-paramo-muted uppercase tracking-tight">During</span>
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
            <span className="text-[10px] font-bold text-paramo-muted uppercase tracking-tight">min</span>
          </div>
        )}

        {(column.type === 'monthly' || column.type === 'annually') && (
          <div className="flex items-center bg-paramo-board border border-white/10 rounded overflow-hidden h-7">
            <input 
              type="number" min="1" max="31" placeholder="Day" value={targetDay} 
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
            <option value="" disabled>Month</option>
            {monthNames.map((m, i) => <option key={m} value={i + 1} className="text-paramo-muted">{m}</option>)}
          </select>
        )}
      </div>
      
      <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
        <div>{initialData && <button onClick={onDelete} disabled={isSaving} title="Delete task" className="text-paramo-muted hover:text-red-500 p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"><Trash2 size={16} /></button>}</div>
        <div className="flex gap-2">
          <button onClick={onCancel} disabled={isSaving} className="text-paramo-muted hover:text-white p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50"><X size={16} /></button>
          
          {/* Changed logic to support the async call visually */}
          <button onClick={handleSave} disabled={!title.trim() || isSaving} className="text-paramo-frailejon hover:text-teal-400 p-1.5 rounded-md hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
            <Save size={16} />
            {isSaving && <span className="text-[10px] animate-pulse font-bold uppercase tracking-wider">Saving</span>}
          </button>
        </div>
      </div>
    </div>
  );
};