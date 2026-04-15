import React, { useState } from 'react'
import { useReminderStore } from '../store/useReminderStore'
import { X, Plus, Trash2, Bell, Clock, BellOff, BellRing, ChevronUp, ChevronDown } from 'lucide-react'

// Custom "Finger with ribbon" SVG Component
const FingerRibbonIcon = ({ size = 24, className = "" }) => (
  <svg 
    width={size} height={size} viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
    className={className}
  >
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    {/* The ribbon/bow around the index finger */}
    <path d="M11 6c-1-1-3-1-3 1s2 2 3 1" className="text-paramo-frailejon" />
    <path d="M11 6c1-1 3-1 3 1s-2 2-3 1" className="text-paramo-frailejon" />
  </svg>
);

export const ReminderPanel = ({ isOpen, onClose }) => {
  const { reminders, userSettings, addReminder, updateReminder, deleteReminder, updateSettings, isLoading } = useReminderStore();
  
  const [newTitle, setNewTitle] = useState('');
  const [newInterval, setNewInterval] = useState(60);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addReminder({ title: newTitle, intervalMinutes: parseInt(newInterval) });
    setNewTitle('');
  };

  const handleToggle = (reminder) => {
    updateReminder(reminder.id, { ...reminder, isActive: !reminder.isActive });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-paramo-board border-l border-white/10 z-[150] shadow-2xl animate-slideInRight flex flex-col">
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <FingerRibbonIcon className="text-paramo-frailejon" />
          <h2 className="text-xl font-bold text-white italic tracking-tight">Recordatorios</h2>
        </div>
        <button onClick={onClose} className="text-paramo-muted hover:text-white transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {/* Settings Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-paramo-muted flex items-center gap-2">
            <Clock size={14} /> Jornada de Actividad
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-paramo-muted/70 uppercase font-bold">Inicio</label>
              <input 
                type="time" 
                value={userSettings.dayStartTime} 
                onChange={(e) => updateSettings({ ...userSettings, dayStartTime: e.target.value })}
                className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-paramo-frailejon"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-paramo-muted/70 uppercase font-bold">Fin</label>
              <input 
                type="time" 
                value={userSettings.dayEndTime} 
                onChange={(e) => updateSettings({ ...userSettings, dayEndTime: e.target.value })}
                className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-paramo-frailejon"
              />
            </div>
          </div>
        </section>

        {/* Add Reminder Form */}
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-paramo-muted flex items-center gap-2">
            <Plus size={14} /> Nuevo Recordatorio
          </h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <input 
              type="text" placeholder="Ej: Tomar agua, Postura..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted/50 focus:outline-none focus:border-paramo-frailejon"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-paramo-muted">Cada</span>
              <div className="flex items-center bg-black/20 border border-white/5 rounded-lg overflow-hidden">
                <input 
                  type="number" value={newInterval} onChange={(e) => setNewInterval(e.target.value)} min="1"
                  className="w-12 bg-transparent p-2 text-sm text-white text-center focus:outline-none no-spinner"
                />
                <div className="flex flex-col border-l border-white/5">
                  <button 
                    type="button"
                    onClick={() => setNewInterval(prev => Math.max(1, parseInt(prev) + 5))}
                    className="p-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors border-b border-white/5"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewInterval(prev => Math.max(1, parseInt(prev) - 5))}
                    className="p-1 hover:bg-white/5 text-paramo-muted hover:text-white transition-colors"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              </div>
              <span className="text-xs text-paramo-muted">minutos</span>
              <button 
                type="submit" disabled={!newTitle.trim() || isLoading}
                className="flex-1 bg-paramo-frailejon/10 text-paramo-frailejon border border-paramo-frailejon/30 font-bold py-2 rounded-lg hover:bg-paramo-frailejon/20 transition-all disabled:opacity-50"
              >
                Añadir
              </button>
            </div>
          </form>
        </section>

        {/* List Section */}
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-paramo-muted flex items-center gap-2">
            <Bell size={14} /> Mis Alertas
          </h3>
          <div className="space-y-3">
            {reminders.length === 0 && <p className="text-xs text-paramo-muted italic text-center py-4">No hay recordatorios activos.</p>}
            {reminders.map(reminder => (
              <div key={reminder.id} className={`p-4 rounded-xl border transition-all ${reminder.isActive ? 'bg-paramo-card border-white/10' : 'bg-black/10 border-white/5 opacity-60'}`}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold truncate ${reminder.isActive ? 'text-white' : 'text-paramo-muted'}`}>{reminder.title}</h4>
                    <p className="text-[10px] text-paramo-muted uppercase font-black mt-1">Cada {reminder.intervalMinutes} min</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleToggle(reminder)}
                      className={`p-2 rounded-lg transition-colors ${reminder.isActive ? 'text-paramo-frailejon hover:bg-paramo-frailejon/10' : 'text-paramo-muted hover:bg-white/5'}`}
                      title={reminder.isActive ? "Pausar" : "Activar"}
                    >
                      {reminder.isActive ? <BellRing size={16} /> : <BellOff size={16} />}
                    </button>
                    <button 
                      onClick={() => deleteReminder(reminder.id)}
                      className="p-2 text-paramo-muted hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="p-6 bg-black/20 border-t border-white/5">
        <p className="text-[10px] text-center text-paramo-muted leading-relaxed italic">
          Las notificaciones sonarán solo si la app está abierta (pestaña activa o en segundo plano).
        </p>
      </div>
    </div>
  );
};