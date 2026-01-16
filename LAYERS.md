# Layer Attributes and Properties

## Overview

Layers are fundamental organizational units in DXF files that control object visibility, appearance, and behavior. Each layer in the JSON output contains four core attributes: `name`, `color`, `linetype`, and `flags`. Understanding these attributes is crucial for interpreting and working with DXF data.

## Core Layer Attributes

### `name`

- **Type**: String
- **Purpose**: Unique identifier for the layer
- **Description**: Layer names follow industry conventions and typically indicate the type of geometry or discipline. Names are case-sensitive and can contain spaces and special characters.

### `color`

- **Type**: Integer
- **System**: AutoCAD Color Index (ACI) numbering system (0-255)
- **Description**: Controls the display color of objects on this layer. Colors can be standard ACI values or special system values.

### `linetype`

- **Type**: String
- **Purpose**: Defines the pattern of lines drawn on this layer
- **Description**: Determines whether lines appear solid, dashed, dotted, or with other patterns. Must be a defined linetype in the DXF file.

### `flags`

- **Type**: Integer (bit-coded)
- **Purpose**: Controls layer state and behavior
- **Description**: Bit-coded flags that determine visibility, editability, and other layer properties.

## AutoCAD Color Index (ACI) Mappings

### Standard ACI Colors (1-7)

| Color Index | RGB Values | Common Name | Typical Use Cases |
|-------------|------------|-------------|-------------------|
| 1 | (255, 0, 0) | Red | Demolition, warnings, fire elements |
| 2 | (255, 255, 0) | Yellow | Temporary elements, highlights |
| 3 | (0, 255, 0) | Green | Grids, vegetation, electrical |
| 4 | (0, 255, 255) | Cyan | Plumbing, HVAC, water features |
| 5 | (0, 0, 255) | Blue | Water elements, structural steel |
| 6 | (255, 0, 255) | Magenta | Dimensions, annotations, notes |
| 7 | (255, 255, 255) / (0, 0, 0) | White/Black | Default text, general geometry (depends on background) |

### Extended ACI Colors (8-255)

- Colors 8-255 provide various shades and tones
- Common extended colors found in your data:
  - **145**: (76, 133, 153) - Blue-gray, often used for elevation lines
  - **150**: (155, 173, 183) - Medium gray-blue
  - **161**: (139, 158, 177) - Light blue, commonly for glass elements
  - **251**: (217, 217, 217) - Light gray

### Special Color Values

| Value | Meaning | Description |
|-------|---------|-------------|
| 0 | ByBlock | Object inherits color from block definition |
| 256 | ByLayer | Object inherits color from layer (most common) |
| **Negative values** | System/Plot Style | Special system colors or plot style assignments |

## Linetype Definitions

### Standard Linetypes

| Linetype Name | Pattern Description | Common Use Cases |
|---------------|---------------------|------------------|
| `Continuous` | Solid, unbroken line | Most general geometry, text, dimensions |
| `CENTER` | Long dash, dot, long dash | Centerlines, symmetry lines, grids |
| `HIDDEN` | Short dashes | Hidden edges, obscured geometry |
| `Dashed` | Regular dashes | Temporary elements, proposed changes |
| `PHANTOM` | Long dash, two dots, long dash | Reference lines, construction lines |

### ISO Standard Linetypes

- `ACAD_ISO10W100`: ISO standard line type with specific dash spacing
- Used for standardized drafting according to international standards

### Custom/Audit-Generated Linetypes

- `"$DDT_AUDIT_GENERATED_(5D)"`: Indicates linetype was auto-generated during file recovery/audit
- These appear when DXF files are corrupted and recovered using tools like `ezdxf.recover`

## Layer Flags (Bit-Coded Values)

| Flag Value | Binary | Meaning | Behavior |
|------------|--------|---------|----------|
| 0 | 000 | Normal | Visible, editable, plots normally |
| 1 | 001 | **Frozen** | Not visible, not regenerated, doesn't plot |
| 2 | 010 | **Locked** | Visible but objects cannot be edited |
| 3 | 011 | Frozen + Locked | Combination of both states |
| 4+ | 100+ | System flags | Various internal meanings |

## Common Patterns and Industry Conventions

### Layer Naming Conventions

