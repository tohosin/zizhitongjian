import type { TimelineEventUnified, RoleNodeUnified, UnifiedLocation, UnifiedRelation, RoleLinkUnified } from '../types/unified';

interface EventDetailProps {
  event: TimelineEventUnified | null;
  onClose: () => void;
  onEntityClick?: (entityName: string) => void;
}

export function EventDetail({ event, onClose, onEntityClick }: EventDetailProps) {
  if (!event) return null;

  const handleEntityClick = (name: string) => {
    onClose();
    onEntityClick?.(name);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-[#8b4513]">{event.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {event.time && (
            <div>
              <span className="font-semibold text-[#2c1810]">时间：</span>
              <span className="text-gray-700">{event.time}</span>
            </div>
          )}

          {event.location && (
            <div>
              <span className="font-semibold text-[#2c1810]">地点：</span>
              <span className="text-gray-700">{event.location}</span>
            </div>
          )}

          {event.participants.length > 0 && (
            <div>
              <span className="font-semibold text-[#2c1810]">参与者：</span>
              <p className="text-xs text-gray-500 mt-0.5">点击可在关系图中查看</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {event.participants.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleEntityClick(p)}
                    className="px-2 py-1 bg-[#faf8f5] border border-[#d4c5b5] rounded text-sm hover:bg-[#8b4513] hover:text-white hover:border-[#8b4513] transition-colors cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="font-semibold text-[#2c1810]">描述：</span>
            <p className="text-gray-700 mt-1">{event.description}</p>
          </div>

          {event.significance && (
            <div>
              <span className="font-semibold text-[#2c1810]">历史意义：</span>
              <p className="text-gray-700 mt-1 text-sm italic">{event.significance}</p>
            </div>
          )}

          <div className="text-sm text-gray-500 pt-2 border-t border-[#d4c5b5]">
            来源：卷{event.juan_index}
          </div>
        </div>
      </div>
    </div>
  );
}

interface RoleDetailProps {
  role: RoleNodeUnified | null;
  onClose: () => void;
  onEntityClick?: (entityName: string) => void;
}

export function RoleDetail({ role, onClose, onEntityClick }: RoleDetailProps) {
  if (!role) return null;

  const handleEntityClick = (name: string) => {
    onClose();
    onEntityClick?.(name);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-[#8b4513]">{role.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {role.aliases && role.aliases.length > 0 && (
            <div>
              <span className="font-semibold text-[#2c1810]">别名：</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {role.aliases.map((alias, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-[#faf8f5] border border-[#d4a574] rounded text-sm text-[#8b4513]"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {role.power && (
            <div>
              <span className="font-semibold text-[#2c1810]">势力：</span>
              <span className="px-2 py-1 bg-[#c41e3a] text-white rounded text-sm ml-2">
                {role.power}
              </span>
            </div>
          )}

          <div>
            <span className="font-semibold text-[#2c1810]">简介：</span>
            <p className="text-gray-700 mt-1">{role.description || '暂无描述'}</p>
          </div>

          {role.relatedEntities && role.relatedEntities.length > 0 && (
            <div>
              <span className="font-semibold text-[#2c1810]">相关人物：</span>
              <p className="text-xs text-gray-500 mt-0.5">点击可在图中查看</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {role.relatedEntities.slice(0, 15).map((entity, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEntityClick(entity)}
                    className="px-2 py-1 bg-[#faf8f5] border border-[#d4c5b5] rounded text-sm hover:bg-[#8b4513] hover:text-white hover:border-[#8b4513] transition-colors cursor-pointer"
                  >
                    {entity}
                  </button>
                ))}
                {role.relatedEntities.length > 15 && (
                  <span className="text-sm text-gray-500 self-center">
                    +{role.relatedEntities.length - 15}
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <span className="font-semibold text-[#2c1810]">出现次数：</span>
            <span className="text-gray-700">{role.appearances} 次</span>
          </div>

          <div>
            <span className="font-semibold text-[#2c1810]">出现卷目：</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {role.juans.map((j) => (
                <span
                  key={j}
                  className="px-2 py-1 bg-[#faf8f5] border border-[#d4c5b5] rounded text-sm"
                >
                  卷{j}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LocationListProps {
  locations: UnifiedLocation[];
  onLocationClick?: (location: UnifiedLocation) => void;
}

export function LocationList({ locations, onLocationClick }: LocationListProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-bold text-[#2c1810] mb-4">地点列表</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className="p-3 border border-[#d4c5b5] rounded-lg hover:bg-[#faf8f5] cursor-pointer transition-colors"
            onClick={() => onLocationClick?.(loc)}
          >
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-[#8b4513]">{loc.canonical_name}</h4>
              {loc.location_type && (
                <span className="text-xs px-2 py-1 bg-[#d4a574] text-white rounded">
                  {loc.location_type}
                </span>
              )}
            </div>
            {loc.modern_name && (
              <p className="text-sm text-gray-500 mt-1">今：{loc.modern_name}</p>
            )}
            {loc.description && (
              <p className="text-sm text-gray-700 mt-1 line-clamp-2">{loc.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface LocationDetailProps {
  location: UnifiedLocation | null;
  relatedEvents: TimelineEventUnified[];
  relatedRoles: string[];
  relatedActions: UnifiedRelation[];
  onClose: () => void;
  onEntityClick?: (entityName: string) => void;
}

export function LocationDetail({
  location,
  relatedEvents,
  relatedRoles,
  onClose,
  onEntityClick,
}: LocationDetailProps) {
  if (!location) return null;

  const handleEntityClick = (name: string) => {
    onClose();
    onEntityClick?.(name);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#8b4513]">{location.canonical_name}</h2>
            {location.modern_name && (
              <p className="text-sm text-gray-500">今：{location.modern_name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {location.location_type && (
            <div>
              <span className="px-2 py-1 bg-[#d4a574] text-white rounded text-sm">
                {location.location_type}
              </span>
            </div>
          )}

          {location.all_names && location.all_names.length > 1 && (
            <div>
              <span className="font-semibold text-[#2c1810]">别名：</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {location.all_names.filter(n => n !== location.canonical_name).map((alias, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-[#faf8f5] border border-[#d4c5b5] rounded text-sm"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {location.description && (
            <div>
              <span className="font-semibold text-[#2c1810]">描述：</span>
              <p className="text-gray-700 mt-1">{location.description}</p>
            </div>
          )}

          {location.coordinates && (
            <div>
              <span className="font-semibold text-[#2c1810]">坐标：</span>
              <span className="text-gray-700 ml-2">
                {location.coordinates[0].toFixed(4)}, {location.coordinates[1].toFixed(4)}
              </span>
            </div>
          )}

          {relatedEvents.length > 0 && (
            <div>
              <span className="font-semibold text-[#2c1810]">相关事件：</span>
              <div className="mt-2 space-y-2">
                {relatedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-2 bg-[#faf8f5] border border-[#d4c5b5] rounded"
                  >
                    <div className="font-medium text-[#8b4513]">{event.name}</div>
                    {event.time && <div className="text-xs text-gray-500">{event.time}</div>}
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">{event.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relatedRoles.length > 0 && (
            <div>
              <span className="font-semibold text-[#2c1810]">相关人物：</span>
              <p className="text-xs text-gray-500 mt-0.5">点击可在关系图中查看</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {relatedRoles.map((role, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEntityClick(role)}
                    className="px-2 py-1 bg-[#c41e3a] text-white rounded text-sm hover:bg-[#8b4513] transition-colors cursor-pointer"
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RelationDetailProps {
  relations: RoleLinkUnified[];
  sourceName: string;
  targetName: string;
  onClose: () => void;
  onEntityClick?: (entityName: string) => void;
}

export function RelationDetail({
  relations,
  sourceName,
  targetName,
  onClose,
  onEntityClick,
}: RelationDetailProps) {
  if (!relations || relations.length === 0) return null;

  const handleEntityClick = (name: string) => {
    onClose();
    onEntityClick?.(name);
  };

  // Aggregate stats from all relations
  const allSourceJuans = [...new Set(relations.flatMap(r => r.sourceJuans || []))].sort((a, b) => a - b);
  const totalWeight = relations.reduce((sum, r) => sum + r.weight, 0);
  
  // Get the earliest time
  const times = relations.map(r => r.time).filter(Boolean);
  const earliestTime = times.length > 0 ? times[0] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#8b4513]">
              人物关系详情
            </h2>
            <p className="text-lg text-[#2c1810] mt-1">
              <button
                onClick={() => handleEntityClick(sourceName)}
                className="font-semibold hover:text-[#8b4513] hover:underline cursor-pointer"
              >
                {sourceName}
              </button>
              <span className="mx-2 text-gray-500">⇄</span>
              <button
                onClick={() => handleEntityClick(targetName)}
                className="font-semibold hover:text-[#8b4513] hover:underline cursor-pointer"
              >
                {targetName}
              </button>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">点击人物名可在图中查看</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Relations Summary */}
          {relations.length > 1 && (
            <div className="p-3 bg-[#f5f0e8] border border-[#d4a574] rounded-lg">
              <span className="text-sm text-[#8b4513]">
                共找到 <strong>{relations.length}</strong> 条关系记录（包含双向关系）
              </span>
            </div>
          )}

          {/* Individual Relations */}
          {relations.map((relation, relIdx) => {
            const relSourceId = typeof relation.source === 'object' ? (relation.source as any).id : relation.source;
            const isReverse = relSourceId !== sourceName && relSourceId !== relations[0].source;
            const fromName = isReverse ? targetName : sourceName;
            const toName = isReverse ? sourceName : targetName;
            
            return (
              <div key={relIdx} className="border border-[#d4c5b5] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-[#8b4513]">关系 {relIdx + 1}:</span>
                  <span className="text-sm text-gray-700">{fromName}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-sm text-gray-700">{toName}</span>
                </div>

                {/* Primary Action */}
                <div className="mb-2">
                  <span className="font-semibold text-[#2c1810] text-sm">主要行动：</span>
                  <span className="ml-2 px-2 py-0.5 bg-[#8b4513] text-white rounded-full text-xs">
                    {relation.action}
                  </span>
                </div>

                {/* Action Types */}
                {relation.actionTypes && relation.actionTypes.length > 0 && (
                  <div className="mb-2">
                    <span className="font-semibold text-[#2c1810] text-sm">行动类型：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {relation.actionTypes.slice(0, 8).map((type, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-[#f5f0e8] border border-[#d4a574] text-[#8b4513] rounded text-xs"
                        >
                          {type}
                        </span>
                      ))}
                      {relation.actionTypes.length > 8 && (
                        <span className="text-xs text-gray-500 self-center">
                          +{relation.actionTypes.length - 8}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Contexts for this relation */}
                {relation.contexts && relation.contexts.length > 0 && (
                  <div>
                    <span className="font-semibold text-[#2c1810] text-sm">
                      互动记录 ({relation.contexts.length})：
                    </span>
                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                      {relation.contexts.map((context, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-[#faf8f5] border border-[#d4c5b5] rounded text-xs text-gray-700"
                        >
                          {context}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary Stats */}
          <div className="pt-3 border-t border-[#d4c5b5] grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[#2c1810]">总互动次数：</span>
              <span className="text-gray-700 ml-2">{totalWeight} 次</span>
            </div>
            {earliestTime && (
              <div>
                <span className="font-semibold text-[#2c1810]">最早记录：</span>
                <span className="text-gray-700 ml-2">{earliestTime}</span>
              </div>
            )}
          </div>

          {/* Source Juans */}
          {allSourceJuans.length > 0 && (
            <div>
              <span className="font-semibold text-[#2c1810] text-sm">出现卷目：</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {allSourceJuans.map((j) => (
                  <span
                    key={j}
                    className="px-2 py-0.5 bg-[#faf8f5] border border-[#d4c5b5] rounded text-xs"
                  >
                    卷{j}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
