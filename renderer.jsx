import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import * as d3 from "d3";


const HEX_RADIUS = 40;
const STATES = ["GRAY", "WHITE", "BLACK"];
const DIRECTIONS = [
    { q: +1, r: 0 },
    { q: +1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: +1 },
    { q: 0, r: +1 },
];


function randomizeHexStates(hexes) {
    // Build a quick lookup table: id -> cell
    const lookup = new Map(hexes.map((c) => [c.id, c]));

    // Helper to count neighbor states
    const countNeighbors = (cell) => {
        const neighborIds = DIRECTIONS.map(({ q, r }) =>
            lookup.get(`${cell.q + q},${cell.r + r}`)
        ).filter((n) => n !== undefined);

        let white = 0,
            black = 0;
        neighborIds.forEach((nid) => {
            const neighbor = lookup.get(nid) || neighborIds.find((id) => id === nid);
            if (neighbor?.state === "WHITE") white++;
            if (neighbor?.state === "BLACK") black++;
        });

        return { white, black };
    };

    return hexes.map((cell) => {
        const { white, black } = countNeighbors(cell);

        let whitePct = 0.5;
        let blackPct = 0.5;

        if (white === 0 && black === 0) {
            whitePct = 0.5;
            blackPct = 0.5;
        } else if (white < 3) {
            whitePct = 0.6;
            blackPct = 0.4;
        } else if (white >= 3) {
            whitePct = 0.3;
            blackPct = 0.7;
        }

        const rand = Math.random();
        let newState = "GRAY"; // default fallback
        if (rand < whitePct) newState = "WHITE";
        else newState = "BLACK";

        return { ...cell, state: newState };
    });
}


