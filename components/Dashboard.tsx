import React, { useState, useMemo, useEffect } from 'react';
import { LogEntry, ProductPreset, getDefaultTolerance, Machine } from '../types';
import { 
  Search, BarChart3, ChevronDown, ChevronUp, 
  AlertCircle, CheckCircle2, History, RefreshCw, TrendingUp,
  Clock, Inbox, Eye, Target, Calendar, Percent, Monitor,
  Layers, Info, X, Activity, EyeOff, LayoutGrid, List
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Area, Line, LabelList,
  ComposedChart
} from 'recharts';

interface DashboardProps {
  logs: LogEntry[];
  presets: ProductPreset[];
  machines: Machine[];
  onRefresh: () => void;
  isRefreshing: boolean;
  fieldLabels: Record<string, string>;
  themeMode?: string; // Add themeMode prop
}

// Helper to get Product Name from new log structure or fallback
const getLogProductName = (log: any) => {
    return log.product || log["Product"] || log.productName || log["Sản phẩm"] || log["ProductName"] || "N/A";
};

const getLogStructure = (log: any) => {
    return log.structure || log["Structure"] || log["Cấu trúc"] || "N/A";
};

const getLogValue = (log: any, fieldKey: string, type: 'Act' | 'Std' | 'Diff' = 'Act'): number => {
  if (!log) return 0;
  const suffix = type.toLowerCase();
  const targetKey = `${fieldKey}_${suffix}`;
  let val = log[targetKey];
  if (val === undefined || val === null || val === "") {
    if (type === 'Act') val = log[fieldKey];
    else if (type === 'Std') val = log[`std_${fieldKey}`] || log[`Std_${fieldKey}`];
    else if (type === 'Diff') val = log[`diff_${fieldKey}`] || log[`Diff_${fieldKey}`];
  }
  return parseNumericValue(val);
};