- **Prefix Systems**:

  - `NKB-` = Structural discipline elements
  - `PS-` = Plan/Section details
  - `DT-S-` = Detailed structural components
  - `AAK-` = Architectural annotations
  - `ITD-` = Interior design elements
- **Standard Suffixes**:
  - `-TEXT` = Text annotations
  - `-DIM` = Dimension objects
  - `-MKD` = Marking/dimension details
  - `-HATCH` = Hatch patterns
  - `-REINF` = Reinforcement details

### Discipline-Specific Color Usage

- **Architectural**: White (7) for walls, Green (3) for grids
- **Structural**: Red (1) for columns, Blue (5) for beams, Magenta (6) for reinforcement
- **MEP**: Cyan (4) for plumbing, Green (3) for electrical, Magenta (6) for HVAC
- **Civil**: Yellow (2) for earthwork, Red (1) for boundaries

## Edge Cases and Special Values

### Special System Layers

- **`Defpoints` layer** (color: -20):
  - AutoCAD system layer that **never plots**
  - Used for dimension reference points
  - Should not contain actual geometry
  - Negative color indicates system layer status

- **`0` layer** (color: 7):
  - Default layer that should typically remain unused for actual geometry
  - Objects on layer 0 inherit properties from blocks

### Edge Cases Found in Sample Data

1. **Negative Colors**:

   ```json
   {
     "name": "Defpoints",
     "color": -20,
     "linetype": "Continuous",
     "flags": 0
   }
   ```

   - **Meaning**: System-assigned plot style or internal color
   - **Handling**: Treat as special system layers; don't rely on standard color mapping

2. **Audit-Generated Linetypes**:

   ```json
   {
     "name": "SP_S_TEXT",
     "color": 3,
     "linetype": "$DDT_AUDIT_GENERATED_(5D)",
     "flags": 0
   }
   ```

   - **Meaning**: File was corrupted and recovered using audit/recovery tools
   - **Implication**: Data integrity may be compromised; verify geometry

3. **Mixed Flag States**:

   ```json
   {
     "name": "DOORS",
     "color": 150,
     "linetype": "CENTER",
     "flags": 1
   },
   {
     "name": "pargola",
     "color": 7,
     "linetype": "Continuous",
     "flags": 2
   }
   ```

   - **DOORS layer**: Frozen (`flags: 1`) - not visible in drawing
   - **pargola layer**: Locked (`flags: 2`) - visible but not editable

4. **Non-Standard Linetypes**:

   ```json
   {
     "name": "P. BEAM",
     "color": 7,
     "linetype": "Default",
     "flags": 0
   }
   ```

   - **Meaning**: Custom or undefined linetype name
   - **Handling**: May default to continuous in most viewers

## Practical Implications for JSON Processing

### For Data Extraction

- **Color handling**: Map ACI values to RGB for web display
- **Flag interpretation**: Use flags to determine layer visibility and editability
- **Special layers**: Filter out system layers like `Defpoints` when processing geometry

### For Data Reconstruction

- **Standard compliance**: Use standard ACI colors and linetypes for maximum compatibility
- **Name validation**: Ensure layer names don't exceed 255 characters (DXF limit)
- **Flag preservation**: Maintain original flag states when recreating DXF files

### For Visualization

- **White (7) handling**: Check drawing background color - white objects may be invisible on white backgrounds
- **Frozen layers**: Exclude geometry from frozen layers when generating previews
- **Locked layers**: Display with reduced opacity or overlay lock icon

## Best Practices

### Layer Organization

1. **Use consistent naming**: Follow industry standards (AIA, NCS, or company standards)
2. **Limit colors**: Stick to standard ACI colors (1-255) for compatibility
3. **Avoid layer 0**: Reserve for block definitions, not actual geometry
4. **Use layer states**: Freeze layers not needed for current view to improve performance

### Error Handling

1. **Validate linetypes**: Check that referenced linetypes exist in the file
2. **Handle negative colors**: Treat as system layers or apply default mapping
3. **Check flag combinations**: Ensure valid flag combinations (not all combinations are valid)
4. **Audit recovered files**: Files with audit-generated linetypes may need manual verification

### Performance Considerations

- **Frozen layers**: Skip processing geometry on frozen layers for performance
- **Large files**: Process layers in batches to avoid memory issues
- **Color mapping**: Cache ACI-to-RGB conversions for repeated use
