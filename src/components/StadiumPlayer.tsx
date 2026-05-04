import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Settings, FastForward, Radio } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PlayerSettings } from '../types';

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
    autoplay: true,
    muted: false,
    loop: false,
    showControls: true,
    primaryColor: '#ff0000',
    playbackRates: [0.5, 1, 1.5, 2]
  });
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'playerConfig'));
        if (snap.exists()) {
          setConfig(snap.data() as PlayerSettings);
        }
      } catch (err) {
        console.error("Player config error:", err);
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
      autoplay: config.autoplay,
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

    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('timeupdate', () => setCurrentTime(player.currentTime()));
    player.on('loadedmetadata', () => {
      setDuration(player.duration());
      setHasError(false);
    });
    player.on('error', () => {
      console.error("Player error detected");
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

  const togglePlay = () => {
    if (playerRef.current.paused()) {
      playerRef.current.play();
    } else {
      playerRef.current.pause();
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

  if (useIframe && isGDrive && driveId) {
    return (
      <div className="relative w-full aspect-video bg-black group rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        <iframe 
          src={`https://drive.google.com/file/d/${driveId}/preview`}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
        <button 
          onClick={() => {
            setUseIframe(false);
            setHasError(false);
          }}
          className="absolute top-4 left-4 z-[60] bg-brand text-white px-4 py-2 rounded-full text-[10px] font-black uppercase italic tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          Switch to Advanced Player
        </button>
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

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-3xl p-8 text-center">
          <div className="w-20 h-20 bg-brand/20 text-brand rounded-full flex items-center justify-center mb-6 border border-brand/30 animate-pulse">
            <Radio className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-black uppercase italic tracking-widest mb-2">Connection Blocked</h3>
          <p className="text-sm text-text-muted mb-8 max-w-sm font-medium">
            Google Drive is restricting direct playback for this video. Use our embedded safe-player to watch.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-black uppercase italic tracking-widest transition-all"
            >
              Retry
            </button>
            {isGDrive && driveId && (
              <button 
                onClick={() => setUseIframe(true)}
                className="px-8 py-3 bg-brand text-white rounded-full text-xs font-black uppercase italic tracking-widest shadow-xl shadow-brand/20 hover:scale-105 active:scale-95 transition-all"
              >
                Safe Drive Mode
              </button>
            )}
          </div>
        </div>
      )}

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
                  {/* Playback Rate */}
                  <div className="relative group/rate">
                     <button className="text-white/70 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white/5 rounded">
                        {playbackRate}x
                     </button>
                     <div className="absolute bottom-full mb-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden hidden group-hover/rate:block min-w-[80px]">
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
            className="backdrop-blur-md border px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
            style={{ backgroundColor: `${config.primaryColor}33`, borderColor: `${config.primaryColor}4d`, color: config.primaryColor }}
         >
            Ultra HD
         </div>
         <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/90">
            5.1 Audio
         </div>
      </div>
    </div>
  );
}
