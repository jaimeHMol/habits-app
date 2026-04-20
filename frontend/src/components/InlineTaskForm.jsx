import React, { useState } from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { translations } from '../i18n/translations'
import { X, Save, Trash2, Check, Hash, Calendar, Clock, AlertTriangle } from 'lucide-react'

export const InlineTaskForm = ({ column, initialData = null, onSave, onCancel, onDelete }) => {
  const { language } = useHabitStore();
  const t = translations[language] || translations.en;

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [priority, setPriority] = useState(initialData?.priority || 'muted');
  const [taskType, setTaskType] = useState(initialData?.taskType || 'checkbox');
  const [targetDay, setTargetDay] = useState(initialData?.targetDay || '');
  const [targetMonth, setTargetMonth] = useState(initialData?.targetMonth || '');
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      title,
      description,
      priority,
      taskType,
      targetDay: targetDay === '' ? null : parseInt(targetDay),
      targetMonth: targetMonth === '' ? null : parseInt(targetMonth),
      durationMinutes: durationMinutes === '' ? null : parseInt(durationMinutes)
    });
  };

  return (
    <form 
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="bg-paramo-card border border-paramo-frailejon/30 rounded-xl p-4 shadow-2xl animate-fadeIn space-y-4"
    >
      <div className="space-y-1">
        <label className="text-[10px] uppercase font-black text-paramo-muted tracking-widest">{t.title_label}</label>
        <input 
          autoFocus
          type="text" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-paramo-frailejon"
          placeholder="..."
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase font-black text-paramo-muted tracking-widest">{t.desc_label}</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-xs text-paramo-muted min-h-[80px] focus:outline-none focus:border-paramo-frailejon resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black text-paramo-muted tracking-widest">{t.priority_label}</label>
          <div className="flex bg-black/20 rounded-lg p-1 border border-white/5">
            {[
              { id: 'muted', label: t.prio_muted, color: 'bg-stone-500' },
              { id: 'frailejon', label: t.prio_important, color: 'bg-paramo-frailejon' },
              { id: 'tierra', label: t.prio_critical, color: 'bg-paramo-tierra' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriority(p.id)}
                className={`flex-1 py-1 text-[9px] uppercase font-bold rounded transition-all ${priority === p.id ? `${p.color} text-white` : 'text-paramo-muted hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black text-paramo-muted tracking-widest">{t.type_label}</label>
          <div className="flex bg-black/20 rounded-lg p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setTaskType('checkbox')}
              className={`flex-1 py-1 flex justify-center items-center rounded transition-all ${taskType === 'checkbox' ? 'bg-white/10 text-white' : 'text-paramo-muted hover:text-white'}`}
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setTaskType('counter')}
              className={`flex-1 py-1 flex justify-center items-center rounded transition-all ${taskType === 'counter' ? 'bg-white/10 text-white' : 'text-paramo-muted hover:text-white'}`}
            >
              <Hash size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(column.id === 'monthly' || column.id === 'annually') && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black text-paramo-muted tracking-widest flex items-center gap-1">
              <Calendar size={10} /> {t.day_label}
            </label>
            <input 
              type="number" min="1" max="31" value={targetDay} onChange={(e) => setTargetDay(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-paramo-frailejon"
            />
          </div>
        )}
        {column.id === 'annually' && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black text-paramo-muted tracking-widest flex items-center gap-1">
              <Calendar size={10} /> {t.month_label}
            </label>
            <input 
              type="number" min="1" max="12" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-paramo-frailejon"
            />
          </div>
        )}
        {column.id === 'daily' && (
          <div className="space-y-1 col-span-2">
            <label className="text-[10px] uppercase font-black text-paramo-muted tracking-widest flex items-center gap-1">
              <Clock size={10} /> {t.duration_label}
            </label>
            <input 
              type="number" min="0" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-paramo-frailejon"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        {initialData && (
          <button 
            type="button" onClick={onDelete}
            className="p-2 text-paramo-muted hover:text-red-400 bg-red-400/5 rounded-lg transition-colors border border-transparent hover:border-red-400/20"
          >
            <Trash2 size={18} />
          </button>
        )}
        <button 
          type="button" onClick={onCancel}
          className="flex-1 py-2 text-xs font-bold text-paramo-muted hover:text-white transition-colors"
        >
          {t.cancel}
        </button>
        <button 
          type="submit"
          className="flex-1 bg-paramo-frailejon/20 text-paramo-frailejon border border-paramo-frailejon/40 font-black uppercase tracking-widest text-[10px] py-2 rounded-lg hover:bg-paramo-frailejon/30 transition-all flex items-center justify-center gap-2"
        >
          <Save size={14} /> {t.save_btn}
        </button>
      </div>
    </form>
  );
};
