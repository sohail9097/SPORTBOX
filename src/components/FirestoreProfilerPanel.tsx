import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Clock, 
  Layers, 
  Radio, 
  Repeat, 
  Trash2, 
  FileText, 
  Route, 
  User, 
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Activity,
  Terminal,
  RefreshCw,
  Search,
  Eye
} from 'lucide-react';

interface ReadLog {
  id: string;
  timestamp: string;
  msSinceStartup: number;
  api: string;
  path: string;
  isListener: boolean;
  listenerId?: string;
  isCacheHit: boolean;
  route: string;
  url: string;
  caller: {
    fileName: string;
    functionName: string;
    stack: string;
  };
  uid: string | null;
  duration: number;
  docCount: number;
  stack: string;
}

interface ListenerInfo {
  id: string;
  path: string;
  created: string;
  createdMs: number;
  caller: {
    fileName: string;
    functionName: string;
    stack: string;
  };
  route: string;
  active: boolean;
  snapshotsCount: number;
  destroyed: string | null;
  destroyedMs: number | null;
  lifetime: number | null;
}

export default function FirestoreProfilerPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'operations' | 'duplicates' | 'listeners' | 'components' | 'groups'>('timeline');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedRead, setSelectedRead] = useState<ReadLog | null>(null);
  const [selectedListener, setSelectedListener] = useState<ListenerInfo | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  
  // Local copies of the telemetry data
  const [logs, setLogs] = useState<ReadLog[]>([]);
  const [listeners, setListeners] = useState<ListenerInfo[]>([]);
  const [renders, setRenders] = useState<Record<string, any>>({});
  const [counters, setCounters] = useState<any>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Poll the global window object to get real-time stats
    const timer = setInterval(() => {
      if (typeof window !== 'undefined') {
        setLogs([...((window as any).__firestore_reads_log || [])]);
        setListeners([...((window as any).__firestore_listeners_history || [])]);
        setRenders({ ...((window as any).__firestore_renders || {}) });
        setCounters((window as any).__firestore_counters ? { ...((window as any).__firestore_counters) } : null);
        setTick(t => t + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isOpen) {
    return (
      <button
        id="firestore-profiler-launcher"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-[9999] bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] flex items-center gap-2 transition-all duration-300 font-mono text-xs border border-red-500/30"
      >
        <Activity className="w-4 h-4 animate-pulse" />
        <span>FS Read Profiler ({logs.length})</span>
      </button>
    );
  }

  const clearLogs = () => {
    if (typeof window !== 'undefined') {
      (window as any).__firestore_reads_log = [];
      (window as any).__firestore_listeners_history = (window as any).__firestore_listeners_history?.filter((l: any) => l.active) || [];
      (window as any).__firestore_renders = {};
      if ((window as any).__firestore_counters) {
        (window as any).__firestore_counters.getDoc = 0;
        (window as any).__firestore_counters.getDocs = 0;
        (window as any).__firestore_counters.onSnapshot = 0;
        (window as any).__firestore_counters.realReads = 0;
        (window as any).__firestore_counters.realWrites = 0;
        (window as any).__firestore_counters.byRoute = {};
      }
      setLogs([]);
      setRenders({});
      setSelectedRead(null);
      setSelectedListener(null);
    }
  };

  const toggleGroupExpand = (key: string) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ----------------------------------------------------
  // CALCULATE TELEMETRY METRICS
  // ----------------------------------------------------
  
  // Total unique document reads vs cache hits
  const totalReadsInitiated = logs.length;
  const cacheHits = logs.filter(l => l.isCacheHit).length;
  const serverReads = logs.filter(l => !l.isCacheHit).length;
  const cacheHitRate = totalReadsInitiated > 0 ? Math.round((cacheHits / totalReadsInitiated) * 100) : 0;
  
  // Current active listeners
  const activeListenersCount = listeners.filter(l => l.active).length;
  
  // Group reads by path to detect duplicate reads
  const pathGroups: Record<string, ReadLog[]> = {};
  logs.forEach(log => {
    if (!pathGroups[log.path]) {
      pathGroups[log.path] = [];
    }
    pathGroups[log.path].push(log);
  });

  const duplicatePaths = Object.entries(pathGroups)
    .map(([path, occurrences]) => ({
      path,
      count: occurrences.length,
      occurrences,
      realCalls: occurrences.filter(o => !o.isCacheHit).length,
      cacheHits: occurrences.filter(o => o.isCacheHit).length,
    }))
    .filter(g => g.count > 1)
    .sort((a, b) => b.count - a.count);

  // Group active listeners by path to detect duplicate listeners
  const activeListenerGroups: Record<string, ListenerInfo[]> = {};
  listeners.filter(l => l.active).forEach(listener => {
    if (!activeListenerGroups[listener.path]) {
      activeListenerGroups[listener.path] = [];
    }
    activeListenerGroups[listener.path].push(listener);
  });

  const duplicateListeners = Object.entries(activeListenerGroups)
    .map(([path, instances]) => ({
      path,
      count: instances.length,
      instances
    }))
    .filter(g => g.count > 1)
    .sort((a, b) => b.count - a.count);

  // Group reads by Route
  const routeGroups: Record<string, number> = {};
  logs.forEach(log => {
    routeGroups[log.route] = (routeGroups[log.route] || 0) + 1;
  });

  // Group reads by Component / Caller File
  const componentGroups: Record<string, { count: number; realReads: number; cacheHits: number; queries: string[] }> = {};
  logs.forEach(log => {
    const comp = log.caller.fileName || 'Unknown File';
    if (!componentGroups[comp]) {
      componentGroups[comp] = { count: 0, realReads: 0, cacheHits: 0, queries: [] };
    }
    componentGroups[comp].count++;
    if (log.isCacheHit) {
      componentGroups[comp].cacheHits++;
    } else {
      componentGroups[comp].realReads++;
    }
    if (!componentGroups[comp].queries.includes(log.path)) {
      componentGroups[comp].queries.push(log.path);
    }
  });

  // Ranked contributors
  const rankedContributors = Object.entries(componentGroups)
    .map(([component, info]) => ({
      component,
      ...info
    }))
    .sort((a, b) => b.realReads - a.realReads);

  // Group reads by collection name
  const collectionGroups: Record<string, number> = {};
  logs.forEach(log => {
    const collectionName = log.path.split('/')[0] || 'unknown';
    collectionGroups[collectionName] = (collectionGroups[collectionName] || 0) + 1;
  });

  // Filter logs for search
  const filteredLogs = logs.filter(log => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return (
      log.path.toLowerCase().includes(term) ||
      log.api.toLowerCase().includes(term) ||
      log.caller.fileName.toLowerCase().includes(term) ||
      log.caller.functionName.toLowerCase().includes(term) ||
      log.route.toLowerCase().includes(term)
    );
  });

  return (
    <div
      id="firestore-profiler-panel"
      className={`fixed right-0 top-0 bottom-0 z-[99999] bg-[#0c0f17] text-gray-200 shadow-[-5px_0_30px_rgba(0,0,0,0.8)] border-l border-gray-800 transition-all duration-300 font-mono text-[11px] leading-relaxed flex flex-col ${
        isMinimized ? 'w-[45px]' : 'w-full max-w-4xl'
      }`}
    >
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between p-3 bg-[#131926] border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-red-500" />
          {!isMinimized && (
            <span className="font-bold text-gray-100 tracking-wider text-xs">
              FIRESTORE READ FORENSICS <span className="text-red-500 font-black">v1.2</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isMinimized && (
            <button
              onClick={clearLogs}
              title="Clear all recorded stats & logs"
              className="p-1.5 hover:bg-red-950 hover:text-red-400 text-gray-400 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-gray-800 text-gray-400 rounded transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          {!isMinimized && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-gray-800 text-gray-400 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isMinimized ? (
        <div className="flex-grow flex flex-col items-center justify-start gap-6 py-6 cursor-pointer" onClick={() => setIsMinimized(false)}>
          <div className="rotate-90 origin-center whitespace-nowrap tracking-widest font-bold text-red-500 uppercase flex items-center gap-2">
            <Activity className="w-3 h-3 animate-pulse" />
            PROFILER ({logs.length} READS)
          </div>
        </div>
      ) : (
        <>
          {/* QUICK OVERVIEW STATS BANNER */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 p-2 bg-[#0a0d14] border-b border-gray-850 shrink-0 text-center">
            <div className="p-2 bg-[#121622] rounded border border-gray-850">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Reads (Log)</div>
              <div className="text-lg font-black text-white mt-1 flex justify-center items-center gap-1.5">
                <span>{totalReadsInitiated}</span>
                <span className="text-[9px] font-normal text-gray-500">operations</span>
              </div>
            </div>
            <div className="p-2 bg-[#121622] rounded border border-gray-850">
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Real Server Reads</div>
              <div className="text-lg font-black text-red-500 mt-1 flex justify-center items-center gap-1.5">
                <span>{serverReads}</span>
                <span className="text-[9px] font-normal text-red-600">to Firebase</span>
              </div>
            </div>
            <div className="p-2 bg-[#121622] rounded border border-gray-850">
              <div className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Cache Saving Rate</div>
              <div className="text-lg font-black text-green-500 mt-1 flex justify-center items-center gap-1.5">
                <span>{cacheHitRate}%</span>
                <span className="text-[9px] font-normal text-green-600">({cacheHits} hits)</span>
              </div>
            </div>
            <div className="p-2 bg-[#121622] rounded border border-gray-850">
              <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Active Listeners</div>
              <div className="text-lg font-black text-yellow-500 mt-1 flex justify-center items-center gap-1.5">
                <span>{activeListenersCount}</span>
                <span className="text-[9px] font-normal text-yellow-600">live hooks</span>
              </div>
            </div>
          </div>

          {/* TABS SELECTOR */}
          <div className="flex bg-[#111624] border-b border-gray-850 shrink-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`p-2.5 px-4 font-bold border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'timeline' ? 'border-red-500 bg-[#161c2d] text-white' : 'border-transparent hover:bg-gray-850 text-gray-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('operations')}
              className={`p-2.5 px-4 font-bold border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'operations' ? 'border-red-500 bg-[#161c2d] text-white' : 'border-transparent hover:bg-gray-850 text-gray-400'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              All Read Ops
            </button>
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`p-2.5 px-4 font-bold border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'duplicates' ? 'border-red-500 bg-[#161c2d] text-white' : 'border-transparent hover:bg-gray-850 text-gray-400'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              Duplicates {duplicatePaths.length > 0 && <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">{duplicatePaths.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab('listeners')}
              className={`p-2.5 px-4 font-bold border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'listeners' ? 'border-red-500 bg-[#161c2d] text-white' : 'border-transparent hover:bg-gray-850 text-gray-400'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Listeners {duplicateListeners.length > 0 && <span className="bg-yellow-600 text-black text-[9px] px-1.5 py-0.5 rounded-full font-black">{duplicateListeners.length} duplicates</span>}
            </button>
            <button
              onClick={() => setActiveTab('components')}
              className={`p-2.5 px-4 font-bold border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'components' ? 'border-red-500 bg-[#161c2d] text-white' : 'border-transparent hover:bg-gray-850 text-gray-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              By Component & Renders
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`p-2.5 px-4 font-bold border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'groups' ? 'border-red-500 bg-[#161c2d] text-white' : 'border-transparent hover:bg-gray-850 text-gray-400'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Summary Groups
            </button>
          </div>

          {/* MAIN CONTENT WORKSPACE */}
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
            {/* WORKSPACE LEFT: LIST DATA */}
            <div className="flex-grow flex flex-col overflow-hidden border-r border-gray-850 md:w-3/5">
              {/* SEARCH BOX FOR TIMELINE & OPERATIONS */}
              {['timeline', 'operations'].includes(activeTab) && (
                <div className="p-2 bg-[#090d14] border-b border-gray-850 flex items-center gap-2 shrink-0">
                  <Search className="w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter by path, component file, API..."
                    className="bg-transparent border-none text-gray-200 outline-none w-full placeholder-gray-600 text-[11px]"
                  />
                  {searchFilter && (
                    <button onClick={() => setSearchFilter('')} className="text-gray-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* VIEW LOGS RENDERING DEPENDING ON ACTIVE TAB */}
              <div className="flex-grow overflow-y-auto p-2 space-y-1">
                {/* 1. TIMELINE OF FIRESTORE READS */}
                {activeTab === 'timeline' && (
                  <div className="space-y-2">
                    {filteredLogs.length === 0 ? (
                      <div className="text-center py-8 text-gray-600 uppercase tracking-widest text-[10px]">No Firestore Reads Recorded Yet</div>
                    ) : (
                      filteredLogs.map((log, idx) => {
                        const isSelected = selectedRead?.id === log.id;
                        return (
                          <div
                            key={log.id}
                            onClick={() => setSelectedRead(log)}
                            className={`p-2.5 rounded border transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-red-950/20 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.15)]' 
                                : 'bg-[#111522] border-gray-850 hover:bg-[#151b2c] hover:border-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] text-gray-500 font-bold">
                                #{logs.length - idx} &bull; {(log.msSinceStartup / 1000).toFixed(2)}s startup
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                log.isCacheHit ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                              }`}>
                                {log.isCacheHit ? 'CACHE' : 'SERVER'}
                              </span>
                            </div>
                            <div className="mt-1 font-bold text-gray-200 break-all select-all flex items-center gap-1">
                              <span className="text-red-400 uppercase text-[9px] bg-red-950/50 px-1 py-0.2 rounded border border-red-900/30 font-black shrink-0">
                                {log.api.replace('_snapshot', '')}
                              </span>
                              <span>{log.path}</span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400 text-[10px]">
                              <span className="flex items-center gap-1 text-sky-400 font-bold">
                                <Layers className="w-3 h-3 text-sky-500" />
                                {log.caller.fileName}:{log.caller.functionName}
                              </span>
                              <span className="flex items-center gap-1 text-gray-500">
                                <Route className="w-3 h-3" />
                                {log.route}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 2. OPERATIONS DETAIL GRID */}
                {activeTab === 'operations' && (
                  <div className="overflow-x-auto border border-gray-850 rounded">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#111624] text-gray-300 font-bold uppercase text-[9px] border-b border-gray-800">
                          <th className="p-2">API</th>
                          <th className="p-2">Path</th>
                          <th className="p-2">Source</th>
                          <th className="p-2">Caller</th>
                          <th className="p-2">Time</th>
                          <th className="p-2">Docs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-850">
                        {filteredLogs.map((log) => (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedRead(log)}
                            className={`hover:bg-[#151b2c] cursor-pointer transition-colors ${
                              selectedRead?.id === log.id ? 'bg-red-950/15' : ''
                            }`}
                          >
                            <td className="p-2">
                              <span className="text-red-400 font-bold uppercase">{log.api.replace('_snapshot', '')}</span>
                            </td>
                            <td className="p-2 text-gray-300 font-bold break-all select-all max-w-[200px] truncate">{log.path}</td>
                            <td className="p-2">
                              <span className={`text-[8px] font-black uppercase px-1 rounded ${log.isCacheHit ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                                {log.isCacheHit ? 'CACHE' : 'SERVER'}
                              </span>
                            </td>
                            <td className="p-2 text-sky-400 font-bold truncate max-w-[120px]" title={log.caller.fileName}>
                              {log.caller.fileName}
                            </td>
                            <td className="p-2 text-gray-500 text-[10px]">{(log.msSinceStartup / 1000).toFixed(2)}s</td>
                            <td className="p-2 text-gray-400">{log.docCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. DUPLICATE READS DETECTOR */}
                {activeTab === 'duplicates' && (
                  <div className="space-y-3">
                    <div className="p-2 bg-red-950/10 border border-red-900/30 rounded flex items-start gap-2.5 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-red-400 uppercase text-[10px]">DUPLICATE READ DEFECT WARNING</div>
                        <div className="text-gray-400 mt-0.5 text-[10px]">
                          Paths read multiple times across the application. If not cached, these generate redundant billable Firestore lookups.
                        </div>
                      </div>
                    </div>

                    {duplicatePaths.length === 0 ? (
                      <div className="text-center py-8 text-green-500 uppercase tracking-widest text-[10px]">Excellent! No Duplicate Reads Detected</div>
                    ) : (
                      duplicatePaths.map((group, idx) => {
                        const isExpanded = !!expandedKeys[group.path];
                        return (
                          <div key={group.path} className="border border-red-950/30 rounded overflow-hidden">
                            <div
                              onClick={() => toggleGroupExpand(group.path)}
                              className="p-2.5 bg-[#121623] hover:bg-[#161c2d] cursor-pointer flex items-center justify-between border-b border-gray-850"
                            >
                              <div className="flex items-center gap-2 select-all font-bold text-gray-200">
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                                <span className="bg-red-950 text-red-500 px-1.5 py-0.5 rounded font-black text-[10px]">{group.count}x READS</span>
                                <span className="text-xs break-all">{group.path}</span>
                              </div>
                              <div className="flex gap-1.5 text-[9px] text-gray-400 shrink-0">
                                <span className="bg-red-950/80 px-1 rounded text-red-400 font-bold">{group.realCalls} Server</span>
                                <span className="bg-green-950/85 px-1 rounded text-green-400 font-bold">{group.cacheHits} Cache</span>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="bg-[#0b0e15] divide-y divide-gray-900 p-1 pl-4 space-y-1">
                                {group.occurrences.map((occ, oIdx) => (
                                  <div
                                    key={occ.id}
                                    onClick={() => setSelectedRead(occ)}
                                    className="p-1.5 hover:bg-gray-850 cursor-pointer rounded flex items-center justify-between gap-4 text-[10px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500">#{oIdx + 1}</span>
                                      <span className="text-sky-400 font-bold">{occ.caller.fileName}:{occ.caller.functionName}</span>
                                      <span className="text-gray-500">on route {occ.route}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[8px] font-bold px-1 rounded ${occ.isCacheHit ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                                        {occ.isCacheHit ? 'CACHE' : 'SERVER'}
                                      </span>
                                      <span className="text-gray-500">{(occ.msSinceStartup / 1000).toFixed(2)}s</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 4. ACTIVE LISTENERS LIFECYCLE */}
                {activeTab === 'listeners' && (
                  <div className="space-y-3">
                    {duplicateListeners.length > 0 && (
                      <div className="p-2 bg-yellow-950/10 border border-yellow-900/30 rounded flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-yellow-500 uppercase text-[10px]">MULTIPLE CONCURRENT ACTIVE LISTENERS</div>
                          <div className="text-gray-400 mt-0.5 text-[10px]">
                            We detected {duplicateListeners.length} path(s) subscribed to by multiple active listeners simultaneously! This leaks memory and Firestore bandwidth.
                          </div>
                        </div>
                      </div>
                    )}

                    {listeners.length === 0 ? (
                      <div className="text-center py-8 text-gray-600 uppercase tracking-widest text-[10px]">No Real-Time Snapshots Registered</div>
                    ) : (
                      <div className="space-y-2">
                        {listeners.map((listener) => {
                          const isSelected = selectedListener?.id === listener.id;
                          return (
                            <div
                              key={listener.id}
                              onClick={() => setSelectedListener(listener)}
                              className={`p-2.5 rounded border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-yellow-950/10 border-yellow-500'
                                  : 'bg-[#111522] border-gray-850 hover:bg-[#151b2c]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <Radio className={`w-3.5 h-3.5 ${listener.active ? 'text-red-500 animate-pulse' : 'text-gray-650'}`} />
                                  <span className="font-bold text-gray-200 font-mono text-[10px]">{listener.id}</span>
                                  <span className={`text-[8px] font-black uppercase px-1 rounded ${listener.active ? 'bg-red-950 text-red-500' : 'bg-gray-800 text-gray-400'}`}>
                                    {listener.active ? 'ACTIVE' : 'DESTROYED'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  Snapshots: <span className="text-gray-300 font-bold">{listener.snapshotsCount}</span>
                                </div>
                              </div>
                              <div className="mt-1 font-bold text-gray-300 break-all">{listener.path}</div>
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-gray-500 text-[10px]">
                                <span className="text-sky-400 font-bold">Caller: {listener.caller.fileName}</span>
                                <span>Created: {(listener.createdMs / 1000).toFixed(2)}s</span>
                                {listener.lifetime && <span>Lifetime: {(listener.lifetime / 1000).toFixed(2)}s</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. BY COMPONENT RENDERS CHAIN */}
                {activeTab === 'components' && (
                  <div className="space-y-3">
                    <div className="bg-[#121622] rounded border border-gray-850 p-2.5">
                      <div className="font-bold text-gray-200 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-gray-800 pb-1">
                        <Activity className="w-3.5 h-3.5 text-sky-500" />
                        Component Renders Telemetry Log ({Object.keys(renders).length} tracked)
                      </div>
                      {Object.keys(renders).length === 0 ? (
                        <div className="text-center py-4 text-gray-600 text-[10px] uppercase">No component render events recorded. Import and call useRenderProfiler() on components to log render counters.</div>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(renders).map(([name, data]: [string, any]) => (
                            <div key={name} className="bg-[#151b2a] border border-gray-800 rounded p-2">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-sky-400 text-xs">{name}</span>
                                <span className="bg-sky-950 text-sky-400 text-[10px] px-1.5 py-0.5 rounded font-black">{data.count} RENDERS</span>
                              </div>
                              <div className="mt-1.5 text-gray-500 text-[9px] uppercase font-bold tracking-wider">Render Cascade History:</div>
                              <div className="mt-1 max-h-[80px] overflow-y-auto space-y-0.5 scrollbar-none pr-1">
                                {data.history.map((h: any, hIdx: number) => (
                                  <div key={hIdx} className="text-[10px] flex justify-between items-center text-gray-400 bg-[#0d101a] p-1 rounded">
                                    <span>#{h.renderNumber} &bull; {(h.msSinceStartup / 1000).toFixed(2)}s</span>
                                    <span className="text-sky-500/80 truncate max-w-[120px] font-mono" title={h.changedProps.join(', ')}>
                                      {h.changedProps.length ? `Changed: ${h.changedProps.join(', ')}` : 'init'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RENDERING RANKED REPETITIVE COMPONENT CONTRIBUTORS */}
                    <div className="bg-[#121622] rounded border border-gray-850 p-2.5">
                      <div className="font-bold text-gray-200 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-gray-800 pb-1">
                        <Layers className="w-3.5 h-3.5 text-red-500" />
                        Ranked Firestore Read Load Contributors
                      </div>
                      <div className="space-y-1">
                        {rankedContributors.map((contrib, idx) => (
                          <div key={contrib.component} className="flex justify-between items-center p-2 hover:bg-gray-800 bg-[#161d2d] rounded border border-gray-800 text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 font-bold">#{idx + 1}</span>
                              <span className="text-white font-bold select-all">{contrib.component}</span>
                              <span className="text-gray-500 font-mono">({contrib.queries.length} unique paths)</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="bg-red-950 text-red-400 px-1 py-0.2 rounded font-bold font-mono">{contrib.realReads} Server Reads</span>
                              <span className="bg-green-950 text-green-400 px-1 py-0.2 rounded font-bold font-mono">{contrib.cacheHits} Cache Hits</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. GROUPED SUMMARY STATISTICS */}
                {activeTab === 'groups' && (
                  <div className="space-y-3">
                    {/* BY ROUTE GROUP */}
                    <div className="bg-[#121622] border border-gray-850 rounded p-2.5">
                      <div className="font-bold text-gray-300 text-[10px] uppercase tracking-wider mb-2 border-b border-gray-800 pb-1 flex items-center gap-1">
                        <Route className="w-3.5 h-3.5 text-sky-400" />
                        Reads Grouped By Route (URL)
                      </div>
                      <div className="space-y-1">
                        {Object.entries(routeGroups).map(([route, count]) => (
                          <div key={route} className="flex justify-between items-center text-[10px] p-1.5 bg-[#171d2e] rounded">
                            <span className="text-gray-300 font-mono select-all font-bold">{route}</span>
                            <span className="bg-red-950 text-red-500 px-1.5 py-0.3 rounded font-black">{count} reads</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* BY COLLECTION GROUP */}
                    <div className="bg-[#121622] border border-gray-850 rounded p-2.5">
                      <div className="font-bold text-gray-300 text-[10px] uppercase tracking-wider mb-2 border-b border-gray-800 pb-1 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-yellow-500" />
                        Reads Grouped By Firestore Collection Name
                      </div>
                      <div className="space-y-1">
                        {Object.entries(collectionGroups).map(([collection, count]) => (
                          <div key={collection} className="flex justify-between items-center text-[10px] p-1.5 bg-[#171d2e] rounded">
                            <span className="text-yellow-400 font-bold tracking-wide">/{collection}</span>
                            <span className="bg-red-950 text-red-500 px-1.5 py-0.3 rounded font-black">{count} reads</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* WORKSPACE RIGHT: DETAILED METRICS PANEL (INSPECTOR) */}
            <div className="flex-grow md:w-2/5 p-2.5 bg-[#0a0d15] flex flex-col overflow-y-auto">
              <div className="font-black text-gray-300 uppercase tracking-widest text-[9px] mb-3 border-b border-gray-800 pb-1 flex items-center gap-1.5">
                <Terminal className="w-4.5 h-4.5 text-red-500" />
                Live Inspect Console
              </div>

              {/* READS OPERATIONS DETAIL INSPECTOR */}
              {selectedRead ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-400 uppercase text-xs">Read Operation Log</span>
                    <button onClick={() => setSelectedRead(null)} className="p-1 text-gray-500 hover:text-white rounded hover:bg-gray-850">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 bg-[#121623] p-3 rounded border border-gray-850">
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Read ID</div>
                      <div className="text-white font-mono select-all font-bold">{selectedRead.id}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Firestore API Method</div>
                      <div className="text-red-400 uppercase font-black">{selectedRead.api}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Document / Query Path</div>
                      <div className="text-cyan-400 select-all break-all font-bold text-xs">{selectedRead.path}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Cache / Network lookup</div>
                      <div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                          selectedRead.isCacheHit ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                        }`}>
                          {selectedRead.isCacheHit ? 'CACHE HIT (Zero billable cost)' : 'SERVER QUERY (Contacted Firestore)'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-gray-500 uppercase text-[9px] font-bold">Query Time</div>
                        <div className="text-gray-200">{(selectedRead.msSinceStartup / 1000).toFixed(2)}s startup</div>
                      </div>
                      <div>
                        <div className="text-gray-500 uppercase text-[9px] font-bold">Network Duration</div>
                        <div className="text-gray-200">{selectedRead.duration}ms</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-gray-500 uppercase text-[9px] font-bold">Snapshot Size</div>
                        <div className="text-gray-200">{selectedRead.docCount} docs returned</div>
                      </div>
                      <div>
                        <div className="text-gray-500 uppercase text-[9px] font-bold">Auth User UID</div>
                        <div className="text-gray-300 font-mono truncate max-w-[120px]" title={selectedRead.uid || 'Anonymous'}>{selectedRead.uid || 'Anonymous'}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Caller React Component</div>
                      <div className="text-sky-400 font-bold font-mono">{selectedRead.caller.fileName}:{selectedRead.caller.functionName}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Current URL Route</div>
                      <div className="text-gray-300 break-all">{selectedRead.route}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 uppercase text-[9px] font-bold mb-1">Javascript Stack Trace (Origin)</div>
                    <pre className="bg-[#0e111a] border border-gray-900 rounded p-2 text-[9px] font-mono overflow-auto max-h-[160px] text-gray-400 select-all scrollbar-none whitespace-pre-wrap leading-relaxed">
                      {selectedRead.stack}
                    </pre>
                  </div>
                </div>
              ) : selectedListener ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-yellow-500 uppercase text-xs">Listener Lifecycle Details</span>
                    <button onClick={() => setSelectedListener(null)} className="p-1 text-gray-500 hover:text-white rounded hover:bg-gray-850">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 bg-[#121623] p-3 rounded border border-gray-850">
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Listener ID</div>
                      <div className="text-white font-mono select-all font-bold">{selectedListener.id}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Status</div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                        selectedListener.active ? 'bg-red-950 text-red-500' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {selectedListener.active ? 'ACTIVE SUB' : 'UNSUBSCRIBED'}
                      </span>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Subscribed Path</div>
                      <div className="text-cyan-400 select-all break-all font-bold text-xs">{selectedListener.path}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Total Snapshots Received</div>
                      <div className="text-white font-bold">{selectedListener.snapshotsCount} snapshots</div>
                    </div>
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Registered Timestamp</div>
                      <div className="text-gray-300">{(selectedListener.createdMs / 1000).toFixed(2)}s startup ({selectedListener.created})</div>
                    </div>
                    {selectedListener.destroyed && (
                      <div>
                        <div className="text-gray-500 uppercase text-[9px] font-bold">Destroyed Timestamp</div>
                        <div className="text-gray-300">{(selectedListener.destroyedMs! / 1000).toFixed(2)}s startup ({selectedListener.destroyed})</div>
                      </div>
                    )}
                    {selectedListener.lifetime && (
                      <div>
                        <div className="text-gray-500 uppercase text-[9px] font-bold">Active Lifetime Duration</div>
                        <div className="text-yellow-500 font-bold">{(selectedListener.lifetime / 1000).toFixed(2)} seconds</div>
                      </div>
                    )}
                    <div>
                      <div className="text-gray-500 uppercase text-[9px] font-bold">Creator File</div>
                      <div className="text-sky-400 font-bold">{selectedListener.caller.fileName}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500 uppercase text-[9px] font-bold mb-1">Creation Stack Trace</div>
                    <pre className="bg-[#0e111a] border border-gray-900 rounded p-2 text-[9px] font-mono overflow-auto max-h-[160px] text-gray-400 select-all scrollbar-none whitespace-pre-wrap leading-relaxed">
                      {selectedListener.caller.stack}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-gray-650 uppercase tracking-widest text-[10px] space-y-2 py-16">
                  <Terminal className="w-8 h-8 text-gray-700 animate-pulse" />
                  <div>Select any read log or listener from the left to inspect variables & traces.</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
