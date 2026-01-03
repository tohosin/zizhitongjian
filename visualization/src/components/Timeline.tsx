import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { TimelineEventUnified } from '../types/unified';

interface TimelineProps {
  events: TimelineEventUnified[];
  onEventClick?: (event: TimelineEventUnified) => void;
}

interface EventCluster {
  events: TimelineEventUnified[];
  centerTime: number;
  isExpanded: boolean;
}

export function Timeline({ events, onEventClick }: TimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEventUnified | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());
  const [containerWidth, setContainerWidth] = useState(0);

  // Constants
  const CLUSTER_THRESHOLD = 30; // pixels - events closer than this will cluster
  const height = 500;
  const minimapHeight = 80;
  const margin = { top: 60, right: 60, bottom: 80, left: 60 };

  // Update container width on mount and resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Filter events by search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(e => 
      e.name.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query) ||
      e.participants?.some(p => p.toLowerCase().includes(query))
    );
  }, [events, searchQuery]);

  // Create clusters of nearby events
  const clusters = useMemo(() => {
    if (containerWidth === 0 || filteredEvents.length === 0) return [];
    
    const width = containerWidth;
    const validEvents = filteredEvents.filter(e => e.timeNumeric !== null);
    if (validEvents.length === 0) return [];

    const timeExtent = d3.extent(validEvents, d => d.timeNumeric) as [number, number];
    const xScale = d3.scaleLinear()
      .domain(timeExtent)
      .range([margin.left, width - margin.right]);

    // Sort events by time
    const sorted = [...validEvents].sort((a, b) => a.timeNumeric! - b.timeNumeric!);
    const clusters: EventCluster[] = [];
    let currentCluster: TimelineEventUnified[] = [];

    sorted.forEach((event, i) => {
      if (currentCluster.length === 0) {
        currentCluster.push(event);
      } else {
        const lastEvent = currentCluster[currentCluster.length - 1];
        const distance = Math.abs(xScale(event.timeNumeric!) - xScale(lastEvent.timeNumeric!));
        
        if (distance < CLUSTER_THRESHOLD && currentCluster.length < 10) {
          currentCluster.push(event);
        } else {
          // Save current cluster
          const centerTime = d3.mean(currentCluster, d => d.timeNumeric!) || currentCluster[0].timeNumeric!;
          clusters.push({
            events: [...currentCluster],
            centerTime,
            isExpanded: expandedClusters.has(clusters.length)
          });
          currentCluster = [event];
        }
      }
    });

    // Don't forget the last cluster
    if (currentCluster.length > 0) {
      const centerTime = d3.mean(currentCluster, d => d.timeNumeric!) || currentCluster[0].timeNumeric!;
      clusters.push({
        events: currentCluster,
        centerTime,
        isExpanded: expandedClusters.has(clusters.length)
      });
    }

    return clusters;
  }, [filteredEvents, expandedClusters, containerWidth, margin.left, margin.right, CLUSTER_THRESHOLD]);

  // Main visualization effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || containerWidth === 0 || filteredEvents.length === 0 || clusters.length === 0) return;

    const container = containerRef.current;
    const width = containerWidth;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Get valid events
    const validEvents = filteredEvents.filter((e) => e.timeNumeric !== null && e.timeNumeric !== undefined);
    if (validEvents.length === 0) return;

    // Create scales
    const timeExtent = d3.extent(validEvents, (d) => d.timeNumeric) as [number, number];
    const xScale = d3
      .scaleLinear()
      .domain(timeExtent)
      .range([margin.left, width - margin.right]);

    // Create main group for zoom/pan
    const mainGroup = svg.append('g')
      .attr('class', 'main-group');

    // Add zoom behavior - configure to allow clicks on child elements
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .extent([[0, 0], [width, height]])
      .translateExtent([[margin.left - 1000, 0], [width - margin.right + 1000, height]])
      .filter((event) => {
        // Allow wheel zoom and middle button drag, but not left button drag on event elements
        if (event.type === 'wheel') return true;
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          const target = event.target as Element;
          // Check if clicking on an event or cluster element
          if (target.closest('.event-item') || target.closest('.cluster-item')) {
            return false; // Don't zoom/pan, let the click through
          }
          return true; // Allow zoom/pan on background
        }
        return true;
      })
      .on('zoom', (event) => {
        mainGroup.attr('transform', event.transform);
        setZoomTransform(event.transform);
      });

    svg.call(zoom as any);

    // Draw timeline line
    mainGroup
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', height / 2)
      .attr('y2', height / 2)
      .attr('stroke', '#8b4513')
      .attr('stroke-width', 3)
      .attr('opacity', 0.6);

    // Create axis
    const xAxis = d3.axisBottom(xScale).tickFormat((d) => {
      const year = d as number;
      return year < 0 ? `前${Math.abs(year)}年` : `${year}年`;
    }).ticks(8);

    const axisGroup = svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis);
    
    axisGroup.selectAll('text')
      .style('font-size', '13px')
      .style('fill', '#2c1810')
      .style('font-weight', '500');
    
    axisGroup.selectAll('line, path')
      .style('stroke', '#8b4513')
      .style('stroke-width', '2');

    // Draw clusters
    clusters.forEach((cluster, clusterIndex) => {
      const x = xScale(cluster.centerTime);
      const isSingleEvent = cluster.events.length === 1;
      const isExpanded = cluster.isExpanded;

      if (isSingleEvent || isExpanded) {
        // Draw individual events
        cluster.events.forEach((event, eventIndex) => {
          const eventX = xScale(event.timeNumeric!);
          const yOffset = eventIndex * 50;
          const y = height / 2 - 80 - yOffset;

          const eventGroup = mainGroup.append('g')
            .attr('class', 'event-item')
            .attr('transform', `translate(${eventX}, ${y})`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'all')
            .on('mouseenter', () => setHoveredEvent(event))
            .on('mouseleave', () => setHoveredEvent(null))
            .on('click', (e) => {
              e.stopPropagation();
              onEventClick?.(event);
            });

          // Connector line
          eventGroup.append('line')
            .attr('x1', 0)
            .attr('y1', 10)
            .attr('x2', 0)
            .attr('y2', 80 + yOffset)
            .attr('stroke', '#d4c5b5')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4,4')
            .attr('opacity', 0.6);

          // Event circle
          eventGroup.append('circle')
            .attr('r', 10)
            .attr('fill', '#c41e3a')
            .attr('stroke', '#fff')
            .attr('stroke-width', 3)
            .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))');

          // Event label (show on hover or if expanded)
          const label = eventGroup.append('text')
            .attr('x', 15)
            .attr('y', 4)
            .text(event.name.length > 12 ? event.name.slice(0, 12) + '...' : event.name)
            .style('font-size', '12px')
            .style('fill', '#2c1810')
            .style('font-weight', '500')
            .attr('opacity', isExpanded ? 1 : 0);

          eventGroup.on('mouseenter', function() {
            d3.select(this).select('text').attr('opacity', 1);
            d3.select(this).select('circle')
              .transition().duration(200)
              .attr('r', 12);
          });

          eventGroup.on('mouseleave', function() {
            if (!isExpanded) {
              d3.select(this).select('text').attr('opacity', 0);
            }
            d3.select(this).select('circle')
              .transition().duration(200)
              .attr('r', 10);
          });
        });
      } else {
        // Draw cluster indicator
        const clusterGroup = mainGroup.append('g')
          .attr('class', 'cluster-item')
          .attr('transform', `translate(${x}, ${height / 2 - 80})`)
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .on('click', (e) => {
            e.stopPropagation();
            setExpandedClusters(prev => {
              const newSet = new Set(prev);
              if (newSet.has(clusterIndex)) {
                newSet.delete(clusterIndex);
              } else {
                newSet.add(clusterIndex);
              }
              return newSet;
            });
          });

        // Connector line
        clusterGroup.append('line')
          .attr('x1', 0)
          .attr('y1', 10)
          .attr('x2', 0)
          .attr('y2', 80)
          .attr('stroke', '#d4c5b5')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', 0.6);

        // Cluster circle
        clusterGroup.append('circle')
          .attr('r', 14)
          .attr('fill', '#8b4513')
          .attr('stroke', '#fff')
          .attr('stroke-width', 3)
          .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))');

        // Cluster count
        clusterGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 5)
          .text(cluster.events.length)
          .style('font-size', '12px')
          .style('fill', '#fff')
          .style('font-weight', 'bold');

        // Cluster label
        clusterGroup.append('text')
          .attr('x', 20)
          .attr('y', 4)
          .text(`${cluster.events.length} 个事件`)
          .style('font-size', '11px')
          .style('fill', '#5d2e0c')
          .style('font-weight', '500')
          .attr('opacity', 0);

        clusterGroup.on('mouseenter', function() {
          d3.select(this).select('text:last-child').attr('opacity', 1);
          d3.select(this).select('circle')
            .transition().duration(200)
            .attr('r', 16);
        });

        clusterGroup.on('mouseleave', function() {
          d3.select(this).select('text:last-child').attr('opacity', 0);
          d3.select(this).select('circle')
            .transition().duration(200)
            .attr('r', 14);
        });
      }
    });

    // Add title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#2c1810')
      .text('历史事件时间轴');

    // Add zoom instructions
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#8b4513')
      .text('💡 滚轮缩放 | 拖拽平移 | 点击圆圈展开事件群');

  }, [filteredEvents, clusters, onEventClick, height, margin, containerWidth, expandedClusters]);

  // Minimap effect
  useEffect(() => {
    if (!minimapRef.current || !containerRef.current || containerWidth === 0 || filteredEvents.length === 0) return;

    const width = containerWidth;
    const validEvents = filteredEvents.filter(e => e.timeNumeric !== null);
    if (validEvents.length === 0) return;

    d3.select(minimapRef.current).selectAll('*').remove();

    const minimap = d3.select(minimapRef.current)
      .attr('width', width)
      .attr('height', minimapHeight);

    const timeExtent = d3.extent(validEvents, d => d.timeNumeric) as [number, number];
    const xScale = d3.scaleLinear()
      .domain(timeExtent)
      .range([margin.left, width - margin.right]);

    // Background
    minimap.append('rect')
      .attr('width', width)
      .attr('height', minimapHeight)
      .attr('fill', '#f5f5f5')
      .attr('rx', 4);

    // Timeline line
    minimap.append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', minimapHeight / 2)
      .attr('y2', minimapHeight / 2)
      .attr('stroke', '#8b4513')
      .attr('stroke-width', 2);

    // Event markers
    validEvents.forEach(event => {
      minimap.append('circle')
        .attr('cx', xScale(event.timeNumeric!))
        .attr('cy', minimapHeight / 2)
        .attr('r', 3)
        .attr('fill', '#c41e3a')
        .attr('opacity', 0.6);
    });

    // Viewport indicator (if zoomed)
    if (zoomTransform && zoomTransform.k !== 1) {
      const viewportWidth = (width - margin.left - margin.right) / zoomTransform.k;
      const viewportX = -zoomTransform.x / zoomTransform.k + margin.left;
      
      minimap.append('rect')
        .attr('x', Math.max(margin.left, viewportX))
        .attr('y', 5)
        .attr('width', Math.min(viewportWidth, width - margin.right - viewportX))
        .attr('height', minimapHeight - 10)
        .attr('fill', 'rgba(139, 69, 19, 0.2)')
        .attr('stroke', '#8b4513')
        .attr('stroke-width', 2)
        .attr('rx', 4);
    }

  }, [filteredEvents, zoomTransform, margin, containerWidth, minimapHeight]);

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-6 space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索事件名称、描述或参与者..."
            className="w-full px-4 py-2 pl-10 border border-[#d4c5b5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b4513] focus:border-transparent"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 text-sm text-[#8b4513] hover:bg-[#faf8f5] rounded-lg transition-colors"
          >
            清除
          </button>
        )}
        <div className="text-sm text-gray-600">
          {filteredEvents.length} / {events.length} 个事件
        </div>
      </div>

      {/* Main timeline */}
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} className="w-full" />
      </div>

      {/* Minimap */}
      <div className="w-full border-t border-[#d4c5b5] pt-4">
        <div className="text-xs text-gray-500 mb-2">总览</div>
        <svg ref={minimapRef} className="w-full" />
      </div>

      {/* Hover tooltip */}
      {hoveredEvent && (
        <div className="fixed z-50 bg-white border-2 border-[#8b4513] rounded-lg shadow-xl p-4 max-w-sm pointer-events-none"
          style={{
            left: '50%',
            top: '20%',
            transform: 'translateX(-50%)'
          }}>
          <h4 className="font-bold text-[#2c1810] mb-2">{hoveredEvent.name}</h4>
          <div className="text-sm space-y-1">
            <p className="text-gray-600">
              <span className="font-semibold">时间:</span> {hoveredEvent.time || '未知'}
            </p>
            {hoveredEvent.location && (
              <p className="text-gray-600">
                <span className="font-semibold">地点:</span> {hoveredEvent.location}
              </p>
            )}
            {hoveredEvent.participants && hoveredEvent.participants.length > 0 && (
              <p className="text-gray-600">
                <span className="font-semibold">参与者:</span> {hoveredEvent.participants.slice(0, 3).join(', ')}
                {hoveredEvent.participants.length > 3 && '...'}
              </p>
            )}
            {hoveredEvent.description && (
              <p className="text-gray-600 mt-2">
                {hoveredEvent.description.slice(0, 100)}
                {hoveredEvent.description.length > 100 && '...'}
              </p>
            )}
          </div>
          <div className="mt-2 text-xs text-[#8b4513]">
            💡 点击查看详情
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-600 border-t border-[#d4c5b5] pt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#c41e3a] border-2 border-white"></div>
          <span>单个事件</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#8b4513] border-2 border-white flex items-center justify-center text-white text-xs font-bold">
            N
          </div>
          <span>事件群 (点击展开)</span>
        </div>
      </div>
    </div>
  );
}