function HexGrid() {
    const svgRef = useRef();
    const [cells, setCells] = useState([]);
    const [startId, setStartId] = useState(null);
    const [endId, setEndId] = useState(null);
    const [transform, setTransform] = useState(d3.zoomIdentity);

    // Initialize hexagon cluster grid to random state.
    useEffect(() => {
        const radius = 1; // change this number to grow/shrink cluster
        let id = 0;
        const hexes = [];

        // axial -> pixel conversion
        function axialToPixel(q, r) {
            const x = HEX_RADIUS * 1.5 * q;
            const y = HEX_RADIUS * Math.sqrt(3) * (r + q / 2);
            return { x, y };
        }
        for (let q = -radius; q <= radius; q++) {
            for (let r = -radius; r <= radius; r++) {
                const s = -q - r;
                if (Math.abs(s) <= radius) {
                    const { x, y } = axialToPixel(q, r);
                    hexes.push(
                        { id: id++,
                            q: q,
                            r: r,
                            s: s,
                            x: x,
                            y: y,
                            distance: 0,
                            cost: 0,
                            state: "GRAY"
                        }
                    );
                }
            }
        }
        setStartId(0);
        setEndId(3);
        setCells(randomizeHexStates(hexes));
    }, []);


    function updateHexStatesFromStep(stepResult) {
        console.log("Updating hex results: {}\n", stepResult);
        return;
        try {
            setCells((prev) =>
                prev.map((cell) => {
                const update = stepResult.find((s) => s.id === cell.id);
                if (!update) return cell;
                return {
                    ...cell,
                    distance: update.distance,
                    cost: update.cost,
                    visited: update.visited,
                };
                })
            );
        }catch(err) {
            console.error("Failed to update cells: {}", err)
        }
        

    }

    // Setup zoom
    useEffect(() => {
        const svg = d3.select(svgRef.current);

        // Disable double-click zoom
        svg.on("dblclick.zoom", null);

        svg.call(
            d3.zoom().on("zoom", (event) => {
                setTransform(event.transform);
            })
        );
    }, []);

    async function stepAlgo() {
        try {
            const gridData = {
                nodes: cells.map((cell) => ({
                    id: cell.id,
                    state: cell.state,
                    q: cell.q,
                    r: cell.r,
                    s: cell.s,
                    x: cell.x,
                    y: cell.y,
                    cost: cell.cost || 0,
                    distance: cell.distance || 0,
                    neighbors: cell.neighbors || [], // make sure neighbors array exists
                })),
            };
            const result = await window.electronAPI.runAStarStep(gridData, startId, endId);
            updateHexStatesFromStep(result);
        } catch(err) {
            console.error("Failed to run step Algo");
        }
    }
    // State cycle on click
    const handleClick = (id) => {
        setCells((prev) =>
            prev.map((c) =>
                c.id === id
                    ? {
                        ...c,
                        state: STATES[(STATES.indexOf(c.state) + 1) % STATES.length],
                    }
                    : c
            )
        );
    };

    // Color mapping
    const getFill = (state) => {
        if (state === "GRAY") return "gray";
        if (state === "WHITE") return "white";
        if (state === "BLACK") return "black";
    };

    // Export grid data with exact axial neighbors
    const exportGrid = () => {
        console.log("Exporting grid:");
         const gridData = {
            nodes: cells.map((cell) => ({
                id: cell.id,
                state: cell.state,
                q: cell.q,
                r: cell.r,
                s: cell.s,
                x: cell.x,
                y: cell.y,
                cost: cell.cost || 0,
                distance: cell.distance || 0,
                neighbors: cell.neighbors || [], // make sure neighbors array exists
            })),
        };

        // Convert to JSON string
        const jsonString = JSON.stringify(gridData, null, 2); // pretty print with 2-space indentation
        console.log("Exported grid:", jsonString);
        window.electronAPI.exportGrid(jsonString);
    };

    // flat-topped hex corners
    function hexCorners(x, y, radius) {
        return d3.range(6).map((i) => {
            const angle = (Math.PI / 180) * (60 * i); // flat-topped
            return [
                x + radius * Math.cos(angle),
                y + radius * Math.sin(angle),
            ].join(",");
        }).join(" ");
    }
   
    // Randomize grid according to neighbor rules
    const randomizeGrid = () => setCells(randomizeHexStates(cells));

    return (
        <div className="w-full h-full flex flex-col items-center">
            <div style={{ margin: "10px" }}>
                <button onClick={exportGrid} style={{ marginRight: "10px", padding: "6px 12px" }}>Export Grid</button>
                <button onClick={randomizeGrid} style={{ padding: "6px 12px" }}>Randomize Grid</button>
                <button onClick={stepAlgo} style={{ padding: "6px 12px" }}> Step Algo</button>
            </div>
            <svg ref={svgRef} width="100%" height="700px">
                <g transform={`translate(${window.innerWidth / 2}, ${window.innerHeight / 2}) ${transform.toString()}`}>
                    {cells.map((cell) => (
                        <g
                            key={cell.id}
                            transform={`translate(${cell.x}, ${cell.y})`}
                            onClick={() => handleClick(cell.id)}
                            onMouseEnter={(e) => {
                                // bring hovered hex to front
                                e.currentTarget.parentNode.appendChild(e.currentTarget);

                                // apply scale + lift (translateY up a bit)
                                e.currentTarget.setAttribute(
                                    "transform",
                                    `translate(${cell.x}, ${cell.y - 10}) scale(1.1)` // lift up 10px
                                );
                            }}
                            onMouseLeave={(e) => {
                                // restore original position + scale
                                e.currentTarget.setAttribute(
                                    "transform",
                                    `translate(${cell.x}, ${cell.y}) scale(1.0)`
                                );
                            }}
                        >
                            <polygon
                                points={hexCorners(0, 0, HEX_RADIUS)}
                                fill={getFill(cell.state)}
                                stroke="black"
                                strokeWidth="2"
                                style={{ transition: "transform 0.25s ease-in-out" }}
                            />

                             <text
                                x={0}
                                y={5}  // roughly center vertically
                                fontSize={12}
                                textAnchor="middle"  // center horizontally
                                fill="black"
                                pointerEvents="none" // so it doesn’t block mouse events
                                >
                                {`(${cell.q},${cell.r},${cell.s})`}
                            </text>
                        </g>
                    ))}
                </g>
            </svg>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<HexGrid />);
