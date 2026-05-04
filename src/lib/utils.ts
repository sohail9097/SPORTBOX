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
