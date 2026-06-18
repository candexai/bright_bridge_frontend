import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Loader2, Play, Pause, Headphones, Download } from 'lucide-react';

type SeekableAudioPlayerProps = {
  src: string;
  compact?: boolean;
};

function formatTime(time: number) {
  if (!Number.isFinite(time) || time < 0) return '0:00';
  const min = Math.floor(time / 60);
  const sec = Math.floor(time % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function SeekableAudioPlayer({ src, compact = false }: SeekableAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(false);
    setLoading(true);
    isScrubbingRef.current = false;
  }, [src]);

  const seekToClientX = useCallback((clientX: number) => {
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar || error) return;

    const dur = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : duration;
    if (!dur || dur <= 0) return;

    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
    const nextTime = pct * dur;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [duration, error]);

  useEffect(() => {
    const stopScrubbing = () => {
      isScrubbingRef.current = false;
    };
    window.addEventListener('pointerup', stopScrubbing);
    window.addEventListener('pointercancel', stopScrubbing);
    return () => {
      window.removeEventListener('pointerup', stopScrubbing);
      window.removeEventListener('pointercancel', stopScrubbing);
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || error) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (error) return;
    isScrubbingRef.current = true;
    seekToClientX(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    seekToClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    e.stopPropagation();
    isScrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const canSeek = !error && duration > 0;

  const progressBar = (
    <div
      ref={progressBarRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        e.stopPropagation();
        if (!isScrubbingRef.current) seekToClientX(e.clientX);
      }}
      className={`relative rounded-full bg-slate-200 ${compact ? 'h-1.5' : 'h-2'} ${canSeek ? 'cursor-pointer' : 'cursor-default'} select-none touch-none`}
      role="slider"
      aria-label="Seek audio"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.floor(duration))}
      aria-valuenow={Math.max(0, Math.floor(currentTime))}
      aria-disabled={!canSeek}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-blue-500 pointer-events-none"
        style={{ width: `${progressPercentage}%` }}
      />
      {canSeek && (
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-blue-600 border-2 border-white shadow pointer-events-none"
          style={{ left: `calc(${progressPercentage}% - 7px)` }}
        />
      )}
    </div>
  );

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 ${error ? 'opacity-60' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <audio
          ref={audioRef}
          src={src}
          preload="auto"
          hidden
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
              setLoading(false);
            }
          }}
          onDurationChange={() => {
            if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
              setDuration(audioRef.current.duration);
              setLoading(false);
            }
          }}
          onCanPlay={() => setLoading(false)}
          onSeeked={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
          onError={() => { setError(true); setLoading(false); }}
          onEnded={() => setIsPlaying(false)}
        />
        <button
          type="button"
          onClick={togglePlay}
          disabled={error || loading}
          className={`w-7 h-7 flex items-center justify-center rounded-md shrink-0 transition-all ${error ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          {error ? (
            <p className="text-[10px] text-red-500 italic font-medium">Recording unavailable</p>
          ) : (
            <>
              <div className="py-2">{progressBar}</div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 -mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-50 border border-slate-200 rounded-xl p-3 w-full ${error ? 'opacity-75' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        hidden
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            setLoading(false);
          }
        }}
        onDurationChange={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
            setLoading(false);
          }
        }}
        onCanPlay={() => setLoading(false)}
        onSeeked={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onError={() => { setError(true); setLoading(false); }}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={error || loading}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shrink-0 ${error ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {error ? (
            <div className="h-6 flex items-center justify-center text-[10px] font-semibold text-red-500 bg-red-50 rounded italic">
              Recording unavailable or still processing
            </div>
          ) : (
            <>
              <div className="py-2">{progressBar}</div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] font-bold text-slate-400">{formatTime(currentTime)}</span>
                <span className="text-[10px] font-bold text-slate-400">{formatTime(duration)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Headphones className="w-3 h-3" />
          <span className="text-[8px] font-bold uppercase tracking-wider">
            {error ? 'Error loading audio' : 'Recording Console'}
          </span>
        </div>
        {!error && !loading && (
          <a href={src} download onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-blue-600">
            <Download className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
