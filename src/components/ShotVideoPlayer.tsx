import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const video = localRef.current;
    if (!video) return;

    video.muted = isMuted;

    const syncPlayback = async () => {
      try {
        if (isPlaying) {
          // If there is an active pause or play promise, we wait for it to be stable
          if (video.paused) {
            const p = video.play();
            playPromiseRef.current = p;
            if (p !== undefined) {
              await p;
            }
          }
        } else {
          // Wait for any pending play promise to resolve before pausing, to avoid interruption error
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

  // Clean up and pause video when unmounting or source changing
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
      onClick={onClick}
      onError={onError}
      onEnded={onEnded}
      className="w-full h-full cursor-pointer bg-neutral-950 object-cover object-center scale-100"
    />
  );
}
