import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import * as d3 from "d3";

const HEX_NUMBER = 7;
const NUM_HEX_TILES = HEX_NUMBER * (2 * HEX_NUMBER - 1); // Formula to find the x'th hex number.
const HEX_RADIUS = 40;
const STATES = ["OPEN", "CLOSED"];
const DIRECTIONS = [
    { q: +1, r: 0 },
    { q: +1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: +1 },
    { q: 0, r: +1 },
];
let startId = 0;
let endId = NUM_HEX_TILES;
function HexGrid() {
    const svgRef = useRef();
    const [cells, setCells] = useState([]);
    // const [startId, setStartId] = useState(0);
    // const [endId, setEndId] = useState(NUM_HEX_TILES);
    const [maxCost, setMaxCost] = useState(1);

    const [transform, setTransform] = useState(d3.zoomIdentity);
    const [selectMode, setSelectMode] = useState(null); // "start", "end", or null

    function randomizeHexStates(hexes, startId, endId) {
        // Build a quick lookup table: id -> cell
        const lookup = new Map(hexes.map((c) => [c.id, c]));

        // Generate a new startId
        // Helper to count neighbor states
        const countNeighbors = (cell) => {
            const neighborIds = DIRECTIONS.map(({ q, r }) =>
                lookup.get(`${cell.q + q},${cell.r + r}`)
            ).filter((n) => n !== undefined);

            let white = 0,
                black = 0;
            neighborIds.forEach((nid) => {
                const neighbor = lookup.get(nid) || neighborIds.find((id) => id === nid);
                if (neighbor?.state === "OPEN") white++;
                if (neighbor?.state === "CLOSED") black++;
            });
            return { white, black };
        };

        return hexes.map((cell) => {
            const { white, black } = countNeighbors(cell);

            // dummy markov.
            let whitePct = 0.5;
            if (white === 0 && black === 0) {
                whitePct = 0.5;
            } else if (white < 3) {
                whitePct = 0.6;
            } else if (white >= 3) {
                whitePct = 0.3;
            }

            const rand = Math.random();
            let newState = "CLOSED"; // default fallback
            if (rand < whitePct)
                newState = "OPEN";

            if (cell.id == startId || cell.id == endId) {
                console.log("Cell id: %d matches %d/%d", cell.id, startId, endId);
                newState = "OPEN";
            }
            
            return { ...cell,  cost: 0, state: newState, distance: 0, visited: false };
        });
    }
    function randomTile() {
        return Math.round(Math.random() * (NUM_HEX_TILES));
    }
    // Initialize hexagon cluster grid to random state.
    useEffect(() => {
        const radius = HEX_NUMBER; // change this number to grow/shrink cluster
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
                        {
                            id: id++,
                            q: q, r: r, s: s,
                            x: x,
                            y: y,
                            distance: 0,
                            visited: false,
                            cost: 0,
                            state: "GRAY"
                        }
                    );
                }
            }
        }

        startId = 0;
        endId = randomTile();
        console.log("sId e:Id => ", startId, endId);
        setCells(randomizeHexStates(hexes, startId, endId));
    }, []);


    function updateHexStatesFromStep(stepResult) {
        try {
            setCells((prev) =>
                prev.map((cell) => {
                    const update = stepResult["nodes"].find((s) => s.id === cell.id);
                    if (cell.id == endId) {
                        setMaxCost(update.distance)
                    }
                    if (!update) return cell;
                    return {
                        ...cell,
                        distance: update.distance,
                        visited: update.visited,
                        cost: update.cost,
                    };
                })
            );
        } catch (err) {
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
                    visited: false,
                    cost: cell.cost || 0,
                    distance: cell.distance || 0,
                    neighbors: cell.neighbors || []
                })),
            };
            const result = await window.electronAPI.runAStarStep(gridData, startId, endId);
            updateHexStatesFromStep(result);
        } catch (err) {
            console.error("Failed to run step Algo");
        }
    }
    // State cycle on click
    const handleHexClick = (cellId) => {
        if (selectMode === "start") {
            startId = cellId;
            setSelectMode(null); // exit selection mode
            setCells((prev) =>
                prev.map((c) => c.id === cellId ? {
                    ...c,
                    state: "OPEN",
                } : c)
            );
        } else if (selectMode === "end") {
            endId = cellId;
            setSelectMode(null); // exit selection mode
            setCells((prev) =>
                prev.map((c) => c.id === cellId ? {
                    ...c,
                    state: "OPEN",
                } : c)
            );
        } else {
            // Normal click behavior: cycle hex state
            setCells((prev) =>
                prev.map((c) => c.id === cellId ? {
                    ...c,
                    state: STATES[(STATES.indexOf(c.state) + 1) % STATES.length],
                } : c)
            );
        }
    };

    // Color mapping
    const getFill = (cell) => {
        if (cell.id == startId)
            return "rgb(0, 255,0)";
        if (cell.id == endId)
            return "rgb(255,0,0)";

        if (cell.state === "OPEN") {
            if (cell.distance > 0 && cell.visited) {
                let r = 255*(cell.distance / maxCost);
                let g = 255 - 255*(cell.distance / maxCost);
                return `rgb(${r},${g},0)`;
            } else if (cell.cost > 0) {
                return "gray";
            } else {
                return "white";
            }
        }
        if (cell.state === "CLOSED")
            return "black";
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
                visited: cell.visited,
                cost: cell.cost || 0,
                distance: cell.distance || 0,
                neighbors: cell.neighbors || [] // make sure neighbors array exists
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
    const randomizeGrid = () => {
        startId = randomTile();
        endId = 1 + randomTile();
        console.log(`Ids now ${startId} / ${endId}`);
        setCells(randomizeHexStates(cells, startId, endId))
    };

    return (
        <div className="w-full h-full flex flex-col items-center">
            <div style={{ margin: "10px" }}>
                <button onClick={exportGrid} style={{ marginRight: "10px", padding: "6px 12px" }}>Export Grid</button>
                <button onClick={randomizeGrid} style={{ padding: "6px 12px" }}>Randomize Grid</button>
                <button onClick={stepAlgo} style={{ padding: "6px 12px" }}> Step Algo</button>
            </div>
            <div style={{ marginBottom: "10px" }}>
                <button onClick={() => setSelectMode("start")}>Select Start Tile</button>
                <button onClick={() => setSelectMode("end")}>Select End Tile</button>
                <span style={{ marginLeft: "10px" }}>
                    {selectMode ? `Click a hex to select ${selectMode} tile` : ""}
                </span>
            </div>
            <svg ref={svgRef} width="100%" height="700px">
                <g transform={`translate(${window.innerWidth / 2}, ${window.innerHeight / 2}) ${transform.toString()}`}>
                    {cells.map((cell) => (
                        <g
                            key={cell.id}
                            transform={`translate(${cell.x}, ${cell.y})`}
                            onClick={() => handleHexClick(cell.id)}
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
                                fill={getFill(cell)}
                                stroke="black"
                                strokeWidth="2"
                                style={{ transition: "transform 0.25s ease-in-out" }}
                            />
                            <text
                                x={0}
                                y={-5}  // roughly center vertically
                                fontSize={12}
                                textAnchor="middle"  // center horizontally
                                fill="black"
                                pointerEvents="none" // so it doesn’t block mouse events
                            >
                                {`(id:${cell.id})`}
                            </text>
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
                            <text
                                x={0}
                                y={15}  // roughly center vertically
                                fontSize={12}
                                textAnchor="middle"  // center horizontally
                                fill="black"
                                pointerEvents="none" // so it doesn’t block mouse events
                            >
                                {`F(n):(${cell.distance})`}
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
