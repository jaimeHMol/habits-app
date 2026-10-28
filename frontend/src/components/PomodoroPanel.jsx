import React, { useState, useEffect, useRef, useMemo } from 'react'
import { usePomodoroStore, parseServerDateMs } from '../store/usePomodoroStore'
import { useHabitStore } from '../store/useHabitStore'
import { useReminderStore } from '../store/useReminderStore'
import { translations } from '../i18n/translations'
import { X, Play, Plus, Trash2, ChevronDown, CheckCircle2, Clock } from 'lucide-react'

export const formatHour12 = (hour) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
};

const parseHourFromTimeStr = (timeStr, fallbackHour) => {
  if (!timeStr || typeof timeStr !== 'string') return fallbackHour;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  if (isNaN(h) || h < 0 || h > 23) return fallbackHour;
  return h;
};

export const getActiveWindowHours = (dayStartTime, dayEndTime) => {
  const startHour = parseHourFromTimeStr(dayStartTime, 8);
  const endHour = parseHourFromTimeStr(dayEndTime, 20);
  const hours = [];

  if (startHour <= endHour) {
    for (let h = startHour; h <= endHour; h++) {
      hours.push(h);
    }
  } else {
    for (let h = startHour; h < 24; h++) {
      hours.push(h);
    }
    for (let h = 0; h <= endHour; h++) {
      hours.push(h);
    }
  }

  return hours.length > 0 ? hours : Array.from({ length: 24 }, (_, i) => i);
};

export const getClosestHourInOptions = (targetHour, availableHours) => {
  if (!availableHours || availableHours.length === 0) return targetHour;
  if (availableHours.includes(targetHour)) return targetHour;

  let closest = availableHours[0];
  let minDiff = Infinity;

  for (const h of availableHours) {
    const directDiff = Math.abs(h - targetHour);
    const circularDiff = Math.min(directDiff, 24 - directDiff);
    if (circularDiff < minDiff) {
      minDiff = circularDiff;
      closest = h;
    }
  }

  return closest;
};

export const TomatoIcon = ({ size = 20, strokeWidth = 2, isActive = false, className = "" }) => (
  <div className="relative inline-flex items-center justify-center">
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Tomato Body (plump and rounded, reacts to currentColor) */}
      <path d="M12 8.5c-4-1.5-9.5 0-9.5 6.5 0 5 4.5 7 9.5 7s9.5-2 9.5-7c0-6.5-5.5-8-9.5-6.5z" />

      {/* Stem and prominent leaves (same frailejon green as reminder ribbon) */}
      <g className="text-paramo-frailejon">
        <path d="M12 5.5c0-1.8 1-2.8 2.5-3.5" />
        <path d="M12 6.5c-2.8-1.8-6-1.5-8.5 0 2 1.5 4.5 1.8 7 1.2" />
        <path d="M12 6.5c2.8-1.8 6-1.5 8.5 0-2 1.5-4.5 1.8-7 1.2" />
        <path d="M11 7.5c-1.8 1.5-3.5 3.2-4.5 5.2 2-1 3.8-2 5-3.8" />
        <path d="M13 7.5c1.8 1.5 3.5 3.2 4.5 5.2-2-1-3.8-2-5-3.8" />
        <path d="M12 7.5v3.8" />
      </g>
    </svg>
    {isActive && (
      <span className="absolute -top-1 -right-1 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-paramo-frailejon opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-paramo-frailejon"></span>
      </span>
    )}
  </div>
);

