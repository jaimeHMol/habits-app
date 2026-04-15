import React from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { CheckCircle2, ChevronDown, ChevronUp, Calendar, GripVertical, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export const TaskCard = ({ task, column, dragHandleProps, snapshot, onEditClick }) => {
  const { toggleCollapse, toggleTaskCompletion } = useHabitStore();

  const hasMonthlyDate = column.type === 'monthly' && task.targetDay != null;
  const hasAnnuallyDate = column.type === 'annually' && task.targetDay != null && task.targetMonth != null;
  const showDateBadge = hasMonthlyDate || hasAnnuallyDate;

  return (
    <div 
      onClick={onEditClick}
      className={`rounded-xl border-l-4 cursor-pointer group transition-colors transition-shadow duration-200
        ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-paramo-frailejon z-50 bg-paramo-board' : 'shadow-md ring-1 hover:ring-white/20'}
        ${task.completed ? 'bg-paramo-card/40 ring-white/5 opacity-70 grayscale-[50%]' : 'bg-paramo-card ring-white/10'}
      `}
      style={{ 
        // BUG FIX: Removed provided.draggableProps.style from here.
        borderLeftColor: task.completed ? '#a8a29e' : (task.priority === 'frailejon' ? '#0d9488' : task.priority === 'tierra' ? '#b45309' : '#a8a29e') 
      }}
    >
      <div className="p-3 md:p-4 flex items-start gap-2 md:gap-3">
        <button 
          title={task.completed ? "Mark as active" : "Mark as done"}
          onClick={(e) => {
            e.stopPropagation();
            toggleTaskCompletion(task.id);
          }}
          className={`mt-0.5 transition-colors flex-shrink-0
            ${task.completed ? 'text-paramo-frailejon hover:text-white' : 'text-paramo-muted hover:text-paramo-frailejon'}
          `}
        >
          {task.completed ? <RotateCcw size={18} strokeWidth={2} /> : <CheckCircle2 size={20} strokeWidth={1.5} />}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="flex flex-col min-w-0 flex-1 opacity-90">
              {showDateBadge && (
                <span className={`flex items-center gap-1 text-[10px] md:text-[11px] font-black uppercase tracking-tighter mb-1 ${task.completed ? 'text-paramo-muted' : 'text-paramo-frailejon'}`}>
                  <Calendar size={10} />
                  {column.type === 'monthly' ? task.targetDay : `${task.targetDay} ${monthNames[task.targetMonth - 1]}`}
                </span>
              )}
              <h3 className={`text-xs sm:text-sm lg:text-xs xl:text-sm font-bold uppercase tracking-wide italic leading-tight break-normal text-balance transition-colors
                ${task.completed ? 'text-paramo-muted line-through decoration-white/30' : 'text-white/90 group-hover:text-white'}
              `}>
                {task.title}
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