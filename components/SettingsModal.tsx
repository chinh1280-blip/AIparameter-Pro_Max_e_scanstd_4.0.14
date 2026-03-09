import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Link, Plus, Trash2, Check, Layers, RefreshCw, Key, BrainCircuit, Edit3, Trash, Settings2, Box, Search, Copy, Tag, Database, Cloud, Cpu, Monitor, Scan, Lock, Palette, Sun, Moon, Type, Info, Sliders } from 'lucide-react';
import { StandardDataMap, ProductPreset, ModelConfig, Machine, ZoneDefinition, ScanConfig, UIConfig, DEFAULT_UI_CONFIG, ImageProcessingProfile, DEFAULT_PROCESSING_PROFILES } from '../types';
import { analyzeImage } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleSheetUrl: string;
  setGoogleSheetUrl: (url: string) => void;
  presets: ProductPreset[];
  currentPresetId: string | null;
  setCurrentPresetId: (id: string | null) => void;
  onRefreshPresets: () => Promise<void>;
  isRefreshing: boolean;
  customModels: ModelConfig[];
  setCustomModels: (models: ModelConfig[]) => void;
  machines: Machine[];
  setMachines: (machines: Machine[]) => void;
  scanConfigs: ScanConfig[];
  setScanConfigs: (configs: ScanConfig[]) => void;
  currentMachineId: string | null;
  setCurrentMachineId: (id: string | null) => void;
  fieldLabels: Record<string, string>;
  setFieldLabels: (labels: Record<string, string>) => void;

  apiKeys: {id: string, name: string, key: string}[];
  setApiKeys: (keys: any[]) => void;
  selectedApiKeyId: string | null;
  setSelectedApiKeyId: (id: string | null) => void;
  scriptUrls: {id: string, name: string, url: string}[];
  setScriptUrls: (urls: any[]) => void;
  onSaveAppConfig: (apiKeys: any[], scriptUrls: any[], models: any[]) => Promise<void>;

  selectedModel: string;
  activeApiKey: string;
  
  // New props for UI Config
  uiConfig?: UIConfig;
  setUiConfig?: (config: UIConfig) => void;

  // New props for Processing Profiles
  processingProfiles?: ImageProcessingProfile[];
  setProcessingProfiles?: (profiles: ImageProcessingProfile[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, googleSheetUrl, setGoogleSheetUrl, presets, currentPresetId, setCurrentPresetId, onRefreshPresets, isRefreshing, customModels, setCustomModels,
  machines, setMachines, scanConfigs, setScanConfigs, currentMachineId, setCurrentMachineId, fieldLabels, setFieldLabels,
  apiKeys, setApiKeys, selectedApiKeyId, setSelectedApiKeyId, scriptUrls, setScriptUrls, onSaveAppConfig,
  selectedModel, activeApiKey, uiConfig = DEFAULT_UI_CONFIG, setUiConfig,
  processingProfiles = DEFAULT_PROCESSING_PROFILES, setProcessingProfiles
}) => {
  const [activeTab, setActiveTab] = useState<'select' | 'machine' | 'manage' | 'labels' | 'ai' | 'cloud' | 'interface'>('manage'); // Default to Manage (Standard) which is unlocked
  const [localUrl, setLocalUrl] = useState(googleSheetUrl);
  
  // PIN Logic
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPinScreen, setShowPinScreen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const [isEditingMachine, setIsEditingMachine] = useState(false);
  const [editMachine, setEditMachine] = useState<Partial<Machine>>({ zones: [] });

  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null); // Track ID for edits
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newStructure, setNewStructure] = useState('');
  const [newData, setNewData] = useState<StandardDataMap>({});
  const [newTolerances, setNewTolerances] = useState<StandardDataMap>({});
  
  const [presetSearch, setPresetSearch] = useState('');
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newScriptName, setNewScriptName] = useState('');
  const [newScriptValue, setNewScriptValue] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelVal, setNewLabelVal] = useState('');
  const [isSyncingLabels, setIsSyncingLabels] = useState(false);

  // New state for Scan Options Selection
  const [scanOptions, setScanOptions] = useState<any[]>([]);
  const [showScanSelection, setShowScanSelection] = useState(false);
  const [scanCommonInfo, setScanCommonInfo] = useState<any>({});

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  // Profile Management State
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [newProfile, setNewProfile] = useState<ImageProcessingProfile | null>(null);

  const handleEditProfile = (profile: ImageProcessingProfile) => {
    setNewProfile({ ...profile });
    setEditingProfileId(profile.id);
  };

  const handleCreateProfile = () => {
    setNewProfile({
      id: `profile_${Date.now()}`,
      name: 'New Profile',
      resizeMaxWidth: 1200,
      jpegQuality: 80,
      enableGrayscale: false,
      enableAdaptiveThreshold: false,
      adaptiveBlockSize: 31,
      adaptiveC: 8,
      contrast: 0,
      brightness: 0
    });
    setEditingProfileId(null);
  };

  const handleSaveProfile = () => {
    if (!newProfile || !setProcessingProfiles) return;
    
    let updatedProfiles = [...processingProfiles];
    if (editingProfileId) {
        const idx = updatedProfiles.findIndex(p => p.id === editingProfileId);
        if (idx > -1) updatedProfiles[idx] = newProfile;
    } else {
        updatedProfiles.push(newProfile);
    }
    
    setProcessingProfiles(updatedProfiles);
    setNewProfile(null);
    setEditingProfileId(null);
  };

  const handleDeleteProfile = (id: string) => {
    if (!setProcessingProfiles) return;
    if (DEFAULT_PROCESSING_PROFILES.some(p => p.id === id)) {
        alert("Không thể xóa profile mặc định!");
        return;
    }
    if (confirm("Bạn có chắc chắn muốn xóa profile này?")) {
        setProcessingProfiles(processingProfiles.filter(p => p.id !== id));
    }
  };

  useEffect(() => { setLocalUrl(googleSheetUrl); }, [googleSheetUrl, isOpen]);

  // Reset PIN state when closing modal
  useEffect(() => {
    if (!isOpen) {
        setIsPinVerified(false);
        setPinInput('');
        setShowPinScreen(false);
        setActiveTab('manage'); // Reset to unlocked tab
        setShowScanSelection(false);
        setScanOptions([]);
        setScanCommonInfo({});
    }
  }, [isOpen]);

  const handleTabChange = (tabId: any) => {
    if (tabId === 'manage') {
        setActiveTab(tabId);
        setShowPinScreen(false);
        return;
    }

    if (isPinVerified) {
        setActiveTab(tabId);
    } else {
        setPendingTab(tabId);
        setShowPinScreen(true);
        setPinInput('');
    }
  };

  const verifyPin = () => {
    if (pinInput === '3745') {
        setIsPinVerified(true);
        setShowPinScreen(false);
        if (pendingTab) setActiveTab(pendingTab as any);
    } else {
        alert("Sai mã PIN! Vui lòng thử lại.");
        setPinInput('');
    }
  };

  const currentMachineSchemaKeys = useMemo(() => {
    const machine = machines.find(m => m.id === currentMachineId);
    if (!machine) return [];
    const keys = new Set<string>();
    machine.zones.forEach(zone => {
      try {
        const schema = typeof zone.schema === 'string' ? JSON.parse(zone.schema) : zone.schema;
        if (schema.properties) {
          Object.keys(schema.properties).forEach(k => keys.add(k));
        }
      } catch (e) {}
    });
    return Array.from(keys);
  }, [currentMachineId, machines]);

  const filteredPresets = useMemo(() => {
    return presets
      .filter(p => p.machineId === currentMachineId)
      .filter(p => 
        p.productName.toLowerCase().includes(presetSearch.toLowerCase()) || 
        p.structure.toLowerCase().includes(presetSearch.toLowerCase())
      );
  }, [presets, currentMachineId, presetSearch]);

  const handleSaveMachine = async () => {
    if (!editMachine.name?.trim()) return;
    const newMachines = [...machines];
    const newMachine: Machine = {
      id: editMachine.id || `m_${Date.now()}`,
      name: editMachine.name.trim(),
      zones: editMachine.zones || []
    };
    if (editMachine.id) {
      const idx = newMachines.findIndex(m => m.id === editMachine.id);
      newMachines[idx] = newMachine;
    } else {
      newMachines.push(newMachine);
    }
    setMachines(newMachines);
    if (googleSheetUrl) {
      try {
        await fetch(googleSheetUrl, {
          method: 'POST', mode: 'no-cors',
          body: JSON.stringify({ action: "save_machines", machines: newMachines })
        });
      } catch (e) {}
    }
    setIsEditingMachine(false);
  };

  const handleEditPreset = (preset: ProductPreset) => {
    setNewProductName(preset.productName); setNewStructure(preset.structure);
    setNewData({ ...preset.data }); setNewTolerances({ ...preset.tolerances || {} });
    setEditingPresetId(preset.id); // Set ID for update
    setIsEditing(true); setIsCreating(true);
  };

  const handleCopyPreset = (preset: ProductPreset) => {
    setNewProductName(`${preset.productName} (Copy)`); 
    setNewStructure(preset.structure);
    setNewData({ ...preset.data }); 
    setNewTolerances({ ...preset.tolerances || {} });
    setEditingPresetId(null); // Clear ID for new creation
    setIsEditing(false); 
    setIsCreating(true);
  };

  const handleCreatePreset = async () => {
    if (!newProductName.trim() || !newStructure.trim() || !currentMachineId) { 
      alert("Thiếu thông tin hoặc chưa chọn máy!"); return; 
    }
    setIsSavingCloud(true);
    try {
      // If editing, use the existing ID. If creating new, backend will generate ID.
      const payload = {
        action: "save_standard",
        id: isEditing ? editingPresetId : undefined, 
        productName: newProductName.trim(), 
        structure: newStructure.trim(), 
        data: newData, 
        tolerances: newTolerances, 
        machineId: currentMachineId
      };

      await fetch(googleSheetUrl, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      await new Promise(r => setTimeout(r, 1000));
      await onRefreshPresets();
      setIsCreating(false); setIsEditing(false); setEditingPresetId(null);
    } catch (error) { alert("Lỗi kết nối"); } finally { setIsSavingCloud(false); }
  };

  const handleSyncLabelsCloud = async () => {
    if (!googleSheetUrl) return;
    setIsSyncingLabels(true);
    try {
      await fetch(googleSheetUrl, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: "save_labels", labels: fieldLabels })
      });
      alert("Đã đồng bộ nhãn lên Cloud!");
    } finally {
      setIsSyncingLabels(false);
    }
  };

  const handleSyncScanConfigsCloud = async (configs: ScanConfig[]) => {
    if (!googleSheetUrl) return;
    try {
      await fetch(googleSheetUrl, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ action: "save_scan_configs", configs: configs })
      });
    } catch (e) {}
  };

  const applyScanResult = (optionData: any, commonData: any) => {
      // 1. Extract Product Name & Structure (Priority: Option > Common)
      let pName = optionData.productName || optionData.Ten_San_Pham || commonData.productName || commonData.Ten_San_Pham || '';
      const struct = optionData.structure || optionData.Cau_Truc || commonData.structure || commonData.Cau_Truc || '';
      
      // Dynamic Product Name Logic: Replace {{FILM_WIDTH}} in template if available
      // Priority: Template from Common Data -> Template from Option Data -> pName itself if it has placeholder
      let template = commonData.Ten_San_Pham_Template || commonData.productNameTemplate || optionData.Ten_San_Pham_Template || '';
      
      // If no explicit template, check if pName has the placeholder
      if (!template && pName && (pName.includes('{{FILM_WIDTH}}') || pName.includes('{{film_width}}'))) {
          template = pName;
      }

      // Get Film Width: Option Data -> Common Data (Header fallback)
      const filmWidth = optionData.filmWidth || commonData.filmWidth || '';
      
      if (template && filmWidth) {
          // Case-insensitive replacement
          pName = template.replace(/\{\{FILM_WIDTH\}\}/gi, filmWidth);
      }
      
      if (pName) setNewProductName(pName);
      if (struct) setNewStructure(struct);

      const mappedData: StandardDataMap = {};
      const mappedTols: StandardDataMap = {};

      // 2. Merge Data: Common Data first, then Option Data overrides
      // Note: We need to handle both flat structure (key: {std, tol}) and nested structure if any
      
      const processFields = (source: any) => {
          Object.entries(source).forEach(([key, val]: [string, any]) => {
            if (key === 'options' || key === 'data') return; // Skip metadata
            if (val && typeof val === 'object' && val.std !== undefined) {
              mappedData[key] = val.std;
              mappedTols[key] = val.tol;
            }
          });
      };

      // Process Common Data first
      processFields(commonData);

      // Process Option Data (can be directly in optionData or in optionData.data)
      const optionFields = optionData.data || optionData;
      processFields(optionFields);

      setNewData(mappedData);
      setNewTolerances(mappedTols);
      setEditingPresetId(null);
      setIsCreating(true);
      setIsEditing(false);
      setShowScanSelection(false); // Close modal if open
  };

  const handleScanStandardFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentMachineId) return;

    const scanConfig = scanConfigs.find(c => c.machineId === currentMachineId);
    if (!scanConfig) {
      alert("Máy này chưa được cấu hình Scan Phiếu Chuẩn.");
      return;
    }

    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        // Use processingProfileId if available
        const result = await analyzeImage(base64, scanConfig.prompt, scanConfig.schema, selectedModel, activeApiKey, scanConfig.processingProfileId, processingProfiles);
        if (result) {
          // Separate Common Data (everything except options)
          const { options, ...commonData } = result;
          
          // Check for new structure with options
          if (options && Array.isArray(options) && options.length > 0) {
             if (options.length === 1) {
                 // Only 1 option, apply directly
                 applyScanResult(options[0], commonData);
             } else {
                 // Multiple options, show selection
                 setScanCommonInfo(commonData);
                 setScanOptions(options);
                 setShowScanSelection(true);
             }
          } else {
             // Fallback to old flat structure (treat result as both common and option)
             applyScanResult(result, {});
          }
        }
      } catch (err: any) {
        alert("Lỗi Scan: " + err.message);
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddApiKey = () => {
    if (!newKeyName || !newKeyValue) return;
    const newList = [...apiKeys, { id: `key_${Date.now()}`, name: newKeyName, key: newKeyValue }];
    setApiKeys(newList);
    setNewKeyName(''); setNewKeyValue('');
  };

  const handleAddScriptUrl = () => {
    if (!newScriptName || !newScriptValue) return;
    const newList = [...scriptUrls, { id: `script_${Date.now()}`, name: newScriptName, url: newScriptValue }];
    setScriptUrls(newList);
    setNewScriptName(''); setNewScriptValue('');
  };

  const handleAddCustomModel = () => {
    if (!newModelId || !newModelName) return;
    const newList = [...customModels, { id: newModelId, name: newModelName }];
    setCustomModels(newList);
    setNewModelId(''); setNewModelName('');
  };

  const handleSyncAppConfig = () => {
    onSaveAppConfig(apiKeys, scriptUrls, customModels);
  };

  const handleUIConfigChange = (key: keyof UIConfig, value: any) => {
    if (setUiConfig) {
        setUiConfig({ ...uiConfig, [key]: value });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-black text-white flex items-center gap-3">
            <Settings2 size={22} className="text-blue-500" />
            CẤU HÌNH
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full"><X size={22} /></button>
        </div>
        
        <div className="flex border-b border-slate-800 overflow-x-auto no-scrollbar bg-slate-900/30 shrink-0">
          <TabButton id="manage" label="Bộ Chuẩn" active={activeTab} onClick={handleTabChange} />
          <TabButton id="select" label="Vận Hành" active={activeTab} onClick={handleTabChange} locked={!isPinVerified} />
          <TabButton id="machine" label="Máy & Vùng" active={activeTab} onClick={handleTabChange} locked={!isPinVerified} />
          <TabButton id="interface" label="Giao Diện" active={activeTab} onClick={handleTabChange} locked={!isPinVerified} />
          <TabButton id="labels" label="Nhãn" active={activeTab} onClick={handleTabChange} locked={!isPinVerified} />
          <TabButton id="ai" label="API & Models" active={activeTab} onClick={handleTabChange} locked={!isPinVerified} />
          <TabButton id="cloud" label="Cloud & Scripts" active={activeTab} onClick={handleTabChange} locked={!isPinVerified} />
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-950/20 relative min-h-[500px]">
          
          {/* Scan Selection Overlay */}
          {showScanSelection ? (
            <div className="absolute inset-0 bg-slate-900 z-50 flex flex-col p-6 animate-fade-in overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white font-black text-lg uppercase flex items-center gap-2">
                        <Scan size={20} className="text-cyan-400" />
                        Chọn Khổ Màng
                    </h3>
                    <button onClick={() => setShowScanSelection(false)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><X size={16}/></button>
                </div>
                <p className="text-slate-400 text-xs mb-4">AI đã tìm thấy nhiều dải khổ màng trong bảng Lực Căng. Vui lòng chọn một dải để áp dụng thông số.</p>
                
                <div className="grid grid-cols-1 gap-3">
                    {scanOptions.map((opt, idx) => (
                        <button 
                            key={idx}
                            onClick={() => applyScanResult(opt, scanCommonInfo)}
                            className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between hover:bg-blue-600/20 hover:border-blue-500 transition-all group text-left"
                        >
                            <div>
                                <p className="text-xs font-black text-white uppercase mb-1">Khổ: {opt.filmWidth || "Không xác định"}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{Object.keys(opt.data || opt).length} thông số</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 group-hover:border-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                <Check size={16} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
          ) : showPinScreen ? (
            <div className="absolute inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center p-6 animate-fade-in">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-slate-700">
                    <Lock className="text-red-500 w-8 h-8" />
                </div>
                <h3 className="text-white font-black text-xl uppercase mb-2">Yêu cầu bảo mật</h3>
                <p className="text-slate-500 text-xs mb-6 text-center max-w-[200px]">Vui lòng nhập mã PIN để truy cập cấu hình nâng cao</p>
                <div className="flex gap-2">
                    <input 
                        type="password" 
                        value={pinInput} 
                        onChange={(e) => setPinInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                        maxLength={4}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-center font-black tracking-[0.5em] text-lg w-40 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none transition-all"
                        placeholder="••••"
                        autoFocus
                    />
                    <button onClick={verifyPin} className="bg-red-600 text-white rounded-xl px-4 font-black shadow-lg active:scale-95 transition-all">OK</button>
                </div>
                <button onClick={() => setShowPinScreen(false)} className="mt-8 text-slate-500 text-xs font-bold uppercase hover:text-white">Quay lại</button>
            </div>
          ) : (
            <>
              {activeTab === 'select' && (
                <div className="space-y-5">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-inner">
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-2.5">Chọn máy hiện tại</label>
                    <select value={currentMachineId || ''} onChange={(e) => setCurrentMachineId(e.target.value || null)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-bold outline-none mb-6 text-sm">
                      <option value="">-- Chọn Máy --</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>

                    <div className="flex justify-between items-center mb-2.5">
                      <label className="block text-[9px] font-black text-slate-500 uppercase">Chọn lệnh sản xuất</label>
                      <button onClick={onRefreshPresets} disabled={isRefreshing} className="text-[9px] flex items-center gap-1.5 text-blue-400 font-black uppercase tracking-tighter"><RefreshCw size={10} className={isRefreshing ? "animate-spin" : ""} /> Sync Cloud</button>
                    </div>
                    
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                          type="text" 
                          placeholder="Tìm sản phẩm..." 
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-white font-bold outline-none text-sm"
                          value={presetSearch}
                          onChange={(e) => { setPresetSearch(e.target.value); setShowPresetDropdown(true); }}
                          onFocus={() => setShowPresetDropdown(true)}
                      />
                      {showPresetDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                            {filteredPresets.map(p => (
                              <div 
                                key={p.id} 
                                onMouseDown={() => { setCurrentPresetId(p.id); setShowPresetDropdown(false); setPresetSearch(''); }}
                                className="w-full text-left p-3.5 hover:bg-blue-600/20 border-b border-slate-800 flex flex-col cursor-pointer transition-colors"
                              >
                                <span className="font-black text-white text-xs uppercase">{p.productName}</span>
                                <span className="text-[9px] text-slate-500 font-bold uppercase">{p.structure}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'manage' && (
                <div className="space-y-4">
                  {!isCreating ? (
                    <>
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-inner mb-2 flex flex-col gap-3">
                        <label className="block text-[9px] font-black text-slate-500 uppercase">1. Chọn máy trước khi tạo bộ chuẩn mới</label>
                        <select 
                          value={currentMachineId || ''} 
                          onChange={(e) => setCurrentMachineId(e.target.value || null)} 
                          className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold outline-none text-sm"
                        >
                          <option value="">-- Click để chọn máy --</option>
                          {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setIsCreating(true); setIsEditing(false); setEditingPresetId(null); setNewProductName(''); setNewStructure(''); setNewData({}); setNewTolerances({}); }} 
                            disabled={!currentMachineId}
                            className={`flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${currentMachineId ? 'bg-blue-600 text-white shadow-lg active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                          >
                            <Plus size={16} /> Nhập Tay
                          </button>
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            ref={scanInputRef}
                            onChange={handleScanStandardFile}
                          />
                          <button 
                            onClick={() => scanInputRef.current?.click()}
                            disabled={!currentMachineId || isScanning}
                            className={`flex-1 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${currentMachineId ? 'bg-cyan-600 text-white shadow-lg active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                          >
                            {isScanning ? <RefreshCw className="animate-spin" size={16}/> : <Scan size={16} />} Scan Phiếu
                          </button>
                        </div>
                      </div>

                      {/* Thanh tìm kiếm nhỏ trong tab Bộ Chuẩn */}
                      <div className="px-2">
                        <div className="relative group">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="Tìm chuẩn đã có trong danh sách..." 
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-[10px] font-bold text-white outline-none focus:border-blue-500/50 transition-all shadow-inner"
                            value={presetSearch}
                            onChange={(e) => setPresetSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        {filteredPresets.length === 0 ? (
                          <div className="p-12 text-center opacity-25">
                            <Monitor size={40} className="mx-auto mb-3"/>
                            <p className="text-[9px] font-black uppercase tracking-widest leading-loose">Chọn máy bên trên để<br/>xem danh sách bộ chuẩn</p>
                          </div>
                        ) : (
                          filteredPresets.map(p => (
                            <div key={p.id} className="p-4 border-b border-slate-800 flex justify-between items-center group hover:bg-slate-800/20 transition-colors">
                              <div className="flex-1 min-w-0 pr-4">
                                <div className="font-black text-white text-xs uppercase break-words whitespace-normal mb-1">{p.productName}</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase break-words whitespace-normal">{p.structure}</div>
                              </div>
                              <div className="flex gap-1.5 shrink-0 items-start">
                                <button onClick={() => handleCopyPreset(p)} className="p-2 text-cyan-400 bg-cyan-400/5 rounded-lg hover:bg-cyan-400/10"><Copy size={14} /></button>
                                <button onClick={() => handleEditPreset(p)} className="p-2 text-blue-400 bg-blue-400/5 rounded-lg hover:bg-blue-400/10"><Edit3 size={14} /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-5 animate-slide-down">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Tên Sản Phẩm</label>
                           <input type="text" value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="Nhập tên sản phẩm..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-blue-500/50" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Cấu Trúc</label>
                           <input type="text" value={newStructure} onChange={e => setNewStructure(e.target.value)} placeholder="Nhập cấu trúc..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-blue-500/50" />
                        </div>
                      </div>
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 space-y-2.5">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2">Nhập thông số thiết kế</p>
                        {currentMachineSchemaKeys.map(fk => (
                            <div key={fk} className="flex items-center gap-2">
                              <label className="flex-1 text-[10px] text-slate-200 font-black uppercase truncate tracking-tighter">{fieldLabels[fk] || fk}</label>
                              <input type="number" step="0.1" value={newData[fk] ?? ''} onChange={e => setNewData({...newData, [fk]: e.target.value === '' ? undefined : parseFloat(e.target.value)})} className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-[10px] text-center font-bold" placeholder="Std" />
                              <input type="number" step="0.1" value={newTolerances[fk] ?? ''} onChange={e => setNewTolerances({...newTolerances, [fk]: e.target.value === '' ? undefined : parseFloat(e.target.value)})} className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-400 text-[10px] text-center font-bold" placeholder="±" />
                            </div>
                        ))}
                      </div>
                      <button onClick={handleCreatePreset} disabled={isSavingCloud} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">
                        {isSavingCloud ? "Đang đồng bộ..." : "Lưu bộ chuẩn vào Cloud"}
                      </button>
                      <button onClick={() => { setIsCreating(false); setIsEditing(false); setEditingPresetId(null); }} className="w-full py-2 text-slate-500 font-black uppercase text-[9px] tracking-widest hover:text-slate-300">Hủy bỏ</button>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'interface' && (
                <div className="space-y-6 animate-fade-in">
                    <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <Palette size={20} className="text-purple-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Giao diện & Màu sắc</h3>
                        </div>

                        {/* Theme Toggle */}
                        <div className="mb-6 p-1 bg-slate-950 rounded-xl flex border border-slate-800">
                            <button 
                                onClick={() => handleUIConfigChange('themeMode', 'dark')} 
                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-all ${uiConfig.themeMode === 'dark' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Moon size={12} /> Tối
                            </button>
                            <button 
                                onClick={() => handleUIConfigChange('themeMode', 'light')} 
                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-all ${uiConfig.themeMode === 'light' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Sun size={12} /> Sáng 1
                            </button>
                            <button 
                                onClick={() => handleUIConfigChange('themeMode', 'light_2')} 
                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-all ${uiConfig.themeMode === 'light_2' ? 'bg-[#feefe8] text-[#232323] shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Sun size={12} /> Sáng 2
                            </button>
                        </div>

                        {/* Debug Toggle */}
                        <div className="mb-6 bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <h4 className="text-[10px] font-black text-white uppercase mb-1">Chế độ kiểm tra ảnh</h4>
                                <p className="text-[9px] text-slate-500">Hiển thị ảnh đã qua xử lý (resize, threshold) để kiểm tra chất lượng đầu vào AI.</p>
                            </div>
                            <button 
                                onClick={() => handleUIConfigChange('showProcessedImage', !uiConfig.showProcessedImage)}
                                className={`w-12 h-6 rounded-full p-1 transition-colors ${uiConfig.showProcessedImage ? 'bg-blue-600' : 'bg-slate-800'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${uiConfig.showProcessedImage ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <button 
                            onClick={handleSyncAppConfig} 
                            className="w-full mt-6 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                        >
                            <Save size={18} /> Lưu cấu hình Giao diện
                        </button>
                    </section>

                    {/* Image Processing Profiles Section */}
                    <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <Sliders size={20} className="text-cyan-400" />
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Chế độ xử lý ảnh</h3>
                            </div>
                            <button onClick={handleCreateProfile} className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-lg font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-1">
                                <Plus size={12} /> Thêm Mới
                            </button>
                        </div>

                        {newProfile ? (
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 animate-slide-down space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                                    <h4 className="text-xs font-black text-white uppercase">{editingProfileId ? 'Chỉnh sửa Profile' : 'Tạo Profile Mới'}</h4>
                                    <button onClick={() => setNewProfile(null)} className="text-slate-500 hover:text-white"><X size={16}/></button>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase">Tên Profile</label>
                                    <input 
                                        type="text" 
                                        value={newProfile.name} 
                                        onChange={e => setNewProfile({...newProfile, name: e.target.value})} 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase">Max Width (px)</label>
                                        <input 
                                            type="number" 
                                            value={newProfile.resizeMaxWidth ?? ''} 
                                            onChange={e => setNewProfile({...newProfile, resizeMaxWidth: e.target.value === '' ? undefined : parseInt(e.target.value)})} 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase">JPEG Quality (0-100)</label>
                                        <input 
                                            type="number" 
                                            value={newProfile.jpegQuality ?? ''} 
                                            onChange={e => setNewProfile({...newProfile, jpegQuality: e.target.value === '' ? undefined : parseInt(e.target.value)})} 
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
                                    <span className="text-[10px] font-black text-white uppercase">Grayscale</span>
                                    <button 
                                        onClick={() => setNewProfile({...newProfile, enableGrayscale: !newProfile.enableGrayscale})}
                                        className={`w-10 h-5 rounded-full p-1 transition-colors ${newProfile.enableGrayscale ? 'bg-blue-600' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${newProfile.enableGrayscale ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
                                    <span className="text-[10px] font-black text-white uppercase">Adaptive Threshold</span>
                                    <button 
                                        onClick={() => setNewProfile({...newProfile, enableAdaptiveThreshold: !newProfile.enableAdaptiveThreshold})}
                                        className={`w-10 h-5 rounded-full p-1 transition-colors ${newProfile.enableAdaptiveThreshold ? 'bg-blue-600' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${newProfile.enableAdaptiveThreshold ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {newProfile.enableAdaptiveThreshold ? (
                                    <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase">Block Size (Odd)</label>
                                            <input 
                                                type="number" 
                                                value={newProfile.adaptiveBlockSize ?? ''} 
                                                onChange={e => setNewProfile({...newProfile, adaptiveBlockSize: e.target.value === '' ? undefined : parseInt(e.target.value)})} 
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase">C (Constant)</label>
                                            <input 
                                                type="number" 
                                                value={newProfile.adaptiveC ?? ''} 
                                                onChange={e => setNewProfile({...newProfile, adaptiveC: e.target.value === '' ? undefined : parseInt(e.target.value)})} 
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase">Contrast (-100 to 100)</label>
                                            <input 
                                                type="number" 
                                                value={newProfile.contrast ?? ''} 
                                                onChange={e => setNewProfile({...newProfile, contrast: e.target.value === '' ? undefined : parseInt(e.target.value)})} 
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-500 uppercase">Brightness (-100 to 100)</label>
                                            <input 
                                                type="number" 
                                                value={newProfile.brightness ?? ''} 
                                                onChange={e => setNewProfile({...newProfile, brightness: e.target.value === '' ? undefined : parseInt(e.target.value)})} 
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-white uppercase">Sử dụng Hình Mẫu (Reference Image)</span>
                                        <button 
                                            onClick={() => setNewProfile({...newProfile, enableReferenceImage: !newProfile.enableReferenceImage})}
                                            className={`w-10 h-5 rounded-full p-1 transition-colors ${newProfile.enableReferenceImage ? 'bg-blue-600' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${newProfile.enableReferenceImage ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    {newProfile.enableReferenceImage && (
                                        <div className="space-y-2 animate-slide-down">
                                            <label className="text-[9px] font-black text-slate-500 uppercase">URL Hình Mẫu (Direct Link)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="https://example.com/image.jpg"
                                                    value={newProfile.referenceImageUrl || ''} 
                                                    onChange={e => setNewProfile({...newProfile, referenceImageUrl: e.target.value})} 
                                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono outline-none focus:border-blue-500"
                                                />
                                                {newProfile.referenceImageUrl && (
                                                    <button 
                                                        onClick={() => setZoomedImage(newProfile.referenceImageUrl || null)}
                                                        className="bg-slate-800 border border-slate-700 p-2 rounded-lg text-blue-400 hover:bg-slate-700 hover:text-white transition-all"
                                                        title="Phóng to"
                                                    >
                                                        <Scan size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {newProfile.referenceImageUrl && (
                                                <div 
                                                    className="relative group w-full h-32 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center cursor-zoom-in" 
                                                    onClick={() => setZoomedImage(newProfile.referenceImageUrl || null)}
                                                >
                                                    <img 
                                                        src={newProfile.referenceImageUrl} 
                                                        alt="Reference" 
                                                        className="max-w-full max-h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" 
                                                        referrerPolicy="no-referrer" 
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                                                        <Scan className="text-white drop-shadow-lg" size={24} />
                                                        <span className="text-white text-[10px] font-black uppercase ml-2 drop-shadow-lg">Phóng to</span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <p className="text-[8px] text-slate-500 italic">Lưu ý: Link hình ảnh phải ở chế độ công khai (Public).</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button onClick={handleSaveProfile} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Lưu Profile</button>
                                    <button onClick={() => setNewProfile(null)} className="flex-1 bg-slate-800 text-slate-400 py-2 rounded-lg font-black uppercase text-[10px] hover:text-white transition-all">Hủy</button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2">
                                {processingProfiles.map(p => (
                                    <div key={p.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between group hover:border-slate-700 transition-colors">
                                        <div>
                                            <p className="text-xs font-black text-white uppercase">{p.name}</p>
                                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                                                {p.enableAdaptiveThreshold ? `Adaptive (Block: ${p.adaptiveBlockSize}, C: ${p.adaptiveC})` : `Contrast: ${p.contrast}, Brightness: ${p.brightness}`}
                                            </p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEditProfile(p)} className="p-2 bg-slate-900 text-blue-400 rounded-lg hover:bg-blue-400/10 transition-colors"><Edit3 size={14}/></button>
                                            {!DEFAULT_PROCESSING_PROFILES.some(dp => dp.id === p.id) && (
                                                <button onClick={() => handleDeleteProfile(p.id)} className="p-2 bg-slate-900 text-red-400 rounded-lg hover:bg-red-400/10 transition-colors"><Trash2 size={14}/></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <button 
                            onClick={handleSyncAppConfig} 
                            className="w-full mt-4 py-3 bg-cyan-600 text-white rounded-xl font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                        >
                            <Cloud size={16} /> Lưu & Đồng bộ Profile lên Cloud
                        </button>
                    </section>
                </div>
              )}

              {/* ... (rest of the tabs remain unchanged) ... */}
              {activeTab === 'machine' && (
                <div className="space-y-4">
                  {!isEditingMachine ? (
                    <>
                      <button onClick={() => { setEditMachine({ zones: [] }); setIsEditingMachine(true); }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"><Plus size={18} /> Thêm Máy Mới</button>
                      <div className="space-y-2">
                        {machines.map(m => (
                          <div key={m.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col gap-3 group hover:border-slate-700 transition-colors">
                            <div className="flex items-center justify-between">
                                <span className="font-black text-white uppercase text-sm truncate pr-4">{m.name}</span>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => { setEditMachine(m); setIsEditingMachine(true); }} className="p-2 text-blue-400 bg-blue-400/5 rounded-lg"><Edit3 size={16} /></button>
                                  <button onClick={() => setMachines(machines.filter(x => x.id !== m.id))} className="p-2 text-red-400 bg-red-400/5 rounded-lg"><Trash size={16} /></button>
                                </div>
                            </div>
                            
                            {/* Quản lý Scan Config cho máy */}
                            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Scan size={12}/> Scan Config (OCR Phiếu Chuẩn)</p>
                              <div className="space-y-2">
                                  <textarea 
                                    placeholder="Prompt cho quét phiếu chuẩn..." 
                                    value={scanConfigs.find(c => c.machineId === m.id)?.prompt || ''} 
                                    onChange={e => {
                                      const newConfigs = [...scanConfigs];
                                      const idx = newConfigs.findIndex(c => c.machineId === m.id);
                                      if (idx > -1) newConfigs[idx].prompt = e.target.value;
                                      else newConfigs.push({ machineId: m.id, prompt: e.target.value, schema: '' });
                                      setScanConfigs(newConfigs);
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[9px] text-white font-mono" 
                                    rows={2}
                                  />
                                  <textarea 
                                    placeholder="Schema JSON đầu ra..." 
                                    value={scanConfigs.find(c => c.machineId === m.id)?.schema || ''} 
                                    onChange={e => {
                                      const newConfigs = [...scanConfigs];
                                      const idx = newConfigs.findIndex(c => c.machineId === m.id);
                                      if (idx > -1) newConfigs[idx].schema = e.target.value;
                                      else newConfigs.push({ machineId: m.id, prompt: '', schema: e.target.value });
                                      setScanConfigs(newConfigs);
                                    }}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[9px] text-white font-mono" 
                                    rows={2}
                                  />
                                  
                                  <div className="flex items-center gap-2">
                                    <label className="text-[8px] font-black text-slate-500 uppercase whitespace-nowrap">Chế độ xử lý ảnh:</label>
                                    <select
                                        value={scanConfigs.find(c => c.machineId === m.id)?.processingProfileId || ''}
                                        onChange={(e) => {
                                            const newConfigs = [...scanConfigs];
                                            const idx = newConfigs.findIndex(c => c.machineId === m.id);
                                            if (idx > -1) newConfigs[idx].processingProfileId = e.target.value || undefined;
                                            else newConfigs.push({ machineId: m.id, prompt: '', schema: '', processingProfileId: e.target.value || undefined });
                                            setScanConfigs(newConfigs);
                                        }}
                                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-[9px] text-white font-bold outline-none focus:border-blue-500"
                                    >
                                        <option value="">Mặc định (Không xử lý)</option>
                                        {processingProfiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                  </div>

                                  <button 
                                    onClick={() => handleSyncScanConfigsCloud(scanConfigs)}
                                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-[9px] font-black uppercase text-blue-400 rounded-lg transition-all"
                                  >
                                    Lưu Config OCR
                                  </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4 animate-slide-down">
                      <input type="text" value={editMachine.name || ''} onChange={e => setEditMachine({...editMachine, name: e.target.value})} placeholder="Tên Máy" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold text-sm outline-none focus:border-blue-500/50" />
                      <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cấu hình các vùng chụp</p>
                        <button onClick={() => {
                          const zones = [...(editMachine.zones || [])];
                          zones.push({ id: `z_${Date.now()}`, name: "Vùng mới", prompt: "", schema: "", images: [{ id: `img_${Date.now()}`, label: "Ảnh 1" }] });
                          setEditMachine({ ...editMachine, zones });
                        }} className="text-[8px] bg-slate-800 px-3 py-1.5 rounded-lg font-black uppercase text-blue-400 border border-slate-700">+ Thêm Vùng</button>
                      </div>
                      {editMachine.zones?.map((zone, idx) => (
                        <div key={idx} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3 relative">
                          <button onClick={() => {
                            const zones = editMachine.zones?.filter((_, i) => i !== idx);
                            setEditMachine({...editMachine, zones});
                          }} className="absolute top-2 right-2 text-slate-600 hover:text-red-500 p-1"><X size={14}/></button>
                          <input value={zone.name} onChange={e => {
                            const zones = [...(editMachine.zones || [])];
                            zones[idx].name = e.target.value;
                            setEditMachine({...editMachine, zones});
                          }} placeholder="Tên Vùng (e.g. Màn hình Unwind)" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs font-bold" />
                          
                          <div className="space-y-2 border border-slate-800 rounded-lg p-2 bg-slate-950/50">
                            <div className="flex justify-between items-center">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cấu hình ảnh chụp</p>
                              <button onClick={() => {
                                const zones = [...(editMachine.zones || [])];
                                const images = [...(zones[idx].images || [{ id: `img_${Date.now()}_0`, label: "Ảnh 1" }])];
                                images.push({ id: `img_${Date.now()}_${images.length}`, label: `Ảnh ${images.length + 1}` });
                                zones[idx].images = images;
                                setEditMachine({...editMachine, zones});
                              }} className="text-[8px] bg-slate-800 px-2 py-1 rounded-lg font-black uppercase text-blue-400 border border-slate-700">+ Thêm Ảnh</button>
                            </div>
                            {(zone.images || [{ id: 'default', label: 'Ảnh 1' }]).map((img, imgIdx) => (
                              <div key={img.id} className="flex flex-col gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-black text-slate-500 w-4">{imgIdx + 1}.</span>
                                  <input value={img.label} onChange={e => {
                                    const zones = [...(editMachine.zones || [])];
                                    const images = [...(zones[idx].images || [{ id: 'default', label: 'Ảnh 1' }])];
                                    images[imgIdx].label = e.target.value;
                                    zones[idx].images = images;
                                    setEditMachine({...editMachine, zones});
                                  }} placeholder="Ghi chú ảnh (e.g. Chụp màn hình 1)" className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-[10px] font-bold outline-none focus:border-blue-500/50" />
                                  <button onClick={() => {
                                    const zones = [...(editMachine.zones || [])];
                                    const images = [...(zones[idx].images || [{ id: 'default', label: 'Ảnh 1' }])];
                                    if (images.length > 1) {
                                      images.splice(imgIdx, 1);
                                      zones[idx].images = images;
                                      setEditMachine({...editMachine, zones});
                                    }
                                  }} className="text-slate-600 hover:text-red-500 p-1.5 bg-slate-800 rounded-lg disabled:opacity-50" disabled={(zone.images || []).length <= 1}><Trash2 size={12}/></button>
                                </div>
                                <input value={img.guideImage || ''} onChange={e => {
                                    const zones = [...(editMachine.zones || [])];
                                    const images = [...(zones[idx].images || [{ id: 'default', label: 'Ảnh 1' }])];
                                    images[imgIdx].guideImage = e.target.value;
                                    zones[idx].images = images;
                                    setEditMachine({...editMachine, zones});
                                  }} placeholder="URL ảnh hướng dẫn (Guide Image URL)..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-400 text-[9px] font-mono outline-none focus:border-blue-500/50" />
                                  
                                  <div className="flex items-center gap-2 mt-1 px-1">
                                    <label className="text-[8px] font-black text-slate-500 uppercase">Chế độ:</label>
                                    <select
                                        value={img.processingProfileId || (img.captureMode === 'screen' ? 'screen' : 'digital_meter')}
                                        onChange={(e) => {
                                            const zones = [...(editMachine.zones || [])];
                                            const images = [...(zones[idx].images || [{ id: 'default', label: 'Ảnh 1' }])];
                                            images[imgIdx].processingProfileId = e.target.value;
                                            zones[idx].images = images;
                                            setEditMachine({...editMachine, zones});
                                        }}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[9px] text-white font-bold outline-none focus:border-blue-500"
                                    >
                                        {processingProfiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                  </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-between items-center px-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Prompt (System Instruction)</p>
                            <div className="flex items-center gap-2">
                                {(zone.images?.length || 0) > 1 && (
                                  <div className="text-[8px] text-blue-400 flex items-center gap-1 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20">
                                    <Info size={10} />
                                    <span>AI sẽ đọc {zone.images?.length} ảnh cùng lúc</span>
                                  </div>
                                )}
                                <select
                                    value={zone.modelId || ''}
                                    onChange={(e) => {
                                        const zones = [...(editMachine.zones || [])];
                                        zones[idx].modelId = e.target.value || undefined;
                                        setEditMachine({...editMachine, zones});
                                    }}
                                    className="bg-slate-950 border border-slate-800 rounded-lg p-1 text-[9px] text-white font-bold outline-none focus:border-blue-500 max-w-[100px]"
                                >
                                    <option value="">Mặc định (Theo App)</option>
                                    <option value="gemini-flash-lite-latest">Lite</option>
                                    <option value="gemini-flash-latest">Flash</option>
                                    <option value="gemini-3-pro-preview">Pro</option>
                                    {customModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                          </div>
                          <textarea value={zone.prompt} onChange={e => {
                            const zones = [...(editMachine.zones || [])];
                            zones[idx].prompt = e.target.value;
                            setEditMachine({...editMachine, zones});
                          }} placeholder={
                            (zone.images?.length || 0) > 1 
                              ? "Ví dụ: Đọc nhiệt độ từ ảnh 1 và tốc độ từ ảnh 2..." 
                              : "Prompt (System Instruction) cho vùng này..."
                          } rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 text-[10px] font-mono" />

                          <textarea value={zone.schema} onChange={e => {
                            const zones = [...(editMachine.zones || [])];
                            zones[idx].schema = e.target.value;
                            setEditMachine({...editMachine, zones});
                          }} placeholder="Schema JSON của các thông số" rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-400 text-[10px] font-mono" />

                        </div>
                      ))}
                      <button onClick={handleSaveMachine} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={18}/> Lưu Máy</button>
                      <button onClick={() => setIsEditingMachine(false)} className="w-full text-slate-500 font-bold uppercase text-[9px] tracking-widest py-2">Hủy quay lại</button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'labels' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Hiển thị nhãn Tiếng Việt</h3>
                    <button onClick={handleSyncLabelsCloud} disabled={isSyncingLabels} className="text-[9px] flex items-center gap-1.5 text-blue-400 font-black uppercase tracking-tighter"><RefreshCw size={12} className={isSyncingLabels ? "animate-spin" : ""} /> Đồng bộ</button>
                  </div>
                  
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4 shadow-inner">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase ml-1 tracking-widest">Schema Key</label>
                        <input 
                          list="keys-datalist"
                          placeholder="e.g. unwind_1" 
                          value={newLabelKey} 
                          onChange={e => setNewLabelKey(e.target.value)} 
                          className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white font-mono outline-none focus:border-blue-500/30" 
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-500 uppercase ml-1 tracking-widest">Tên Tiếng Việt</label>
                        <input placeholder="e.g. Trục Xả 1" value={newLabelVal} onChange={e => setNewLabelVal(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white font-bold outline-none focus:border-blue-500/30" />
                      </div>
                      <datalist id="keys-datalist">
                        {currentMachineSchemaKeys.map(k => <option key={k} value={k} />)}
                      </datalist>
                    </div>
                    <button onClick={() => { if(!newLabelKey) return; setFieldLabels({...fieldLabels, [newLabelKey]: newLabelVal}); setNewLabelKey(''); setNewLabelVal(''); }} className="w-full py-3 bg-yellow-600/10 border border-yellow-600/20 text-yellow-500 text-[10px] font-black uppercase rounded-lg shadow-sm hover:bg-yellow-600/20 active:scale-95 transition-all">+ Thêm nhãn mới</button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {Object.entries(fieldLabels).map(([key, val]) => (
                        <div key={key} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between group hover:border-slate-700 transition-colors">
                          <div className="flex-1 min-w-0 pr-4">
                              <div className="text-[8px] font-bold text-slate-500 font-mono uppercase truncate mb-0.5">{key}</div>
                              <div className="text-xs font-black text-white uppercase truncate">{val}</div>
                          </div>
                          <button onClick={() => { const n = {...fieldLabels}; delete n[key]; setFieldLabels(n); }} className="text-red-500/70 p-2 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4"><Key size={20} className="text-yellow-400" /><h3 className="text-sm font-black text-white uppercase tracking-widest">Danh sách API Keys</h3></div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <input type="text" placeholder="Tên Gợi Nhớ" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
                      <input type="password" placeholder="API Key" value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
                    </div>
                    <button onClick={handleAddApiKey} className="w-full py-3 bg-slate-800 border border-slate-700 text-xs font-black uppercase text-white rounded-xl hover:bg-slate-700 transition-all mb-4">+ Thêm Key Mới</button>

                    <div className="space-y-2">
                      <div onClick={() => setSelectedApiKeyId(null)} className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${selectedApiKeyId === null ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-950 border-slate-800'}`}>
                        <span className="text-xs font-bold">Dùng API Key Hệ Thống</span>
                        {selectedApiKeyId === null && <Check size={16} className="text-blue-500" />}
                      </div>
                      {apiKeys.map(k => (
                        <div key={k.id} className="group relative">
                          <div onClick={() => setSelectedApiKeyId(k.id)} className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${selectedApiKeyId === k.id ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-950 border-slate-800'}`}>
                            <span className="text-xs font-bold">{k.name}</span>
                            {selectedApiKeyId === k.id && <Check size={16} className="text-blue-500" />}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setApiKeys(apiKeys.filter(x => x.id !== k.id)); }} className="absolute -right-2 top-1/2 -translate-y-1/2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4"><Cpu size={20} className="text-blue-400" /><h3 className="text-sm font-black text-white uppercase tracking-widest">Danh sách API Versions</h3></div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <input type="text" placeholder="Model ID" value={newModelId} onChange={e => setNewModelId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
                      <input type="text" placeholder="Tên hiển thị" value={newModelName} onChange={e => setNewModelName(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
                    </div>
                    <button onClick={handleAddCustomModel} className="w-full py-3 bg-slate-800 border border-slate-700 text-xs font-black uppercase text-white rounded-xl hover:bg-slate-700 transition-all mb-4">+ Thêm Model Mới</button>

                    <div className="space-y-2">
                      {customModels.map(m => (
                        <div key={m.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-white">{m.name}</span>
                            <span className="text-[9px] font-mono text-slate-500">{m.id}</span>
                          </div>
                          <button onClick={() => setCustomModels(customModels.filter(x => x.id !== m.id))} className="text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <button onClick={handleSyncAppConfig} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Save size={18} /> Lưu cấu hình hệ thống</button>
                </div>
              )}

              {activeTab === 'cloud' && (
                <div className="space-y-6">
                  <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-3 mb-4"><Database size={20} className="text-cyan-400" /><h3 className="text-sm font-black text-white uppercase tracking-widest">Cloud Scripts</h3></div>
                    
                    <div className="space-y-3 mb-4">
                      <input type="text" placeholder="Tên Gợi Nhớ" value={newScriptName} onChange={e => setNewScriptName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
                      <input type="text" placeholder="URL AppScript" value={newScriptValue} onChange={e => setNewScriptValue(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white" />
                      <button onClick={handleAddScriptUrl} className="w-full py-3 bg-cyan-600/10 border border-cyan-500/30 text-xs font-black uppercase text-cyan-400 rounded-xl active:scale-95 transition-all">+ Thêm Link Scripts</button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {scriptUrls.map(s => (
                        <div key={s.id} className="group flex items-center gap-2">
                          <button onClick={() => { setGoogleSheetUrl(s.url); setLocalUrl(s.url); }} className={`flex-1 p-3 rounded-xl border flex flex-col items-start transition-all ${localUrl === s.url ? 'bg-cyan-600/20 border-cyan-500' : 'bg-slate-950 border-slate-800'}`}>
                              <span className="text-xs font-black text-white uppercase">{s.name}</span>
                              <span className="text-[8px] text-slate-500 truncate w-full text-left">{s.url}</span>
                          </button>
                          <button onClick={() => setScriptUrls(scriptUrls.filter(x => x.id !== s.id))} className="p-3 text-red-500/70 hover:bg-red-500/10 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Đang kết nối URL:</label>
                    <div className="flex gap-2">
                        <input type="text" value={localUrl} onChange={e => setLocalUrl(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 font-mono" />
                        <button onClick={() => setGoogleSheetUrl(localUrl)} className="px-4 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Save size={16}/></button>
                    </div>
                  </div>

                  <button onClick={handleSyncAppConfig} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"><Cloud size={18} /> Đồng Bộ Config Lên Sheet</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {zoomedImage && (
        <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setZoomedImage(null)}>
            <button onClick={() => setZoomedImage(null)} className="absolute top-4 right-4 text-white/50 hover:text-white p-2 transition-colors"><X size={32}/></button>
            <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" referrerPolicy="no-referrer" />
        </div>
      )}
    </div>
  );
};

const TabButton = ({ id, label, active, onClick, locked }: any) => (
  <button 
    onClick={() => onClick(id)} 
    className={`py-3 px-4 text-[9px] font-black uppercase tracking-tighter border-b-2 whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${active === id ? 'text-blue-400 border-blue-400 bg-blue-400/5' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
  >
    {label} {locked && <Lock size={10} className="text-slate-600" />}
  </button>
);