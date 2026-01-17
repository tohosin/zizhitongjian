import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { parseUrlGlobalContext, writeUrlGlobalContext } from './state';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const initialCtxRef = useRef(parseUrlGlobalContext(searchParams, 294));
  
  const [juanRange, setJuanRange] = useState<[number, number]>(initialCtxRef.current.juanRange);
  const [timeRange, setTimeRange] = useState<[number | null, number | null]>(initialCtxRef.current.yearRange);
  const [activeTab, setActiveTab] = useState<TabType>(initialCtxRef.current.tab);
  
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

  // Keep latest derived arrays in refs so URL-sync effect doesn't depend on them
  // (avoids rerender loops if hooks return new array identities each render).
  const rolesRef = useRef<RoleNodeUnified[]>([]);
  const roleLinksRef = useRef<RoleLinkUnified[]>([]);
  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);
  useEffect(() => {
    roleLinksRef.current = roleLinks;
  }, [roleLinks]);

  // Keep local state in sync when the user navigates Back/Forward.
  useEffect(() => {
    const ctx = parseUrlGlobalContext(searchParams, 294);
    setActiveTab(ctx.tab);
    
    // PERFORMANCE CRITICAL: Only update juanRange/timeRange if values actually changed.
    // 
    // Problem this solves:
    // - parseUrlGlobalContext() always returns NEW array references (e.g., [1, 3])
    // - Even if values are identical, React treats new arrays as "changed" state
    // - This triggers useUnifiedVisualizationData() to recompute with "new" juanRange
    // - Which creates new roles/roleLinks arrays, causing NetworkGraph to rebuild D3 simulation
    // - Result: clicking a node would reset all graph node positions!
    //
    // Solution: Use functional setState to compare values, keeping the same reference if unchanged.
    // DO NOT simplify to `setJuanRange(ctx.juanRange)` - it will break graph interactions!
    setJuanRange(prev => 
      prev[0] === ctx.juanRange[0] && prev[1] === ctx.juanRange[1] 
        ? prev 
        : ctx.juanRange
    );
    setTimeRange(prev => 
      prev[0] === ctx.yearRange[0] && prev[1] === ctx.yearRange[1] 
        ? prev 
        : ctx.yearRange
    );
    setFocusNodeId(ctx.focusRoleId ?? null);

    // Restore selection when possible.
    const selection = ctx.selection;
    if (!kb || !selection) {
      setSelectedEvent(null);
      setSelectedRole(null);
      setSelectedLocation(null);
      setSelectedRelationPair(null);
      return;
    }

    if (selection.type === 'event') {
      const ev = kb.events?.[selection.id];
      if (ev) {
        setSelectedEvent({
          id: ev.id,
          name: ev.name,
          time: ev.time,
          timeNumeric: ev.time_start,
          location: ev.location,
          participants: Array.from(ev.participants || []),
          description: ev.description,
          juan_index: ev.source_juans?.[0] || 0,
          type: 'event',
          significance: ev.significance,
          background: ev.background,
        });
      }
      setSelectedRole(null);
      setSelectedLocation(null);
      setSelectedRelationPair(null);
      return;
    }

    if (selection.type === 'role') {
      const role = kb.roles?.[selection.id];
      if (role) {
        setSelectedRole({
          id: role.id,
          name: role.canonical_name,
          power: role.primary_power,
          description: role.description,
          appearances: role.total_mentions,
          juans: role.juans_appeared,
          aliases: Array.from(role.all_names || []).filter(n => n !== role.canonical_name),
          relatedEntities: Array.from(role.related_entities || []),
        });
      }
      setSelectedEvent(null);
      setSelectedLocation(null);
      setSelectedRelationPair(null);
      return;
    }

    if (selection.type === 'location') {
      const loc = kb.locations?.[selection.id];
      if (loc) setSelectedLocation(loc);
      setSelectedEvent(null);
      setSelectedRole(null);
      setSelectedRelationPair(null);
      return;
    }

    if (selection.type === 'relationPair') {
      // Reconstruct the selected relation pair from the currently loaded link list.
      const currentLinks = roleLinksRef.current;
      const currentRoles = rolesRef.current;
      const relations = currentLinks.filter(link => {
        const linkSourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const linkTargetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        return (
          (linkSourceId === selection.sourceId && linkTargetId === selection.targetId) ||
          (linkSourceId === selection.targetId && linkTargetId === selection.sourceId)
        );
      });
      const sourceNode = currentRoles.find(n => n.id === selection.sourceId);
      const targetNode = currentRoles.find(n => n.id === selection.targetId);
      setSelectedRelationPair({
        sourceId: selection.sourceId,
        targetId: selection.targetId,
        sourceName: sourceNode?.name || selection.sourceId,
        targetName: targetNode?.name || selection.targetId,
        relations,
      });
      setSelectedEvent(null);
      setSelectedRole(null);
      setSelectedLocation(null);
    }
  }, [searchParams, kb]);

  const selectionForUrl = useMemo(() => {
    if (selectedEvent) return { type: 'event' as const, id: selectedEvent.id };
    if (selectedRole) return { type: 'role' as const, id: selectedRole.id };
    if (selectedLocation) return { type: 'location' as const, id: selectedLocation.id };
    if (selectedRelationPair)
      return {
        type: 'relationPair' as const,
        sourceId: selectedRelationPair.sourceId,
        targetId: selectedRelationPair.targetId,
      };
    return undefined;
  }, [selectedEvent, selectedRole, selectedLocation, selectedRelationPair]);

  const updateUrlContext = useCallback(
    (
      next: Partial<{
        tab: TabType;
        juanRange: [number, number];
        yearRange: [number | null, number | null];
        focusRoleId: string | undefined;
      }>,
      opts: { replace: boolean }
    ) => {
      const params = writeUrlGlobalContext(searchParams, {
        tab: next.tab ?? activeTab,
        juanRange: next.juanRange ?? juanRange,
        yearRange: next.yearRange ?? timeRange,
        focusRoleId: (next.focusRoleId ?? focusNodeId ?? undefined) as string | undefined,
        selection: selectionForUrl,
      });
      setSearchParams(params, { replace: opts.replace });
    },
    [searchParams, setSearchParams, activeTab, juanRange, timeRange, focusNodeId, selectionForUrl]
  );

  // Handler for focusing on a node in the graph (from detail panels)
  const handleFocusNode = useCallback((entityName: string) => {
    // Switch to network tab and focus on the node
    setActiveTab('network');
    setFocusNodeId(entityName);

    const next = writeUrlGlobalContext(searchParams, {
      tab: 'network',
      juanRange,
      yearRange: timeRange,
      focusRoleId: entityName,
      selection: { type: 'role', id: entityName },
    });
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams, juanRange, timeRange]);

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

    const next = writeUrlGlobalContext(searchParams, {
      tab: 'network',
      juanRange,
      yearRange: timeRange,
      focusRoleId: focusNodeId ?? undefined,
      selection: { type: 'relationPair', sourceId, targetId },
    });
    setSearchParams(next, { replace: false });
  }, [roleLinks, roles, searchParams, setSearchParams, juanRange, timeRange, focusNodeId]);

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
              onJuanRangeChange={(range) => {
                setJuanRange(range);
                updateUrlContext({ juanRange: range }, { replace: true });
              }}
              onJuanRangeCommit={(range) => {
                updateUrlContext({ juanRange: range }, { replace: false });
              }}
              maxJuan={294}
              timeRange={timeRange}
              onTimeRangeChange={(range) => {
                setTimeRange(range);
                updateUrlContext({ yearRange: range }, { replace: true });
              }}
              onTimeRangeCommit={(range) => {
                updateUrlContext({ yearRange: range }, { replace: false });
              }}
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
                    onClick={() => {
                      setActiveTab(tab.id);
                      const next = writeUrlGlobalContext(searchParams, {
                        tab: tab.id,
                        juanRange,
                        yearRange: timeRange,
                        focusRoleId: focusNodeId ?? undefined,
                        selection: undefined,
                      });
                      setSearchParams(next, { replace: false });
                    }}
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
                  onEventClick={(ev) => {
                    setSelectedEvent(ev);
                    const next = writeUrlGlobalContext(searchParams, {
                      tab: 'timeline',
                      juanRange,
                      yearRange: timeRange,
                      focusRoleId: focusNodeId ?? undefined,
                      selection: { type: 'event', id: ev.id },
                    });
                    setSearchParams(next, { replace: false });
                  }}
                />
              )}

              {activeTab === 'network' && (
                <NetworkGraph
                  nodes={roles}
                  links={roleLinks}
                  onNodeClick={(role) => {
                    setSelectedRole(role);
                    const next = writeUrlGlobalContext(searchParams, {
                      tab: 'network',
                      juanRange,
                      yearRange: timeRange,
                      focusRoleId: focusNodeId ?? undefined,
                      selection: { type: 'role', id: role.id },
                    });
                    setSearchParams(next, { replace: false });
                  }}
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
                  onLocationClick={(loc) => {
                    setSelectedLocation(loc);
                    const next = writeUrlGlobalContext(searchParams, {
                      tab: 'locations',
                      juanRange,
                      yearRange: timeRange,
                      focusRoleId: focusNodeId ?? undefined,
                      selection: { type: 'location', id: loc.id },
                    });
                    setSearchParams(next, { replace: false });
                  }}
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
        onClose={() => {
          setSelectedEvent(null);
          const next = writeUrlGlobalContext(searchParams, {
            tab: activeTab,
            juanRange,
            yearRange: timeRange,
            focusRoleId: focusNodeId ?? undefined,
            selection: undefined,
          });
          setSearchParams(next, { replace: false });
        }}
        onEntityClick={handleFocusNode}
      />
      <RoleDetail 
        role={selectedRole} 
        onClose={() => {
          setSelectedRole(null);
          const next = writeUrlGlobalContext(searchParams, {
            tab: activeTab,
            juanRange,
            yearRange: timeRange,
            focusRoleId: focusNodeId ?? undefined,
            selection: undefined,
          });
          setSearchParams(next, { replace: false });
        }}
        onEntityClick={handleFocusNode}
      />
      {selectedLocation && (
        <LocationDetail
          location={selectedLocation}
          relatedEvents={filteredEvents.filter(e => e.location === selectedLocation.canonical_name)}
          relatedRoles={selectedLocation.associated_entities || []}
          relatedActions={[]} // Actions not directly linked to location in unified view yet
          onClose={() => {
            setSelectedLocation(null);
            const next = writeUrlGlobalContext(searchParams, {
              tab: activeTab,
              juanRange,
              yearRange: timeRange,
              focusRoleId: focusNodeId ?? undefined,
              selection: undefined,
            });
            setSearchParams(next, { replace: false });
          }}
          onEntityClick={handleFocusNode}
        />
      )}
      {selectedRelationPair && (
        <RelationDetail
          relations={selectedRelationPair.relations}
          sourceName={selectedRelationPair.sourceName}
          targetName={selectedRelationPair.targetName}
          onClose={() => {
            setSelectedRelationPair(null);
            const next = writeUrlGlobalContext(searchParams, {
              tab: activeTab,
              juanRange,
              yearRange: timeRange,
              focusRoleId: focusNodeId ?? undefined,
              selection: undefined,
            });
            setSearchParams(next, { replace: false });
          }}
          onEntityClick={handleFocusNode}
        />
      )}
    </div>
  );
}

export default App;
