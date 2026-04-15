import React, { useState, useEffect } from 'react'
import { useHabitStore } from './store/useHabitStore'
import { DragDropContext } from '@hello-pangea/dnd'
import { Column } from './components/Column'
import { DailyReviewModal } from './components/DailyReviewModal'
import { ReminderEngine } from './components/ReminderEngine'
import { ReminderPanel } from './components/ReminderPanel'
import { NotificationToast } from './components/NotificationToast'
import { LogOut, Lock } from 'lucide-react'

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
    <path d="M11 6c-1-1-3-1-3 1s2 2 3 1" className="text-paramo-frailejon" />
    <path d="M11 6c1-1 3-1 3 1s-2 2-3 1" className="text-paramo-frailejon" />
  </svg>
);

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function App() {
  const { columns, reorderTasks, fetchTasks, isAuthenticated, login, logout, showReviewModal, checkDayChange } = useHabitStore()
  
  const [activeMobileColumn, setActiveMobileColumn] = useState('daily')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isReminderPanelOpen, setIsReminderPanelOpen] = useState(false)

  const greeting = getGreeting()

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks().then(() => {
        checkDayChange();
      });
    }
  }, [fetchTasks, isAuthenticated, checkDayChange]);

  const onDragEnd = (result) => {
    const { source, destination } = result
    if (!destination || source.droppableId !== destination.droppableId || source.index === destination.index) return
    reorderTasks(source.droppableId, source.index, destination.index)
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(false);
    const success = await login(username, password);
    if (!success) setLoginError(true);
    setIsLoggingIn(false);
  }

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-paramo-board border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-6 animate-fadeIn">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="h-12 w-12 bg-paramo-card rounded-full flex items-center justify-center border border-white/5 shadow-inner">
              <Lock className="text-paramo-frailejon" size={24} />
            </div>
            <h1 className="text-2xl font-bold italic tracking-tight text-white/90">Restricted Access</h1>
          </div>
          
          {loginError && <p className="text-red-400 text-xs text-center font-bold bg-red-900/30 py-2 rounded">Invalid credentials.</p>}
          
          <input 
            type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required
            className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
          />
          <input 
            type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
          />
          
          <button disabled={isLoggingIn} className="bg-paramo-frailejon/10 text-paramo-frailejon border border-paramo-frailejon/30 font-bold tracking-widest uppercase text-xs p-3 rounded-lg hover:bg-paramo-frailejon/20 transition-all mt-2 flex justify-center">
            {isLoggingIn ? 'Authenticating...' : 'Enter Hub'}
          </button>
        </form>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen h-full font-sans selection:bg-paramo-frailejon/30 flex flex-col pb-24 md:pb-0">
      {showReviewModal && <DailyReviewModal />}
      <NotificationToast />
      <ReminderEngine />
      <ReminderPanel isOpen={isReminderPanelOpen} onClose={() => setIsReminderPanelOpen(false)} />
      
      <header className="p-4 md:p-6 mb-4 md:mb-8 flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-paramo-text tracking-tight italic">
            {greeting}, <span className="text-paramo-frailejon">Jaime</span>
          </h1>
          <p className="text-paramo-muted mt-2 text-xs md:text-sm uppercase tracking-widest">
            Habit Tracker • {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReminderPanelOpen(true)}
            title="Recordatorios"
            className="text-paramo-muted hover:text-white bg-paramo-board p-2 rounded-lg border border-white/5 transition-colors flex items-center gap-2"
          >
            <FingerRibbonIcon size={20} />
          </button>          
          <button onClick={logout} title="Logout" className="text-paramo-muted hover:text-white bg-paramo-board p-2 rounded-lg border border-white/5 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 flex gap-0 md:gap-6 overflow-x-hidden md:overflow-x-auto items-start w-full px-4 md:px-6 pb-10">
          {columns.map(column => (
            <Column key={column.id} column={column} isActiveOnMobile={activeMobileColumn === column.id} />
          ))}
        </div>
      </DragDropContext>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-paramo-board border-t border-white/5 px-2 py-3 flex justify-around items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {columns.map(col => (
          <button 
            key={col.id} onClick={() => setActiveMobileColumn(col.id)}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${activeMobileColumn === col.id ? 'text-paramo-frailejon scale-105' : 'text-paramo-muted hover:text-white/70'}`}
          >
            <span className="text-[10px] font-black tracking-widest uppercase">{col.title}</span>
            <div className={`h-1 w-1 rounded-full ${activeMobileColumn === col.id ? 'bg-paramo-frailejon' : 'bg-transparent'}`}></div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default App