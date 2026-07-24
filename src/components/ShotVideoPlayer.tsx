import { useEffect, useRef, useState } from 'react';

interface ShotVideoPlayerProps {
  src: string;
  poster: string;
  isPlaying: boolean;
  isMuted: boolean;
  onClick: () => void;
  onError: () => void;
  onEnded: () => void;
  videoRef: (el: HTMLVideoElement | null) => void;
}

export default function ShotVideoPlayer({
  src,
  poster,
  isPlaying,
  isMuted,
  onClick,
  onError,
  onEnded,
  videoRef
}: ShotVideoPlayerProps) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    const video = localRef.current;
    if (!video) return;

    video.muted = isMuted;

    const syncPlayback = async () => {
      try {
        if (isPlaying) {
          if (video.paused) {
            const p = video.play();
            playPromiseRef.current = p;
            if (p !== undefined) {
              await p;
            }
          }
        } else {
          if (playPromiseRef.current) {
            try {
              await playPromiseRef.current;
            } catch (err) {
              // Ignore play rejections
            }
          }
          if (!video.paused) {
            video.pause();
          }
        }
      } catch (err) {
        console.log("[ShotVideoPlayer] Playback sync safe handled:", err);
      }
    };

    syncPlayback();
  }, [isPlaying, isMuted, src]);

  // Clean up and pause video when unmounting
  useEffect(() => {
    return () => {
      const video = localRef.current;
      if (video) {
        try {
          video.pause();
        } catch (e) {
          // Ignore pause errors on unmount
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden cursor-pointer" onClick={onClick}>
      <video
        ref={(el) => {
          localRef.current = el;
          videoRef(el);
        }}
        src={src}
        poster={poster}
        preload="auto"
        loop={true}
        playsInline
        muted={isMuted}
        onError={onError}
        onEnded={onEnded}
        onCanPlay={() => setIsVideoReady(true)}
        onPlaying={() => setIsVideoReady(true)}
        onLoadedData={() => setIsVideoReady(true)}
        className="w-full h-full object-cover object-center scale-100"
      />

      {/* High-quality poster overlay that stays until video is actively ready & playing to avoid black flash */}
      {poster && (!isVideoReady || !isPlaying) && (
        <div 
          className={`absolute inset-0 transition-opacity duration-200 pointer-events-none ${
            isVideoReady && isPlaying ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <img 
            src={poster} 
            alt="Poster" 
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}
    </div>
  );
}

