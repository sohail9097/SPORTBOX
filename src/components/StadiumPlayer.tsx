import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Settings, FastForward, Radio, WifiOff } from 'lucide-react';
import { cn, sanitizeVideoUrlOrIframe, getEmbedUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import LivestreamFallbackScreen from './LivestreamFallbackScreen';

interface StadiumPlayerProps {
  url: string;
  poster?: string;
  isLive?: boolean;
  useIframe?: boolean;
}

const config = {
  useCustomPlayer: true,
  autoplay: true,
  muted: false,
  loop: false,
  showControls: true,
  primaryColor: '#e11d48',
  playbackRates: [0.5, 1, 1.25, 1.5, 2]
};

export default function StadiumPlayer({ url, poster, isLive, useIframe: initialUseIframe }: StadiumPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [useIframe, setUseIframe] = useState(initialUseIframe);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<'error' | 'buffering' | 'offline' | 'timeout' | 'network'>('buffering');
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isChangingState, setIsChangingState] = useState(false);
  const [doubleTapRipple, setDoubleTapRipple] = useState<{ side: 'left' | 'right'; id: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // Monitor network online/offline state
  useEffect(() => {
    const handleOffline = () => {
      setFallbackReason('offline');
      setShowFallback(true);
    };
    const handleOnline = () => {
      toast.info("Network reconnected. Restoring stream...");
      handleAutoReconnect();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [url]);

  useEffect(() => {
    if (!videoRef.current) return;

    // Reset fallback state on URL change
    setShowFallback(false);
    setHasError(false);

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered', 'vjs-stadium-theme');
    videoElement.setAttribute('crossorigin', 'anonymous');
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('x5-playsinline', 'true');
    videoRef.current.appendChild(videoElement);

    const player = playerRef.current = videojs(videoElement, {
      autoplay: false, // programmatic play on ready to prevent unhandled rejections
      muted: config.muted,
      loop: config.loop,
      controls: false, // We'll build custom controls
      responsive: true,
      fluid: true,
      errorDisplay: false, // Suppress raw VideoJS modal dialogs in favor of custom LivestreamFallbackScreen
      html5: {
        vhs: {
          overrideNative: true
        }
      },
      sources: [{
        src: url,
        type: url.includes('m3u8') ? 'application/x-mpegURL' : (url.includes('drive.google.com') || url.includes('mp4')) ? 'video/mp4' : 'video/mp4'
      }]
    });

    // 8-second initial load timeout
    loadTimerRef.current = setTimeout(() => {
      if (!player.duration() && player.paused() && !player.currentTime()) {
        console.warn("[StadiumPlayer] Load timeout reached. Triggering livestream fallback screen.");
        setFallbackReason('timeout');
        setShowFallback(true);
      }
    }, 8000);

    const clearTimers = () => {
      if (bufferTimerRef.current) {
        clearTimeout(bufferTimerRef.current);
        bufferTimerRef.current = null;
      }
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };

    player.ready(() => {
      if (config.autoplay) {
        const playPromise = player.play();
        if (playPromise !== undefined) {
          playPromise.catch((e: any) => {
            console.log("StadiumPlayer autoplay interaction handled safely or aborted:", e);
          });
        }
      }
    });

    player.on('play', () => {
      setIsPlaying(true);
      clearTimers();
      setShowFallback(false);
    });
    player.on('playing', () => {
      setIsPlaying(true);
      clearTimers();
      setShowFallback(false);
    });
    player.on('canplay', () => {
      clearTimers();
    });
    player.on('pause', () => setIsPlaying(false));
    player.on('timeupdate', () => {
      setCurrentTime(player.currentTime());
      if (player.currentTime() > 0) {
        clearTimers();
        setShowFallback(false);
      }
    });
    player.on('loadedmetadata', () => {
      setDuration(player.duration());
      setHasError(false);
      clearTimers();
    });

    // Trigger fallback screen if stream stalls or buffers for > 6 seconds
    const startBufferTimer = () => {
      if (bufferTimerRef.current) return;
      bufferTimerRef.current = setTimeout(() => {
        console.warn("[StadiumPlayer] Stream stall/buffering timeout (>6s). Activating fallback screen.");
        setFallbackReason('buffering');
        setShowFallback(true);
      }, 6000);
    };

    player.on('waiting', startBufferTimer);
    player.on('stalled', startBufferTimer);

    player.on('error', () => {
      const error = player.error();
      console.warn("StadiumPlayer videojs issue handled:", error ? `[Code ${error.code}] ${error.message}` : "Source not supported");
      clearTimers();
      setHasError(true);

      // If code 4 (MEDIA_ERR_SRC_NOT_SUPPORTED) or source format error, check if we can switch to iframe embed mode automatically
      if (error && (error.code === 4 || error.code === 2) && !useIframe) {
        setUseIframe(true);
      }

      setFallbackReason('error');
      setShowFallback(true);
    });

    player.on('volumechange', () => {
      setVolume(player.volume());
      setIsMuted(player.muted());
    });
    player.on('ratechange', () => {
      setPlaybackRate(player.playbackRate());
    });

    return () => {
      clearTimers();
      if (player) {
        player.dispose();
      }
    };
  }, [url]);

  const handleAutoReconnect = async () => {
    if (!playerRef.current) return;
    try {
      playerRef.current.src({
        src: url,
        type: url.includes('m3u8') ? 'application/x-mpegURL' : (url.includes('drive.google.com') || url.includes('mp4')) ? 'video/mp4' : 'video/mp4'
      });
      playerRef.current.load();
      const playPromise = playerRef.current.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      setShowFallback(false);
    } catch (err) {
      console.log("[StadiumPlayer] Auto reconnect attempt error:", err);
    }
  };

  const togglePlay = async () => {
    if (!playerRef.current || isChangingState) return;
    
    setIsChangingState(true);
    try {
      if (playerRef.current.paused()) {
        const playPromise = playerRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } else {
        playerRef.current.pause();
      }
    } catch (err) {
      console.warn("Playback interaction handled:", err);
    } finally {
      setIsChangingState(false);
    }
  };

  const seek = (amount: number) => {
    playerRef.current.currentTime(playerRef.current.currentTime() + amount);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    playerRef.current.volume(val);
    if (val === 0) playerRef.current.muted(true);
    else playerRef.current.muted(false);
  };

  const toggleMute = () => {
    playerRef.current.muted(!playerRef.current.muted());
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const changePlaybackRate = (rate: number) => {
    playerRef.current.playbackRate(rate);
  };

  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const now = Date.now();
    const timeDiff = now - lastTapRef.current.time;

    if (timeDiff < 320 && Math.abs(clickX - lastTapRef.current.x) < 120) {
      // Double tap seek
      if (clickX < rect.width * 0.4) {
        seek(-10);
        setDoubleTapRipple({ side: 'left', id: now });
        setTimeout(() => setDoubleTapRipple(null), 700);
      } else if (clickX > rect.width * 0.6) {
        seek(10);
        setDoubleTapRipple({ side: 'right', id: now });
        setTimeout(() => setDoubleTapRipple(null), 700);
      } else {
        togglePlay();
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clickX };
      setShowControls((prev) => !prev);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3500);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isGDrive = url.includes('drive.google.com') || url.includes('id=');
  const driveId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  const isIframeUrl = 
    url.includes('cloudflarestream.com') || 
    url.endsWith('/iframe') || 
    useIframe ||
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('youtube-nocookie.com') ||
    url.includes('vimeo.com') ||
    url.includes('twitch.tv') ||
    url.includes('facebook.com/plugins/video.php') ||
    url.includes('iframe.dacast.com') ||
    url.trim().startsWith('<iframe') ||
    url.trim().startsWith('<');

  if ((isGDrive && driveId) || isIframeUrl) {
    const iframeSrc = isGDrive ? `https://drive.google.com/file/d/${driveId}/preview` : sanitizeVideoUrlOrIframe(getEmbedUrl(url));
    if (!iframeSrc) return null;
    return (
      <div className="relative w-full h-full aspect-video bg-black group rounded-none md:rounded-xl overflow-hidden border-0 md:border md:border-white/10 shadow-2xl">
        {isGDrive ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
            <iframe 
              src={iframeSrc}
              className="absolute -top-[48px] sm:-top-[52px] left-0 w-full h-[calc(100%+52px)] sm:h-[calc(100%+56px)] border-0 pointer-events-auto"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <iframe 
            src={iframeSrc}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          ></iframe>
        )}

        {/* Livestream Fallback Screen Overlay for Iframe Streams */}
        <AnimatePresence>
          {showFallback && (
            <LivestreamFallbackScreen
              reason={fallbackReason}
              onManualRetry={() => setShowFallback(false)}
              onAutoRetry={async () => setShowFallback(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full bg-black group overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={handleScreenClick}
    >
      <div ref={videoRef} className="w-full h-full cursor-pointer" />

      {/* Double Tap Seek Feedback Ripple Overlay */}
      <AnimatePresence>
        {doubleTapRipple && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center bg-black/75 backdrop-blur-md text-white rounded-full p-4 sm:p-6 border border-white/20 shadow-2xl",
              doubleTapRipple.side === 'left' ? 'left-6 sm:left-16' : 'right-6 sm:right-16'
            )}
          >
            {doubleTapRipple.side === 'left' ? (
              <>
                <RotateCcw className="w-7 h-7 sm:w-9 sm:h-9 text-brand" />
                <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase mt-1">-10 SEC</span>
              </>
            ) : (
              <>
                <RotateCw className="w-7 h-7 sm:w-9 sm:h-9 text-brand" />
                <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase mt-1">+10 SEC</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Livestream Fallback Screen Overlay */}
      <AnimatePresence>
        {showFallback && (
          <LivestreamFallbackScreen
            reason={fallbackReason}
            onManualRetry={handleAutoReconnect}
            onAutoRetry={handleAutoReconnect}
          />
        )}
      </AnimatePresence>

      {/* Cinematic Overlays */}
      <AnimatePresence>
        {showControls && config.showControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 pointer-events-none"
          >
            {/* Top Gradient */}
            <div className="absolute top-0 inset-x-0 h-28 md:h-32 bg-gradient-to-b from-black/80 to-transparent" />
            
            {/* Bottom Gradient */}
            <div className="absolute bottom-0 inset-x-0 h-40 md:h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Centered Play/Pause Overlay */}
            <div 
              className="absolute inset-0 flex items-center justify-center pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
            >
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white/15 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-2xl active:scale-90"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 fill-current" />
                ) : (
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 fill-current ml-1" />
                )}
              </motion.button>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 inset-x-0 p-3 sm:p-6 md:p-8 space-y-2 md:space-y-4 pointer-events-auto">
              {/* Touch-optimized Progress Bar */}
              {!isLive && (
                <div className="group/progress relative h-2.5 sm:h-2 w-full bg-white/25 rounded-full cursor-pointer overflow-hidden mb-2 touch-none select-none">
                  <div 
                    className="absolute top-0 left-0 h-full transition-all duration-75 rounded-full"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%`, backgroundColor: config.primaryColor }}
                  />
                  <input 
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => {
                      e.stopPropagation();
                      playerRef.current?.currentTime(parseFloat(e.target.value));
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }} 
                    className="p-1.5 text-white hover:text-brand transition-colors active:scale-90"
                    aria-label="Play/Pause"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />}
                  </button>
                  
                  {!isLive && (
                    <div className="flex items-center gap-2 sm:gap-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          seek(-10);
                        }} 
                        className="p-1.5 text-white/80 hover:text-white transition-colors active:scale-90"
                        aria-label="Rewind 10s"
                      >
                        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          seek(10);
                        }} 
                        className="p-1.5 text-white/80 hover:text-white transition-colors active:scale-90"
                        aria-label="Forward 10s"
                      >
                        <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 sm:gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }} 
                      className="p-1.5 text-white/80 hover:text-white active:scale-90"
                      aria-label="Mute/Unmute"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <input 
                      type="range" 
                      min={0} 
                      max={1} 
                      step={0.1} 
                      value={volume} 
                      onChange={handleVolumeChange}
                      className="w-20 hidden md:block"
                    />
                  </div>

                  <div className="text-[10px] sm:text-xs font-bold font-mono tracking-wider">
                    {isLive ? (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                           <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                           <span className="text-red-600 uppercase italic">Live</span>
                        </div>
                    ) : (
                        <span className="text-white/90">
                           {formatTime(currentTime)} <span className="text-white/40">/ {formatTime(duration)}</span>
                        </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
                  {/* Quality Control */}
                  <div className="relative group/quality">
                     <button 
                      onClick={(e) => e.stopPropagation()}
                      className="text-white/80 hover:text-white transition-colors text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-1.5 py-1 sm:px-2 bg-white/10 rounded flex items-center gap-1 sm:gap-2"
                     >
                        <Settings className="w-3 h-3" />
                        <span className="hidden sm:inline">Quality</span>
                     </button>
                     <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-xl border border-white/15 rounded-md overflow-hidden hidden group-hover/quality:block min-w-[120px] shadow-2xl z-30">
                        {['Auto', '1080p (HQ)', '720p', '480p', 'Data Saver'].map(quality => (
                           <button 
                               key={quality} 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 toast.info(`Quality changed to ${quality} (Simulated)`);
                               }}
                               className={cn(
                                 "w-full px-3 py-2.5 text-[10px] font-bold hover:bg-brand/20 transition-colors text-left border-b border-white/5 last:border-0",
                                 quality === 'Auto' ? "text-brand" : "text-white/70"
                               )}
                           >
                              {quality}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Playback Rate */}
                  <div className="relative group/rate">
                     <button 
                      onClick={(e) => e.stopPropagation()}
                      className="text-white/80 hover:text-white transition-colors text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-1.5 py-1 sm:px-2 bg-white/10 rounded"
                     >
                        {playbackRate}x
                     </button>
                     <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-xl border border-white/15 rounded-md overflow-hidden hidden group-hover/rate:block min-w-[80px] shadow-2xl z-30">
                        {config.playbackRates.map(rate => (
                           <button 
                              key={rate} 
                              onClick={(e) => {
                                e.stopPropagation();
                                changePlaybackRate(rate);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-[10px] font-bold hover:bg-white/10 transition-colors text-left",
                                playbackRate === rate ? "text-brand" : "text-white/70"
                              )}
                           >
                              {rate}x
                           </button>
                        ))}
                     </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }} 
                    className="p-1.5 text-white/80 hover:text-white transition-colors active:scale-90"
                    aria-label="Fullscreen"
                  >
                    <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quality Badge & Signal Test Trigger */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-20 flex items-center gap-1.5 sm:gap-2">
         <button
            type="button"
            onClick={() => {
              setFallbackReason('buffering');
              setShowFallback(true);
              toast.info("Simulating livestream signal drop...");
            }}
            title="Test Livestream Fallback Screen"
            className="hidden md:flex bg-red-500/10 hover:bg-red-500/20 backdrop-blur-md border border-red-500/30 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest text-red-400 transition-all cursor-pointer items-center gap-1.5 active:scale-95"
         >
            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
            <span>Test Fallback</span>
         </button>
         <div 
            className="backdrop-blur-md border px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest"
            style={{ backgroundColor: `${config.primaryColor}33`, borderColor: `${config.primaryColor}4d`, color: config.primaryColor }}
         >
            Ultra HD
         </div>
         <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest text-white/90 hidden sm:block">
            5.1 Audio
         </div>
      </div>
    </div>
  );
}