const parseNumericValue = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim().replace(',', '.');
  str = str.replace(/[^-0-9.]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

const parseLogDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  const str = String(dateStr).trim();
  const regexVN = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(.*)$/;
  const match = str.match(regexVN);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    let year = parseInt(match[3]);
    if (year < 100) year += 2000;
    const timePart = (match[4] || "").trim();
    let h = 0, m = 0, s = 0;
    if (timePart) {
      const t = timePart.split(':');
      h = parseInt(t[0]) || 0; m = parseInt(t[1]) || 0; s = parseInt(t[2]) || 0;
    }
    return new Date(year, month, day, h, m, s);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const CustomDataLabels = (props: any) => {
  const { x, y, value, payload, index, showAct, showDiff, showPerc, chartData, tolerance, themeMode } = props;
  if (!chartData || !chartData[index]) return null;
  
  const data = chartData[index];
  const labels = [];
  if (showAct) labels.push({ text: data.value, color: "#fff" });
  if (showDiff) labels.push({ text: data.diffValue, color: "#93c5fd" }); 
  if (showPerc) labels.push({ text: `${data.diffPercent}%`, color: "#cbd5e1" });

  if (labels.length === 0) return null;

  const diff = Math.abs(data.value - data.std);
  const isOut = diff > (tolerance || 0);

  const boxWidth = 58;
  const boxHeight = labels.length * 15 + 8;
  const boxY = y - boxHeight - 15;

  // Change background color based on theme
  const fillStyle = (themeMode && themeMode !== 'dark') ? "rgba(35, 35, 35, 0.9)" : "rgba(255, 255, 255, 0.12)";

  return (
    <g>
      <rect 
        x={x - boxWidth / 2} 
        y={boxY} 
        width={boxWidth} 
        height={boxHeight} 
        rx={8} 
        fill={fillStyle}
        stroke={isOut ? "rgba(239, 68, 68, 0.9)" : "rgba(59, 130, 246, 0.4)"} 
        strokeWidth={isOut ? 2 : 1.5}
        style={{ backdropFilter: 'blur(8px)' }}
      />
      {labels.map((lbl, i) => (
        <text 
          key={i}
          x={x} 
          y={boxY + 14 + i * 15} 
          fill={lbl.color} 
          fontSize={10} 
          fontWeight="900" 
          textAnchor="middle"
        >
          {lbl.text}
        </text>
      ))}
    </g>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ logs, presets, machines, onRefresh, isRefreshing, fieldLabels, themeMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterMachineId, setFilterMachineId] = useState<string | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedChartField, setSelectedChartField] = useState('speed');
  
  const [showActual, setShowActual] = useState(true);
  const [showDiff, setShowDiff] = useState(false);
  const [showPercent, setShowPercent] = useState(false);
  const [showStdLines, setShowStdLines] = useState(true);
  const [logViewMode, setLogViewMode] = useState<'grid' | 'list'>('grid');

  const availableProducts = useMemo(() => {
    const rawData = Array.isArray(logs) ? logs : [];
    const machineFilteredLogs = filterMachineId === 'all'
      ? rawData
      : rawData.filter(log => (log.machineId || log["MachineID"] || log["Máy"] || log["machine_id"]) === filterMachineId);

    const productNames = machineFilteredLogs.map(l => getLogProductName(l)).filter(Boolean);
    return Array.from(new Set(productNames)).sort();
  }, [logs, filterMachineId]);

  const machineSpecificFields = useMemo(() => {
    const fields = new Set<string>();
    
    if (filterMachineId === 'all') {
      Object.keys(fieldLabels).forEach(k => fields.add(k));
      machines.forEach(m => m.zones.forEach(z => {
        try {
          const schema = typeof z.schema === 'string' ? JSON.parse(z.schema) : z.schema;
          if (schema.properties) Object.keys(schema.properties).forEach(k => fields.add(k));
        } catch (e) {}
      }));
    } else {
      const targetMachine = machines.find(m => m.id === filterMachineId);
      if (targetMachine) {
        targetMachine.zones.forEach(z => {
          try {
            const schema = typeof z.schema === 'string' ? JSON.parse(z.schema) : z.schema;
            if (schema.properties) Object.keys(schema.properties).forEach(k => fields.add(k));
          } catch (e) {}
        });
      }
    }
    
    if (fields.size === 0) fields.add('speed');
    
    return Array.from(fields).sort();
  }, [machines, filterMachineId, fieldLabels]);

  const allFields = useMemo(() => {
    const fields = new Set<string>(Object.keys(fieldLabels));
    machines.forEach(m => m.zones.forEach(z => {
      try {
        const schema = typeof z.schema === 'string' ? JSON.parse(z.schema) : z.schema;
        if (schema.properties) Object.keys(schema.properties).forEach(k => fields.add(k));
      } catch (e) {}
    }));
    return Array.from(fields);
  }, [machines, fieldLabels]);

  useEffect(() => {
    if (filterProduct !== 'all' && !availableProducts.includes(filterProduct)) {
      setFilterProduct('all');
    }
  }, [filterMachineId, availableProducts]);

  useEffect(() => {
    if (!machineSpecificFields.includes(selectedChartField) && machineSpecificFields.length > 0) {
      setSelectedChartField(machineSpecificFields[0]);
    }
  }, [machineSpecificFields, selectedChartField]);

  const [filterUser, setFilterUser] = useState('all');

  const availableUsers = useMemo(() => {
    const rawData = Array.isArray(logs) ? logs : [];
    const users = rawData.map(l => l.uploadedBy || l["User"] || l["Người gửi"] || "N/A").filter(Boolean);
    return Array.from(new Set(users)).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const rawData = Array.isArray(logs) ? logs : [];
    return rawData
      .filter(log => {
        const pName = String(getLogProductName(log)).toLowerCase();
        const sName = String(getLogStructure(log)).toLowerCase();
        const matchesSearch = pName.includes(searchTerm.toLowerCase()) || sName.includes(searchTerm.toLowerCase());
        const matchesProduct = filterProduct === 'all' || getLogProductName(log) === filterProduct;
        
        const mId = log.machineId || log["MachineID"] || log["Máy"] || log["machine_id"];
        const matchesMachine = filterMachineId === 'all' || mId === filterMachineId;

        const user = log.uploadedBy || log["User"] || log["Người gửi"] || "N/A";
        const matchesUser = filterUser === 'all' || user === filterUser;
        
        const logDate = parseLogDate(log.timestamp || log["Timestamp"] || log["Thời gian"]);
        if (!logDate) return matchesSearch && matchesProduct && matchesMachine && matchesUser;

        const d_log_ts = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate()).getTime();
        if (startDate) {
          const s = new Date(startDate);
          if (d_log_ts < new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()) return false;
        }
        if (endDate) {
          const e = new Date(endDate);
          if (d_log_ts > new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()) return false;
        }

        return matchesSearch && matchesProduct && matchesMachine && matchesUser;
      })
      .sort((a, b) => {
        const dateA = parseLogDate(a.timestamp || a["Timestamp"] || a["Thời gian"])?.getTime() || 0;
        const dateB = parseLogDate(b.timestamp || b["Timestamp"] || b["Thời gian"])?.getTime() || 0;
        return dateB - dateA;
      });
  }, [logs, searchTerm, filterProduct, filterMachineId, filterUser, startDate, endDate]);

  const selectedPreset = useMemo(() => {
    if (filterProduct === 'all') return null;
    // Try to match preset with input product name, though input might differ slightly
    return presets.find(p => p.productName === filterProduct);
  }, [filterProduct, presets]);

  const activeToleranceValue = useMemo(() => {
    return selectedPreset?.tolerances?.[selectedChartField] ?? getDefaultTolerance(selectedChartField);
  }, [selectedPreset, selectedChartField]);

  const chartData = useMemo(() => {
    const tol = activeToleranceValue;
    return [...filteredLogs].slice(0, 20).reverse().map(log => {
      const logDate = parseLogDate(log.timestamp || log["Timestamp"] || log["Thời gian"]);
      const timeStr = logDate ? `${logDate.getDate()}/${logDate.getMonth() + 1} ${logDate.getHours()}:${String(logDate.getMinutes()).padStart(2, '0')}` : "--/--";
      
      const day = logDate ? String(logDate.getDate()).padStart(2, '0') : "--";
      const month = logDate ? String(logDate.getMonth() + 1).padStart(2, '0') : "--";
      const year = logDate ? String(logDate.getFullYear()).slice(-2) : "--";
      const dateShort = `${day}/${month}/${year}`;

      const actValue = getLogValue(log, selectedChartField, 'Act');
      const stdValue = getLogValue(log, selectedChartField, 'Std');
      const diffVal = parseFloat((actValue - stdValue).toFixed(1));
      let diffPercent = stdValue > 0 ? ((actValue - stdValue) / stdValue) * 100 : 0;

      return {
        time: timeStr,
        dateShort: dateShort,
        productName: getLogProductName(log),
        structure: getLogStructure(log),
        value: actValue,
        std: stdValue,
        upperBound: stdValue > 0 ? stdValue + tol : null,
        lowerBound: stdValue > 0 ? stdValue - tol : null,
        toleranceRange: stdValue > 0 ? [stdValue - tol, stdValue + tol] : null,
        diffPercent: diffPercent.toFixed(1),
        diffValue: diffVal > 0 ? `+${diffVal}` : `${diffVal}`
      };
    });
  }, [filteredLogs, selectedChartField, activeToleranceValue]);

  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const vals = chartData.flatMap(d => [d.value, d.std, d.upperBound, d.lowerBound].filter(v => v !== null) as number[]);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const range = rawMax - rawMin;
    const padding = Math.max(range * 0.5, 5);
    return [Math.max(0, Math.floor(rawMin - padding)), Math.ceil(rawMax + padding)];
  }, [chartData]);

  const timeStats = useMemo(() => {
    let d = 0, w = 0, m = 0;
    const now = new Date();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    (Array.isArray(logs) ? logs : []).forEach(log => {
      const logDate = parseLogDate(log.timestamp || log["Timestamp"] || log["Thời gian"]);
      if (!logDate) return;
      const t = logDate.getTime();
      if (t >= todayTs) d++;
      if (now.getTime() - t < 7 * 24 * 3600 * 1000) w++;
      if (logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()) m++;
    });
    return { d, w, m, todayDate: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}` };
  }, [logs]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Stats */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col md:flex-row gap-6 items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4 w-full md:auto">
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
             <Clock className="text-blue-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg">Đo lường sản xuất</h3>
            <button onClick={onRefresh} disabled={isRefreshing} className="flex items-center gap-1.5 text-[10px] text-blue-400 font-black uppercase tracking-tighter mt-1">
               <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} /> Sync Cloud
            </button>
          </div>
        </div>
        <div className="flex items-center justify-around md:justify-end gap-4 md:gap-8 w-full md:auto">
          <StatBox label="Hôm nay" value={timeStats.d} subValue={timeStats.todayDate} color="text-blue-400" />
          <StatBox label={`Tuần`} value={timeStats.w} subValue="Bản ghi" color="text-cyan-400" />
          <StatBox label="Tháng này" value={timeStats.m} subValue="Bản ghi" color="text-indigo-400" />
        </div>
      </div>

      {/* Machine Filter */}
      <div className="bg-slate-900/50 border border-slate-800 p-2 rounded-2xl overflow-x-auto no-scrollbar shadow-inner">
         <div className="flex items-center gap-2 min-w-max">
            <button 
              onClick={() => setFilterMachineId('all')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterMachineId === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
            >
               <Layers size={14} /> Tất cả máy
            </button>
            {machines.map(m => (
              <button 
                key={m.id}
                onClick={() => setFilterMachineId(m.id)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${filterMachineId === m.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}
              >
                 <Monitor size={14} /> {m.name}
              </button>
            ))}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={<History className="text-blue-400" />} label="Tổng bản ghi" value={filteredLogs.length} trend="Bản ghi" />
        <KpiCard icon={<AlertCircle className="text-red-400" />} label="Lỗi vượt ngưỡng" value={filteredLogs.filter(l => allFields.some(f => Math.abs(getLogValue(l, f, 'Diff')) > (presets.find(p => p.productName === getLogProductName(l))?.tolerances?.[f] || getDefaultTolerance(f)))).length} trend="Cảnh báo" color="red" />
        <KpiCard icon={<BarChart3 className="text-green-400" />} label="Hiệu suất" value={filteredLogs.length > 0 ? (100 - (filteredLogs.filter(l => allFields.some(f => Math.abs(getLogValue(l, f, 'Diff')) > (presets.find(p => p.productName === getLogProductName(l))?.tolerances?.[f] || getDefaultTolerance(f)))).length / filteredLogs.length * 100)).toFixed(1) : 0} trend="Phần trăm đạt" unit="%" color="green" />
      </div>

      {/* Main Chart Section */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" placeholder="Tìm sản phẩm..." className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="relative">
            <select className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-2xl py-3 px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-white" value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
              <option value="all">Tất cả sản phẩm</option>
              {availableProducts.map(n => <option key={n as string} value={n as string}>{n as string}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
          </div>
          <div className="relative">
            <select className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-2xl py-3 px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-white" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="all">Tất cả người gửi</option>
              {availableUsers.map(u => <option key={u as string} value={u as string}>{u as string}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
          </div>
          <div className="relative">
             <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
             <select 
               className="w-full appearance-none bg-slate-800/50 border border-slate-700 rounded-2xl py-3 pl-12 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-white font-bold" 
               value={selectedChartField} 
               onChange={e => setSelectedChartField(e.target.value)}
             >
               {machineSpecificFields.map(f => (
                 <option key={f} value={f}>{fieldLabels[f] || f}</option>
               ))}
             </select>
             <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
          </div>
          <div className="relative">
             <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
             <input type="date" className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 text-white" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="relative">
             <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
             <input type="date" className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 text-white" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Chart Body */}
        <div className="flex flex-col gap-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-inner min-h-[500px]">
          <div className="flex-1 min-h-[400px] relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-3">
                <TrendingUp size={24} className="text-green-400"/>
                <h3 className="font-bold text-slate-300 text-xs uppercase tracking-widest">Biểu đồ: {fieldLabels[selectedChartField] || selectedChartField}</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowActual(!showActual)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${showActual ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'}`}>Thực tế</button>
                <button onClick={() => setShowDiff(!showDiff)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${showDiff ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'}`}>Độ lệch</button>
                <button onClick={() => setShowPercent(!showPercent)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${showPercent ? 'bg-slate-400 text-slate-900 border-slate-300' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'}`}>% Lệch</button>
                <div className="w-px h-6 bg-slate-800 mx-1"></div>
                <button onClick={() => setShowStdLines(!showStdLines)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all flex items-center gap-2 ${showStdLines ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'}`}>
                  {showStdLines ? <Eye size={12}/> : <EyeOff size={12}/>} Chuẩn
                </button>
              </div>
            </div>

            {/* Force fixed height to resolve width(-1) error */}
            <div style={{ width: '100%', height: '400px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 70, right: 35, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} dy={10} />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={yAxisDomain} 
                      allowDecimals={true} 
                      width={50}
                      tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)}
                    />
                    <Tooltip content={(props) => <CustomTooltip {...props} fieldLabels={fieldLabels} />} />
                    
                    {showStdLines && (
                      <>
                        <Area type="monotone" dataKey="toleranceRange" fill="#fbbf24" fillOpacity={0.07} stroke="none" isAnimationActive={false} />
                        <Line type="monotone" dataKey="upperBound" stroke="#fbbf24" strokeWidth={1} dot={false} strokeDasharray="5 5" isAnimationActive={false} />
                        <Line type="monotone" dataKey="lowerBound" stroke="#fbbf24" strokeWidth={1} dot={false} strokeDasharray="5 5" isAnimationActive={false} />
                        <Line type="monotone" dataKey="std" stroke="#10b981" strokeWidth={2.5} dot={false} />
                      </>
                    )}

                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.15} 
                      strokeWidth={4} 
                      animationDuration={1200}
                      dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2.5, stroke: '#0b1120', fillOpacity: 1 }}
                      activeDot={{ r: 8, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3 }}
                    >
                      <LabelList 
                        dataKey="value" 
                        content={(props) => (
                          <CustomDataLabels 
                            {...props} 
                            showAct={showActual} 
                            showDiff={showDiff} 
                            showPerc={showPercent} 
                            chartData={chartData} 
                            tolerance={activeToleranceValue}
                            themeMode={themeMode}
                          />
                        )} 
                      />
                    </Area>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2">
                  <Inbox size={48} className="opacity-20"/><p className="font-bold uppercase text-[10px] tracking-widest">Trống dữ liệu biểu đồ</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom presets */}
          {selectedPreset && (
            <div className="w-full bg-slate-950/40 border border-slate-800 rounded-3xl p-4 flex flex-col shadow-inner animate-fade-in shrink-0">
               <div className="flex items-center gap-2 mb-3 px-1">
                  <Target size={14} className="text-blue-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BỘ THÔNG SỐ CHUẨN: {selectedPreset.productName}</span>
               </div>
               
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11 gap-2 overflow-x-auto no-scrollbar pb-1">
                  {Object.entries(selectedPreset.data).map(([key, val]) => {
                    const isSelected = key === selectedChartField;
                    const tol = selectedPreset.tolerances?.[key] ?? getDefaultTolerance(key);
                    return (
                      <div 
                        key={key} 
                        onClick={() => setSelectedChartField(key)} 
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-center min-w-[100px] ${isSelected ? 'bg-blue-600/30 border-blue-500 ring-2 ring-blue-500/10' : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}`}
                      >
                         <p className={`text-[8px] font-black uppercase truncate tracking-tight transition-colors mb-1 ${isSelected ? 'text-blue-300' : 'text-slate-500'}`}>
                           {fieldLabels[key] || key}
                         </p>
                         <div className="flex justify-between items-baseline">
                            <span className="text-sm font-black text-white font-mono leading-none tracking-tighter">{val}</span>
                            <span className="text-[8px] font-bold text-slate-600">±{tol}</span>
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-bold flex items-center gap-3 text-white text-lg">
            <History size={20} className="text-blue-400" /> Nhật ký kiểm tra chi tiết
          </h3>
          <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setLogViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${logViewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              title="Dạng thẻ"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setLogViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${logViewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              title="Dạng danh sách"
            >
              <List size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800">
              <Inbox size={48} className="mx-auto mb-2 opacity-10"/><p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Trống nhật ký</p>
            </div>
          ) : (
            filteredLogs.map((log, i) => <LogCard key={i} log={log} availableFields={allFields} presets={presets} machines={machines} fieldLabels={fieldLabels} viewMode={logViewMode} />)
          )}
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, subValue, color }: any) => (
  <div className="text-center">
    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-xl font-black ${color} tracking-tight leading-none`}>{value}</p>
    <p className="text-[9px] text-slate-600 font-bold mt-1 tracking-tight">{subValue}</p>
  </div>
);

const KpiCard = ({ icon, label, value, trend, unit = "", color = "blue" }: any) => {
  const colorMap: any = {
    blue: "border-blue-500/20 bg-blue-500/5",
    red: "border-red-500/20 bg-red-500/5",
    green: "border-green-500/20 bg-green-500/5",
  };
  return (
    <div className={`bg-slate-900 border ${colorMap[color]} p-5 rounded-3xl shadow-xl transition-all hover:scale-[1.02]`}>
      <div className="flex items-center gap-3 mb-2">
         <div className="p-2 bg-slate-800 rounded-xl border border-slate-700">{icon}</div>
         <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-3xl font-black text-white">{value}</p>
        <span className="text-sm font-bold text-slate-500">{unit}</span>
      </div>
      <div className="mt-2 text-[9px] font-black text-slate-600 uppercase tracking-widest">{trend}</div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label, fieldLabels }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const diffVal = data.diffValue;
    const diffPerc = parseFloat(data.diffPercent);
    const color = diffPerc > 0 ? 'text-red-400' : (diffPerc < 0 ? 'text-yellow-400' : 'text-green-400');
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl backdrop-blur-md min-w-[200px]">
        <div className="mb-3 border-b border-slate-800 pb-2">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">{data.dateShort} - {label.split(' ')[1]}</p>
          <p className="text-xs font-black text-white uppercase tracking-tight truncate">{data.productName}</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter truncate">{data.structure}</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between gap-8"><span className="text-[10px] font-bold text-slate-400 uppercase">Thực tế:</span><span className="text-xs font-black text-blue-400 font-mono">{data.value}</span></div>
          <div className="flex justify-between gap-8"><span className="text-[10px] font-bold text-slate-400 uppercase">Chuẩn:</span><span className="text-xs font-black text-green-400 font-mono">{data.std}</span></div>
          <div className="flex justify-between gap-8 pt-1 border-t border-slate-800"><span className="text-[10px] font-bold text-slate-400 uppercase">Lệch:</span><span className={`text-xs font-black font-mono ${color}`}>{diffVal} ({diffPerc}%)</span></div>
        </div>
      </div>
    );
  }
  return null;
};

const LogCard: React.FC<{ log: any, availableFields: string[], presets: ProductPreset[], machines: Machine[], fieldLabels: Record<string, string>, viewMode?: 'grid' | 'list' }> = ({ log, availableFields, presets, machines, fieldLabels, viewMode = 'grid' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const pName = getLogProductName(log);
  const sName = getLogStructure(log);
  const time = log.timestamp || log["Timestamp"] || log["Thời gian"] || "N/A";
  
  let formattedTime = time;
  const logDate = parseLogDate(time);
  if (logDate) {
    const h = String(logDate.getHours()).padStart(2, '0');
    const m = String(logDate.getMinutes()).padStart(2, '0');
    const s = String(logDate.getSeconds()).padStart(2, '0');
    const d = String(logDate.getDate()).padStart(2, '0');
    const mo = String(logDate.getMonth() + 1).padStart(2, '0');
    const y = String(logDate.getFullYear()).slice(-2);
    formattedTime = `${h}:${m}:${s} ${d}/${mo}/${y}`;
  }
  
  const mId = log.machineId || log["MachineID"] || log["Máy"] || log["machine_id"];
  const mName = machines.find(m => m.id === mId)?.name || log.machineName || log["Tên máy"] || "N/A";
  const user = log.uploadedBy || log["User"] || log["Người gửi"] || "N/A";

  const currentPreset = presets.find(p => p.productName === pName);
  
  const logDataKeys = useMemo(() => {
    return availableFields.filter(f => {
      const val = getLogValue(log, f, 'Act');
      return val !== 0 || log[f] !== undefined;
    });
  }, [log, availableFields]);

  const hasAlert = logDataKeys.some(f => Math.abs(getLogValue(log, f, 'Diff')) > (currentPreset?.tolerances?.[f] ?? getDefaultTolerance(f)));

  return (
    <div className={`bg-slate-900 border ${isOpen ? 'border-blue-500/50' : 'border-slate-800'} rounded-3xl overflow-hidden transition-all shadow-md`}>
      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${hasAlert ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
            {hasAlert ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-black text-white text-sm truncate uppercase tracking-tight">{pName}</h4>
              <span className="text-slate-500 font-black text-sm">|</span>
              <span className="text-slate-400 font-bold text-xs truncate">{user}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-0.5">
              {sName}
            </div>
            <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1">
               <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-blue-400">{mName}</span>
               <span>•</span>
               <span>{formattedTime}</span>
            </div>
          </div>
        </div>
        <div className={`p-2 rounded-full transition-all ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {isOpen && (
        <div className="p-4 pt-0 bg-slate-950/40 border-t border-slate-800/50 animate-slide-down">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mt-4">
              {logDataKeys.map(f => {
                const val = getLogValue(log, f, 'Act');
                let std = getLogValue(log, f, 'Std');
                let diff = getLogValue(log, f, 'Diff');
                
                if (std === 0 && diff === 0 && currentPreset?.data?.[f] !== undefined) {
                    std = currentPreset.data[f];
                    diff = parseFloat((val - std).toFixed(2));
                }

                const tol = currentPreset?.tolerances?.[f] ?? getDefaultTolerance(f);
                const diffAbs = Math.abs(diff);

                let borderColor = 'border-slate-800';
                if (diffAbs <= tol / 2) {
                    borderColor = 'border-green-500 shadow-[0_0_10px_-2px_rgba(34,197,94,0.3)]';
                } else if (diffAbs <= tol) {
                    borderColor = 'border-yellow-500 shadow-[0_0_10px_-2px_rgba(234,179,8,0.3)]';
                } else {
                    borderColor = 'border-red-500 shadow-[0_0_10px_-2px_rgba(239,68,68,0.3)]';
                }

                const color = diffAbs <= tol / 2 ? 'text-green-400' : (diffAbs <= tol ? 'text-yellow-400' : 'text-red-400');

                return (
                  <div key={f} className={`bg-slate-900/80 p-3 rounded-2xl border ${borderColor} flex flex-col justify-between transition-all`}>
                    <p className="text-[8px] text-slate-100 truncate font-black uppercase mb-1">{fieldLabels[f] || f}</p>
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-sm font-black text-white font-mono">{val}</span>
                      <span className={`text-[9px] font-black font-mono ${color}`}>{diff > 0 ? '+' : ''}{diff}</span>
                    </div>
                    <div className="flex justify-between items-center text-[7px] text-slate-600 font-bold uppercase tracking-tighter">
                      <span>S: {std}</span>
                      <span>±{tol}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 mt-4">
              {logDataKeys.map(f => {
                const val = getLogValue(log, f, 'Act');
                let std = getLogValue(log, f, 'Std');
                let diff = getLogValue(log, f, 'Diff');
                
                if (std === 0 && diff === 0 && currentPreset?.data?.[f] !== undefined) {
                    std = currentPreset.data[f];
                    diff = parseFloat((val - std).toFixed(2));
                }

                const tol = currentPreset?.tolerances?.[f] ?? getDefaultTolerance(f);
                const diffAbs = Math.abs(diff);

                let borderColor = 'border-slate-800';
                if (diffAbs <= tol / 2) {
                    borderColor = 'border-green-500 shadow-[0_0_10px_-2px_rgba(34,197,94,0.3)]';
                } else if (diffAbs <= tol) {
                    borderColor = 'border-yellow-500 shadow-[0_0_10px_-2px_rgba(234,179,8,0.3)]';
                } else {
                    borderColor = 'border-red-500 shadow-[0_0_10px_-2px_rgba(239,68,68,0.3)]';
                }

                const color = diffAbs <= tol / 2 ? 'text-green-400' : (diffAbs <= tol ? 'text-yellow-400' : 'text-red-400');

                return (
                  <div key={f} className={`bg-slate-900/80 px-3 py-2 rounded-xl border ${borderColor} flex items-center justify-between transition-all gap-2`}>
                    <p className="text-[10px] text-slate-300 font-bold uppercase leading-tight flex-1">{fieldLabels[f] || f}</p>
                    <div className="flex items-center font-mono whitespace-nowrap">
                      <span className={`text-xs font-black ${color} w-12 text-right`}>{val}</span>
                      <div className="flex items-baseline border-l border-slate-700 pl-2 ml-2">
                        <span className="text-[10px] text-slate-500 font-bold">{std}</span>
                        <span className="text-[9px] text-slate-600 font-bold ml-0.5">±{tol}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};