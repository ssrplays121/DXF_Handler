# Backend Guide: Layering Script

The core of this project is the `layering.py` script. It reads a DXF file and extracts its layers, geometry, and attributes into structured JSON files.

## How to Run

1.  Open your terminal in the project folder.
2.  Run the script with your DXF file:
    ```bash
    python python_scripts/layering.py input.dxf --output ./output_folder
    ```

## Output Structure

The script creates a folder for your file containing:
*   `layers/`: A subfolder with one JSON file per layer.
*   `_layers_summary.json`: A summary file for the whole drawing.

**Detailed Documentation:**
*   [**Layer File Structure**](./JSON_LAYERS.md) - formatting of the individual layer `.json` files.
*   [**Summary File Structure**](./JSON_SUMMARY.md) - formatting of the `_layers_summary.json` file.

## Supported Data Types

The script extracts the following entities:

*   **Lines & Curves**: `LINE`, `LWPOLYLINE`, `POLYLINE`, `CIRCLE`, `ARC`, `ELLIPSE`, `SPLINE`.
*   **Annotations**: `TEXT`, `MTEXT`, `DIMENSION`.
*   **Other**: `INSERT` (Blocks), `HATCH`, `POINT`.

## Layers & Attributes

Each layer keeps track of:
*   **Color**: Standard AutoCAD colors (1-255).
*   **Linetype**: e.g., Continuous, Dashed.
*   **Flags**: Visibility and locking status.

## Troubleshooting

If you see errors:
*   The script includes a `recovery` mode that attempts to fix corrupted DXF files automatically.
*   Check the console output for specific warning messages about missing attributes.
