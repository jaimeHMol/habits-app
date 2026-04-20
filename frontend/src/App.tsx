import React, { useState, useEffect } from 'react'
import { useHabitStore } from './store/useHabitStore'
import { useReminderStore } from './store/useReminderStore'
import { translations } from './i18n/translations'
import { DragDropContext } from '@hello-pangea/dnd'
import { Column } from './components/Column'
import { PeriodicReviewModal } from './components/PeriodicReviewModal'
import { ReminderEngine } from './components/ReminderEngine'
import { ReminderPanel } from './components/ReminderPanel'
import { NotificationToast } from './components/NotificationToast'
import { LogOut, Lock, UserPlus, Copy, Check, Globe } from 'lucide-react'

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

const getGreetingKey = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

function App() {
  const { 
    columns, reorderTasks, fetchTasks, isAuthenticated, user, 
    login, register, logout, fetchUserProfile, language, setLanguage,
    showReviewModal, checkDayChange, activeTimer, tickTimer, generateInvite 
  } = useHabitStore()
  
  const { fetchReminders } = useReminderStore()
  
  const [activeMobileColumn, setActiveMobileColumn] = useState('daily')
  const [authMode, setAuthMode] = useState('login') 
  
  // Auth Form State
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  
  const [authError, setAuthError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isReminderPanelOpen, setIsReminderPanelOpen] = useState(false)
  
  // Admin State
  const [generatedInvite, setGeneratedInvite] = useState('')
  const [copied, setCopied] = useState(false)

  const t = translations[language] || translations.en;
  const greeting = t[getGreetingKey()];

  // Initial and Automatic Refresh Logic
  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshData = () => {
      console.log("🔄 Syncing data with server...");
      if (!user) fetchUserProfile();
      fetchTasks().then(() => {
        checkDayChange();
      });
      fetchReminders();
    };

    refreshData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshData);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshData);
    };
  }, [fetchTasks, fetchReminders, isAuthenticated, checkDayChange, user, fetchUserProfile]);

  // Timer loop for Focus Mode
  useEffect(() => {
    let interval;
    if (isAuthenticated && activeTimer.taskId) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAuthenticated, activeTimer.taskId, tickTimer]);

  const onDragEnd = (result) => {
    const { source, destination } = result
    if (!destination || source.droppableId !== destination.droppableId || source.index === destination.index) return
    reorderTasks(source.droppableId, source.index, destination.index)
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setAuthError('');
    const success = await login(username, password);
    if (!success) setAuthError(t.auth_failed);
    setIsProcessing(false);
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setAuthError('');
    const result = await register({ fullName, username, password, invitationCode });
    if (result.success) {
      setAuthMode('login');
      setAuthError('');
    } else {
      setAuthError(result.message || t.reg_failed);
    }
    setIsProcessing(false);
  }

  const handleGenerateInvite = async () => {
    const code = await generateInvite();
    if (code) {
      setGeneratedInvite(code);
      setCopied(false);
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedInvite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // --- AUTH SCREEN (Login or Register) ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-paramo-board border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-6 animate-fadeIn relative">
          {/* Language Toggle in Login Screen */}
          <button 
            onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
            className="absolute top-4 right-4 text-paramo-muted hover:text-white flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors"
          >
            <Globe size={12} />
            {language === 'en' ? 'ES' : 'EN'}
          </button>

          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="h-12 w-12 bg-paramo-card rounded-full flex items-center justify-center border border-white/5 shadow-inner">
              <Lock className="text-paramo-frailejon" size={24} />
            </div>
            <h1 className="text-2xl font-bold italic tracking-tight text-white/90">
              {authMode === 'login' ? t.login_title : t.register_title}
            </h1>
          </div>
          
          {authError && <p className="text-red-400 text-xs text-center font-bold bg-red-900/30 py-2 rounded">{authError}</p>}
          
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input 
                type="text" placeholder={t.username} value={username} onChange={(e) => setUsername(e.target.value)} required
                className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
              />
              <input 
                type="password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} required
                className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
              />
              <button disabled={isProcessing} className="bg-paramo-frailejon/10 text-paramo-frailejon border border-paramo-frailejon/30 font-bold tracking-widest uppercase text-xs p-3 rounded-lg hover:bg-paramo-frailejon/20 transition-all mt-2 flex justify-center">
                {isProcessing ? '...' : t.enter_btn}
              </button>
              <button 
                type="button" onClick={() => setAuthMode('register')}
                className="text-[10px] text-paramo-muted hover:text-white font-black tracking-tighter text-center mt-2"
              >
                {t.have_invite}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <input 
                type="text" placeholder={t.full_name} value={fullName} onChange={(e) => setFullName(e.target.value)} required
                className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
              />
              <input 
                type="text" placeholder={t.username} value={username} onChange={(e) => setUsername(e.target.value)} required
                className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
              />
              <input 
                type="password" placeholder={t.password} value={password} onChange={(e) => setPassword(e.target.value)} required
                className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
              />
              <input 
                type="text" placeholder={t.invitation_code} value={invitationCode} onChange={(e) => setInvitationCode(e.target.value)} required
                className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-paramo-muted focus:outline-none focus:border-paramo-frailejon transition-colors"
              />
              <button disabled={isProcessing} className="bg-paramo-frailejon/10 text-paramo-frailejon border border-paramo-frailejon/30 font-bold tracking-widest uppercase text-xs p-3 rounded-lg hover:bg-paramo-frailejon/20 transition-all mt-2 flex justify-center">
                {isProcessing ? '...' : t.register_btn}
              </button>
              <button 
                type="button" onClick={() => setAuthMode('login')}
                className="text-[10px] text-paramo-muted hover:text-white font-black tracking-tighter text-center mt-2"
              >
                {t.back_to_login}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen font-sans selection:bg-paramo-frailejon/30 flex flex-col pb-24 md:pb-6">
      {showReviewModal && <PeriodicReviewModal />}
      <NotificationToast />
      <ReminderEngine />
      <ReminderPanel isOpen={isReminderPanelOpen} onClose={() => setIsReminderPanelOpen(false)} />
      
      <header className="p-4 md:p-6 mb-1 md:mb-2 flex flex-col gap-2">
        <div className="w-full">
          <h1 className="text-3xl md:text-4xl font-bold text-paramo-text tracking-tight italic truncate">
            {greeting}, <span className="text-paramo-frailejon">{(user?.full_name || user?.fullName || 'User').split(' ')[0]}</span>
          </h1>
        </div>
        
        <div className="flex justify-between items-center w-full">
          <p className="text-paramo-muted text-[10px] md:text-sm uppercase tracking-widest">
            {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button 
              onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
              className="text-paramo-muted hover:text-white bg-paramo-board px-2.5 py-2 rounded-lg border border-white/5 transition-colors text-[10px] font-black tracking-widest flex items-center gap-2"
              title="Change Language"
            >
              <Globe size={16} />
              <span className="hidden sm:inline">{language === 'en' ? 'ES' : 'EN'}</span>
            </button>

            {user?.role === 'admin' && (
              <div className="relative group">
                <button
                  onClick={handleGenerateInvite}
                  title="Generate Invitation"
                  className="text-paramo-muted hover:text-white bg-paramo-board p-2 rounded-lg border border-white/5 transition-colors"
                >
                  <UserPlus size={18} />
                </button>
                
                {generatedInvite && (
                  <div className="absolute top-full right-0 mt-2 bg-paramo-card border border-white/10 p-3 rounded-xl shadow-2xl w-48 z-[200] animate-fadeIn">
                    <p className="text-[10px] font-black uppercase text-paramo-muted mb-2 tracking-widest">{t.invitation_code}</p>
                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/5 mb-2">
                      <span className="text-xs font-mono text-white flex-1">{generatedInvite}</span>
                      <button onClick={copyToClipboard} className="text-paramo-muted hover:text-white">
                        {copied ? <Check size={14} className="text-paramo-frailejon" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <button 
                      onClick={() => setGeneratedInvite('')}
                      className="w-full text-[10px] uppercase font-bold text-paramo-muted hover:text-white pt-1"
                    >
                      {t.close}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsReminderPanelOpen(true)}
              title={t.reminders_title}
              className="text-paramo-muted hover:text-white bg-paramo-board p-2 rounded-lg border border-white/5 transition-colors flex items-center gap-2"
            >
              <FingerRibbonIcon size={20} />
            </button>          
            <button onClick={logout} title="Logout" className="text-paramo-muted hover:text-white bg-paramo-board p-2 rounded-lg border border-white/5 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-0 md:gap-6 overflow-x-hidden md:overflow-x-auto items-start w-full px-4 md:px-6 pb-10">
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
            <span className="text-[10px] font-black tracking-widest uppercase">{t[col.id]}</span>
            <div className={`h-1 w-1 rounded-full ${activeMobileColumn === col.id ? 'bg-paramo-frailejon' : 'bg-transparent'}`}></div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
