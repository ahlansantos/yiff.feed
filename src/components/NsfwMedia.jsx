"use client";

import { useState } from "react";

export default function NsfwMedia({ isNsfw, children, className = "", onReveal }) {
  const [revealed, setRevealed] = useState(false);

  if (!isNsfw) return children;

  if (revealed) {
    return (
      <div className={`relative ${className}`}>
        {children}
        <button
          onClick={() => setRevealed(false)}
          className="absolute top-2 left-2 z-10 text-xs px-2 py-1 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
        >
          Hide 18+
        </button>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="blur-2xl scale-110 pointer-events-none select-none">{children}</div>
      <button
        onClick={() => {
          setRevealed(true);
          onReveal?.();
        }}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-sm cursor-pointer hover:bg-black/50 transition-colors z-10"
      >
        <span className="text-sm font-semibold text-white px-3 py-1 rounded-full border border-white/40">
          18+
        </span>
        <span className="text-sm text-white/90 font-medium">Tap to reveal</span>
      </button>
    </div>
  );
}
