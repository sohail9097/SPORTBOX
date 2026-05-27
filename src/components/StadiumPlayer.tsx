import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Settings, FastForward, Radio } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PlayerSettings } from '../types';

import { toast } from 'sonner';

interface StadiumPlayerProps {
  url: string;
  poster?: string;
  isLive?: boolean;
  useIframe?: boolean;
}

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
  const [config, setConfig] = useState<PlayerSettings>({
    useCustomPlayer: true,
    autoplay: true,
    muted: false,
    loop: false,
    showControls: true,
    primaryColor: '#ff0000',
    playbackRates: [0.5, 1, 1.5, 2]
  });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isChangingState, setIsChangingState] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'playerConfig'));
        if (snap.exists()) {
          setConfig(snap.data() as PlayerSettings);
        }
      } catch (err: any) {
        // Only log if it's not a common offline error
        if (!err.message?.includes('offline')) {
          console.warn("Player config could not be fetched (offline or permission issue):", err.message);
        }
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered', 'vjs-stadium-theme');
    videoElement.setAttribute('crossorigin', 'anonymous');
    videoRef.current.appendChild(videoElement);

    const player = playerRef.current = videojs(videoElement, {
      autoplay: false, // programmatic play on ready to prevent unhandled rejections
      muted: config.muted,
      loop: config.loop,
      controls: false, // We'll build custom controls
      responsive: true,
      fluid: true,
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

    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('timeupdate', () => setCurrentTime(player.currentTime()));
    player.on('loadedmetadata', () => {
      setDuration(player.duration());
      setHasError(false);
    });
    player.on('error', () => {
      const error = player.error();
      console.warn("Player technical issue:", error ? error.message : "Source not supported");
      setHasError(true);
    });
    player.on('volumechange', () => {
      setVolume(player.volume());
      setIsMuted(player.muted());
    });
    player.on('ratechange', () => {
      setPlaybackRate(player.playbackRate());
    });

    return () => {
      if (player) {
        player.dispose();
      }
    };
  }, [url, config]);

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
  const isIframeUrl = url.includes('cloudflarestream.com') || url.endsWith('/iframe') || useIframe;

  if ((isGDrive && driveId) || isIframeUrl) {
    const iframeSrc = isGDrive ? `https://drive.google.com/file/d/${driveId}/preview` : url;
    if (!iframeSrc) return null;
    return (
      <div className="relative w-full aspect-video bg-black group rounded-xl overflow-hidden border border-white/10 shadow-2xl">
        <iframe 
          src={iframeSrc}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full bg-black group overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div ref={videoRef} className="w-full h-full" onClick={togglePlay} />

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
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
            
            {/* Bottom Gradient */}
            <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Centered Play Button (Jio Hotstar Style) */}
            {!isPlaying && (
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-auto"
                onClick={togglePlay}
              >
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-20 h-20 md:w-24 md:h-24 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white transition-all duration-300"
                >
                  <Play className="w-10 h-10 md:w-12 md:h-12 fill-current ml-2" />
                </motion.button>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-0 inset-x-0 p-6 md:p-8 space-y-4 pointer-events-auto">
              {/* Progress Bar */}
              {!isLive && (
                <div className="group/progress relative h-1.5 w-full bg-white/20 rounded-full cursor-pointer overflow-hidden mb-2">
                  <div 
                    className="absolute top-0 left-0 h-full transition-all duration-100"
                    style={{ width: `${(currentTime / duration) * 100}%`, backgroundColor: config.primaryColor }}
                  />
                  <input 
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => playerRef.current.currentTime(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button onClick={togglePlay} className="text-white hover:text-brand transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>
                  
                  {!isLive && (
                    <div className="flex items-center gap-4">
                      <button onClick={() => seek(-10)} className="text-white/70 hover:text-white transition-colors">
                        <RotateCcw className="w-5 h-5" />
                      </button>
                      <button onClick={() => seek(10)} className="text-white/70 hover:text-white transition-colors">
                        <RotateCw className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button onClick={toggleMute} className="text-white/70 hover:text-white">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
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

                  <div className="text-xs font-bold font-mono tracking-wider">
                    {isLive ? (
                        <div className="flex items-center gap-2">
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

                <div className="flex items-center gap-6">
                  {/* Quality Control */}
                  <div className="relative group/quality">
                     <button className="text-white/70 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white/5 rounded-sm flex items-center gap-2">
                        <Settings className="w-3 h-3" />
                        Quality
                     </button>
                     <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-md overflow-hidden hidden group-hover/quality:block min-w-[120px]">
                        {['Auto', '1080p (HQ)', '720p', '480p', 'Data Saver'].map(quality => (
                           <button 
                               key={quality} 
                               onClick={() => toast.info(`Quality changed to ${quality} (Simulated)`)}
                               className={cn(
                                 "w-full px-4 py-3 text-[10px] font-bold hover:bg-brand/20 transition-colors text-left border-b border-white/5 last:border-0",
                                 quality === 'Auto' ? "text-brand" : "text-white/60"
                               )}
                           >
                              {quality}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Playback Rate */}
                  <div className="relative group/rate">
                     <button className="text-white/70 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white/5 rounded-sm">
                        {playbackRate}x
                     </button>
                     <div className="absolute bottom-full mb-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-md overflow-hidden hidden group-hover/rate:block min-w-[80px]">
                        {config.playbackRates.map(rate => (
                           <button 
                              key={rate} 
                              onClick={() => changePlaybackRate(rate)}
                              className={cn(
                                "w-full px-4 py-2 text-[10px] font-bold hover:bg-white/10 transition-colors text-left",
                                playbackRate === rate ? "text-brand" : "text-white/60"
                              )}
                           >
                              {rate}x
                           </button>
                        ))}
                     </div>
                  </div>

                  <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors">
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quality Badge (Optional Jio Hotstar Feel) */}
      <div className="absolute top-8 right-8 z-20 flex gap-2">
         <div 
            className="backdrop-blur-md border px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest"
            style={{ backgroundColor: `${config.primaryColor}33`, borderColor: `${config.primaryColor}4d`, color: config.primaryColor }}
         >
            Ultra HD
         </div>
         <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest text-white/90">
            5.1 Audio
         </div>
      </div>
    </div>
  );
}
