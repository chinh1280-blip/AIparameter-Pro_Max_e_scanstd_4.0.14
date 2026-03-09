import React, { useRef } from 'react';
import { Camera } from 'lucide-react';
import { processImage } from '../utils/imageProcessing';
import { ImageProcessingProfile, DEFAULT_PROCESSING_PROFILES } from '../types';

interface ImageUploaderProps {
  onImageSelected: (displayBase64: string, processedBase64: string) => void;
  isProcessing: boolean;
  processingProfile?: ImageProcessingProfile;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, isProcessing, processingProfile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallback to default if no profile provided
  const activeProfile = processingProfile || DEFAULT_PROCESSING_PROFILES[0];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    try {
      const { display, processed } = await processImage(file, activeProfile);
      onImageSelected(display, processed);
    } catch (error) {
      console.error("Image processing failed:", error);
      // Fallback: read directly if processing fails
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        onImageSelected(base64, base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className={`
            w-full relative group overflow-hidden
            bg-slate-800 hover:bg-slate-800/80 border-2 border-dashed border-slate-700 hover:border-blue-500/50
            rounded-2xl p-6 transition-all duration-300
            flex flex-col items-center justify-center gap-3
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
           {isProcessing ? (
               <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
           ) : (
               <Camera className="text-blue-500 w-6 h-6" />
           )}
        </div>
        
        <div className="text-center">
             <h3 className="text-white font-semibold text-sm">
                {isProcessing ? 'Đang phân tích...' : 'Chụp hình'}
             </h3>
             <p className="text-slate-400 text-[10px] mt-1">
                Nhấn để mở camera
             </p>
        </div>
      </button>
    </div>
  );
};