import React, { useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, Position, ReactFlowProvider, useReactFlow, getNodesBounds } from '@xyflow/react';
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
  const [contextMenu, setContextMenu] = React.useState(null); // [DSA] Context Menu State
  const [hoverInfo, setHoverInfo] = React.useState(null); // [DSA] Hover Trace Tooltip State
  const [showFeatures, setShowFeatures] = React.useState(false); // Features Modal State
  const [hasSeenFeatures, setHasSeenFeatures] = React.useState(() => {
    try {
      return localStorage.getItem('hasSeenFeatures') === 'true';
    } catch (e) { return false; }
  });
  // [DSA] Responsive Check - Increased threshold to account for Sidebar + Center Search
  const [isSmallScreen, setIsSmallScreen] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 1350 : false);

  React.useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 1350);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleShowFeatures = useCallback(() => {
    setShowFeatures(true);
    if (!hasSeenFeatures) {
      setHasSeenFeatures(true);
      localStorage.setItem('hasSeenFeatures', 'true');
    }
  }, [hasSeenFeatures]);
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
            collapsedHidden: false, // Track logical visibility
            parentId // [DSA] Keep track of parent for virtualization path finding
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
          // Helper to find parent node
          const findParent = (childId) => Object.keys(nodeHierarchy).find(gp =>
            nodeHierarchy[gp] && nodeHierarchy[gp].includes(childId)
          );

          Object.keys(nodeHierarchy).forEach(parentId => {
            // Check if this parent points to our matching node
            if (nodeHierarchy[parentId] && nodeHierarchy[parentId].includes(node.id)) {
              let currentParent = parentId;

              // Walk up the tree until the root or a break
              while (currentParent) {
                nodesToExpand.add(currentParent);
                // Find parent of current parent (Grandparent)
                currentParent = findParent(currentParent);
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

  // [DSA] Context Menu Handler
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setHoverInfo(null); // [Fix] Immediately clear hover info when opening context menu
    const pane = document.querySelector('.json-graph-container').getBoundingClientRect();

    // [DSA] Find "Main Section" (Top-level ancestor below Root)
    // Useful for jumping out of deep nesting (e.g. from "City" back to "Users")
    let mainSection = null;
    let current = node;
    let depth = 0;

    // Traverse up
    while (current && current.data && current.data.parentId && depth < 20) {
      // If parent is Root, then THIS node is the Main Section
      if (current.data.parentId === 'node-0') {
        mainSection = current;
        break;
      }

      const parentId = current.data.parentId;
      const parent = nodes.find(n => n.id === parentId);
      if (parent) {
        current = parent;
      } else {
        break;
      }
      depth++;
    }

    setContextMenu({
      id: node.id,
      x: event.clientX - pane.left,
      y: event.clientY - pane.top,
      node: node,
      mainSection: (mainSection && mainSection.id !== node.id) ? mainSection : null
    });
  }, [nodes]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // [DSA] Hover Handler for Trace Tooltip
  const onNodeMouseEnter = useCallback((event, node) => {
    // [Fix] Do not show tooltip if context menu is active
    if (contextMenu) return;

    // Only show trace for non-root nodes
    if (node.id === 'node-0') return;

    const path = [];
    let curr = node;
    let depth = 0;

    // Traverse UP to build path
    while (curr && curr.data && curr.data.parentId && depth < 10) { // Limit depth for tooltip
      const pid = curr.data.parentId;
      const parent = nodes.find(n => n.id === pid);
      if (parent) {
        // Clean label
        let label = parent.data.label.replace(/^[▼▶]\s/, '');
        // Truncate long labels
        if (label.length > 20) label = label.substring(0, 20) + '...';
        path.unshift(label);
        curr = parent;
      } else break;
      depth++;
    }

    // Current node label
    let currentLabel = node.data.label.replace(/^[▼▶]\s/, '');
    if (currentLabel.length > 30) currentLabel = currentLabel.substring(0, 30) + '...';

    const pane = document.querySelector('.json-graph-container').getBoundingClientRect();

    setHoverInfo({
      x: event.clientX - pane.left + 20,
      y: event.clientY - pane.top,
      path,
      label: currentLabel
    });
  }, [nodes, contextMenu]);

  const onNodeMouseLeave = useCallback(() => setHoverInfo(null), []);


  const handleJumpToNode = useCallback((targetId) => {
    closeContextMenu();

    if (!targetId) return;

    const rf = window.reactFlowInstance;
    const targetNode = rf.getNode(targetId);

    if (targetNode) {
      // 1. Center View on Target
      const x = targetNode.position.x + (targetNode.width || 220) / 2;
      const y = targetNode.position.y + (targetNode.height || 60) / 2;

      rf.setCenter(x, y, { zoom: 1.2, duration: 800 });

      // 2. Flash Highlight
      setNodes(nds => nds.map(n => ({
        ...n,
        style: n.id === targetId
          ? { ...n.style, outline: '3px solid #3b82f6', outlineOffset: '4px', transition: 'all 0.3s' }
          : { ...n.style, outline: 'none' }
      })));

      setTimeout(() => {
        setNodes(nds => nds.map(n => ({
          ...n,
          style: { ...n.style, outline: 'none' }
        })));
      }, 2000);
    }
  }, [closeContextMenu, setNodes]);



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

      setNodes(nds => {
        // 1. Identify direct visibility & build map
        const nodeMap = new Map();
        const visibleIds = new Set();

        // Use 'nds' (current nodes) to ensure we have latest positions
        nds.forEach(n => {
          nodeMap.set(n.id, n);
          // Always show root and warnings
          if (n.id === 'node-0' || n.type === 'node-warning') { visibleIds.add(n.id); return; }

          if (n.data.collapsedHidden) return; // Skip logically hidden

          const nx = n.position.x;
          const ny = n.position.y;
          const nw = n.width || 220;
          const nh = n.height || 60;

          // Check intersection
          if (
            nx + nw > visibleRect.x &&
            nx < visibleRect.x + visibleRect.width &&
            ny + nh > visibleRect.y &&
            ny < visibleRect.y + visibleRect.height
          ) {
            visibleIds.add(n.id);
          }
        });

        // 2. Ancestry Protection: Ensure parents of visible nodes are also visible
        // This prevents edges from disappearing when the parent is off-screen
        const finalVisible = new Set(visibleIds);
        visibleIds.forEach(id => {
          let curr = nodeMap.get(id);
          // Traverse up the tree
          while (curr && curr.data && curr.data.parentId) {
            const pid = curr.data.parentId;
            if (finalVisible.has(pid)) break; // Already visited this path
            finalVisible.add(pid);
            curr = nodeMap.get(pid);
          }
        });

        // 3. Apply changes
        return nds.map(node => {
          if (node.data.collapsedHidden) {
            return node.hidden ? node : { ...node, hidden: true };
          }

          const shouldHide = !finalVisible.has(node.id);
          if (node.hidden !== shouldHide) {
            return { ...node, hidden: shouldHide };
          }
          return node;
        });
      });
    }, 150); // Debounce

    return () => clearTimeout(timeoutId);
  }, [viewport, enableVirtualization, nodes, setNodes]);

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
      {/* Search Bar - Top Center */}
      <div className="search-bar" style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                navigateSearch(e.shiftKey ? 'prev' : 'next');
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateSearch('next');
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateSearch('prev');
              }
            }}
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
        onNodeContextMenu={onNodeContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={closeContextMenu}
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

        {/* Features Button - Icon Only, Above Controls (Bottom Left) */}
        <button
          className={`graph-info-btn feature-icon-btn ${!hasSeenFeatures ? 'feature-btn-glow' : ''}`}
          onClick={handleShowFeatures}
          title={!hasSeenFeatures ? "New Features Available!" : "Features"}
          style={{
            position: 'absolute',
            bottom: 145, // roughly above the 4 control buttons
            left: 15,
            zIndex: 10,
            padding: 8,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#2B2B2B',
            border: '1px solid #555',
            borderRadius: 4,
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#60a5fa' }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </button>

        {/* Deep Dive Button - Top Right with Auto-Collapse */}
        <div className="graph-info-wrapper" style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
          <button
            className="graph-info-btn"
            onClick={onShowLogic}
            title="How does this work?"
            style={{
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              maxWidth: (searchQuery || isSmallScreen) ? '42px' : '280px',
              padding: (searchQuery || isSmallScreen) ? '8px' : '8px 16px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            {/* Show Question Mark when searching, Info 'i' when expanded? Or just consistent Question Mark? */}
            {/* User asked for Question Mark icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ minWidth: 20 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>

            <span
              className="info-label"
              style={{
                marginLeft: 10,
                opacity: (searchQuery || isSmallScreen) ? 0 : 1,
                transition: 'opacity 0.2s',
                pointerEvents: (searchQuery || isSmallScreen) ? 'none' : 'auto'
              }}
            >
              Interested in a deep dive?
            </span>
          </button>
        </div>

        {/* Features Modal */}
        {showFeatures && (
          <div className="features-backdrop" onClick={() => setShowFeatures(false)}>
            <div className="features-modal" onClick={e => e.stopPropagation()}>
              <div className="features-header">
                <h2>Power Features</h2>
                <button className="close-btn" onClick={() => setShowFeatures(false)}>✕</button>
              </div>

              <div className="feature-list">
                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div className="feature-content">
                    <h4>Smart Trace on Hover</h4>
                    <p>Hover over any node to simply visualize its full path from Root. Never get lost in deep JSON again.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon-wrapper" style={{ color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.2)', background: 'rgba(168, 85, 247, 0.1)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </div>
                  <div className="feature-content">
                    <h4>Context Navigation</h4>
                    <p>Right-click any node to instantly jump to its <b>Parent</b>, <b>Main Section</b>, or back to <b>Root</b>.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-icon-wrapper" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.1)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div className="feature-content">
                    <h4>Deep Search</h4>
                    <p>Type to find any key or value. Navigate results with <code>Enter</code> or <code>Arrow Keys</code> (Up/Down).</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {contextMenu && (
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseLeave={closeContextMenu}
          >
            <div className="context-menu-header">Jump To</div>

            {/* 1. Go to Parent */}
            {contextMenu.node.data.parentId ? (
              <div
                className="context-menu-item"
                onClick={() => handleJumpToNode(contextMenu.node.data.parentId)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                Go to Parent
              </div>
            ) : (
              <div className="context-menu-item disabled" style={{ opacity: 0.5 }}>Is Root</div>
            )}

            {/* 2. Go to Main Section (if applicable and different from Parent) */}
            {contextMenu.mainSection &&
              contextMenu.mainSection.id !== contextMenu.node.data.parentId && (
                <div
                  className="context-menu-item"
                  onClick={() => handleJumpToNode(contextMenu.mainSection.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Go to {contextMenu.mainSection.data.label.split(' ')[0]}
                </div>
              )}

            {/* 3. Go to Root (if not already at Root or Main Section) */}
            {contextMenu.node.id !== 'node-0' &&
              (!contextMenu.mainSection || contextMenu.mainSection.data.parentId !== 'node-0') && (
                <div
                  className="context-menu-item"
                  onClick={() => handleJumpToNode('node-0')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Go to Root
                </div>
              )}
          </div>
        )}

        {/* [DSA] Hover Trace Tooltip - [Fix] only if no context menu */}
        {hoverInfo && !contextMenu && (
          <div
            className="trace-tooltip"
            style={{ top: hoverInfo.y, left: hoverInfo.x }}
          >
            <div className="trace-title">Logic Trace Path</div>
            <div className="trace-path">
              {hoverInfo.path.map((segment, index) => (
                <React.Fragment key={index}>
                  <span className="trace-segment">{segment}</span>
                  <span className="trace-arrow">➞</span>
                </React.Fragment>
              ))}
              <span className="trace-segment trace-current">{hoverInfo.label}</span>
            </div>
          </div>
        )}
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