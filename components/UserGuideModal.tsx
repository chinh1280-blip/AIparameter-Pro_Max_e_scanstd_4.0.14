import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Save, BookOpen, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { User } from '../types';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  onSave: (images: string[]) => void;
  currentUser: User | null;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose, images, onSave, currentUser }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>(images);
  const [newImageUrl, setNewImageUrl] = useState('');

  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (isOpen) {
      setLocalImages(images);
      setEditMode(false);
      setCurrentIndex(0);
      setImageErrors({});
      setNewImageUrl('');
    }
  }, [isOpen]); // Only run when isOpen changes

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  const handleNext = () => {
    if (currentIndex < (editMode ? localImages.length - 1 : images.length - 1)) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const getDirectImageUrl = (url: string) => {
    if (!url) return '';
    let driveId = '';
    
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) driveId = match[1];
    } else if (url.includes('drive.google.com/open?id=')) {
      const match = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) driveId = match[1];
    } else if (url.includes('drive.google.com/uc?')) {
      const match = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) driveId = match[1];
    }

    if (driveId) {
      // lh3.googleusercontent.com is much more reliable for embedding Drive images
      // Adding a timestamp or random param to bypass cache if needed, but usually not required
      return `https://lh3.googleusercontent.com/d/${driveId}`;
    }
    return url;
  };

  const handleAddImage = () => {
    let url = newImageUrl.trim();
    if (url) {
      url = getDirectImageUrl(url);

      setLocalImages([...localImages, url]);
      setImageErrors(prev => ({ ...prev, [localImages.length]: false }));
      setNewImageUrl('');
      if (localImages.length === 0) {
        setCurrentIndex(0);
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const updated = localImages.filter((_, i) => i !== index);
    setLocalImages(updated);
    
    // Clear error state for removed image and shift others
    const newErrors: Record<number, boolean> = {};
    Object.keys(imageErrors).forEach(key => {
      const k = parseInt(key);
      if (k < index) newErrors[k] = imageErrors[k];
      if (k > index) newErrors[k - 1] = imageErrors[k];
    });
    setImageErrors(newErrors);

    if (currentIndex >= updated.length && updated.length > 0) {
      setCurrentIndex(updated.length - 1);
    } else if (updated.length === 0) {
      setCurrentIndex(0);
    }
  };

  const handleSave = () => {
    // Filter out empty strings before saving
    const validImages = localImages.filter(url => url.trim() !== '');
    onSave(validImages);
    setEditMode(false);
  };

  const handleImageError = (index: number) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
  };

  const displayImages = (editMode ? localImages : images).map(getDirectImageUrl);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-[90vw] xl:max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
            Hướng dẫn sử dụng
            {isAdmin && !editMode && (
              <button 
                onClick={() => { setEditMode(true); setLocalImages(images); }}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded ml-2 whitespace-nowrap"
              >
                Chỉnh sửa
              </button>
            )}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[300px] relative ${editMode ? 'p-4' : 'p-0 sm:p-2'}`}>
          {editMode && isAdmin ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Nhập link hình ảnh (URL)..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
                <button 
                  onClick={handleAddImage}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors"
                >
                  <Plus size={16} /> Thêm
                </button>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-4">
                {localImages.map((url, idx) => {
                  const displayUrl = getDirectImageUrl(url);
                  return (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-slate-800 flex items-center justify-center">
                    {imageErrors[idx] ? (
                      <div className="text-center p-2">
                        <BookOpen size={24} className="mx-auto text-slate-600 mb-2" />
                        <p className="text-[10px] text-red-400 font-bold">Lỗi tải ảnh</p>
                        <p className="text-[8px] text-slate-500 truncate mt-1 max-w-[120px]" title={url}>{url}</p>
                      </div>
                    ) : (
                      <img 
                        src={displayUrl} 
                        alt={`Guide ${idx + 1}`} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer" 
                        onError={() => handleImageError(idx)}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => handleRemoveImage(idx)}
                        className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-full"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                      Trang {idx + 1}
                    </div>
                  </div>
                )})}
                {localImages.length === 0 && (
                  <div className="col-span-full text-center text-slate-500 py-10">
                    Chưa có hình ảnh hướng dẫn nào.
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button 
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors"
                >
                  <Save size={16} /> Lưu thay đổi
                </button>
              </div>
            </div>
          ) : (
            <>
              {displayImages.length > 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  {/* Image Container */}
                  <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden bg-black/20 rounded-lg">
                    {imageErrors[currentIndex] ? (
                      <div className="text-center text-slate-500 flex flex-col items-center gap-3">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center">
                          <BookOpen size={32} className="text-slate-600" />
                        </div>
                        <p className="text-red-400 font-bold">Không thể tải hình ảnh hướng dẫn.</p>
                        <p className="text-xs max-w-md break-all">{displayImages[currentIndex]}</p>
                      </div>
                    ) : (
                      <TransformWrapper
                        initialScale={1}
                        minScale={0.5}
                        maxScale={5}
                        centerOnInit={true}
                        wheel={{ step: 0.1 }}
                      >
                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                          <img 
                            src={displayImages[currentIndex]} 
                            alt={`Guide page ${currentIndex + 1}`} 
                            className="max-w-full max-h-[80vh] object-contain shadow-lg"
                            referrerPolicy="no-referrer"
                            onError={() => handleImageError(currentIndex)}
                          />
                        </TransformComponent>
                      </TransformWrapper>
                    )}
                  </div>
                  
                  {/* Navigation Controls */}
                  <div className="mt-2 mb-2 sm:mt-4 sm:mb-0 flex items-center justify-center gap-4 w-full px-4">
                    {/* Left Arrow */}
                    <button 
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className={`shrink-0 p-2 rounded-full bg-slate-800 text-white transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700 hover:scale-110'}`}
                    >
                      <ChevronLeft size={20} />
                    </button>

                    {/* Dot Indicators */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {displayImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-2.5 rounded-full transition-all ${
                            idx === currentIndex 
                              ? 'bg-blue-500 w-8' 
                              : 'bg-slate-600 hover:bg-slate-500 w-2.5'
                          }`}
                          aria-label={`Go to page ${idx + 1}`}
                        />
                      ))}
                    </div>

                    {/* Right Arrow */}
                    <button 
                      onClick={handleNext}
                      disabled={currentIndex === displayImages.length - 1}
                      className={`shrink-0 p-2 rounded-full bg-slate-800 text-white transition-all ${currentIndex === displayImages.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700 hover:scale-110'}`}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                    <BookOpen size={24} className="text-slate-600" />
                  </div>
                  <p>Chưa có hướng dẫn sử dụng.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
