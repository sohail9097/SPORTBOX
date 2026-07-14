import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | number | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export const transformGDriveUrl = (url: string, type: 'image' | 'video' = 'image') => {
  if (!url || !url.includes('drive.google.com')) return url;
  
  let id = '';
  // Handle /file/d/ID/view or /d/ID
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) id = dMatch[1];
  
  // Handle uc?id=ID or open?id=ID
  if (!id) {
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch) id = idMatch[1];
  }
  
  if (!id) return url;
  
  if (type === 'image') {
    return `https://lh3.googleusercontent.com/d/${id}`;
  } else {
    // Direct stream link for Google Drive videos
    return `https://drive.google.com/uc?export=download&id=${id}&confirm=no_antivirus`;
  }
};

export function getCategoryFallbackImage(category?: string): string {
  const cat = (category || 'others').toLowerCase();
  switch (cat) {
    case 'football':
      return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800&auto=format&fit=crop';
    case 'cricket':
      return 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=800&auto=format&fit=crop';
    case 'wrestling':
      return 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800&auto=format&fit=crop';
    case 'tennis':
      return 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800&auto=format&fit=crop';
    case 'f1':
      return 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=800&auto=format&fit=crop';
    case 'boxing':
      return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop';
    case 'watersports':
      return 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=800&auto=format&fit=crop';
    case 'kabaddi':
      return 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800&auto=format&fit=crop';
    case 'stunts':
      return 'https://images.unsplash.com/photo-1568285519808-115fef54e8ab?q=80&w=800&auto=format&fit=crop';
    case 'polo':
      return 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=800&auto=format&fit=crop';
    case 'olympics':
      return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800&auto=format&fit=crop';
    default:
      return 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=800&auto=format&fit=crop';
  }
}

export function getVideoAutoThumbnail(videoUrl: string, category?: string): string {
  if (!videoUrl) {
    return getCategoryFallbackImage(category);
  }

  const target = videoUrl.trim();

  // 1. YouTube Identification
  let youtubeId = '';
  if (target.includes('youtube.com') || target.includes('youtu.be')) {
    if (target.includes('youtube.com/embed/')) {
      const parts = target.split('/embed/');
      if (parts[1]) youtubeId = parts[1].split(/[?#]/)[0];
    } else if (target.includes('youtube.com/watch')) {
      const match = target.match(/[?&]v=([^&#]+)/);
      if (match) youtubeId = match[1];
    } else if (target.includes('youtu.be/')) {
      const parts = target.split('youtu.be/');
      if (parts[1]) youtubeId = parts[1].split(/[?#]/)[0];
    }
  } else if (target.startsWith('<iframe') || target.startsWith('<')) {
    const matchHref = target.match(/src=["']([^"']+)["']/i);
    if (matchHref && (matchHref[1].includes('youtube.com') || matchHref[1].includes('youtu.be'))) {
      const embedUrl = matchHref[1];
      if (embedUrl.includes('youtube.com/embed/')) {
        const parts = embedUrl.split('/embed/');
        if (parts[1]) youtubeId = parts[1].split(/[?#]/)[0];
      }
    }
  }

  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  // 2. Cloudflare Stream Identification
  if (target.includes('cloudflarestream.com') || target.includes('videodelivery.net')) {
    try {
      const hexIdMatch = target.match(/([a-fA-F0-9]{32})/);
      if (hexIdMatch) {
        const videoId = hexIdMatch[1];
        const customerMatch = target.match(/customer-([a-zA-Z0-9]+)\.cloudflarestream\.com/);
        if (customerMatch) {
          const customerId = customerMatch[1];
          return `https://customer-${customerId}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg?time=2s&height=600`;
        }
        return `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg?time=2s&height=600`;
      }
    } catch (e) {
      console.warn("Failed to parse Cloudflare stream thumbnail ID", e);
    }
  }

  // Fallback to Category Images
  return getCategoryFallbackImage(category);
}

export function sanitizeVideoUrlOrIframe(input: string): string {
  if (!input) return input;
  
  const isCloudflare = input.includes('cloudflarestream.com') || input.includes('videodelivery.net');
  if (!isCloudflare) return input;

  const params = 'liveViewerCount=false&showLiveViewerCount=false&viewerCount=false';

  const cleanUrl = (url: string) => {
    let u = url;
    // Remove any existing variations to avoid conflicts
    u = u.replace(/[?&]liveViewerCount=[^&]+/g, '');
    u = u.replace(/[?&]showLiveViewerCount=[^&]+/g, '');
    u = u.replace(/[?&]viewerCount=[^&]+/g, '');
    
    // Replace any trailing question mark or ampersand before appending
    u = u.replace(/[&?]+$/, '');
    
    const connector = u.includes('?') ? '&' : '?';
    return `${u}${connector}${params}`;
  };

  // If it's a raw iframe string
  if (input.trim().startsWith('<iframe') || input.includes('src=')) {
    return input.replace(/src=["']([^"']+)["']/gi, (match, src) => {
      if (src.includes('cloudflarestream.com') || src.includes('videodelivery.net')) {
        return `src="${cleanUrl(src)}"`;
      }
      return match;
    });
  }

  return cleanUrl(input);
}

export function getEmbedUrl(url: string): string {
  if (!url) return '';
  const target = url.trim();

  // If it's already an iframe string
  if (target.startsWith('<iframe') || target.startsWith('<')) {
    const match = target.match(/src=["']([^"']+)["']/i);
    if (match) return match[1];
    return url;
  }

  // 1. YouTube
  if (target.includes('youtube.com') || target.includes('youtu.be') || target.includes('youtube-nocookie.com')) {
    let youtubeId = '';
    if (target.includes('youtube.com/embed/')) {
      const parts = target.split('/embed/');
      if (parts[1]) youtubeId = parts[1].split(/[?#&]/)[0];
    } else if (target.includes('youtube-nocookie.com/embed/')) {
      const parts = target.split('/embed/');
      if (parts[1]) youtubeId = parts[1].split(/[?#&]/)[0];
    } else if (target.includes('youtube.com/watch')) {
      const match = target.match(/[?&]v=([^&#]+)/);
      if (match) youtubeId = match[1];
    } else if (target.includes('youtu.be/')) {
      const parts = target.split('youtu.be/');
      if (parts[1]) youtubeId = parts[1].split(/[?#&]/)[0];
    }
    if (youtubeId) {
      return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&mute=1`;
    }
  }

  // 2. Vimeo
  if (target.includes('vimeo.com')) {
    if (target.includes('player.vimeo.com/video/')) {
      return target;
    }
    const match = target.match(/vimeo\.com\/([0-9]+)/);
    if (match) {
      return `https://player.vimeo.com/video/${match[1]}?autoplay=1&muted=1`;
    }
  }

  // 3. Twitch
  if (target.includes('twitch.tv')) {
    if (!target.includes('player.twitch.tv')) {
      const match = target.match(/twitch\.fr\/([^/]+)/) || target.match(/twitch\.tv\/([^/]+)/);
      if (match && match[1] && !match[1].startsWith('directory') && !match[1].startsWith('videos')) {
        const parent = window.location.hostname || 'localhost';
        return `https://player.twitch.tv/?channel=${match[1]}&parent=${parent}&autoplay=true&muted=true`;
      }
    }
  }

  return url;
}
