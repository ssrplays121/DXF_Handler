# JSON Layer Structure Documentation

Each layer in a DXF file is exported as a separate JSON file with the following structure:

### Top-Level Structure

```json
{
  "file_info": {...},
  "layer_info": {...},
  "entities": [...],
  "entity_statistics": {...},
  "geometry_summary": {...},
  "layer_issues": {...},
  "extraction_metadata": {...}
}
```

---

### 1. `file_info`
Contains global file metadata.

```json
"file_info": {
  "source_path": "string - path to original DXF file",
  "dxf_version": "string - DXF format version (e.g., 'R2018')",
  "units": "string - measurement units (default: 'mm')",
  "extents": {
    "min": [x, y, z],
    "max": [x, y, z],
    "center": [x, y, z],
    "size": [width, height, depth]
  },
  "creation_time": "ISO timestamp"
}
```

---

### 2. `layer_info`
Describes the layer properties from DXF.

```json
"layer_info": {
  "name": "string - layer name",
  "color": "integer - AutoCAD color index (1-255, 256=BYLAYER)",
  "linetype": "string - line type name",
  "lineweight": "integer - line weight in 1/100 mm (-3=BYLAYER)",
  "description": "string - layer description (if any)",
  "flags": {
    "frozen": "boolean - layer visibility state",
    "locked": "boolean - editability state",
    "plot": "boolean - whether layer should be plotted",
    "visible": "boolean - overall visibility"
  }
}
```

---

### 3. `entities`
Array containing all entities on this layer.

#### Common Entity Properties
Each entity has:
```json
{
  "type": "string - entity type (LINE, CIRCLE, TEXT, etc.)",
  "handle": "string - AutoCAD unique identifier",
  "color": "integer - entity color",
  "linetype": "string - line type",
  "lineweight": "integer - line weight",
  "geometry": {...},  // Entity-specific geometry data
  "attributes": {...}  // Additional DXF attributes
}
```

#### Geometry by Entity Type

**LINE**
```json
"geometry": {
  "start": {"x": number, "y": number, "z": number},
  "end": {"x": number, "y": number, "z": number},
  "length": number  // Calculated length
}
```

**CIRCLE**
```json
"geometry": {
  "center": {"x": number, "y": number, "z": number},
  "radius": number,
  "circumference": number,
  "area": number
}
```

**TEXT/MTEXT**
```json
"geometry": {
  "position": {"x": number, "y": number, "z": number},
  "height": number,
  "rotation": number,
  "width_factor": number,
  "halign": number,  // Horizontal alignment (0=left, 1=center, 2=right)
  "valign": number   // Vertical alignment
}
"text_content": "string - actual text content"
```

**LWPOLYLINE**
```json
"geometry": {
  "vertices": [
    {"x": number, "y": number, "bulge": number}
  ],
  "closed": boolean,
  "total_length": number
}
```
*Note: `bulge` indicates curvature (0=straight, positive/negative=curve direction)*

**INSERT (Block Reference)**
```json
"geometry": {
  "insertion_point": {"x": number, "y": number, "z": number},
  "block_name": "string - referenced block name",
  "scale": {"x": number, "y": number, "z": number},
  "rotation": number
},
"block_attributes": [  // Only if block has attributes
  {
    "tag": "string - attribute tag",
    "text": "string - attribute value",
    "position": {"x": number, "y": number, "z": number},
    "height": number,
    "rotation": number
  }
]
```

**DIMENSION**
```json
"geometry": {
  "definition_points": {
    "defpoint": {"x": number, "y": number, "z": number},
    "defpoint2": {...},
    "defpoint3": {...}
  },
  "text_position": {"x": number, "y": number, "z": number},
  "measured_value": number,
  "text_override": "string or null"  // User-modified dimension text
}
```

**Other Entities**
- `POLYLINE`, `SPLINE`, `ELLIPSE`, `ARC`, `HATCH`, `POINT`, etc.
- Each includes type-specific geometry data

---

### 4. `entity_statistics`
Statistical summary of entities in this layer.

```json
"entity_statistics": {
  "total_count": number,
  "by_type": {
    "LINE": {
      "count": number,
      "example_entity": {...}  // First entity of this type
    },
    "CIRCLE": {...},
    // ... all entity types present
  }
}
```

---

### 5. `geometry_summary`
Geometric overview of the layer.

```json
"geometry_summary": {
  "bounding_box": {
    "min": [x, y, z],
    "max": [x, y, z]
  },
  "has_3d": boolean,
  "has_text": boolean,
  "has_dimensions": boolean,
  "has_blocks": boolean
}
```

---

### 6. `layer_issues`
Errors and warnings encountered during extraction.

```json
"layer_issues": {
  "extraction_errors": [
    {
      "context": "string - where error occurred",
      "error_type": "string - exception class name",
      "error_message": "string - error details",
      "entity_type": "string",
      "entity_handle": "string",
      "timestamp": "ISO timestamp"
    }
  ],
  "warnings": [...],  // Same structure as errors
  "missing_attributes": ["attribute_name1", ...]
}
```

---

### 7. `extraction_metadata`
Information about the extraction process.

```json
"extraction_metadata": {
  "generated": "ISO timestamp",
  "processing_time": number,  // Seconds
  "ezdxf_version": "string",
  "entities_processed": number
}
```

---

## Special Notes

1. **Coordinates**: All coordinates use AutoCAD's coordinate system (right-handed, Y-up by default).
2. **Units**: Units are not converted from DXF - use `units` field to interpret.
3. **Color Index**: AutoCAD color index (1-255), where 256 = BYLAYER, 0 = BYBLOCK.
4. **Lineweights**: Values in 1/100 mm. Negative values indicate special states (-1=BYLAYER, -2=BYBLOCK, -3=DEFAULT).
5. **Bulge Values**: For polylines, bulge = tan(Δθ/4) where Δθ is the included angle of arc.
