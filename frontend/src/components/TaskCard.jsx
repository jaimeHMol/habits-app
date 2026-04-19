import React from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { CheckCircle2, ChevronDown, ChevronUp, Calendar, GripVertical, RotateCcw, Clock, Play, Square, Minus, Plus, Hash } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export const TaskCard = ({ task, column, dragHandleProps, snapshot, onEditClick }) => {
  const { toggleCollapse, toggleTaskCompletion, activeTimer, startTimer, stopTimer, incrementTask, decrementTask } = useHabitStore();

  const hasMonthlyDate = column.type === 'monthly' && task.targetDay != null;
  const hasAnnuallyDate = column.type === 'annually' && task.targetDay != null && task.targetMonth != null;
  const showDateBadge = hasMonthlyDate || hasAnnuallyDate;

  const isTimerActive = activeTimer.taskId === task.id;
  const isDailyColumn = column.id === 'daily';

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      onClick={onEditClick}
      className={`rounded-xl border-l-4 cursor-pointer group transition-all duration-300
        ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-paramo-frailejon z-50 bg-paramo-board' : 'shadow-md ring-1 hover:ring-white/20'}
        ${task.completed ? 'bg-paramo-card/40 ring-white/5 opacity-70 grayscale-[50%]' : 'bg-paramo-card ring-white/10'}
        ${isTimerActive ? 'ring-paramo-frailejon/50 bg-paramo-frailejon/5 shadow-lg shadow-paramo-frailejon/5' : ''}
      `}
      style={{ 
        // BUG FIX: Removed provided.draggableProps.style from here.
        borderLeftColor: isTimerActive ? '#0d9488' : (task.completed ? '#a8a29e' : (task.priority === 'frailejon' ? '#0d9488' : task.priority === 'tierra' ? '#b45309' : '#a8a29e')) 
      }}
    >
      <div className="p-3 md:p-4 flex items-start gap-2 md:gap-3">
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {task.taskType === 'counter' ? (
            <div className="flex flex-col items-center gap-2">
              <button 
                title="Increment"
                onClick={(e) => {
                  e.stopPropagation();
                  incrementTask(task.id);
                }}
                className="mt-0.5 text-paramo-muted hover:text-paramo-frailejon transition-colors"
              >
                <Plus size={20} strokeWidth={1.5} />
              </button>
              <button 
                title="Decrement"
                onClick={(e) => {
                  e.stopPropagation();
                  decrementTask(task.id);
                }}
                className={`p-1 text-paramo-muted/40 hover:text-white transition-all active:scale-90 ${task.currentCount === 0 ? 'invisible' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <Minus size={14} />
              </button>
            </div>
          ) : (
            <>
              <button 
                title={task.completed ? "Mark as active" : "Mark as done"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskCompletion(task.id);
                }}
                className={`mt-0.5 transition-colors
                  ${task.completed ? 'text-paramo-frailejon hover:text-white' : 'text-paramo-muted hover:text-paramo-frailejon'}
                `}
              >
                {task.completed ? <RotateCcw size={18} strokeWidth={2} /> : <CheckCircle2 size={20} strokeWidth={1.5} />}
              </button>

              {isDailyColumn && !task.completed && task.durationMinutes > 0 && (
                <button
                  title={isTimerActive ? "Stop focus" : "Start focus"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isTimerActive) stopTimer();
                    else startTimer(task.id, task.durationMinutes);
                  }}
                  className={`p-1.5 rounded-lg transition-all duration-300 ${isTimerActive ? 'bg-paramo-frailejon text-white animate-pulse' : 'text-paramo-muted hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100'}`}
                >
                  {isTimerActive ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                </button>
              )}
            </>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="flex flex-col min-w-0 flex-1 opacity-90">
              {(showDateBadge || (isDailyColumn && task.durationMinutes > 0 && !task.completed && !isTimerActive) || task.taskType === 'counter') && (
                <div className="flex items-center gap-2 mb-1">
                  {showDateBadge && (
                    <span className={`flex items-center gap-1 text-[10px] md:text-[11px] font-black uppercase tracking-tighter ${task.completed ? 'text-paramo-muted' : 'text-paramo-frailejon'}`}>
                      <Calendar size={10} />
                      {column.type === 'monthly' ? task.targetDay : `${task.targetDay} ${monthNames[task.targetMonth - 1]}`}
                    </span>
                  )}
                  {task.taskType === 'counter' && (
                    <span className="flex items-center gap-0.5 text-[10px] font-black text-paramo-tierra uppercase tracking-widest bg-paramo-tierra/10 px-1.5 py-0.5 rounded shadow-sm">
                      <Hash size={10} strokeWidth={3} /> {task.currentCount}
                    </span>
                  )}
                  {isDailyColumn && task.durationMinutes > 0 && !task.completed && !isTimerActive && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-paramo-muted/60 uppercase tracking-widest">
                      <Clock size={10} /> {task.durationMinutes}m
                    </span>
                  )}
                </div>
              )}
              <h3 className={`text-xs sm:text-sm lg:text-xs xl:text-sm font-bold uppercase tracking-wide leading-tight break-normal text-balance transition-colors
                ${task.completed ? 'text-paramo-muted line-through decoration-white/30' : 'text-white/90 group-hover:text-white'}
                ${isTimerActive ? 'text-paramo-frailejon' : ''}
              `}>
                {isTimerActive ? (
                  <span className="flex items-center gap-2 italic">
                    <span className="text-xl tabular-nums tracking-tighter">{formatTime(activeTimer.remainingSeconds)}</span>
                  </span>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    disallowedElements={['p']}
                    unwrapDisallowed
                    components={{
                      a: ({node, ...props}) => <a className="text-paramo-frailejon underline hover:text-white transition-colors italic" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} {...props} />,
                      text: ({node, value}) => {
                        // Improved Regex for Emojis
                        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
                        const parts = value.split(emojiRegex);
                        
                        return parts.map((part, i) => {
                          if (part.match(emojiRegex)) {
                            // Emojis: No italic, extra spacing
                            return <span key={i} className="not-italic font-normal inline-block mx-0.5 select-none">{part}</span>;
                          }
                          // Regular text: Force italic here
                          return <span key={i} className="italic">{part}</span>;
                        });
                      }
                    }}
                  >
                    {task.title}
                  </ReactMarkdown>
                )}
              </h3>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              {/* BUG FIX: We now use the explicitly passed dragHandleProps */}
              <div {...dragHandleProps} onClick={(e) => e.stopPropagation()} className="text-paramo-muted/50 hover:text-white p-1 rounded-md cursor-grab active:cursor-grabbing">
                <GripVertical size={16} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleCollapse(task.id); }} 
                className="text-paramo-muted hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
              >
                {task.isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>
          {!task.isCollapsed && (
            <div className="mt-1.5 animate-fadeIn">
              <div className="prose-container">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({node, ...props}) => <p className={`text-xs leading-relaxed font-light break-normal text-balance ${task.completed ? 'text-paramo-muted/70' : 'text-paramo-muted'}`} {...props} />,
                    a: ({node, ...props}) => <a className="text-paramo-frailejon underline hover:text-white transition-colors" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-white/90" {...props} />,
                    em: ({node, ...props}) => <em className="italic" {...props} />,
                    del: ({node, ...props}) => <del className="line-through decoration-white/30" {...props} />,
                    ul: ({node, ...props}) => <ul className={`list-disc list-inside ml-1 text-xs ${task.completed ? 'text-paramo-muted/70' : 'text-paramo-muted'}`} {...props} />,
                    ol: ({node, ...props}) => <ol className={`list-decimal list-inside ml-1 text-xs ${task.completed ? 'text-paramo-muted/70' : 'text-paramo-muted'}`} {...props} />,
                    li: ({node, ...props}) => <li className="mb-0.5 leading-relaxed font-light" {...props} />,
                  }}
                >
                  {task.description}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};