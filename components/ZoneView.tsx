import React, { useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { DataCard } from './DataCard';
import { ProcessingState, StandardDataMap, ProductPreset, ZoneDefinition, ImageProcessingProfile, DEFAULT_PROCESSING_PROFILES, getDefaultTolerance } from '../types';
import { analyzeImage } from '../services/geminiService';
import { Trash2, Info, CheckCircle2, Eye, EyeOff, Scan, X, LayoutGrid, List, ChevronUp, ChevronDown, Check } from 'lucide-react';

// Helper to convert Google Drive viewer links to direct image links
const getDirectImageUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  try {
    // Handle Google Drive URLs
    if (url.includes('drive.google.com')) {
      let fileId = '';
      // Extract ID from /file/d/ID/view
      const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        fileId = fileIdMatch[1];
      } else {
        // Extract ID from ?id=ID
        const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idParamMatch && idParamMatch[1]) {
          fileId = idParamMatch[1];
        }
      }

      if (fileId) {
        // Use thumbnail endpoint which is more reliable for embedding than uc?export=view
        // sz=w1920 requests a large version (width 1920px)
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`;
      }
    }
    return url;
  } catch (e) {
    return url;
  }
};

interface ZoneViewProps {
  zone: ZoneDefinition;
  data: any | null;
  standardData: StandardDataMap;
  currentPreset?: ProductPreset | null;
  setData: (data: any | null) => void;
  state: ProcessingState;
  setState: (state: ProcessingState) => void;
  modelName: string;
  fieldLabels: Record<string, string>;
  apiKey?: string; // Add apiKey
  showProcessedImage?: boolean;
  processingProfiles?: ImageProcessingProfile[];
}

export const ZoneView: React.FC<ZoneViewProps> = React.memo(({
  zone,
  data,
  standardData,
  currentPreset,
  setData,
  state,
  setState,
  modelName,
  fieldLabels,
  apiKey, // Accept apiKey
  showProcessedImage = false,
  processingProfiles = DEFAULT_PROCESSING_PROFILES,
}) => {
  const imagesConfig = zone.images && zone.images.length > 0 ? zone.images : [{ id: 'default', label: 'Ảnh 1' }];
  const imageUrls = state.imageUrls || {};
  const processedImageUrls = state.processedImageUrls || {};
  
  const [visibleGuides, setVisibleGuides] = useState<Record<string, boolean>>({});
  const [viewModes, setViewModes] = useState<Record<string, 'display' | 'processed'>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const toggleGuide = (id: string) => {
    setVisibleGuides(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleViewMode = (id: string) => {
    setViewModes(prev => ({ ...prev, [id]: prev[id] === 'processed' ? 'display' : 'processed' }));
  };

  const handleImageSelected = async (imageId: string, displayBase64: string, processedBase64: string) => {
    const newImageUrls = { ...imageUrls, [imageId]: `data:image/jpeg;base64,${displayBase64}` };
    const newProcessedImageUrls = { ...processedImageUrls, [imageId]: processedBase64 };
    
    // Check if all images are uploaded
    const allUploaded = imagesConfig.every(img => newImageUrls[img.id]);

    setState({
      ...state,
      isAnalyzing: allUploaded,
      error: null,
      imageUrls: newImageUrls,
      processedImageUrls: newProcessedImageUrls,
    });
    
    if (allUploaded) {
      setData(null);
      try {
        // Use processed images for AI analysis
        const base64List = imagesConfig.map(img => newProcessedImageUrls[img.id]);

        // Handle Crop Zones (Removed per user request)
        // let labeledCrops: Record<string, string> | undefined;
        // if (zone.cropZones && Object.keys(zone.cropZones).length > 0) { ... }

        // Use zone-specific model if configured, otherwise use the global modelName
        const activeModel = zone.modelId || modelName;

        // Find processingProfileId from the first image that has one
        let processingProfileId: string | undefined;
        for (const img of imagesConfig) {
            if (img.processingProfileId) {
                processingProfileId = img.processingProfileId;
                break;
            }
        }

        const result = await analyzeImage(base64List, zone.prompt, zone.schema, activeModel, apiKey, processingProfileId, processingProfiles);
        setData(result);
        setState({ ...state, isAnalyzing: false, imageUrls: newImageUrls, processedImageUrls: newProcessedImageUrls });
      } catch (err: any) {
        setState({ 
          ...state, 
          isAnalyzing: false, 
          error: err.message || "Không thể đọc dữ liệu. Vui lòng thử lại với ảnh rõ nét hơn.",
          imageUrls: newImageUrls,
          processedImageUrls: newProcessedImageUrls
        });
      }
    }
  };

  const handleClearImage = (imageId: string) => {
    const newImageUrls = { ...imageUrls };
    const newProcessedImageUrls = { ...processedImageUrls };
    delete newImageUrls[imageId];
    delete newProcessedImageUrls[imageId];
    setState({ ...state, isAnalyzing: false, error: null, imageUrls: newImageUrls, processedImageUrls: newProcessedImageUrls });
    setData(null);
  };

  const handleClearAll = () => {
    setData(null);
    setState({ isAnalyzing: false, error: null, imageUrl: null, imageUrls: {}, processedImageUrls: {} });
  };

  const handleDataChange = (key: string, value: number | null) => {
    if (data) {
      setData({ ...data, [key]: value });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
        <div className="mb-4 flex items-center justify-between">
           <div className="flex items-center gap-2 text-blue-400">
             <Info size={16}/>
             <span className="text-xs font-bold uppercase tracking-widest">{zone.name}</span>
           </div>
           {Object.keys(imageUrls).length > 0 && !state.isAnalyzing && (
             <button onClick={handleClearAll} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
               <Trash2 size={14} /> Xóa tất cả ảnh
             </button>
           )}
        </div>

        {state.error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-lg text-sm flex items-center gap-2">
            <span>⚠️</span> {state.error}
          </div>
        )}

        <div className={`grid grid-cols-1 ${imagesConfig.length > 1 ? 'sm:grid-cols-2' : ''} gap-4`}>
          {imagesConfig.map((img) => {
            const currentImageUrl = imageUrls[img.id];
            const processedImageUrl = processedImageUrls[img.id];
            const viewMode = viewModes[img.id] || 'display';
            const displayUrl = (viewMode === 'processed' && processedImageUrl) 
                ? `data:image/jpeg;base64,${processedImageUrl}` 
                : currentImageUrl;
            
            const showGuide = visibleGuides[img.id];

            // Resolve Processing Profile
            // Priority: 1. processingProfileId, 2. captureMode (legacy), 3. Default
            const profile = processingProfiles.find(p => p.id === img.processingProfileId) 
                         || DEFAULT_PROCESSING_PROFILES.find(p => p.id === img.captureMode)
                         || DEFAULT_PROCESSING_PROFILES[0];

            return (
              <div key={img.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{img.label}</span>
                  <div className="flex items-center gap-2">
                      {img.guideImage && (
                          <button 
                            onClick={() => toggleGuide(img.id)}
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${showGuide ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'}`}
                          >
                             {showGuide ? <EyeOff size={10}/> : <Eye size={10}/>} {showGuide ? 'Ẩn Mẫu' : 'Xem Mẫu'}
                          </button>
                      )}
                      {currentImageUrl && <CheckCircle2 size={14} className="text-green-500" />}
                  </div>
                </div>

                {showGuide && img.guideImage && (
                    <div 
                        className="relative rounded-xl overflow-hidden aspect-video bg-slate-950 border border-blue-500/30 shadow-lg mb-1 animate-slide-down group cursor-zoom-in"
                        onClick={() => setZoomedImage(getDirectImageUrl(img.guideImage) || null)}
                    >
                        <img 
                          src={getDirectImageUrl(img.guideImage)} 
                          alt="Guide" 
                          className="w-full h-full object-contain" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // Fallback if thumbnail fails, try the original URL
                            const target = e.target as HTMLImageElement;
                            if (target.src !== img.guideImage) {
                                target.src = img.guideImage || '';
                            }
                          }}
                        />
                        <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[8px] font-black uppercase px-2 py-1 rounded shadow-sm backdrop-blur-sm">Ảnh Mẫu</div>
                        
                        {/* Hover Overlay for Zoom */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                            <Scan className="text-white drop-shadow-lg" size={32} />
                        </div>
                    </div>
                )}

                {currentImageUrl ? (
                  <div className="relative group">
                    <div className="relative rounded-xl overflow-hidden aspect-video bg-black border border-slate-700 shadow-inner">
                      <img 
                        src={displayUrl} 
                        alt={img.label} 
                        className={`w-full h-full object-contain ${state.isAnalyzing ? 'opacity-50 blur-sm' : ''}`} 
                      />
                      {state.isAnalyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        </div>
                      )}
                      
                      {/* Toggle View Mode Button */}
                      {!state.isAnalyzing && showProcessedImage && processedImageUrl && (
                        <button 
                            onClick={() => toggleViewMode(img.id)}
                            className={`absolute bottom-2 right-2 px-2 py-1 rounded text-[9px] font-black uppercase backdrop-blur-md shadow-lg z-20 transition-all border ${viewMode === 'processed' ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800'}`}
                        >
                            {viewMode === 'processed' ? 'Processed' : 'Original'}
                        </button>
                      )}
                    </div>
                    {!state.isAnalyzing && (
                        <button 
                            onClick={() => handleClearImage(img.id)}
                            className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600/90 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                            title="Xóa ảnh này"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                  </div>
                ) : (
                   <ImageUploader 
                     onImageSelected={(display, processed) => handleImageSelected(img.id, display, processed)} 
                     isProcessing={state.isAnalyzing}
                     processingProfile={profile}
                   />
                )}
              </div>
            );
          })}
        </div>
        
        {state.isAnalyzing && (
          <div className="mt-4 flex flex-col items-center justify-center py-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <span className="text-blue-400 font-medium text-sm animate-pulse">Đang xử lý OCR</span>
          </div>
        )}
      </div>

      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <h3 className="text-white font-semibold flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                Kết quả đọc
             </h3>
             <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 p-1 rounded-xl">
               <button
                 onClick={() => setViewMode('grid')}
                 className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                 title="Dạng thẻ"
               >
                 <LayoutGrid size={16} />
               </button>
               <button
                 onClick={() => setViewMode('list')}
                 className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                 title="Dạng danh sách"
               >
                 <List size={16} />
               </button>
             </div>
          </div>
          
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(data).map(([key, value]) => (
                <DataCard 
                  key={key} 
                  dataKey={key} 
                  value={value as number} 
                  standardValue={standardData[key]}
                  tolerance={currentPreset?.tolerances?.[key]}
                  onChange={handleDataChange} 
                  fieldLabels={fieldLabels}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {Object.entries(data).map(([key, value]) => {
                const val = value as number;
                let std = standardData[key];
                let diff = val !== null && std !== undefined ? parseFloat((val - std).toFixed(2)) : 0;
                
                const tol = currentPreset?.tolerances?.[key] ?? getDefaultTolerance(key);
                const diffAbs = Math.abs(diff);

                let borderColor = 'border-slate-800';
                let color = 'text-slate-400';

                if (val !== null && std !== undefined) {
                    if (diffAbs <= tol / 2) {
                        borderColor = 'border-green-500 shadow-[0_0_10px_-2px_rgba(34,197,94,0.3)]';
                        color = 'text-green-400';
                    } else if (diffAbs <= tol) {
                        borderColor = 'border-yellow-500 shadow-[0_0_10px_-2px_rgba(234,179,8,0.3)]';
                        color = 'text-yellow-400';
                    } else {
                        borderColor = 'border-red-500 shadow-[0_0_10px_-2px_rgba(239,68,68,0.3)]';
                        color = 'text-red-400';
                    }
                }

                return (
                  <div key={key} className={`bg-slate-900/80 px-3 py-2 rounded-xl border ${borderColor} flex items-center justify-between transition-all gap-2`}>
                    <p className="text-[10px] text-slate-200 font-black uppercase leading-tight flex-1">{fieldLabels[key] || key}</p>
                    <div className="flex items-center font-mono whitespace-nowrap">
                        <input
                          type="number"
                          step="0.1"
                          className={`w-12 bg-transparent text-right text-xs font-black p-0 focus:outline-none focus:ring-0 border-none transition-all ${val === null ? 'border-red-900/50' : ''} ${color} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                          value={val ?? ''}
                          onChange={(e) => handleDataChange(key, e.target.value === '' ? null : parseFloat(e.target.value))}
                          placeholder="--"
                        />
                        {std !== undefined && (
                            <div className="flex items-center border-l border-slate-700 pl-2 ml-2 gap-2">
                              <div className="flex items-baseline">
                                <span className="text-[10px] text-slate-500 font-bold">{std}</span>
                                <span className="text-[9px] text-slate-600 font-bold ml-0.5">±{tol}</span>
                              </div>
                              {val !== null && (
                                diffAbs <= tol ? (
                                  <div className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                                    <Check size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                                    <X size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                )
                              )}
                            </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {zoomedImage && (
        <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setZoomedImage(null)}>
            <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 text-white/50 hover:text-white p-2 transition-colors"><X size={32}/></button>
            <img src={zoomedImage} alt="Zoomed Guide" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" referrerPolicy="no-referrer" />
        </div>
      )}
    </div>
  );
});
