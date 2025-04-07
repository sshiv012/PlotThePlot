"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function GraphVisualizer({ data }: { data: any }) {
  const svgRef = useRef(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!data || !data.characters || !data.relations) {
      console.error("Invalid or missing data");
      return;
    }

    const width = 900;
    const height = 600;

    svg.attr("viewBox", [0, 0, width, height]).attr("preserveAspectRatio", "xMidYMid meet");

    const nodes = data.characters.map((char: any) => ({
      id: char.id,
      label: char.common_name,
      main: char.main_character,
      traits: char.traits,
      names: char.names,
      description: char.description
    }));

    const links = data.relations.map((rel: any) => ({
      source: rel.id1,
      target: rel.id2,
      weight: rel.weight,
      role1: rel.id1_to_id2_role || "",
      role2: rel.id2_to_id1_role || "",
      key_dialogs: rel.key_dialogs
    }));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(200)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .force("collision", d3.forceCollide().radius(40));

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("z-index", "10")
      .style("visibility", "hidden")
      .style("background", "white")
      .style("padding", "8px")
      .style("border", "1px solid gray")
      .style("border-radius", "4px")
      .style("font-size", "12px");

    const link = svg
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => d.weight);

    const nodeGroup = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .on("mouseover", function (event, d: any) {
        d3.select(this).select("rect").classed("node-highlight", true);
        tooltip
          .html(
            `<strong>${d.label}</strong><br/>` +
              `<em>${d.description}</em><br/>` +
              `<strong>Traits:</strong> ${d.traits.join(", ")}<br/>` +
              `<strong>Aliases:</strong> ${d.names.join(", ")}`
          )
          .style("visibility", "visible");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", event.pageY + 15 + "px")
          .style("left", event.pageX + 15 + "px");
      })
      .on("mouseout", function () {
        d3.select(this).select("rect").classed("node-highlight", false);
        tooltip.style("visibility", "hidden");
      });
    
    // Draw rectangles with dynamic width
    nodeGroup.append("rect")
      .attr("fill", (d: any) => (d.main ? "#f87171" : "#60a5fa"))
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("height", 28)
      .attr("width", (d: any) => d.label.length * 8 + 20) // padding around text
      .attr("x", (d: any) => -(d.label.length * 4 + 10)) // center the rect
      .attr("y", -14); // center vertically
    
    // Add text
    nodeGroup.append("text")
      .text((d: any) => d.label)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", "#fff")
      .attr("font-size", 12);

    link
     .on("mouseover", function (event, d:any) {
        d3.select(this as SVGLineElement).classed("edge-highlight", true);
        tooltip
          .html(
            `<strong>Relation:</strong><br/>` +
              `${d.source.label} (${d.role1}) → ${d.target.label} (${d.role2})<br/><br/>` +
              `<strong>Key Dialogs:</strong><br/>` +
              d.key_dialogs.map((line: string) => `“${line}”`).join("<br/>")
          )
          .style("visibility", "visible");

        if (summaryRef.current) {
          summaryRef.current.innerHTML = `<strong>Relation:</strong> ${d.source.label} (${d.role1}) → ${d.target.label} (${d.role2})<br/><strong>Key Dialogs:</strong><br/>` +
            d.key_dialogs.map((line: string) => `“${line}”`).join("<br/>");
        }
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", event.pageY + 15 + "px")
          .style("left", event.pageX + 15 + "px");
      })
      .on("mouseout", function () {
        d3.select(this as SVGLineElement).classed("edge-highlight", false);
        tooltip.style("visibility", "hidden");
        if (summaryRef.current) summaryRef.current.innerHTML = "";
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      nodeGroup.attr("transform", (d: any) => {
          // Clamp within bounds
          d.x = Math.max(50, Math.min(width - 50, d.x));
          d.y = Math.max(30, Math.min(height - 30, d.y));
          return `translate(${d.x},${d.y})`;
        });    
      }).force("center", d3.forceCenter(width / 2, height / 2))
    .alphaDecay(0.05) ;
  }, [data]);

  return (
    <div className="p-4 space-y-4">
      {/* Legend at the top */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-400"></div>
          <span className="text-sm text-gray-700">Main Character</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-400"></div>
          <span className="text-sm text-gray-700">Supporting Character</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="50" height="10">
            <line x1="0" y1="5" x2="50" y2="5" stroke="#999" strokeWidth="1" />
          </svg>
          <span className="text-sm text-gray-600">Low interaction</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="50" height="10">
            <line x1="0" y1="5" x2="50" y2="5" stroke="#999" strokeWidth="6" />
          </svg>
          <span className="text-sm text-gray-600">Strong relationship</span>
        </div>
      </div>
      {data ? (
        <>
          <svg ref={svgRef} className="w-full h-full"   ></svg>
          <div className="mt-4 p-4 border rounded bg-gray-100 text-sm whitespace-pre-wrap">
            <strong>Summary:</strong> <br />
            {data.summary}
          </div>
         
        </>
      ) : (
        <div className="text-gray-500 italic">
          Upload a JSON file above to view the visualization.
        </div>
      )}
    </div>
  );
}