
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Workspace, Note } from '../types';

interface StarMapProps {
  workspace: Workspace;
  onSelectNote: (id: string) => void;
}

interface HierarchyDatum {
  id: string;
  name: string;
  type: 'root' | 'universe' | 'place' | 'note';
  noteId?: string;
  children?: HierarchyDatum[];
  value?: number;
}

const StarMap: React.FC<StarMapProps> = ({ workspace, onSelectNote }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: wrapperRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const styles = getComputedStyle(document.documentElement);
    const accentColor = styles.getPropertyValue('--accent').trim();
    const warnColor = styles.getPropertyValue('--warn').trim();
    const faintColor = styles.getPropertyValue('--text-3').trim();

    // 1. Build Hierarchy Data from Persistence
    // Uses settings.universeTags strings
    const universeTags = workspace.settings.universeTags.tags;
    const notes = Object.values(workspace.notes) as Note[];

    const hierarchyData: HierarchyDatum = {
        id: 'root',
        name: 'The Cosmos',
        type: 'root',
        children: universeTags.map(tag => {
            const notesInUniverse = notes.filter(n => n.universeTag === tag && n.type === 'Place');
            
            return {
                id: tag,
                name: tag,
                type: 'universe',
                children: notesInUniverse.map(n => ({
                    id: n.id,
                    name: n.title,
                    type: 'place',
                    noteId: n.id,
                    value: 1 // Leaf node
                }))
            };
        })
    };
    
    // Add nodes without universe tag to a "Cosmos" or "Uncharted" group if needed, 
    // but for now only showing explicit tags as per map logic.

    const root = d3.hierarchy<HierarchyDatum>(hierarchyData)
        .sum(d => d.value || 1)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack<HierarchyDatum>()
        .size([dimensions.width, dimensions.height])
        .padding(20);

    const rootNode = pack(root);

    // 2. Render D3
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Zoom Group
    const g = svg.append("g");
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Initial View State from Maps Config (if available)
    // const mainMap = workspace.maps.maps['main'];
    // if (mainMap) {
    //    svg.call(zoom.transform, d3.zoomIdentity.translate(mainMap.viewState.panX, mainMap.viewState.panY).scale(mainMap.viewState.zoom));
    // }

    // Nodes
    const node = g.selectAll("g")
        .data(rootNode.descendants().slice(1)) // Skip root
        .join("g")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    // Circle Styles
    node.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => {
            if (d.data.type === 'universe') return "transparent"; 
            if (d.data.type === 'place') return `${warnColor}20`; 
            return faintColor;
        })
        .attr("stroke", d => {
             if (d.data.type === 'universe') return `${accentColor}40`;
             if (d.data.type === 'place') return `${warnColor}80`;
             return "none";
        })
        .attr("stroke-width", 1)
        .attr("cursor", d => d.data.noteId ? "pointer" : "default")
        .on("click", (e, d) => {
            if (d.data.noteId) {
                e.stopPropagation();
                onSelectNote(d.data.noteId);
            }
        });

    // Labels
    node.filter(d => d.data.type === 'universe' || d.r > 20)
        .append("text")
        .text(d => d.data.name)
        .attr("dy", d => d.data.type === 'universe' ? -d.r + 15 : 4)
        .attr("text-anchor", "middle")
        .attr("fill", d => d.data.type === 'universe' ? accentColor : warnColor)
        .attr("font-size", d => d.data.type === 'universe' ? "12px" : "10px")
        .attr("font-weight", "bold")
        .attr("font-family", "JetBrains Mono")
        .attr("pointer-events", "none")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px");

  }, [workspace, dimensions]);

  return (
    <div ref={wrapperRef} className="w-full h-full bg-deep-space relative overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
            <h2 className="text-sm font-bold text-faint uppercase tracking-widest">Cosmos Topology</h2>
            <p className="text-[10px] text-muted">Visualizing {workspace.settings.universeTags.tags.length} universes.</p>
        </div>
        <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default StarMap;
