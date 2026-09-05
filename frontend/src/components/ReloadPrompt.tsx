import React from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download } from 'lucide-react'
import { useHabitStore } from '../store/useHabitStore'
import { translations } from '../i18n/translations'

export function ReloadPrompt() {
  const { language } = useHabitStore()
  const t = translations[language] || translations.en

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered', r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="fixed bottom-24 md:bottom-10 right-4 z-[200] bg-paramo-card border border-paramo-frailejon/30 shadow-2xl p-4 rounded-2xl flex items-center gap-4 animate-fadeIn max-w-sm">
      <div className="bg-paramo-frailejon/10 p-2 rounded-xl text-paramo-frailejon">
        <Download size={20} />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-bold text-white mb-0.5">
          {offlineReady ? t.pwa_ready : t.pwa_update}
        </h4>
        <p className="text-xs text-paramo-muted leading-tight">
          {offlineReady ? t.pwa_offline : t.pwa_refresh}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {needRefresh && (
          <button 
            onClick={() => updateServiceWorker(true)} 
            className="bg-paramo-frailejon text-paramo-bg px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-teal-400 transition-colors"
          >
            {t.pwa_update_btn}
          </button>
        )}
        <button 
          onClick={close} 
          className="text-[10px] text-paramo-muted hover:text-white uppercase font-bold text-center mt-1"
        >
          {t.close}
        </button>
      </div>
    </div>
  )
}
