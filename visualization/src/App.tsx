import { useState, useMemo, useCallback } from 'react';
import { useUnifiedKnowledgeBase, useUnifiedVisualizationData } from './hooks/useUnifiedData';
import {
  Timeline,
  NetworkGraph,
  PowerChart,
  FilterControls,
  EventDetail,
  RoleDetail,
  LocationList,
  LocationDetail,
  RelationDetail,
} from './components';
import type { TimelineEventUnified, RoleNodeUnified, UnifiedLocation, RoleLinkUnified } from './types/unified';

type TabType = 'timeline' | 'network' | 'power' | 'locations';

// Interface for showing all relations between two nodes
interface SelectedRelationPair {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  relations: RoleLinkUnified[];
}

function App() {
  // Use the unified knowledge base hook
  const { kb, loading, error } = useUnifiedKnowledgeBase();
  
  const [juanRange, setJuanRange] = useState<[number, number]>([1, 3]); // Default to first 3 juans
  const [timeRange, setTimeRange] = useState<[number | null, number | null]>([null, null]);
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventUnified | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleNodeUnified | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<UnifiedLocation | null>(null);
  const [selectedRelationPair, setSelectedRelationPair] = useState<SelectedRelationPair | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // Get processed visualization data from unified KB
  const { 
    nodes: roles, 
    links: roleLinks, 
    timelineEvents, 
    locations, 
    powerDistribution 
  } = useUnifiedVisualizationData(kb, juanRange);

  // Handler for focusing on a node in the graph (from detail panels)
  const handleFocusNode = useCallback((entityName: string) => {
    // Switch to network tab and focus on the node
    setActiveTab('network');
    setFocusNodeId(entityName);
  }, []);

  // Handler for link click - find all relations between two nodes
  const handleLinkClick = useCallback((sourceId: string, targetId: string) => {
    // Find all relations between these two nodes (in both directions)
    const relations = roleLinks.filter(link => {
      const linkSourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const linkTargetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      return (linkSourceId === sourceId && linkTargetId === targetId) ||
             (linkSourceId === targetId && linkTargetId === sourceId);
    });
    
    const sourceNode = roles.find(n => n.id === sourceId);
    const targetNode = roles.find(n => n.id === targetId);
    
    setSelectedRelationPair({
      sourceId,
      targetId,
      sourceName: sourceNode?.name || sourceId,
      targetName: targetNode?.name || targetId,
      relations,
    });
  }, [roleLinks, roles]);

  // Filter events by time range if needed
  const filteredEvents = useMemo(() => {
    if (timeRange[0] === null && timeRange[1] === null) return timelineEvents;
    
    return timelineEvents.filter(event => {
      if (event.timeNumeric === null) return true;
      const afterStart = timeRange[0] === null || event.timeNumeric >= timeRange[0];
      const beforeEnd = timeRange[1] === null || event.timeNumeric <= timeRange[1];
      return afterStart && beforeEnd;
    });
  }, [timelineEvents, timeRange]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#8b4513] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[#2c1810]">正在加载统一知识库...</p>
          <p className="text-sm text-gray-500 mt-2">正在解析实体关系网络</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="text-center text-red-600">
          <p className="text-xl mb-2">加载失败</p>
          <p className="text-sm">{error}</p>
          <p className="text-sm mt-4 text-gray-500">
            请确保数据文件已放置在 public/data/ 目录下
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'timeline', label: '时间轴', icon: '📅' },
    { id: 'network', label: '关系网络', icon: '🔗' },
    { id: 'power', label: '势力分布', icon: '📊' },
    { id: 'locations', label: '地点', icon: '📍' },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#8b4513] to-[#5d2e0c] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">资治通鉴可视化系统</h1>
          <p className="text-[#d4a574] mt-1">
            基于统一知识库
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar with filters */}
          <div className="lg:col-span-1">
            <FilterControls
              juanRange={juanRange}
              onJuanRangeChange={setJuanRange}
              maxJuan={294}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />

            {/* Stats */}
            <div className="bg-white rounded-lg shadow-md p-4 mt-4">
              <h3 className="text-lg font-bold text-[#2c1810] mb-3">数据统计</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">人物数量：</span>
                  <span className="font-semibold">{roles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">事件数量：</span>
                  <span className="font-semibold">{filteredEvents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">地点数量：</span>
                  <span className="font-semibold">{locations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">关系数量：</span>
                  <span className="font-semibold">{roleLinks.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-md mb-4">
              <div className="flex border-b border-[#d4c5b5]">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-[#8b4513] border-b-2 border-[#8b4513] bg-[#faf8f5]'
                        : 'text-gray-500 hover:text-[#8b4513] hover:bg-[#faf8f5]'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="space-y-4">
              {activeTab === 'timeline' && (
                <Timeline
                  events={filteredEvents}
                  onEventClick={setSelectedEvent}
                />
              )}

              {activeTab === 'network' && (
                <NetworkGraph
                  nodes={roles}
                  links={roleLinks}
                  onNodeClick={setSelectedRole}
                  onLinkClick={handleLinkClick}
                  focusNodeId={focusNodeId}
                  onFocusNodeHandled={() => setFocusNodeId(null)}
                />
              )}

              {activeTab === 'power' && (
                <PowerChart data={powerDistribution} />
              )}

              {activeTab === 'locations' && (
                <LocationList
                  locations={locations}
                  onLocationClick={setSelectedLocation}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2c1810] text-[#d4a574] py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          资治通鉴历史数据可视化系统 © 2026
        </div>
      </footer>

      {/* Detail modals */}
      <EventDetail 
        event={selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
        onEntityClick={handleFocusNode}
      />
      <RoleDetail 
        role={selectedRole} 
        onClose={() => setSelectedRole(null)} 
        onEntityClick={handleFocusNode}
      />
      {selectedLocation && (
        <LocationDetail
          location={selectedLocation}
          relatedEvents={filteredEvents.filter(e => e.location === selectedLocation.canonical_name)}
          relatedRoles={selectedLocation.associated_entities || []}
          relatedActions={[]} // Actions not directly linked to location in unified view yet
          onClose={() => setSelectedLocation(null)}
          onEntityClick={handleFocusNode}
        />
      )}
      {selectedRelationPair && (
        <RelationDetail
          relations={selectedRelationPair.relations}
          sourceName={selectedRelationPair.sourceName}
          targetName={selectedRelationPair.targetName}
          onClose={() => setSelectedRelationPair(null)}
          onEntityClick={handleFocusNode}
        />
      )}
    </div>
  );
}

export default App;
