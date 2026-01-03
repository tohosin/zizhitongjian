import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { RoleNodeUnified, RoleLinkUnified } from '../types/unified';

interface NetworkGraphProps {
  nodes: RoleNodeUnified[];
  links: RoleLinkUnified[];
  onNodeClick?: (node: RoleNodeUnified) => void;
  onLinkClick?: (sourceId: string, targetId: string) => void;
  focusNodeId?: string | null; // Node ID to focus/highlight from external trigger
  onFocusNodeHandled?: () => void; // Callback when focus is handled
}

interface SimulationNode extends RoleNodeUnified {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimulationLink {
  source: SimulationNode;
  target: SimulationNode;
  action: string;
  weight: number;
  time: string | null;
}

export function NetworkGraph({ nodes, links, onNodeClick, onLinkClick, focusNodeId, onFocusNodeHandled }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: RoleNodeUnified } | null>(null);
  const [linkTooltip, setLinkTooltip] = useState<{ x: number; y: number; content: RoleLinkUnified; sourceName: string; targetName: string } | null>(null);
  
  // Use refs for callbacks to avoid re-triggering useEffect
  const onNodeClickRef = useRef(onNodeClick);
  const onLinkClickRef = useRef(onLinkClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);
  useEffect(() => { onLinkClickRef.current = onLinkClick; }, [onLinkClick]);
  
  // Interactive state
  const [searchTerm, setSearchTerm] = useState('');
  const [minAppearances, setMinAppearances] = useState(1);
  const [selectedPower, setSelectedPower] = useState<string>('all');
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  // Get unique powers for filter dropdown
  const availablePowers = useMemo(() => {
    const powers = new Set(nodes.map(n => n.power).filter(Boolean) as string[]);
    return Array.from(powers).sort();
  }, [nodes]);

  // Filter nodes based on appearances and power
  // Create fresh copies to avoid D3 mutating the original data
  const filteredNodes = useMemo(() => {
    return nodes
      .filter(n => n.appearances >= minAppearances)
      .filter(n => selectedPower === 'all' || n.power === selectedPower)
      .map(n => ({ ...n }));
  }, [nodes, minAppearances, selectedPower]);

  // Filter links to match filtered nodes
  // Note: We need to create fresh copies of links to avoid D3 mutating them with object references
  const filteredLinks = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return links
      .filter(l => {
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map(l => ({
        ...l,
        // Reset source/target to string IDs for fresh simulation
        source: typeof l.source === 'object' ? (l.source as any).id : l.source,
        target: typeof l.target === 'object' ? (l.target as any).id : l.target,
      }));
  }, [links, filteredNodes]);

  // Search functionality
  const searchResult = useMemo(() => {
    if (!searchTerm) return null;
    return filteredNodes.find(n => 
      n.name.includes(searchTerm) || 
      n.aliases.some(a => a.includes(searchTerm))
    );
  }, [filteredNodes, searchTerm]);

  useEffect(() => {
    if (searchResult) {
      setHighlightedNode(searchResult.id);
    } else {
      setHighlightedNode(null);
    }
  }, [searchResult]);

