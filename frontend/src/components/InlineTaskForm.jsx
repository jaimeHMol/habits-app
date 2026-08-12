import React, { useState, useRef, useEffect } from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { translations } from '../i18n/translations'
import { Trash2, X, Save, AlertCircle, ChevronUp, ChevronDown, LoaderPinwheel } from 'lucide-react'

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

const Dropdown = ({ value, options, onChange, disabled, className, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value == value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 bg-paramo-board border border-white/10 rounded px-2 py-1 text-xs font-bold focus:outline-none focus:border-paramo-frailejon disabled:opacity-50 ${className}`}
      >
        <span>{selectedOption ? selectedOption.label : (placeholder || '')}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-full mt-1 left-0 bg-paramo-board border border-white/10 rounded shadow-xl z-50 overflow-y-auto max-h-48 flex flex-col min-w-[120px] custom-scrollbar">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setIsOpen(false); }}
              className={`px-3 py-2 text-xs font-bold text-left hover:bg-white/5 transition-colors whitespace-nowrap ${o.className || 'text-paramo-muted'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

      <input autoFocus type="text" placeholder={t.title_placeholder || "Task title..."} value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving} className="bg-transparent border-b border-white/10 text-sm font-bold text-white placeholder:text-paramo-muted pb-1 focus:outline-none focus:border-paramo-frailejon" />
      <textarea placeholder={t.desc_placeholder || "Description (optional)..."} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSaving} className="bg-transparent border border-white/10 rounded-md p-2 text-xs text-white placeholder:text-paramo-muted/50 focus:outline-none focus:border-paramo-frailejon resize-y min-h-[4rem] h-24" />
      
      <div className="flex flex-wrap gap-2 items-center">
        <Dropdown
          value={priority}
          onChange={setPriority}
          disabled={isSaving}
          className={priorityColorClass}
          options={[
            { value: 'muted', label: t.prio_muted, className: 'text-paramo-muted' },
            { value: 'frailejon', label: t.prio_important, className: 'text-paramo-frailejon' },
            { value: 'tierra', label: t.prio_critical, className: 'text-paramo-tierra' }
          ]}
        />

        {column.id === 'monthly' && (
          <Dropdown
            value={taskType}
            onChange={setTaskType}
            disabled={isSaving}
            className="text-paramo-muted"
            options={[
              { value: 'checkbox', label: t.type_once || "Once" },
              { value: 'counter', label: t.type_counter || "Counter" }
            ]}
          />
        )}

        {column.id === 'daily' && (
          <div className="flex items-center gap-1.5" title="Focus duration">
            <span className="text-[10px] text-paramo-muted tracking-tight">{t.form_during || "during"}</span>
            <div className="flex items-center bg-paramo-board border border-white/10 rounded overflow-hidden h-[26px]">
              <input 
                type="number" min="0" placeholder="0" value={durationMinutes} 
                onChange={(e) => setDurationMinutes(e.target.value)} disabled={isSaving} 
                className="w-10 h-full bg-transparent px-2 text-xs font-bold text-paramo-muted placeholder:text-paramo-muted focus:outline-none no-spinner text-center" 
              />
              <div className="flex flex-col border-l border-white/10 h-full">
                <button 
                  type="button" disabled={isSaving}
                  onClick={() => setDurationMinutes(prev => Math.max(1, (parseInt(prev) || 0) + 5))}
                  className="px-1 flex-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors border-b border-white/10 flex items-center justify-center"
                >
                  <ChevronUp size={10} />
                </button>
                <button 
                  type="button" disabled={isSaving}
                  onClick={() => setDurationMinutes(prev => Math.max(0, (parseInt(prev) || 5) - 5) || '')}
                  className="px-1 flex-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors flex items-center justify-center"
                >
                  <ChevronDown size={10} />
                </button>
              </div>
            </div>
            <span className="text-[10px] text-paramo-muted tracking-tight">min</span>
          </div>
        )}

        {(column.type === 'monthly' || column.type === 'annually') && (
          <div className="flex items-center bg-paramo-board border border-white/10 rounded overflow-hidden h-[26px]">
            <input 
              type="number" min="1" max="31" placeholder={t.day_label || "Day"} value={targetDay} 
              onChange={(e) => setTargetDay(e.target.value)} disabled={isSaving} 
              className="w-10 h-full bg-transparent px-2 text-xs font-bold text-paramo-muted placeholder:text-paramo-muted focus:outline-none no-spinner text-center" 
            />
            <div className="flex flex-col border-l border-white/10 h-full">
              <button 
                type="button" disabled={isSaving}
                onClick={() => setTargetDay(prev => Math.min(31, Math.max(1, (parseInt(prev) || 0) + 1)))}
                className="px-1 flex-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors border-b border-white/10 flex items-center justify-center"
              >
                <ChevronUp size={10} />
              </button>
              <button 
                type="button" disabled={isSaving}
                onClick={() => setTargetDay(prev => Math.min(31, Math.max(1, (parseInt(prev) || 2) - 1)))}
                className="px-1 flex-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors flex items-center justify-center"
              >
                <ChevronDown size={10} />
              </button>
            </div>
          </div>
        )}
        {column.type === 'annually' && (
          <Dropdown
            value={targetMonth}
            onChange={setTargetMonth}
            disabled={isSaving}
            className="text-paramo-muted"
            placeholder={t.month_label || "Month"}
            options={monthNames.map((m, i) => ({ value: i + 1, label: m, className: "text-paramo-muted" }))}
          />
        )}
      </div>
      
      {showDeleteConfirm ? (
        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-red-500/20 animate-fadeIn bg-red-950/20 -mx-4 -mb-4 p-4 rounded-b-xl">
          <span className="text-xs font-bold text-red-400 flex items-center gap-1"><AlertCircle size={14} /> {t.delete_confirm || "Delete this task permanently?"}</span>
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={isSaving} className="text-xs px-3 py-1.5 rounded text-paramo-muted hover:text-white hover:bg-white/5 transition-colors font-medium">
              {t.cancel || "Cancel"}
            </button>
            <button type="button" onClick={onDelete} disabled={isSaving} className="text-xs px-3 py-1.5 rounded bg-red-900/60 text-red-100 hover:bg-red-800 hover:text-white transition-colors flex items-center gap-1.5 font-bold shadow-sm">
              {isSaving ? <LoaderPinwheel size={12} className="animate-spin" /> : <Trash2 size={12} />} {t.delete || "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
          <div>{initialData && <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={isSaving} title="Delete task" className="text-paramo-muted hover:text-red-500 p-1.5 rounded-md hover:bg-white/5 transition-colors"><Trash2 size={16} /></button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} disabled={isSaving} className="text-paramo-muted hover:text-white p-1.5 rounded-md hover:bg-white/5 transition-colors"><X size={16} /></button>
            
            <button type="button" onClick={handleSave} disabled={!title.trim() || isSaving} className={`p-1.5 rounded-md transition-colors disabled:cursor-not-allowed flex items-center gap-1 ${isSaving ? 'text-paramo-muted' : 'text-paramo-frailejon hover:text-teal-400 hover:bg-white/5'}`}>
              {isSaving ? (
                <LoaderPinwheel size={16} className="animate-spin text-paramo-frailejon" />
              ) : (
                <Save size={16} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
