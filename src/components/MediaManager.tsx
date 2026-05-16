import { useState, useRef } from 'react';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Upload, X, CheckCircle2, Film, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function MediaManager({ onUploadComplete, folderId }: { onUploadComplete?: (url: string) => void, folderId?: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 100 * 1024 * 1024) { // 100MB limit for demo, adjust as needed
        setUploadError("File is too large. Max 100MB.");
        return;
      }
      setFile(selectedFile);
      setUploadError(null);
    }
  };

  const startUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setProgress(0);

    const storageRef = ref(storage, `library/${folderId || 'root'}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (error) => {
        console.error("Upload error:", error);
        setUploadError("Upload failed. Check Firebase Storage rules.");
        setIsUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Log to Firestore for the library
          await addDoc(collection(db, 'library'), {
            name: file.name,
            url: downloadURL,
            type: 'video',
            size: file.size,
            folderId: folderId || null,
            createdAt: serverTimestamp()
          });

          setFile(null);
          setIsUploading(false);
          setProgress(0);
          if (onUploadComplete) onUploadComplete(downloadURL);
        } catch (err) {
          setUploadError("Failed to finalize upload.");
          setIsUploading(false);
        }
      }
    );
  };

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-brand/10 rounded-xl text-brand text-2xl">
          <Upload />
        </div>
        <div>
          <h3 className="font-display font-black uppercase italic tracking-wider">Direct Media Upload</h3>
          <p className="text-xs text-text-muted">Upload high-res videos (MP4, WEBM) directly to your server.</p>
        </div>
      </div>

      <div 
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-4",
          file ? "border-brand bg-brand/5" : "border-white/10 hover:border-brand/40 bg-surface/50",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          accept="video/*"
        />
        
        {file ? (
          <>
            <div className="w-16 h-16 bg-brand rounded-full flex items-center justify-center shadow-2xl shadow-brand/20">
              <Film className="text-white w-8 h-8" />
            </div>
            <div>
              <p className="font-bold text-sm uppercase truncate max-w-[200px]">{file.name}</p>
              <p className="text-[10px] text-text-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            {!isUploading && (
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="px-4 py-2 bg-surface text-text-muted rounded-lg text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); startUpload(); }}
                  className="px-6 py-2 bg-brand text-white rounded-lg text-xs font-bold uppercase shadow-xl shadow-brand/20"
                >
                  Upload Now
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center">
              <Upload className="text-text-muted w-8 h-8" />
            </div>
            <div>
              <p className="font-bold text-sm uppercase">Click to select video</p>
              <p className="text-[10px] text-text-muted">Max file size: 100MB</p>
            </div>
          </>
        )}

        {isUploading && (
           <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-brand">
                 <span>Uploading...</span>
                 <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-brand shadow-[0_0_10px_rgba(255,0,0,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
           </div>
        )}
      </div>

      {uploadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500">
          <X className="w-5 h-5 shrink-0" />
          <p className="text-xs font-bold uppercase tracking-wider">{uploadError}</p>
        </div>
      )}
    </div>
  );
}
