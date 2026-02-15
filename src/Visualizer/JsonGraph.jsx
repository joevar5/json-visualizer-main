import React, { useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, Position, ReactFlowProvider, useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import './JsonGraph.css';

const nodeWidth = 220;
const nodeHeight = 60;

// [DSA] Graph Layout Algorithm
// We use a Directed Acyclic Graph (DAG) layout engine here.
// In DSA terms, we are assigning (x, y) coordinates to each Vertex (V)
// so that edges (E) flow in a specific direction without cycles.
const getLayoutedElements = (nodes, edges) => {
  // [DSA] Initialize a new Graph data structure
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // [DSA] Set layout direction to "Left-to-Right" (LR)
  // This creates a hierarchical tree structure visually.
  dagreGraph.setGraph({ rankdir: 'LR' });

  // [DSA] Add Vertices (Nodes) to the graph instance
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // [DSA] Add Directed Edges to the graph instance
  // An edge connects a Source node to a Target node (u -> v)
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // [DSA] Run the layout algorithm (topological sort + positioning)
  // Time Complexity: Depends on the heuristic, usually O(V + E) or slightly higher
  dagre.layout(dagreGraph);

  // [DSA] Map the calculated positions back to our Node objects
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const JsonGraphInner = forwardRef(({ data, onShowLogic }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [collapsedNodes, setCollapsedNodes] = React.useState(new Set());
  const [nodeHierarchy, setNodeHierarchy] = React.useState({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [matchedNodes, setMatchedNodes] = React.useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const { getNodes } = useReactFlow();

  // Constants for graph limits
  const MAX_NODES = 3000;
  const MAX_DEPTH = 10;
  const MAX_ARRAY_ITEMS = 50;
  const MAX_OBJECT_PROPS = 50;

  // [DSA] Virtualization: Only render nodes in viewport
  const [enableVirtualization] = React.useState(true);
  const [viewport, setViewport] = React.useState({ x: 0, y: 0, zoom: 1 });


  useImperativeHandle(ref, () => ({
    exportAsImage: async () => {
      // [DSA] High-Quality HD Export
      // Get the bounding box of all nodes to determine actual content size
      const nodesBounds = getNodesBounds(getNodes());

      // Define padding around the graph (logical pixels)
      const padding = 100;
      const graphWidth = nodesBounds.width + (padding * 2);
      const graphHeight = nodesBounds.height + (padding * 2);

      // [DSA] HD Configuration
      // User requested "scale 200%" -> pixelRatio: 2
      // This creates a double-density image (like Retina displays)
      const pixelRatio = 2;

      // Safety Mechanism: Prevent browser crash on massive graphs
      // Max safe canvas dimension is typically ~16,384px in modern browsers
      const maxCanvasDimension = 16000;
      const maxLogicalDimension = maxCanvasDimension / pixelRatio;

      // Calculate layout scale (usually 1.0, but reduced if graph is gigantic)
      let scale = 1;
      if (graphWidth > maxLogicalDimension || graphHeight > maxLogicalDimension) {
        const scaleW = maxLogicalDimension / graphWidth;
        const scaleH = maxLogicalDimension / graphHeight;
        scale = Math.min(scaleW, scaleH);
        console.warn(`Graph too large for 2x native export. Adjusting scale to ${Math.round(scale * 100)}% to fit constraints.`);
      }

      const viewportElement = document.querySelector('.react-flow__viewport');

      if (!viewportElement) {
        throw new Error('Viewport element not found');
      }

      // Calculate transform to center graph in the new canvas
      // We translate the top-left of the bounding box to (padding, padding)
      const transformX = -nodesBounds.x + padding;
      const transformY = -nodesBounds.y + padding;

      return toPng(viewportElement, {
        backgroundColor: '#1e1e1e',
        width: graphWidth * scale,
        height: graphHeight * scale,
        pixelRatio: pixelRatio,
        style: {
          width: `${graphWidth * scale}px`,
          height: `${graphHeight * scale}px`,
          // Apply the transform to position the graph correctly within the snapshot
          transform: `scale(${scale}) translate(${transformX}px, ${transformY}px)`,
          transformOrigin: 'top left'
        },
      });
    },
    clearSearch: () => {
      // Clear search state
      setSearchQuery('');
      setMatchedNodes([]);
      setCurrentMatchIndex(0);
      // Clear node highlights
      setNodes(currentNodes =>
        currentNodes.map(n => ({
          ...n,
          className: n.data.isObject ? 'node-object' : 'node-primitive',
          style: { ...n.style, outline: 'none' }
        }))
      );
    }
  }));

  // [DSA] Main Graph Construction Function
  // Transforms the JSON Tree into a Node-Link diagram.
  const processGraph = useCallback((jsonString) => {
    try {
      const parsedData = JSON.parse(jsonString);

      // [DSA] Vertices (V) list
      const tempNodes = [];
      // [DSA] Edges (E) list
      const tempEdges = [];
      // [DSA] Adjacency List: A HashMap storing parent -> children relationships
      // Structure: { "node-1": ["node-2", "node-3"] }
      // This allows O(1) lookup of children, essential for the "collapse" feature.
      const hierarchy = {};

      let nodeIdCounter = 0;
      let isLimitReached = false;

      // [DSA] Depth First Search (DFS) or Pre-order Traversal
      // We visit the root, process it, then recursively visit all children.
      // Time Complexity: O(N) where N is the total number of keys in the JSON
      // Space Complexity: O(H) where H is the height/depth of the JSON tree (call stack)
      const traverse = (key, value, parentId = null, depth = 0) => {
        // [DSA] Base Case / Pruning
        // Essential in recursion to prevent stack overflow or excessive processing.
        if (nodeIdCounter >= MAX_NODES || depth > MAX_DEPTH) {
          if (!isLimitReached) {
            isLimitReached = true;
            console.warn(`Visualization limit reached. Showing first ${MAX_NODES} nodes.`);
          }
          return;
        }

        const currentId = `node-${nodeIdCounter++}`;
        const isObject = value !== null && typeof value === 'object';

        // Create label with collapse indicator for objects
        let label;
        if (isObject) {
          const objectType = Array.isArray(value) ? '[]' : '{}';
          label = `${key} ${objectType}`;
        } else {
          label = `${key}: ${String(value).substring(0, 50)}`;
        }

        // [DSA] Create Vertex (Node)
        tempNodes.push({
          id: currentId,
          data: {
            label,
            isObject,
            hasChildren: isObject && value !== null,
            collapsedHidden: false // Track logical visibility
          },
          position: { x: 0, y: 0 },
          type: 'default',
          className: isObject ? 'node-object' : 'node-primitive'
        });

        // [DSA] Build Adjacency List
        if (!hierarchy[currentId]) {
          hierarchy[currentId] = [];
        }

        if (parentId) {
          // Add this node as a child of its parent
          if (!hierarchy[parentId]) {
            hierarchy[parentId] = [];
          }
          hierarchy[parentId].push(currentId);

          // [DSA] Create Edge (Association)
          // Since this is a Tree, each node has exactly one incoming edge (except Root)
          tempEdges.push({
            id: `edge-${parentId}-${currentId}`,
            source: parentId,
            target: currentId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#a1a1aa', strokeWidth: 1.5 },
          });
        }

        // [DSA] Recursive Step
        // If the current value is a container (Object/Array), we recurse into it.
        if (isObject && value !== null && nodeIdCounter < MAX_NODES && depth < MAX_DEPTH) {
          if (Array.isArray(value)) {
            const itemsToShow = Math.min(value.length, MAX_ARRAY_ITEMS);
            for (let i = 0; i < itemsToShow; i++) {
              // [DSA] Recursive Call for each array item
              traverse(`[${i}]`, value[i], currentId, depth + 1);
            }
            // Handle truncation (omitted for brevity)
            if (value.length > itemsToShow) {
              // ... logic for "more items" node ...
              const moreId = `node-${nodeIdCounter++}`;
              tempNodes.push({
                id: moreId,
                data: {
                  label: `... ${value.length - itemsToShow} more items`,
                  collapsedHidden: false
                },
                position: { x: 0, y: 0 },
                type: 'default',
                className: 'node-primitive'
              });
              tempEdges.push({ id: `edge-${currentId}-${moreId}`, source: currentId, target: moreId, type: 'smoothstep', animated: true, style: { stroke: '#a1a1aa', strokeWidth: 1.5 } });
            }
          } else {
            const entries = Object.entries(value);
            const propsToShow = Math.min(entries.length, MAX_OBJECT_PROPS);
            for (let i = 0; i < propsToShow; i++) {
              const [childKey, childValue] = entries[i];
              // [DSA] Recursive Call for each object property
              traverse(childKey, childValue, currentId, depth + 1);
            }
            if (entries.length > propsToShow) {
              // ... logic for "more props" node ...
              const moreId = `node-${nodeIdCounter++}`;
              tempNodes.push({
                id: moreId,
                data: {
                  label: `... ${entries.length - propsToShow} more properties`,
                  collapsedHidden: false
                },
                position: { x: 0, y: 0 },
                type: 'default',
                className: 'node-primitive'
              });
              tempEdges.push({ id: `edge-${currentId}-${moreId}`, source: currentId, target: moreId, type: 'smoothstep', animated: true, style: { stroke: '#a1a1aa', strokeWidth: 1.5 } });
            }
          }
        }
      };

      // [DSA] Start Traversal at the Root
      traverse('Root', parsedData, null, 0);

      if (isLimitReached) {
        const warningId = `node-warning`;
        tempNodes.unshift({
          id: warningId,
          data: {
            label: `⚠️ Large JSON: Showing ${tempNodes.length} nodes (Limit: ${MAX_NODES})`,
            collapsedHidden: false
          },
          position: { x: 0, y: 0 },
          type: 'default',
          className: 'node-warning'
        });
      }

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        tempNodes,
        tempEdges
      );

      // Add initial ▼ indicator to all object nodes with children (they start expanded)
      const nodesWithIndicators = layoutedNodes.map(node => {
        if (node.data.hasChildren && hierarchy[node.id] && hierarchy[node.id].length > 0) {
          return {
            ...node,
            data: {
              ...node.data,
              label: '▼ ' + node.data.label
            }
          };
        }
        return node;
      });

      setNodes(nodesWithIndicators);
      setEdges(layoutedEdges);
      setNodeHierarchy(hierarchy); // Store the adjacency list for later use
    } catch (err) {
      console.error(err);
    }
  }, [setNodes, setEdges]);

  // Handle node click for collapse/expand
  const onNodeClick = useCallback((event, node) => {
    // Only allow collapse/expand for object nodes (blue boxes)
    if (!node.className || !node.className.includes('node-object')) {
      return;
    }

    const nodeId = node.id;
    const isCurrentlyCollapsed = collapsedNodes.has(nodeId);

    // [DSA] Breadth-First Search (BFS) / Traversal
    // We need to find ALL descendants of the node to hide/show them.
    // Graph Traversal Problem: "Find all reachable nodes starting from X"
    const getAllDescendants = (id) => {
      const descendants = [];
      // [DSA] Queue: A FIFO (First-In-First-Out) structure is typical for BFS.
      const queue = [id];

      while (queue.length > 0) {
        // [DSA] Dequeue: Take the first element
        const currentId = queue.shift();

        // [DSA] Lookup Children from Adjacency List
        const children = nodeHierarchy[currentId] || [];

        children.forEach(childId => {
          descendants.push(childId);
          // [DSA] Enqueue: Add children to look for THEIR children in next iterations
          queue.push(childId);
        });
      }

      return descendants;
    };

    const descendants = getAllDescendants(nodeId);

    // Toggle collapsed state
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyCollapsed) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });

    // Update nodes: hide/show descendants and update the clicked node's label
    setNodes(currentNodes =>
      currentNodes.map(n => {
        // Update descendants visibility
        if (descendants.includes(n.id)) {
          const newCollapsedState = !isCurrentlyCollapsed;
          return {
            ...n,
            hidden: newCollapsedState, // Apply immediately
            data: {
              ...n.data,
              collapsedHidden: newCollapsedState // Track logical state
            }
          };
        }

        // Update the clicked node's label to show collapse indicator
        if (n.id === nodeId && n.data.hasChildren) {
          const baseLabel = n.data.label.replace(/^[▼▶]\s/, ''); // Remove existing indicator
          // If currently collapsed, we're expanding -> show ▼
          // If currently expanded, we're collapsing -> show ▶
          const indicator = isCurrentlyCollapsed ? '▼ ' : '▶ ';
          return {
            ...n,
            data: {
              ...n.data,
              label: indicator + baseLabel
            }
          };
        }

        return n;
      })
    );

    // Hide/show edges connected to descendants
    setEdges(currentEdges =>
      currentEdges.map(e => {
        if (descendants.includes(e.target) || descendants.includes(e.source)) {
          return {
            ...e,
            hidden: !isCurrentlyCollapsed,
          };
        }
        return e;
      })
    );
  }, [collapsedNodes, nodeHierarchy, setNodes, setEdges]);

  // Search functionality
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      // Clear search highlights (omitted logic...)
      setMatchedNodes([]);
      setCurrentMatchIndex(0);
      setNodes(currentNodes =>
        currentNodes.map(n => ({
          ...n,
          className: n.data.isObject ? 'node-object' : 'node-primitive',
          style: { ...n.style, outline: 'none' }
        }))
      );
      return;
    }

    const lowerQuery = query.toLowerCase();

    setNodes(currentNodes => {
      const matches = [];
      // [DSA] Set: Efficient O(1) storage for unique items (nodes to expand)
      const nodesToExpand = new Set();

      // [DSA] Linear Search: Scan through all nodes (O(N))
      currentNodes.forEach(node => {
        if (!node.data || !node.data.label) return;

        const label = node.data.label.replace(/^[▼▶]\s/, '');
        if (label.toLowerCase().includes(lowerQuery)) {
          matches.push(node.id);

          // [DSA] Path Finding (Backtracking)
          // For every match, we must traverse UP the tree to ensure all parents are expanded.
          // This ensures the user can actually see the result.
          Object.keys(nodeHierarchy).forEach(parentId => {
            // Check if this parent points to our matching node
            if (nodeHierarchy[parentId] && nodeHierarchy[parentId].includes(node.id)) {
              let currentParent = parentId;

              // Walk up the tree until the root or a break
              while (currentParent) {
                nodesToExpand.add(currentParent);
                // Find parent of current parent (Grandparent)
                // This lookup is technically slow O(V*E) in this specific implementation 
                // because our adjacency list is Parent->Child (Directed), not Child->Parent.
                // A Doubly Linked List or storing a separate "ParentMap" would optimize this to O(Depth).
                const grandParent = Object.keys(nodeHierarchy).find(gp =>
                  nodeHierarchy[gp] && nodeHierarchy[gp].includes(currentParent)
                );
                currentParent = grandParent;
              }
            }
          });
        }
      });

      setMatchedNodes(matches);
      setCurrentMatchIndex(matches.length > 0 ? 0 : -1);

      if (nodesToExpand.size > 0) {
        setCollapsedNodes(prev => {
          const newSet = new Set(prev);
          nodesToExpand.forEach(nodeId => newSet.delete(nodeId));
          return newSet;
        });
      }

      // Return updated nodes logic...
      return currentNodes.map(n => {
        let shouldBeHidden = false; // Default logical visibility

        if (nodesToExpand.size > 0) {
          // If we are searching, we might force expand things
          // Refactored logic to respect collapsedHidden would be complex here, 
          // for now we trust the "expand path" logic which should set hidden=false

          // Simplified: If search expands, we mark it logically visible
          // Note: The original search code recalculated 'shouldBeHidden' from scratch
          // based on collapsedNodes. We keep that behavior but sync data.collapsedHidden.

          const isDescendantOfCollapsed = Array.from(collapsedNodes).some(collapsedId => {
            if (nodesToExpand.has(collapsedId)) return false;
            const descendants = []; // Need efficient lookup or re-traverse
            // ... reusing the BFS check logic from existing code ...
            const queue = [collapsedId];
            while (queue.length > 0) {
              const curr = queue.shift();
              const kids = nodeHierarchy[curr] || [];
              if (kids.includes(n.id)) return true;
              kids.forEach(k => queue.push(k));
            }
            return false;
          });

          shouldBeHidden = isDescendantOfCollapsed;
        }

        return {
          ...n,
          hidden: shouldBeHidden,
          data: {
            ...n.data,
            collapsedHidden: shouldBeHidden
          },
          className: matches.includes(n.id)
            ? (n.data.isObject ? 'node-object node-search-match' : 'node-primitive node-search-match')
            : (n.data.isObject ? 'node-object' : 'node-primitive'),
          style: matches.includes(n.id)
            ? { ...n.style, outline: '3px solid #fbbf24', outlineOffset: '2px' }
            : { ...n.style, outline: 'none' }
        };
      });
    });
  }, [nodeHierarchy, collapsedNodes, setNodes, setCollapsedNodes]);

  // Navigate to next/previous search result
  const navigateSearch = useCallback((direction) => {
    if (matchedNodes.length === 0) return;

    const newIndex = direction === 'next'
      ? (currentMatchIndex + 1) % matchedNodes.length
      : (currentMatchIndex - 1 + matchedNodes.length) % matchedNodes.length;

    setCurrentMatchIndex(newIndex);

    // Focus on the matched node and center viewport
    const matchedNodeId = matchedNodes[newIndex];
    setNodes(currentNodes =>
      currentNodes.map(n => ({
        ...n,
        style: n.id === matchedNodeId
          ? { ...n.style, outline: '3px solid #f59e0b', outlineOffset: '2px' }
          : matchedNodes.includes(n.id)
            ? { ...n.style, outline: '3px solid #fbbf24', outlineOffset: '2px' }
            : { ...n.style, outline: 'none' }
      }))
    );

    // Center viewport on the selected node with comfortable zoom
    setTimeout(() => {
      const reactFlowInstance = window.reactFlowInstance;
      if (reactFlowInstance) {
        const node = reactFlowInstance.getNode(matchedNodeId);
        if (node) {
          const { x, y, width, height } = node.positionAbsolute || node.position;
          const centerX = x + (width || 150) / 2;
          const centerY = y + (height || 40) / 2;

          reactFlowInstance.setCenter(centerX, centerY, {
            zoom: 1.2,
            duration: 800
          });
        }
      }
    }, 50);
  }, [matchedNodes, currentMatchIndex, setNodes]);

  // [DSA] Virtualization Effect
  // Updates node visibility when viewport changes
  useEffect(() => {
    // Skip if virtualization is disabled or we don't have enough nodes to worry
    if (!enableVirtualization || nodes.length < 100) return;

    // Use a timeout to debounce updates (prevent lag while dragging)
    const timeoutId = setTimeout(() => {
      const renderer = document.querySelector('.react-flow__renderer');
      if (!renderer) return;

      const { width, height } = renderer.getBoundingClientRect();
      const buffer = 800; // Large buffer for smooth scrolling

      const visibleRect = {
        x: -viewport.x / viewport.zoom - buffer,
        y: -viewport.y / viewport.zoom - buffer,
        width: width / viewport.zoom + (buffer * 2),
        height: height / viewport.zoom + (buffer * 2)
      };

      setNodes(nds => nds.map(node => {
        // Optimization: Skip calculation if logically hidden by collapse
        if (node.data.collapsedHidden) {
          // Ensure it remains hidden
          return node.hidden ? node : { ...node, hidden: true };
        }

        // Always show the root node or special warnings
        if (node.id === 'node-0' || node.type === 'node-warning') return { ...node, hidden: false };

        // Simple bounding box intersection check
        const nodeX = node.position.x;
        const nodeY = node.position.y;
        // Assume default node size if not set yet
        const nodeW = node.width || 220;
        const nodeH = node.height || 60;

        const isVisible =
          nodeX + nodeW > visibleRect.x &&
          nodeX < visibleRect.x + visibleRect.width &&
          nodeY + nodeH > visibleRect.y &&
          nodeY < visibleRect.y + visibleRect.height;

        // Final visibility = Logically Visible AND Viewport Visible
        // Since we already filtered for !collapsedHidden, we just check isVisible
        const shouldHide = !isVisible;

        // Only update if visibility changes to avoid unnecessary re-renders
        if (node.hidden !== shouldHide) {
          return {
            ...node,
            hidden: shouldHide
          };
        }

        return node;
      }));
    }, 150); // Debounce

    return () => clearTimeout(timeoutId);
  }, [viewport, enableVirtualization, nodes.length]);

  useEffect(() => {
    if (data) {
      // Clear search when new data is loaded
      setSearchQuery('');
      setMatchedNodes([]);
      setCurrentMatchIndex(0);

      processGraph(data);
    }
  }, [data, processGraph]);

  return (
    <div className="json-graph-container">
      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-input-container">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 14L10.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search keys and values..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => handleSearch('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {matchedNodes.length > 0 && (
          <div className="search-results">
            <span className="search-count">
              {currentMatchIndex + 1} of {matchedNodes.length}
            </span>
            <button
              className="search-nav-btn"
              onClick={() => navigateSearch('prev')}
              title="Previous match"
              disabled={matchedNodes.length === 0}
            >
              ↑
            </button>
            <button
              className="search-nav-btn"
              onClick={() => navigateSearch('next')}
              title="Next match"
              disabled={matchedNodes.length === 0}
            >
              ↓
            </button>
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onInit={(instance) => { window.reactFlowInstance = instance; }}
        onMove={(event, viewportData) => {
          if (enableVirtualization) {
            setViewport(viewportData);
          }
        }}
        fitView
        attributionPosition="bottom-right"
        className="json-flow-renderer"
        minZoom={0.1}
        maxZoom={4}
        // [DSA] Only render nodes in viewport + buffer zone
        // This reduces DOM nodes significantly for large graphs
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background variant="dots" color="#404040" gap={16} size={1.5} />
        <Controls />
        <div className="graph-info-wrapper">
          <button
            className="graph-info-btn"
            onClick={onShowLogic}
            title="How does this work?"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="info-label">Interested in a deep dive?</span>
          </button>
        </div>
      </ReactFlow>
    </div>
  );
});

const JsonGraph = forwardRef((props, ref) => {
  return (
    <ReactFlowProvider>
      <JsonGraphInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

export default JsonGraph;