# Frontend Guide: Web Viewer

The "Viewtool" is a browser-based viewer for your extracted DXF data. It runs entirely in your browser using `index.html`.

## Getting Started

1.  Extract your DXF data using the backend script.
2.  Open `index.html` in your web browser (Chrome, Firefox, Edge).
3.  Select the folder containing your generated JSON files.

## Features & Usage

*   **Visualizing Layers**: The viewer loads each layer as a separate component. You can turn layers on and off using the sidebar checklist.
*   **Navigation**:
    *   **Orbit**: Left-click and drag to rotate the view.
    *   **Pan**: Right-click (or Shift + Left-click) and drag to move the camera.
    *   **Zoom**: Scroll inward/outward to zoom.

## Checking Data

*   **Layer Info**: Hover over entities or check the sidebar to see layer names and colors.
*   **Entity Details**: The viewer reads the JSON files to display lines, text, and hatches exactly as they were extracted.

## Technical Details

The viewer is built with:
*   **index.html**: The main entry point.
*   **Styles**: `styles/main.css` and `components.css`.
*   **Logic**: `scripts/dxf-explorer.js` and `scripts/geometry-renderer.js` handle the rendering.

*Note: You don't need to install any extra software or servers. It works directly with the files on your disk.*