  // Handle external focus request
  useEffect(() => {
    if (focusNodeId) {
      // Check if the node exists in filtered nodes
      const nodeExists = filteredNodes.some(n => n.id === focusNodeId || n.name === focusNodeId);
      if (nodeExists) {
        setHighlightedNode(focusNodeId);
        setSearchTerm(''); // Clear search when focusing externally
      } else {
        // Try to find by name in all nodes and adjust filters
        const node = nodes.find(n => n.id === focusNodeId || n.name === focusNodeId);
        if (node) {
          // Reset filters to show this node
          setMinAppearances(1);
          setSelectedPower('all');
          setHighlightedNode(node.id);
          setSearchTerm('');
        }
      }
      onFocusNodeHandled?.();
    }
  }, [focusNodeId, filteredNodes, nodes, onFocusNodeHandled]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredNodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 600;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Create a container group for zoom/pan
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Color scale for powers
    const powers = [...new Set(filteredNodes.map((n) => n.power || '无'))];
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(powers);

    // Create force simulation
    const simulation = d3
      .forceSimulation<SimulationNode>(filteredNodes as SimulationNode[])
      .force(
        'link',
        d3
          .forceLink<SimulationNode, SimulationLink>(filteredLinks as unknown as SimulationLink[])
          .id((d) => d.id)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Create arrow marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999');

    // Draw links
    const link = g
      .append('g')
      .selectAll('line')
      .data(filteredLinks)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.min(d.weight, 5))
      .attr('marker-end', 'url(#arrowhead)')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const linkData = d as RoleLinkUnified;
        const sourceId = typeof linkData.source === 'object' ? (linkData.source as any).id : linkData.source;
        const targetId = typeof linkData.target === 'object' ? (linkData.target as any).id : linkData.target;
        onLinkClickRef.current?.(sourceId, targetId);
      })
      .on('mouseover', (event, d) => {
        const linkData = d as RoleLinkUnified;
        const sourceId = typeof linkData.source === 'object' ? (linkData.source as any).id : linkData.source;
        const targetId = typeof linkData.target === 'object' ? (linkData.target as any).id : linkData.target;
        const sourceNode = filteredNodes.find(n => n.id === sourceId);
        const targetNode = filteredNodes.find(n => n.id === targetId);
        setLinkTooltip({
          x: event.pageX,
          y: event.pageY,
          content: linkData,
          sourceName: sourceNode?.name || sourceId,
          targetName: targetNode?.name || targetId,
        });
        d3.select(event.currentTarget)
          .attr('stroke', '#8b4513')
          .attr('stroke-opacity', 1)
          .attr('stroke-width', Math.min(linkData.weight + 2, 8));
      })
      .on('mouseout', (event, d) => {
        setLinkTooltip(null);
        const linkData = d as RoleLinkUnified;
        d3.select(event.currentTarget)
          .attr('stroke', '#999')
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', Math.min(linkData.weight, 5));
      });

    // Draw nodes
    const node = g
      .append('g')
      .attr('class', 'nodes-container')
      .selectAll('g')
      .data(filteredNodes as SimulationNode[])
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimulationNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (_, d) => onNodeClickRef.current?.(d))
      .on('mouseover', (event, d) => {
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: d,
        });
        setHighlightedNode(d.id);
      })
      .on('mouseout', () => {
        setTooltip(null);
        setHighlightedNode(searchResult ? searchResult.id : null);
      });

    // Node circles
    node
      .append('circle')
      .attr('r', (d) => Math.min(8 + d.appearances * 2, 20))
      .attr('fill', (d) => colorScale(d.power || '无'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Node labels
    node
      .append('text')
      .attr('x', 0)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#2c1810')
      .text((d) => d.name);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as unknown as SimulationNode).x ?? 0)
        .attr('y1', (d) => (d.source as unknown as SimulationNode).y ?? 0)
        .attr('x2', (d) => (d.target as unknown as SimulationNode).x ?? 0)
        .attr('y2', (d) => (d.target as unknown as SimulationNode).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    // Add legend
    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 120}, 20)`);

    powers.slice(0, 8).forEach((power, i) => {
      const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 20})`);

      legendRow
        .append('circle')
        .attr('r', 6)
        .attr('fill', colorScale(power));

      legendRow
        .append('text')
        .attr('x', 12)
        .attr('y', 4)
        .style('font-size', '11px')
        .style('fill', '#2c1810')
        .text(power.length > 6 ? power.slice(0, 6) + '...' : power);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredLinks]); // Re-run only when filtered data changes, not on callback changes

  // Effect for highlighting
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    const node = svg.selectAll('.node-group'); // Select only node groups, not legend
    const link = svg.selectAll('line');

    if (highlightedNode) {
      // Find connected nodes
      const connectedNodeIds = new Set<string>();
      connectedNodeIds.add(highlightedNode);
      
      filteredLinks.forEach(l => {
        const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
        
        if (sourceId === highlightedNode) connectedNodeIds.add(targetId);
        if (targetId === highlightedNode) connectedNodeIds.add(sourceId);
      });

      // Dim unconnected nodes
      node.style('opacity', (d: any) => d && d.id && connectedNodeIds.has(d.id) ? 1 : 0.1);
      
      // Dim unconnected links
      link.style('opacity', (d: any) => {
        if (!d) return 0.1;
        const sourceId = typeof d.source === 'object' ? d.source?.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target?.id : d.target;
        return (sourceId === highlightedNode || targetId === highlightedNode) ? 1 : 0.1;
      });
    } else {
      // Reset opacity
      node.style('opacity', 1);
      link.style('opacity', 1);
    }
  }, [highlightedNode, filteredLinks]);

  return (
    <div ref={containerRef} className="w-full bg-white rounded-lg shadow-md p-4 relative">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <h3 className="text-lg font-bold text-[#2c1810]">人物关系网络图</h3>
        
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜索人物..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1 border border-[#d4c5b5] rounded-md text-sm focus:outline-none focus:border-[#8b4513] w-32"
            />
            {searchResult && (
              <div className="absolute right-2 top-1.5 text-green-600 text-xs">
                ✓
              </div>
            )}
          </div>

          {/* Power Filter */}
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <span>势力:</span>
            <select
              value={selectedPower}
              onChange={(e) => setSelectedPower(e.target.value)}
              className="px-2 py-1 border border-[#d4c5b5] rounded-md text-sm focus:outline-none focus:border-[#8b4513] bg-white"
            >
              <option value="all">全部</option>
              {availablePowers.map(power => (
                <option key={power} value={power}>{power}</option>
              ))}
            </select>
          </div>

          {/* Density Filter */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>重要度:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={minAppearances}
              onChange={(e) => setMinAppearances(parseInt(e.target.value))}
              className="w-20 accent-[#8b4513]"
            />
            <span className="w-8 text-right">{minAppearances}+</span>
          </div>
        </div>
      </div>

      <svg ref={svgRef} className="w-full" />
      
      {tooltip && (
        <div
          className="absolute bg-white border border-[#d4c5b5] rounded-lg shadow-lg p-3 z-10 max-w-xs pointer-events-none"
          style={{ left: tooltip.x - 100, top: tooltip.y - 200 }}
        >
          <h4 className="font-bold text-[#8b4513]">{tooltip.content.name}</h4>
          <p className="text-sm text-gray-600">势力: {tooltip.content.power || '无'}</p>
          <p className="text-sm mt-1 line-clamp-3">{tooltip.content.description}</p>
          <p className="text-xs text-gray-500 mt-1">出现次数: {tooltip.content.appearances}</p>
          <p className="text-xs text-[#8b4513] mt-1 font-medium">点击查看详情</p>
        </div>
      )}

      {linkTooltip && (
        <div
          className="absolute bg-white border border-[#8b4513] rounded-lg shadow-lg p-3 z-10 max-w-md pointer-events-none"
          style={{ left: linkTooltip.x + 10, top: linkTooltip.y - 100 }}
        >
          <h4 className="font-bold text-[#8b4513]">
            {linkTooltip.sourceName} → {linkTooltip.targetName}
          </h4>
          <p className="text-sm text-gray-700 mt-1">
            <span className="font-medium">主要行动:</span> {linkTooltip.content.action}
          </p>
          <div className="text-sm mt-1">
            <span className="font-medium text-gray-700">行动类型:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {linkTooltip.content.actionTypes?.slice(0, 5).map((type, i) => (
                <span key={i} className="px-2 py-0.5 bg-[#f5f0e8] text-[#8b4513] rounded text-xs">
                  {type}
                </span>
              ))}
              {linkTooltip.content.actionTypes && linkTooltip.content.actionTypes.length > 5 && (
                <span className="text-xs text-gray-500">
                  +{linkTooltip.content.actionTypes.length - 5}更多
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            互动次数: {linkTooltip.content.weight}
          </p>
          {linkTooltip.content.time && (
            <p className="text-xs text-gray-500">首次互动: {linkTooltip.content.time}</p>
          )}
          <p className="text-xs text-[#8b4513] mt-2 font-medium">点击查看详细记录</p>
        </div>
      )}
    </div>
  );
}
