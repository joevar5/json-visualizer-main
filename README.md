# JSON Trace

Raw JSON is great for machines, but reading through thousands of lines of curly braces is a nightmare for humans. **JSON Trace** turns that wall of text into an interactive, explorable map.

I built this tool to solve a simple problem: making complex data structures actually understandable. Whether you're debugging a massive API response or explaining a schema to your team, this tool helps you see the forest *and* the trees.

## How it Works

Instead of just syntax highlighting, JSON Trace treats your data as a **Directed Graph**. It automatically organizes your JSON into a clean, left-to-right flowchart, making it easy to track relationships and hierarchy at a glance.

But it's not just a black box—I've included a **"Logic Flow"** engine right in the app that walks you through *exactly* how we parse your data and calculate the layout in real-time.

## What You Can Do

- **See the Big Picture**: Zoom out to see the entire structure, or zoom in to inspect specific values.
- **Trace the Logic**: Click the "Interested in a deep dive?" button to learn the algorithms behind the visualization.
- **Edit Like a Pro**: Includes the full Monaco Editor (VS Code's engine), so you get auto-complete and validation while you work.
- **Find Needles in Haystacks**: Use the deep search to instantly jump to any key or value, no matter how deep it's buried.
- **Share the View**: Export high-def images of your graph for documentation or presentations.

## Tradeoff Analysis: Long Graphs

Visualizing deep JSON structures presents a unique challenge: balancing readability with screen real estate.

**The "Long Graph" Challenge**
We chose a **Left-to-Right (Horizontal)** layout over Top-Down.
- **Why?** JSON parsing naturally follows a reading order. Horizontal layouts prevent edge crossing in deeply nested arrays, which is common in API responses.
- **The Tradeoff:** Deeply nested objects create very wide graphs.
- **The Solution:** We implemented **viewport virtualization**. Instead of rendering all 5,000+ nodes, we only render the ~50 nodes visible on your screen. This allows finite memory usage regardless of graph width, maintaining 60fps performance even for massive "long graphs".

## Tech Stack

- **React 18**: Component-based UI architecture.
- **React Flow**: Canvas-based node rendering engine.
- **Dagre**: Directed graph layout algorithms.
- **Monaco Editor**: VS Code's browser-based editor.

## Author

**Joel Varghese**
- Backend Developer | ML Engineer
- [GitHub](https://github.com/joevar5)
- [LinkedIn](https://www.linkedin.com/in/joel-eapen/)
