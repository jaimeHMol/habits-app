import React from 'react'

export const LoadingSkeleton = () => {
  return (
    <div className="space-y-3 md:space-y-4 animate-pulse">
      {/* Render 3 placeholder cards to simulate the loading state */}
      {[1, 2, 3].map((i) => (
        <div 
          key={i} 
          className="h-20 bg-paramo-card/50 rounded-xl border border-white/5 w-full flex items-start p-3 md:p-4 gap-3"
        >
          {/* Checkbox placeholder */}
          <div className="h-5 w-5 rounded-full bg-white/10 flex-shrink-0 mt-0.5"></div>
          
          <div className="flex-1 space-y-2">
            {/* Title placeholder */}
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
            {/* Subtitle/Description placeholder */}
            <div className="h-3 bg-white/5 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  )
}