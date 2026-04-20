import React, { useState } from 'react'
import { useHabitStore } from '../store/useHabitStore'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { Plus, ChevronsUpDown } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { InlineTaskForm } from './InlineTaskForm'
import { LoadingSkeleton } from './LoadingSkeleton'

import { translations } from '../i18n/translations'

export const Column = ({ column, isActiveOnMobile }) => {
  // Pull viewMode and setViewMode from the store
  const { tasks, isLoading, toggleColumnCollapse, addTask, updateTask, deleteTask, setViewMode, language } = useHabitStore();
  
  const t = translations[language] || translations.en;
  const [activeNewTask, setActiveNewTask] = useState(false);
  const [activeEditTaskId, setActiveEditTaskId] = useState(null);

  // Get this column's specific view mode from the store
  const currentViewMode = column.viewMode || 'active';

  const columnTasks = tasks.filter(t => t.columnId === column.id);
  const displayedTasks = currentViewMode === 'active' 
    ? columnTasks.filter(t => !t.completed)
    : columnTasks.filter(t => t.completed);

  const areAllCollapsed = displayedTasks.every(t => t.isCollapsed);
  const handleToggleAll = () => toggleColumnCollapse(column.id, !areAllCollapsed);

  return (
    <div className={`
      ${isActiveOnMobile ? 'flex' : 'hidden'} 
      md:flex w-full md:w-[320px] lg:flex-1 lg:min-w-0 flex-shrink-0 
      bg-paramo-board rounded-2xl p-4 md:p-5 flex-col h-fit min-h-[50vh] shadow-xl border border-white/5
    `}>
      
      <div className="flex justify-between items-center mb-5 px-1 gap-2 flex-wrap md:flex-nowrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="font-bold text-lg text-white/90 truncate max-w-[100px] md:max-w-none">{t[column.id]}</h2>
            <div className="h-1.5 w-1.5 rounded-full bg-paramo-frailejon shadow-[0_0_8px_rgba(13,148,136,0.8)]"></div>
          </div>
          
          <div className="flex items-center border-l border-white/10 pl-2 gap-2">
            <button onClick={handleToggleAll} className="text-paramo-muted hover:text-white transition-colors p-1" title="Expand/Collapse All">
              <ChevronsUpDown size={14} />
            </button>

            {/* View Tabs Integrated in Header */}
            <div className="flex bg-black/40 p-0.5 rounded-md shrink-0">
              <button 
                onClick={() => setViewMode(column.id, 'active')} 
                className={`px-2 py-0.5 text-[9px] lowercase font-bold rounded transition-colors ${currentViewMode === 'active' ? 'bg-paramo-card text-white shadow-sm' : 'text-paramo-muted/60 hover:text-white/70'}`}
              >
                {t.active}
              </button>
              <button 
                onClick={() => setViewMode(column.id, 'done')} 
                className={`px-2 py-0.5 text-[9px] lowercase font-bold rounded transition-colors ${currentViewMode === 'done' ? 'bg-paramo-card text-white shadow-sm' : 'text-paramo-muted/60 hover:text-white/70'}`}
              >
                {t.done}
              </button>
            </div>
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold text-paramo-muted bg-paramo-bg px-2.5 py-1 rounded-full border border-white/5 shrink-0">
          {columnTasks.filter(t => t.completed).length}/{columnTasks.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex-1 mt-2">
          <LoadingSkeleton />
        </div>
      ) : (
        <Droppable droppableId={column.id}>
          {(provided, snapshot) => (
            <div 
              ref={provided.innerRef} 
              {...provided.droppableProps} 
              className={`flex-1 transition-colors ${snapshot.isDraggingOver ? 'bg-white/5 rounded-xl' : ''}`}
            >
              {displayedTasks.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef} 
                      {...provided.draggableProps}
                      style={provided.draggableProps.style}
                      className="pb-3 md:pb-4"
                    >
                      {activeEditTaskId === task.id ? (
                        <InlineTaskForm 
                          column={column} initialData={task} 
                          onSave={async (data) => { 
                            const success = await updateTask(task.id, data); 
                            if (success) setActiveEditTaskId(null); 
                          }}
                          onCancel={() => setActiveEditTaskId(null)}
                          onDelete={() => { deleteTask(task.id); setActiveEditTaskId(null); }}
                        />
                      ) : (
                        <TaskCard 
                          task={task} column={column} 
                          dragHandleProps={provided.dragHandleProps} 
                          snapshot={snapshot} 
                          onEditClick={() => setActiveEditTaskId(task.id)} 
                        />
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              
              {currentViewMode === 'done' && displayedTasks.length === 0 && (
                <p className="text-center text-xs text-paramo-muted py-8 italic">
                  {t.no_completed}
                </p>
              )}
            </div>
          )}
        </Droppable>
      )}

      {!isLoading && currentViewMode === 'active' && (
        activeNewTask ? (
          <InlineTaskForm 
            column={column} 
            onSave={async (data) => { 
              const success = await addTask(column.id, data); 
              if (success) setActiveNewTask(false); 
            }}
            onCancel={() => setActiveNewTask(false)}
          />
        ) : (
          <button onClick={() => setActiveNewTask(true)} className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-paramo-muted border border-dashed border-white/10 hover:bg-white/5 hover:text-white transition-all group flex-shrink-0">
            <Plus size={16} className="group-hover:rotate-90 transition-transform" /> {t.new_task}
          </button>
        )
      )}
    </div>
  );
};