const CustomDropdown = ({ value, options, onChange, disabled, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-paramo-frailejon disabled:opacity-50 transition-colors whitespace-nowrap ${className || ''}`}
      >
        <span>{selectedOption ? selectedOption.label : ''}</span>
        <ChevronDown size={12} className={`transition-transform text-paramo-muted ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-full mt-1 left-0 min-w-[110px] bg-paramo-board border border-white/10 rounded-lg shadow-2xl z-50 overflow-y-auto max-h-48 flex flex-col custom-scrollbar">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setIsOpen(false);
              }}
              className={`px-3 py-2 text-xs font-bold text-left hover:bg-white/5 transition-colors whitespace-nowrap ${
                o.value === value ? 'text-paramo-frailejon bg-paramo-frailejon/10' : 'text-paramo-muted'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const PomodoroPanel = ({ isOpen, onClose }) => {
  const {
    todayStats,
    startFocus,
    createManualPomodoro,
    deleteManualPomodoro,
    isLoading
  } = usePomodoroStore();
  const { language } = useHabitStore();
  const { userSettings } = useReminderStore();
  const t = translations[language] || translations.en;

  const availableHours = useMemo(
    () => getActiveWindowHours(userSettings?.dayStartTime, userSettings?.dayEndTime),
    [userSettings?.dayStartTime, userSettings?.dayEndTime]
  );

  const hourOptions = useMemo(
    () =>
      availableHours.map((h) => ({
        value: h,
        label: formatHour12(h)
      })),
    [availableHours]
  );

  const [selectedHour, setSelectedHour] = useState(() =>
    getClosestHourInOptions(new Date().getHours(), availableHours)
  );
  const panelRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedHour(getClosestHourInOptions(new Date().getHours(), availableHours));
    }
  }, [isOpen, availableHours]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStart = async () => {
    await startFocus();
  };

  const handleAddManual = async (e) => {
    e.preventDefault();
    await createManualPomodoro(Number(selectedHour));
  };

  const completedSessions = (todayStats.today_sessions || []).filter(
    (s) => s.status === 'completed'
  );

  return (
    <div
      ref={panelRef}
      className="fixed inset-y-0 right-0 w-full max-w-sm bg-paramo-board border-l border-white/10 z-[150] shadow-2xl animate-slideInRight flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <TomatoIcon size={24} className="text-paramo-frailejon" />
          <h2 className="text-xl font-bold tracking-tight text-white">{t.pomodoro_title}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-paramo-muted hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          title={t.close}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Section 1: Today's Summary */}
        <div className="bg-black/20 border border-white/5 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-paramo-muted mb-1">
              {t.pomodoro_today_completed}
            </p>
            <span className="text-4xl font-black text-paramo-frailejon tabular-nums tracking-tight">
              {todayStats.completed_today_count}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-widest text-paramo-muted font-bold">
              {todayStats.interrupted_today_count} {t.pomodoro_today_interrupted}
            </span>
          </div>
        </div>

        {/* Section 2: Start Pomodoro (Primary Action) */}
        <div className="bg-black/20 border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-paramo-frailejon/15 text-paramo-frailejon border border-paramo-frailejon/20">
              25 MIN FOCUS
            </span>
            <span className="text-paramo-muted text-xs">·</span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 text-paramo-muted border border-white/10">
              5 MIN BREAK
            </span>
          </div>

          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-paramo-frailejon text-paramo-bg font-black uppercase tracking-widest text-xs py-3 px-4 rounded-xl shadow-lg hover:bg-opacity-90 active:scale-95 transition-all"
          >
            <Play size={16} fill="currentColor" />
            {t.pomodoro_start_btn}
          </button>
        </div>

        {/* Section 3: Log Manual Pomodoro */}
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-paramo-muted flex items-center gap-2">
            <Plus size={14} /> {t.pomodoro_manual_section}
          </h3>
          <form onSubmit={handleAddManual} className="bg-black/20 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-2 focus-within:border-paramo-frailejon/30 transition-all">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black text-paramo-muted/60">
                {t.pomodoro_manual_hour}
              </span>
              <CustomDropdown
                value={selectedHour}
                options={hourOptions}
                onChange={(val) => setSelectedHour(Number(val))}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-paramo-frailejon/10 hover:bg-paramo-frailejon/20 text-paramo-frailejon border border-paramo-frailejon/30 font-black uppercase tracking-widest text-[10px] rounded-lg transition-all disabled:opacity-50 shrink-0"
            >
              <Plus size={14} strokeWidth={2} />
              {t.add}
            </button>
          </form>
        </section>

        {/* Section 4: Today's History */}
        <section className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-paramo-muted flex items-center gap-2">
            <Clock size={14} /> {t.pomodoro_history_today}
          </h3>

          {completedSessions.length === 0 ? (
            <p className="text-xs text-paramo-muted italic text-center py-2">
              {t.pomodoro_no_sessions}
            </p>
          ) : (
            <div className="space-y-3">
              {completedSessions.map((session) => {
                let primaryTime = '';
                let secondaryBadge = '';
                if (session.is_manual) {
                  primaryTime = formatHour12(session.hour_of_day);
                  secondaryBadge = t.pomodoro_manual_badge;
                } else if (session.started_at) {
                  const ms = parseServerDateMs(session.started_at);
                  const date = ms ? new Date(ms) : new Date();
                  primaryTime = date.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  secondaryBadge = `25 ${t.minutes}`;
                }

                return (
                  <div
                    key={session.id}
                    className="p-4 rounded-xl border bg-paramo-card border-white/10 transition-all"
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CheckCircle2 size={18} strokeWidth={1.5} className="text-paramo-frailejon shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{primaryTime}</h4>
                          <p className="text-[10px] text-paramo-muted uppercase font-black mt-1">{secondaryBadge}</p>
                        </div>
                      </div>

                      {session.is_manual && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => deleteManualPomodoro(session.id)}
                            className="flex items-center justify-center p-2 text-paramo-muted hover:text-red-400 transition-colors"
                            title={t.delete}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
