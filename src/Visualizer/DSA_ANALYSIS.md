# DSA Analysis of JsonGraph.jsx

This document explains the technical implementation of the JSON Visualizer, mapping specific code functions to standard Data Structures and Algorithms (DSA) concepts.

## 1. Data Structures Used

### A. The Tree (JSON Itself)
*   **Concept:** Tree / N-ary Tree
*   **Implementation:** The input JSON is naturally a tree. It has a single Root, and every child has exactly one parent.
*   **Code:** `parsedData` variable.

### B. Adjacency List
*   **Concept:** Graph Representation
*   **Implementation:** `const hierarchy = {}`
*   **Description:** We use a Hash Map (Object) to store relationships.
    *   **Key:** Parent Node ID
    *   **Value:** Array of Child Node IDs `[child1, child2, ...]`
*   **DSA Purpose:** Allows **O(1)** access to find children of a node, which is critical for the "Collapse/Expand" feature.

### C. Queue
*   **Concept:** FIFO (First-In-First-Out) Data Structure
*   **Implementation:** `const queue = [id];` inside `getAllDescendants`.
*   **DSA Purpose:** Used for **Breadth-First Search (BFS)** to process nodes level-by-level.

### D. Set
*   **Concept:** Unique Collection
*   **Implementation:** `new Set()`
*   **DSA Purpose:** Used to store `collapsedNodes` and `nodesToExpand` to ensure O(1) lookups and no duplicate processing.

---

## 2. Key Algorithms & Functions

### Function: `traverse`
*   **Type:** **Depth-First Search (DFS) / Recursion**
*   **DSA Logic:** 
    1.  Visit the current node (Root).
    2.  Process it (create a Node object).
    3.  **Recursively** call `traverse` for all children.
    4.  Base Case: Stop if max depth is reached or node limit exceeded.
*   **Complexity:** 
    *   **Time:** O(V + E) where V is the number of keys in the JSON.
    *   **Space:** O(H) where H is the height of the tree (call stack depth).

### Function: `getLayoutedElements`
*   **Type:** **Topological Sort / Directed Acyclic Graph (DAG) Layout**
*   **DSA Logic:**
    *   Uses the `dagre` library.
    *   Internally, this performs a **Topological Sort** (likely Kahn's Algorithm or DFS-based sort) to determine the "Rank" (level) of each node.
    *   It ensures that for every edge `u -> v`, node `u` appears before `v` (to the left).
*   **Complexity:** Approximately O(V + E).

### Function: `getAllDescendants`
*   **Type:** **Breadth-First Search (BFS)**
*   **DSA Logic:**
    1.  Start with the clicked node.
    2.  Push it to a **Queue**.
    3.  While Queue is not empty:
        *   Dequeue a node `u`.
        *   Find all neighbors `v` of `u` using the **Adjacency List** (`hierarchy`).
        *   Add `v` to the result list and Enqueue `v`.
*   **Why BFS?** We want to find *every single node* connected underneath the parent to hide them all. BFS guarantees we visit them layer by layer.

### Function: `handleSearch`
*   **Type:** **Linear Search + Backtracking (Path Finding)**
*   **DSA Logic:**
    1.  **Linear Scan:** Iterate through all nodes `O(V)` to find text matches.
    2.  **Backtracking:** For every match found, we must ensure it is visible.
        *   We look up the parent, then the grandparent, etc., all the way to the root.
        *   We "Un-collapse" every node in this path.
*   **Complexity:** 
    *   Scanning: O(V)
    *   Path Finding: O(Depth) per match.

---

## Summary Table

| Function / Block | DSA Concept | Time Complexity |
| :--- | :--- | :--- |
| `traverse` | Depth First Search (DFS) | O(N) |
| `hierarchy` Object | Adjacency List | O(1) Lookup |
| `getLayoutedElements` | Topological Sort / DAG | O(V + E) |
| `getAllDescendants` | Breadth First Search (BFS) | O(V + E) |
| `handleSearch` | Linear Search | O(N) |
