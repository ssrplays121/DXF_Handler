# Summary JSON Structure Documentation

The summary file (`_layers_summary.json`) provides a global overview of the entire DXF file.

### Top-Level Structure

```json
{
  "file_info": {...},
  "layers": [...],
  "entity_statistics": {...},
  "drawing_structure": {...},
  "blocks": [...],
  "styles": {...},
  "tables": {...},
  "semantic_data": {...},
  "global_issues": {...},
  "extraction_summary": {...}
}
```

---

### 1. `file_info`
Enhanced file metadata including drawing properties.

```json
"file_info": {
  "source_path": "string",
  "dxf_version": "string",
  "acad_version": "string - AutoCAD release",
  "encoding": "string - file encoding",
  "file_size": number,  // Bytes
  "drawing_properties": {
    "title": "string",
    "subject": "string",
    "author": "string",
    "keywords": "string",
    "comments": "string"
  }
}
```

---

### 2. `layers`
Array of all layers with summary information.

```json
"layers": [
  {
    "name": "string",
    "color": "integer",
    "linetype": "string",
    "entity_count": number,
    "json_file": "string - corresponding layer JSON filename",
    "flags": {
      "frozen": boolean,
      "locked": boolean,
      "plot": boolean,
      "visible": boolean
    },
    "description": "string"
  }
  // ... all layers
]
```

---

### 3. `entity_statistics`
Global entity statistics across all layers.

```json
"entity_statistics": {
  "total_entities": number,
  "entities_by_layer": {
    "layer_name": count,
    // ... all layers
  },
  "entities_by_type": {
    "LINE": {
      "count": number,
      "example_entity": {...},  // First entity of this type found
      "layers_present": ["layer1", "layer2", ...]
    },
    // ... all entity types
  },
  "text_statistics": {
    "total_text_entities": number,
    "unique_texts": ["text1", "text2", ...],  // First 100 only
    "text_length_distribution": {
      "min": number,
      "max": number,
      "avg": number
    }
  }
}
```

---

### 4. `drawing_structure`
Overall drawing characteristics.

```json
"drawing_structure": {
  "extents": {
    "min": [x, y, z],
    "max": [x, y, z],
    "center": [x, y, z]
  },
  "scale": number,  // Usually 1.0
  "coordinate_system": "string - typically 'WCS' (World Coordinate System)",
  "has_3d": boolean,
  "has_paperspace": boolean
}
```

---

### 5. `blocks`
Block definitions from the DXF.

```json
"blocks": [
  {
    "name": "string - block name",
    "base_point": {"x": number, "y": number, "z": number},
    "entity_count": number,  // Entities inside block definition
    "is_xref": boolean,  // External reference
    "attributes": []  // Placeholder for ATTDEF entities
  }
]
```

---

### 6. `styles`
Text and dimension styles.

```json
"styles": {
  "text_styles": [
    {
      "name": "string",
      "font": "string",
      "height": number,
      "width_factor": number
    }
  ],
  "dimension_styles": [
    {
      "name": "string"
      // Additional dim style properties if available
    }
  ],
  "multileader_styles": []  // Placeholder
}
```

---

### 7. `tables`
DXF table contents.

```json
"tables": {
  "linetypes": [
    {
      "name": "string",
      "description": "string"
    }
  ],
  "views": [],      // View definitions
  "viewports": [],  // Viewport configurations
  "ucs": []         // User Coordinate Systems
}
```

---

### 8. `semantic_data`
Extracted semantic information.

```json
"semantic_data": {
  "all_text_content": [
    {
      "text": "string",
      "layer": "string",
      "type": "string - entity type"
    }
  ],
  "dimension_values": [
    {
      "value": number,
      "layer": "string"
    }
  ],
  "block_references": [
    {
      "block_name": "string",
      "attributes": [...],  // Block attributes
      "insertion_point": {...},
      "layer": "string"
    }
  ],
  "unique_texts": ["text1", "text2", ...],
  "total_unique_texts": number
}
```

---

### 9. `global_issues`
Errors not specific to any layer.

```json
"global_issues": {
  "errors": [
    {
      "context": "string",
      "error_type": "string",
      "error_message": "string",
      "entity_type": "string",
      "entity_handle": "string or null",
      "timestamp": "ISO timestamp"
    }
  ],
  "warnings": [...],  // Same structure
  "missing_attributes": [],
  "error_count": number,
  "warning_count": number
}
```

---

### 10. `extraction_summary`
Processing metadata and results.

```json
"extraction_summary": {
  "timestamp": "ISO timestamp",
  "processing_time": number,  // Seconds, rounded to 2 decimals
  "layers_extracted": number,
  "entities_extracted": number,
  "success_rate": number,  // Percentage (0-100)
  "tool_version": "string",
  "ezdxf_version": "string"
}
```

---

## Key Relationships

1. **Layer Files ↔ Summary**: Each entry in `layers` array has a `json_file` field pointing to the corresponding layer JSON.
2. **Block References**: Entities of type `INSERT` reference block names found in `blocks` array.
3. **Error Tracking**: Layer-specific errors are in individual JSONs; global errors are in summary.
4. **Cross-References**: Use entity `handle` fields to uniquely identify entities across files if needed.

## Quick Reference

- **For layer data**: Use individual layer JSON files
- **For overview**: Use summary file
- **For block definitions**: See `blocks` in summary
- **For text analysis**: Use `semantic_data.all_text_content`
- **For error checking**: Check both layer-specific and global issues
