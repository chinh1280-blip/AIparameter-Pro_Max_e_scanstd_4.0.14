import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ZoneView } from './components/ZoneView';
import { SettingsModal } from './components/SettingsModal';
import { UserGuideModal } from './components/UserGuideModal';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/LoginScreen';
import { ProcessingState, ProductPreset, ModelConfig, LogEntry, Machine, FIELD_LABELS, ScanConfig, User, UIConfig, DEFAULT_UI_CONFIG, ImageProcessingProfile, DEFAULT_PROCESSING_PROFILES } from './types';
import { Cpu, Settings, Send, BarChart3, Box, Layers, RefreshCw, Search, KeyRound, LogOut, ClipboardList, Tag, FileType, X, BookOpen } from 'lucide-react';

const DEFAULT_MODELS: ModelConfig[] = [
  { id: 'gemini-flash-lite-latest', name: 'Lite' },
  { id: 'gemini-flash-latest', name: 'Flash' },
  { id: 'gemini-3-pro-preview', name: 'Pro' }
];

const formatAppTimestamp = (date: Date): string => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear().toString().slice(-2);
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${d}/${m}/${y} ${h}:${min}:${s}`;
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [activeView, setActiveView] = useState<'capture' | 'dashboard'>('capture');
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  
  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash-lite-latest');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // UI Config State
  const [uiConfig, setUiConfig] = useState<UIConfig>(DEFAULT_UI_CONFIG);
  
  // Image Processing Profiles
  const [processingProfiles, setProcessingProfiles] = useState<ImageProcessingProfile[]>(DEFAULT_PROCESSING_PROFILES);

  // User Guide
  const [userGuideImages, setUserGuideImages] = useState<string[]>([]);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);

  const [customModels, setCustomModels] = useState<ModelConfig[]>([]);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>(FIELD_LABELS);

  const [googleSheetUrl, setGoogleSheetUrl] = useState('https://script.google.com/macros/s/AKfycbx91LFb5jbr3Rtj0XT4p5UvVijxzh3IRFcLAwH434ydBmrCFurCRoJoMblw_CnXBE37uA/exec');
  const [presets, setPresets] = useState<ProductPreset[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<LogEntry[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [scanConfigs, setScanConfigs] = useState<ScanConfig[]>([]);
  const [currentMachineId, setCurrentMachineId] = useState<string | null>(null);
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(null);
  
  // Lists for dropdowns
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [availableStructures, setAvailableStructures] = useState<string[]>([]);
  
  // New input states
  const [inputProductionOrder, setInputProductionOrder] = useState('LSX');
  const [inputProductName, setInputProductName] = useState('');
  const [inputStructure, setInputStructure] = useState('');

  const [customApiKeys, setCustomApiKeys] = useState<{id: string, name: string, key: string}[]>([]);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string | null>(null);
  const [savedScriptUrls, setSavedScriptUrls] = useState<{id: string, name: string, url: string}[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});
  const [uiState, setUiState] = useState<Record<string, ProcessingState>>({});
  const [isUploading, setIsUploading] = useState(false);
  
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showProductNameDropdown, setShowProductNameDropdown] = useState(false);
  const [showStructureDropdown, setShowStructureDropdown] = useState(false);

  // Refs for click outside detection
  const headerSearchRef = useRef<HTMLDivElement>(null);
  const productNameRef = useRef<HTMLDivElement>(null);
  const structureRef = useRef<HTMLDivElement>(null);

  const availableModels = useMemo(() => [...DEFAULT_MODELS, ...customModels], [customModels]);

  const currentMachine = useMemo(() => 
    machines.find(m => m.id === currentMachineId) || null, 
  [currentMachineId, machines]);

  const currentPreset = useMemo(() => 
    presets.find(p => p.id === currentPresetId) || null,
  [currentPresetId, presets]);

  // Sync inputs when preset changes, but user can override
  useEffect(() => {
    if (currentPreset) {
      setInputProductName(currentPreset.productName);
      setInputStructure(currentPreset.structure);
    }
  }, [currentPreset]);

  // Click outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerSearchRef.current && !headerSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
      if (productNameRef.current && !productNameRef.current.contains(event.target as Node)) {
        setShowProductNameDropdown(false);
      }
      if (structureRef.current && !structureRef.current.contains(event.target as Node)) {
        setShowStructureDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeApiKey = useMemo(() => {
    const custom = customApiKeys.find(k => k.id === selectedApiKeyId);
    if (custom) return custom.key;
    if (customApiKeys.length > 0) return customApiKeys[0].key;
    return process.env.API_KEY || '';
  }, [customApiKeys, selectedApiKeyId]);

  // Heavy calculation: Memoize filtered presets
  const filteredPresets = useMemo(() => {
    if (!currentMachineId) return [];
    return presets
      .filter(p => p.machineId === currentMachineId)
      .filter(p => 
        p.productName.toLowerCase().includes(productSearch.toLowerCase()) || 
        p.structure.toLowerCase().includes(productSearch.toLowerCase())
      );
  }, [presets, currentMachineId, productSearch]);
  
  // Heavy calculation: Memoize top 50 filtered presets for dropdown to avoid lag on every keystroke
  const dropdownPresets = useMemo(() => filteredPresets.slice(0, 50), [filteredPresets]);

  // Heavy calculation: Memoize available products filtering
  const visibleProductOptions = useMemo(() => {
      if (!inputProductName) return availableProducts.slice(0, 50);
      return availableProducts
        .filter(p => p.toLowerCase().includes(inputProductName.toLowerCase()))
        .slice(0, 50);
  }, [availableProducts, inputProductName]);

  // Heavy calculation: Memoize available structures filtering
  const visibleStructureOptions = useMemo(() => {
      if (!inputStructure) return availableStructures.slice(0, 50);
      return availableStructures
        .filter(s => s.toLowerCase().includes(inputStructure.toLowerCase()))
        .slice(0, 50);
  }, [availableStructures, inputStructure]);

  const handleMachineChange = useCallback((id: string | null) => {
    setCurrentMachineId(id || null);
    setActiveZoneId(null);
    setData({});
    setUiState({});
    // Clear preset and inputs when machine changes
    setCurrentPresetId(null);
    setInputProductName('');
    setInputStructure('');
    if (id) localStorage.setItem('currentMachineId', id);
  }, []);

  const handleSelectPreset = useCallback((id: string | null) => {
    setCurrentPresetId(id || null);
    setProductSearch('');
    setShowProductDropdown(false);
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!googleSheetUrl) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`${googleSheetUrl}${googleSheetUrl.includes('?') ? '&' : '?'}action=sync&t=${Date.now()}`);
      if (response.ok) {
        const resData = await response.json();
        if (resData.presets) {
          // Deduplicate presets by ID to prevent key collisions
          const uniquePresets = Array.from(new Map((resData.presets as ProductPreset[]).map(p => [p.id, p])).values());
          setPresets(uniquePresets);
        }
        if (resData.logs) setHistoricalLogs(resData.logs);
        if (resData.machines) setMachines(resData.machines);
        if (resData.labels) setFieldLabels(prev => ({ ...prev, ...resData.labels }));
        if (resData.scanConfigs) setScanConfigs(resData.scanConfigs);
        if (resData.productStructures) {
            setAvailableProducts(resData.productStructures.products || []);
            setAvailableStructures(resData.productStructures.structures || []);
        }
        if (resData.appConfig) {
           if (resData.appConfig.apiKeys) setCustomApiKeys(resData.appConfig.apiKeys);
           if (resData.appConfig.scriptUrls) setSavedScriptUrls(resData.appConfig.scriptUrls);
           if (resData.appConfig.models) setCustomModels(resData.appConfig.models);
           if (resData.appConfig.uiConfig) setUiConfig(resData.appConfig.uiConfig); // Load UI Config
           if (resData.appConfig.processingProfiles) setProcessingProfiles(resData.appConfig.processingProfiles); // Load Processing Profiles
           if (resData.appConfig.userGuideImages) setUserGuideImages(resData.appConfig.userGuideImages);
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally { setIsRefreshing(false); }
  }, [googleSheetUrl]);

  useEffect(() => {
    const savedUrl = localStorage.getItem('googleSheetUrl');
    const savedMachineId = localStorage.getItem('currentMachineId');
    const savedApiKeyId = localStorage.getItem('selectedApiKeyId');
    const savedModel = localStorage.getItem('selectedModel');
    
    if (savedUrl) setGoogleSheetUrl(savedUrl);
    if (savedMachineId) setCurrentMachineId(savedMachineId);
    if (savedApiKeyId) setSelectedApiKeyId(savedApiKeyId);
    if (savedModel) setSelectedModel(savedModel);
    
    // Check for local storage UI config as backup
    const savedUI = localStorage.getItem('uiConfig');
    if (savedUI) {
        try { setUiConfig(JSON.parse(savedUI)); } catch(e){}
    }
    
    // Load Processing Profiles from LocalStorage
    const savedProfiles = localStorage.getItem('processingProfiles');
    if (savedProfiles) {
        try { setProcessingProfiles(JSON.parse(savedProfiles)); } catch(e){}
    }

    // Load Machines from LocalStorage
    const savedMachines = localStorage.getItem('machines');
    if (savedMachines) {
        try { setMachines(JSON.parse(savedMachines)); } catch(e){}
    }
  }, []);

  useEffect(() => {
    if (googleSheetUrl && isAuthenticated) fetchAllData();
  }, [googleSheetUrl, fetchAllData, isAuthenticated]);

  useEffect(() => {
    if (selectedApiKeyId) localStorage.setItem('selectedApiKeyId', selectedApiKeyId);
  }, [selectedApiKeyId]);

  useEffect(() => {
    if (selectedModel) localStorage.setItem('selectedModel', selectedModel);
  }, [selectedModel]);

  // Persist UI Config locally whenever it changes
  useEffect(() => {
    localStorage.setItem('uiConfig', JSON.stringify(uiConfig));
  }, [uiConfig]);
  
  // Persist Processing Profiles locally
  useEffect(() => {
    localStorage.setItem('processingProfiles', JSON.stringify(processingProfiles));
  }, [processingProfiles]);

  // Persist Machines locally
  useEffect(() => {
    if (machines.length > 0) {
        localStorage.setItem('machines', JSON.stringify(machines));
    }
  }, [machines]);

  const handleSaveAppConfigCloud = async (apiKeys: any[], scriptUrls: any[], models: any[], customUserGuideImages?: string[]) => {
    if (!googleSheetUrl) return;
    try {
      await fetch(googleSheetUrl, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ 
            action: "save_app_config", 
            config: { apiKeys, scriptUrls, models, uiConfig, processingProfiles, userGuideImages: customUserGuideImages || userGuideImages } // Save UI Config & Profiles
        })
      });
      alert("Đã đồng bộ Cấu hình Hệ thống & Giao diện lên Cloud!");
    } catch (e) {
      alert("Lỗi đồng bộ cấu hình");
    }
  };

  const handleUploadToSheet = async () => {
    if (!googleSheetUrl || !currentMachine) return;
    setIsUploading(true);
    try {
      const payload: any = {
        action: "save_log",
        timestamp: formatAppTimestamp(new Date()),
        
        // Manual Inputs
        product: inputProductName || "No Product",
        structure: inputStructure || "No Structure",
        productionOrder: inputProductionOrder || "",
        
        // Standard Reference (From Preset)
        productStd: currentPreset?.productName || "",
        structureStd: currentPreset?.structure || "",

        machineId: currentMachine.id,
        machineName: currentMachine.name,
        uploadedBy: currentUser?.username || 'unknown',
      };

      Object.entries(data).forEach(([zoneId, zoneData]) => {
        if (!zoneData) return;
        Object.entries(zoneData).forEach(([key, val]) => {
          payload[key] = val;
          const std = currentPreset?.data?.[key];
          if (std !== undefined) {
             payload[`std_${key}`] = std;
             payload[`diff_${key}`] = parseFloat(((val as number) - std).toFixed(2));
          }
        });
      });

      await fetch(googleSheetUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      alert("Đã gửi dữ liệu!");
      setData({});
      setUiState({});
      fetchAllData();
    } catch (e) {
      alert("Lỗi gửi dữ liệu");
    } finally { setIsUploading(false); }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Stable handlers for ZoneView to prevent re-renders
  const handleSetData = useCallback((d: any) => {
    if (activeZoneId) {
       setData(prev => ({ ...prev, [activeZoneId]: d }));
    }
  }, [activeZoneId]);

  const handleSetState = useCallback((s: any) => {
    if (activeZoneId) {
        setUiState(prev => ({ ...prev, [activeZoneId]: s }));
    }
  }, [activeZoneId]);

  // --- Theme Configurations ---

  // Light Mode 1 (Updated): Pink removed -> Blue/Teal Theme
  const lightMode1CSS = `
    :root {
      --bg-main: #fef6e4;
      --bg-card: #ffffff;
      --bg-input: #ffffff;
      --text-main: #001858;
      --text-secondary: #172c66;
      --border-color: #001858;
      --color-primary: #2563eb; /* Changed from Pink to Blue */
      --color-secondary: #8bd3dd;
    }
  `;

  // Light Mode 2 (New): Based on new palette
  const lightMode2CSS = `
    :root {
      --bg-main: #feefe8;
      --bg-card: #fffffe;
      --bg-input: #fffffe;
      --text-main: #232323;
      --text-secondary: #222525;
      --border-color: #232323;
      --color-primary: #f45d48; /* Orange Link/Button */
      --color-secondary: #078080; /* Teal Accent */
    }
  `;

  // Shared Light Styles (Applied to both light modes)
  const sharedLightCSS = `
    body { background-color: var(--bg-main) !important; color: var(--text-main) !important; }
    
    /* Overrides for Light Mode */
    .bg-\\[\\#0b1120\\], .bg-slate-900, .bg-slate-950, .bg-slate-800, .bg-slate-900\\/50, .bg-slate-900\\/30, .bg-slate-900\\/80, .bg-slate-900\\/40, .bg-slate-900\\/60, .bg-slate-950\\/40, .bg-slate-950\\/50, .bg-slate-950\\/20, .bg-slate-800\\/50, .bg-slate-800\\/90, .bg-slate-800\\/80 {
        background-color: var(--bg-card) !important;
        color: var(--text-main) !important;
        border-color: var(--border-color) !important;
        box-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 0.1) !important;
    }
    
    /* Inputs */
    input, select, textarea {
        background-color: var(--bg-input) !important;
        color: var(--text-main) !important;
        border-color: var(--border-color) !important;
    }

    /* Text Colors */
    .text-slate-100, .text-white, .text-slate-200, .text-slate-300 { color: var(--text-main) !important; }
    .text-slate-500, .text-slate-400, .text-slate-600 { color: var(--text-secondary) !important; }
    
    /* Primary Buttons */
    .bg-blue-600 { 
        background-color: var(--color-primary) !important; 
        color: #ffffff !important;
        border-color: var(--border-color) !important;
    }
    
    /* Accents */
    .text-blue-400, .text-blue-500 { color: var(--color-primary) !important; }
    .text-cyan-400 { color: var(--color-secondary) !important; }
    
    /* Borders */
    .border-slate-800, .border-slate-700, .border-slate-600 {
        border-color: var(--border-color) !important;
    }
    
    /* Status Borders (prevent override by bg classes) */
    .border-green-500 { border-color: #22c55e !important; }
    .border-yellow-500 { border-color: #eab308 !important; }
    .border-red-500 { border-color: #ef4444 !important; }
    .border-red-900\/50 { border-color: rgba(127, 29, 29, 0.5) !important; }
    .border-blue-500\/50 { border-color: rgba(59, 130, 246, 0.5) !important; }
    .hover\:border-blue-500\/50:hover { border-color: rgba(59, 130, 246, 0.5) !important; }
  `;

  // Memoize Dynamic Styles Injection
  const dynamicStyles = useMemo(() => {
    if (uiConfig.themeMode === 'light') {
        return `${lightMode1CSS} ${sharedLightCSS}`;
    }
    if (uiConfig.themeMode === 'light_2') {
        return `${lightMode2CSS} ${sharedLightCSS}`;
    }
    return ''; // Dark mode (default)
  }, [uiConfig, lightMode1CSS, lightMode2CSS, sharedLightCSS]);

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} googleSheetUrl={googleSheetUrl} />;
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 font-sans pb-24 sm:pb-0">
      <style>{dynamicStyles}</style>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-[200]">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between h-14">
            {activeView === 'capture' ? (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-lg flex items-center justify-center shrink-0">
                  <Box className="text-white" size={20} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Capture AI</h1>
                  <select 
                    value={currentMachineId || ''} 
                    onChange={(e) => handleMachineChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer max-w-full truncate py-1"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">-- Chọn Máy --</option>
                    {machines.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                  <BarChart3 className="text-blue-400" size={20} />
                </div>
                <div>
                  <h1 className="text-base font-black text-white uppercase tracking-tight">Overview</h1>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Dashboard</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5">
               <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/50">
                 <button onClick={() => setActiveView('capture')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${activeView === 'capture' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Chụp ảnh</button>
                 <button onClick={() => setActiveView('dashboard')} className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${activeView === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Nhật ký</button>
               </div>
               
               {activeView === 'capture' && (
                 <>
                  {/* Model Selector */}
                  <div className="hidden sm:flex items-center bg-slate-800 rounded-lg px-2 border border-slate-700 h-8">
                      <Cpu size={12} className="text-blue-500 mr-1.5" />
                      <select 
                        value={selectedModel} 
                        onChange={(e) => setSelectedModel(e.target.value)} 
                        className="bg-transparent text-[9px] font-black uppercase text-slate-200 outline-none cursor-pointer"
                      >
                        {availableModels.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>)}
                      </select>
                  </div>

                  {/* API Key Selector */}
                  <div className="hidden sm:flex items-center bg-slate-800 rounded-lg px-2 border border-slate-700 h-8 ml-1">
                      <KeyRound size={12} className="text-yellow-500 mr-1.5" />
                      <select 
                        value={selectedApiKeyId || ''} 
                        onChange={(e) => setSelectedApiKeyId(e.target.value || null)} 
                        className="bg-transparent text-[9px] font-black uppercase text-slate-200 outline-none cursor-pointer max-w-[80px] truncate"
                      >
                        <option value="" className="bg-slate-900">System Key</option>
                        {customApiKeys.map(k => <option key={k.id} value={k.id} className="bg-slate-900">{k.name}</option>)}
                      </select>
                  </div>
                 </>
               )}
               
               {activeView === 'capture' && (
                 <button onClick={() => setIsUserGuideOpen(true)} className="p-2 rounded-lg border bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700 transition-colors" title="Hướng dẫn sử dụng"><BookOpen size={18} /></button>
               )}
               <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-lg border bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"><Settings size={18} /></button>
               <button onClick={handleLogout} className="p-2 rounded-lg border bg-slate-800 border-slate-700 text-red-400 hover:bg-slate-700 transition-colors" title="Đăng xuất"><LogOut size={18} /></button>
            </div>
          </div>
          
          {activeView === 'capture' && (
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-800/40 pt-2 pb-1">
              {/* Main Product Selector - Keeps compatibility with presets */}
              <div className="relative flex-1 flex flex-col" ref={headerSearchRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder={currentPreset ? "Đã chọn: " + currentPreset.productName : "Tìm TSKT chuẩn..."} 
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-1.5 pl-9 pr-3 text-xs font-bold outline-none focus:border-blue-500/50 transition-all text-slate-100"
                      value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                      onFocus={() => setShowProductDropdown(true)}
                    />
                  </div>
                  {showProductDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[300] max-h-48 overflow-y-auto custom-scrollbar">
                        {dropdownPresets.map(p => (
                          <div key={p.id} onMouseDown={() => handleSelectPreset(p.id)} className="p-2.5 hover:bg-blue-600 cursor-pointer border-b border-slate-800 last:border-0 transition-colors">
                            <div className="font-black text-white text-[10px] uppercase">{p.productName}</div>
                            <div className="text-[8px] text-slate-400 font-bold uppercase truncate">{p.structure}</div>
                          </div>
                        ))}
                    </div>
                  )}
              </div>
              
              <div className="flex items-center justify-between gap-2">
                 {/* Mobile Selectors (Model/Key) */}
                 <div className="flex sm:hidden items-center gap-1">
                    <div className="flex items-center bg-slate-800 rounded-lg px-2 border border-slate-700 h-8 shrink-0">
                        <Cpu size={12} className="text-blue-500" />
                        <select 
                          value={selectedModel} 
                          onChange={(e) => setSelectedModel(e.target.value)} 
                          className="bg-transparent text-[8px] font-black uppercase text-slate-200 outline-none cursor-pointer w-[50px] ml-1"
                        >
                          {availableModels.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center bg-slate-800 rounded-lg px-2 border border-slate-700 h-8 shrink-0">
                        <KeyRound size={12} className="text-yellow-500" />
                        <select 
                          value={selectedApiKeyId || ''} 
                          onChange={(e) => setSelectedApiKeyId(e.target.value || null)} 
                          className="bg-transparent text-[8px] font-black uppercase text-slate-200 outline-none cursor-pointer w-[50px] ml-1"
                        >
                          <option value="" className="bg-slate-900">Sys</option>
                          {customApiKeys.map(k => <option key={k.id} value={k.id} className="bg-slate-900">{k.name}</option>)}
                        </select>
                    </div>
                 </div>

                 <button 
                  onClick={handleUploadToSheet} 
                  disabled={Object.keys(data).length === 0 || isUploading} 
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 h-8"
                >
                    {isUploading ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>} Gửi
                </button>
              </div>

            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {activeView === 'capture' ? (
          <>
            {!currentMachine ? (
              <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800/50">
                 <Box size={40} className="mx-auto mb-4 text-slate-700" />
                 <h2 className="text-sm font-bold text-white mb-3 uppercase tracking-widest">Vui lòng chọn máy</h2>
                 <button onClick={() => setIsSettingsOpen(true)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Mở Cài Đặt</button>
              </div>
            ) : (
              <>
                 {/* Production Info Inputs */}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><ClipboardList size={10}/> Lệnh sản xuất</label>
                      <input 
                        type="text" 
                        value={inputProductionOrder} 
                        onChange={(e) => setInputProductionOrder(e.target.value)}
                        placeholder="Nhập lệnh SX..." 
                        className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1 relative" ref={productNameRef}>
                      <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><Tag size={10}/> Sản phẩm</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={inputProductName}
                          onChange={(e) => { setInputProductName(e.target.value); setShowProductNameDropdown(true); }}
                          onFocus={() => setShowProductNameDropdown(true)}
                          placeholder="Tên sản phẩm..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 pr-8 text-xs font-bold text-white outline-none focus:border-blue-500"
                        />
                        {inputProductName && (
                          <button onClick={() => setInputProductName('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      {showProductNameDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[50] max-h-48 overflow-y-auto custom-scrollbar">
                           {visibleProductOptions.map((p, i) => (
                             <div key={i} onClick={() => { setInputProductName(p); setShowProductNameDropdown(false); }} className="p-2.5 hover:bg-blue-600 cursor-pointer border-b border-slate-800 last:border-0 transition-colors">
                               <div className="font-bold text-white text-xs">{p}</div>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 relative" ref={structureRef}>
                      <label className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1"><FileType size={10}/> Cấu trúc</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={inputStructure}
                          onChange={(e) => { setInputStructure(e.target.value); setShowStructureDropdown(true); }}
                          onFocus={() => setShowStructureDropdown(true)}
                          placeholder="Cấu trúc..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 pr-8 text-xs font-bold text-white outline-none focus:border-blue-500"
                        />
                        {inputStructure && (
                          <button onClick={() => setInputStructure('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      {showStructureDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[50] max-h-48 overflow-y-auto custom-scrollbar">
                           {visibleStructureOptions.map((s, i) => (
                             <div key={i} onClick={() => { setInputStructure(s); setShowStructureDropdown(false); }} className="p-2.5 hover:bg-blue-600 cursor-pointer border-b border-slate-800 last:border-0 transition-colors">
                               <div className="font-bold text-white text-xs">{s}</div>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                 </div>

                <div className="bg-slate-900/30 border border-slate-800/50 mb-6 rounded-xl overflow-x-auto no-scrollbar flex p-1 shadow-inner">
                  {currentMachine.zones.map((zone) => (
                    <button key={zone.id} onClick={() => setActiveZoneId(zone.id)} className={`flex-1 min-w-[90px] py-2.5 px-2 flex flex-col items-center gap-1.5 rounded-lg transition-all ${activeZoneId === zone.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-400'}`}>
                      <Layers size={16} />
                      <span className="text-[9px] font-black uppercase truncate max-w-full">{zone.name}</span>
                    </button>
                  ))}
                </div>

                {activeZoneId && currentMachine.zones.find(z => z.id === activeZoneId) && (
                  <ZoneView 
                    zone={currentMachine.zones.find(z => z.id === activeZoneId)!}
                    data={data[activeZoneId]} 
                    standardData={currentPreset?.data || {}} 
                    currentPreset={currentPreset} 
                    setData={handleSetData} 
                    state={uiState[activeZoneId] || { isAnalyzing: false, error: null, imageUrl: null, imageUrls: {}, processedImageUrls: {} }} 
                    setState={handleSetState} 
                    modelName={selectedModel}
                    fieldLabels={fieldLabels}
                    apiKey={activeApiKey}
                    showProcessedImage={uiConfig.showProcessedImage}
                    processingProfiles={processingProfiles}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <Dashboard logs={historicalLogs} presets={presets} machines={machines} onRefresh={fetchAllData} isRefreshing={isRefreshing} fieldLabels={fieldLabels} themeMode={uiConfig.themeMode} />
        )}
      </main>

      <UserGuideModal
        isOpen={isUserGuideOpen}
        onClose={() => setIsUserGuideOpen(false)}
        images={userGuideImages}
        onSave={(newImages) => {
          setUserGuideImages(newImages);
          handleSaveAppConfigCloud(customApiKeys, savedScriptUrls, customModels, newImages);
        }}
        currentUser={currentUser}
      />

      <SettingsModal 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} 
        googleSheetUrl={googleSheetUrl} setGoogleSheetUrl={setGoogleSheetUrl} 
        presets={presets} currentPresetId={currentPresetId} setCurrentPresetId={handleSelectPreset} 
        onRefreshPresets={fetchAllData} isRefreshing={isRefreshing} 
        customModels={customModels} setCustomModels={setCustomModels}
        machines={machines} setMachines={setMachines}
        scanConfigs={scanConfigs} setScanConfigs={setScanConfigs}
        currentMachineId={currentMachineId} setCurrentMachineId={handleMachineChange}
        fieldLabels={fieldLabels} setFieldLabels={setFieldLabels}
        apiKeys={customApiKeys} setApiKeys={setCustomApiKeys}
        selectedApiKeyId={selectedApiKeyId} setSelectedApiKeyId={setSelectedApiKeyId}
        scriptUrls={savedScriptUrls} setScriptUrls={setSavedScriptUrls}
        onSaveAppConfig={handleSaveAppConfigCloud}
        selectedModel={selectedModel}
        activeApiKey={activeApiKey}
        uiConfig={uiConfig}
        setUiConfig={setUiConfig}
        processingProfiles={processingProfiles}
        setProcessingProfiles={setProcessingProfiles}
      />
    </div>
  );
};

export default App;