import React, { useState } from 'react';
import { Film, Music2, Video } from 'lucide-react';
import type { Platform } from '../lib/mediaUtils';

export const PlatformGlyph: React.FC<{ platform: Platform; className?: string }> = ({
  platform,
  className = 'w-4 h-4',
}) => {
  if (platform === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M23.5 6.2a3.01 3.01 0 0 0-2.12-2.13C19.5 3.56 12 3.56 12 3.56s-7.5 0-9.38.51A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.12 2.13c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.01 3.01 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.57V8.43L15.82 12 9.6 15.57Z" />
      </svg>
    );
  }

  if (platform === 'spotify') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0Zm5.5 17.31a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.15a.75.75 0 0 1-.33-1.46c4.57-1.05 8.49-.6 11.66 1.33.36.22.47.68.25 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.15-2.56-11.97-1.4a.94.94 0 0 1-.55-1.79c4.36-1.32 9.78-.68 13.5 1.6a.94.94 0 0 1 .31 1.28Zm.13-3.41c-3.87-2.3-10.26-2.51-13.95-1.39a1.12 1.12 0 1 1-.65-2.15c4.24-1.29 11.29-1.04 15.75 1.61a1.12 1.12 0 0 1-1.15 1.93Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
};

export const MediaThumbnail: React.FC<{
  src?: string;
  alt: string;
  platform: Platform;
  className?: string;
}> = ({ src, alt, platform, className = 'w-20 h-20 rounded-xl' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80`}
        aria-label={alt}
      >
        {platform === 'spotify' ? (
          <Music2 className="w-6 h-6" />
        ) : platform === 'instagram' ? (
          <Film className="w-6 h-6" />
        ) : (
          <Video className="w-6 h-6" />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80`}
    />
  );
};
