import React, { useState } from 'react';
import './LogicShowcase.css';

const LogicShowcase = ({ isOpen, onClose }) => {
    const [activeStep, setActiveStep] = useState(0);

    const steps = [
        {
            title: "Data Structure: N-ary Tree",
            tag: "JSON Parsing",
            desc: "Your JSON data is naturally a tree. We parse it into a graph structure where every object is a parent node and its properties are children.",
            why: "JSON is hierarchical. Using an N-ary tree allows us to represent any number of nested children, exactly matching the data model.",
            links: [
                { label: "LC 589: N-ary Tree Traversal", url: "https://leetcode.com/problems/n-ary-tree-preorder-traversal/" },
                { label: "LC 104: Max Depth of Tree", url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/" }
            ],
            code: `const parsedData = JSON.parse(jsonString);
// Node Structure
{
  id: "node-1",
  data: { label: "root", type: "object" },
  children: ["node-2", "node-3"]
}`,
            diagram: [
                { id: '1', label: 'Root', active: true },
                { id: '2', label: 'Child', active: false },
                { id: '3', label: 'Child', active: false }
            ]
        },
        {
            title: "Adjacency List: O(1) Lookup",
            tag: "Graph Optimization",
            desc: "To make interactions instant, we convert the tree into an Adjacency List (Hash Map).",
            why: "Flattening the tree into a map allows O(1) time complexity when you click to expand a node, preventing lag even with deep nesting.",
            links: [
                { label: "LC 133: Clone Graph", url: "https://leetcode.com/problems/clone-graph/" }
            ],
            code: `const hierarchy = {
  "node-1": ["node-2", "node-3"],
  "node-2": ["node-4"],
  "node-3": []
};
// Access children instantly:
const children = hierarchy[clickedNodeId];`,
            diagram: [
                { id: 'Hash', label: '{}', active: true },
                { id: 'Key', label: 'ID', active: false },
                { id: 'Val', label: '[...]', active: false }
            ]
        },
        {
            title: "BFS: Visibility Engine",
            tag: "Graph Traversal",
            desc: "When you collapse a node, we use Breadth-First Search (BFS) to find ALL descendants level-by-level.",
            why: "BFS naturally explores layer-by-layer. This is perfect for collapsing 'subtrees' because it ensures we catch every connected child before moving deeper.",
            links: [
                { label: "LC 102: Level Order Traversal", url: "https://leetcode.com/problems/binary-tree-level-order-traversal/" }
            ],
            code: `const queue = [clickedNodeId];
while (queue.length > 0) {
  const current = queue.shift();
  const children = hierarchy[current];
  // Add children to queue...
  queue.push(...children);
}`,
            diagram: [
                { id: 'Q', label: 'Queue', active: true },
                { id: '1', label: 'LVL 1', active: false },
                { id: '2', label: 'LVL 2', active: false }
            ]
        },
        {
            title: "Topological Sort: Layout",
            tag: "Visual Algorithm",
            desc: "To position nodes without overlap, we use a DAG (Directed Acyclic Graph) layout algorithm.",
            why: "Why Topo Sort? In a data tree, dependencies flow one way (Parent -> Child). Topological sorting linearly orders these dependencies, allowing us to calculate the perfect X/Y rank for each node so arrows never point backwards.",
            links: [
                { label: "LC 210: Course Schedule II", url: "https://leetcode.com/problems/course-schedule-ii/" }
            ],
            code: `// Dagre Layout Engine
dagreGraph.setNode(node.id, { width, height });
dagre.layout(dagreGraph);
// Result:
// Node 1 -> Rank 0 (x: 0, y: 0)
// Node 2 -> Rank 1 (x: 100, y: 0)`,
            diagram: [
                { id: 'R0', label: 'Rank 0', active: true },
                { id: 'R1', label: 'Rank 1', active: false },
                { id: 'R2', label: 'Rank 2', active: false }
            ]
        },
        {
            title: "Tradeoff Analysis",
            tag: "Architectural Decision",
            desc: "We prioritize readability over compactness by using a Horizontal (Left-to-Right) layout.",
            why: "Vertical layouts fit mobile screens better but fail for deep JSON nesting, causing edge overlaps. Horizontal layouts preserve hierarchy clearly but can become very wide. To solve this width issue, we implemented Viewport Virtualization—rendering only the visible nodes to maintain 60fps.",
            code: `// Virtualization Logic
const isVisible = (nodeX > viewport.x && nodeX < viewport.x + width);
if (!isVisible) return null; // Skip rendering
// Result: 
// 10,000 nodes in memory -> 50 nodes in DOM`,
            diagram: [
                { id: 'V', label: 'Viewport', active: true },
                { id: 'R', label: 'Render', active: true },
                { id: 'H', label: 'Hidden', active: false }
            ]
        }
    ];

    if (!isOpen) return null;

    return (
        <div className="logic-modal-overlay" onClick={onClose}>
            <div className="logic-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="logic-header">
                    <div className="logic-title">
                        <h2>Graph Logic Engine</h2>
                    </div>
                    <button className="logic-close-btn" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="logic-content">
                    {/* Sidebar Nav */}
                    <div className="logic-nav">
                        {steps.map((step, idx) => (
                            <div
                                key={idx}
                                className={`nav-item ${activeStep === idx ? 'active' : ''}`}
                                onClick={() => setActiveStep(idx)}
                            >
                                <span className="nav-number">{idx + 1}</span>
                                {step.tag}
                            </div>
                        ))}
                    </div>

                    {/* Visual Content */}
                    <div className="logic-visual-pane">
                        <div className="step-content">
                            <span className="step-tag">{steps[activeStep].tag}</span>
                            <h1 className="step-title">{steps[activeStep].title}</h1>
                            <p className="step-description">{steps[activeStep].desc}</p>

                            {steps[activeStep].why && (
                                <div className="step-why">
                                    <h4>Design Rationale</h4>
                                    <p>{steps[activeStep].why}</p>
                                </div>
                            )}

                            {steps[activeStep].links && (
                                <div className="step-links">
                                    <h4>Relevant Algorithms</h4>
                                    <div className="links-container">
                                        {steps[activeStep].links.map((link, i) => (
                                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="leetcode-link">
                                                {link.label}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="visual-block">
                                <pre>
                                    {steps[activeStep].code.split('\n').map((line, i) => (
                                        <code key={i} className="code-line">{line}</code>
                                    ))}
                                </pre>
                            </div>

                            <div className="concept-diagram">
                                {steps[activeStep].diagram.map((node, i) => (
                                    <div key={i} className={`diagram-node ${node.active ? 'active' : ''}`}>
                                        {node.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogicShowcase;
