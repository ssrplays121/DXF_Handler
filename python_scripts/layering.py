import ezdxf
import json
import traceback
import sys
import time
import math
from pathlib import Path
from typing import Dict, List, Any, Set, Optional, Tuple
from collections import defaultdict
from datetime import datetime

class LayerErrorTracker:
    """Tracks errors and warnings for each layer separately"""

    def __init__(self):
        self.layer_errors = defaultdict(lambda: defaultdict(list))
        self.layer_warnings = defaultdict(lambda: defaultdict(list))
        self.global_errors = []
        self.global_warnings = []
        self.error_count = 0
        self.warning_count = 0
        self.missing_attributes = defaultdict(set)

    def add_error(self, context: str, error: Exception, entity_type: str = None,
                  layer: str = None, entity_handle: str = None):
        """Record an error with layer context"""
        error_info = {
            'context': context,
            'error_type': type(error).__name__,
            'error_message': str(error),
            'entity_type': entity_type or 'unknown',
            'entity_handle': entity_handle,
            'timestamp': datetime.now().isoformat()
        }

        if layer:
            self.layer_errors[layer][context].append(error_info)
        else:
            self.global_errors.append(error_info)

        self.error_count += 1

    def add_warning(self, context: str, message: str, entity_type: str = None,
                    layer: str = None, entity_handle: str = None):
        """Record a warning with layer context"""
        warning_info = {
            'context': context,
            'message': message,
            'entity_type': entity_type or 'unknown',
            'entity_handle': entity_handle,
            'timestamp': datetime.now().isoformat()
        }

        if layer:
            self.layer_warnings[layer][context].append(warning_info)
        else:
            self.global_warnings.append(warning_info)

        self.warning_count += 1

    def add_missing_attribute(self, attribute: str, layer: str = None):
        """Track missing attributes by layer"""
        if layer:
            self.missing_attributes[layer].add(attribute)

    def get_layer_issues(self, layer: str) -> Dict[str, Any]:
        """Get all issues for a specific layer"""
        return {
            'errors': list(self.layer_errors[layer].values()),
            'warnings': list(self.layer_warnings[layer].values()),
            'missing_attributes': list(self.missing_attributes[layer]),
            'error_count': sum(len(errors) for errors in self.layer_errors[layer].values()),
            'warning_count': sum(len(warnings) for warnings in self.layer_warnings[layer].values())
        }

    def get_global_issues(self) -> Dict[str, Any]:
        """Get all global issues (not layer-specific)"""
        return {
            'errors': self.global_errors,
            'warnings': self.global_warnings,
            'missing_attributes': [],
            'error_count': len(self.global_errors),
            'warning_count': len(self.global_warnings)
        }

    def get_summary(self) -> str:
        """Generate a comprehensive error summary"""
        summary = []
        summary.append("\n" + "="*60)
        summary.append("LAYER-BASED DXF EXTRACTION SUMMARY")
        summary.append("="*60)

        summary.append(f"📊 TOTAL ISSUES:")
        summary.append(f"   ❌ Total Errors: {self.error_count}")
        summary.append(f"   ⚠️ Total Warnings: {self.warning_count}")

        if self.global_errors or self.global_warnings:
            summary.append("\n🌍 GLOBAL ISSUES (not layer-specific):")
            if self.global_errors:
                summary.append(f"   Errors: {len(self.global_errors)}")
            if self.global_warnings:
                summary.append(f"   Warnings: {len(self.global_warnings)}")

        if self.layer_errors or self.layer_warnings:
            summary.append("\n🎨 LAYER-SPECIFIC ISSUES:")
            all_layers = set(list(self.layer_errors.keys()) + list(self.layer_warnings.keys()))
            for layer in sorted(all_layers):
                layer_error_count = sum(len(errors) for errors in self.layer_errors[layer].values())
                layer_warning_count = sum(len(warnings) for warnings in self.layer_warnings[layer].values())
                if layer_error_count > 0 or layer_warning_count > 0:
                    summary.append(f"   Layer '{layer}': {layer_error_count} errors, {layer_warning_count} warnings")

        summary.append("="*60)
        return "\n".join(summary)

def safe_getattr(obj, attr_name, default=None):
    """Safely get attribute"""
    try:
        if hasattr(obj, attr_name):
            value = getattr(obj, attr_name)
            return value if value is not None else default
        return default
    except Exception:
        return default

def serialize_dxf_value(value):
    """Safely serialize DXF values for JSON"""
    if value is None:
        return None
    elif isinstance(value, (list, tuple)):
        try:
            return [serialize_dxf_value(item) for item in value]
        except:
            return str(value)
    elif isinstance(value, (int, float, str, bool)):
        return value
    elif hasattr(value, '__iter__') and not isinstance(value, str):
        try:
            return [serialize_dxf_value(item) for item in value]
        except:
            return str(value)
    elif hasattr(value, '__dict__'):
        try:
            # Try to get vector coordinates if available
            if hasattr(value, 'x') and hasattr(value, 'y'):
                result = {'x': float(value.x), 'y': float(value.y)}
                if hasattr(value, 'z'):
                    result['z'] = float(value.z)
                return result
            else:
                return str(value)
        except:
            return repr(value)
    else:
        try:
            return str(value)
        except:
            return repr(value)

def extract_entity_geometry(entity) -> Dict[str, Any]:
    """Extract geometry data based on entity type"""
    entity_type = entity.dxftype() if hasattr(entity, 'dxftype') else 'UNKNOWN'
    geometry = {}

    try:
        if entity_type == 'LINE':
            start = safe_getattr(entity.dxf, 'start')
            end = safe_getattr(entity.dxf, 'end')
            geometry = {
                'start': serialize_dxf_value(start),
                'end': serialize_dxf_value(end),
                'length': None
            }
            if start and end and hasattr(start, 'x') and hasattr(end, 'x'):
                try:
                    # Calculate length if coordinates are available
                    dx = end.x - start.x
                    dy = end.y - start.y
                    dz = getattr(end, 'z', 0) - getattr(start, 'z', 0)
                    length = math.sqrt(dx*dx + dy*dy + dz*dz)
                    geometry['length'] = float(length)
                except:
                    pass

        elif entity_type == 'CIRCLE':
            center = safe_getattr(entity.dxf, 'center')
            radius = safe_getattr(entity.dxf, 'radius')
            geometry = {
                'center': serialize_dxf_value(center),
                'radius': float(radius) if radius is not None else 0.0,
                'circumference': 2 * math.pi * float(radius) if radius is not None else 0.0,
                'area': math.pi * float(radius) * float(radius) if radius is not None else 0.0
            }

        elif entity_type == 'ARC':
            center = safe_getattr(entity.dxf, 'center')
            radius = safe_getattr(entity.dxf, 'radius')
            start_angle = safe_getattr(entity.dxf, 'start_angle')
            end_angle = safe_getattr(entity.dxf, 'end_angle')
            geometry = {
                'center': serialize_dxf_value(center),
                'radius': float(radius) if radius is not None else 0.0,
                'start_angle': float(start_angle) if start_angle is not None else 0.0,
                'end_angle': float(end_angle) if end_angle is not None else 360.0,
                'arc_length': None
            }

        elif entity_type == 'TEXT':
            insert = safe_getattr(entity.dxf, 'insert')
            align_point = safe_getattr(entity.dxf, 'align_point')
            height = safe_getattr(entity.dxf, 'height')
            rotation = safe_getattr(entity.dxf, 'rotation')
            width = safe_getattr(entity.dxf, 'width', 1.0)
            halign = safe_getattr(entity.dxf, 'halign', 0)
            valign = safe_getattr(entity.dxf, 'valign', 0)
            geometry = {
                'position': serialize_dxf_value(insert),
                'align_point': serialize_dxf_value(align_point), # Added alignment point
                'height': float(height) if height is not None else 0.0,
                'rotation': float(rotation) if rotation is not None else 0.0,
                'width_factor': float(width) if width is not None else 1.0,
                'halign': int(halign), # Added horizontal alignment
                'valign': int(valign)  # Added vertical alignment
            }

        elif entity_type == 'MTEXT':
            insert = safe_getattr(entity.dxf, 'insert')
            height = safe_getattr(entity.dxf, 'height')
            width = safe_getattr(entity.dxf, 'width', 0.0)
            attachment = safe_getattr(entity.dxf, 'attachment_point')
            flow_direction = safe_getattr(entity.dxf, 'flow_direction')
            geometry = {
                'position': serialize_dxf_value(insert),
                'height': float(height) if height is not None else 0.0,
                'width': float(width) if width is not None else 0.0,
                'attachment_point': int(attachment) if attachment is not None else 1,
                'flow_direction': int(flow_direction) if flow_direction is not None else 1
            }

        elif entity_type == 'INSERT':
            insert = safe_getattr(entity.dxf, 'insert')
            name = safe_getattr(entity.dxf, 'name')
            xscale = safe_getattr(entity.dxf, 'xscale', 1.0)
            yscale = safe_getattr(entity.dxf, 'yscale', 1.0)
            zscale = safe_getattr(entity.dxf, 'zscale', 1.0)
            rotation = safe_getattr(entity.dxf, 'rotation', 0.0)
            geometry = {
                'insertion_point': serialize_dxf_value(insert),
                'block_name': name,
                'scale': {'x': float(xscale), 'y': float(yscale), 'z': float(zscale)},
                'rotation': float(rotation)
            }

        elif entity_type == 'DIMENSION':
            defpoint = safe_getattr(entity.dxf, 'defpoint')
            defpoint2 = safe_getattr(entity.dxf, 'defpoint2')
            defpoint3 = safe_getattr(entity.dxf, 'defpoint3')
            text_midpoint = safe_getattr(entity.dxf, 'text_midpoint')
            actual = safe_getattr(entity.dxf, 'actual_measurement')
            text_override = safe_getattr(entity.dxf, 'text') # Added text override
            geometry = {
                'definition_points': {
                    'defpoint': serialize_dxf_value(defpoint),
                    'defpoint2': serialize_dxf_value(defpoint2),
                    'defpoint3': serialize_dxf_value(defpoint3)
                },
                'text_position': serialize_dxf_value(text_midpoint),
                'measured_value': float(actual) if actual is not None else 0.0,
                'text_override': text_override if text_override else None # Capture user-forced text
            }

        elif entity_type == 'LWPOLYLINE':
            vertices = []
            total_length = 0.0
            closed = safe_getattr(entity, 'closed', False)
            
            # UPDATED: Use get_points to capture bulge (curvature)
            # format='xyb' returns tuples of (x, y, bulge)
            try:
                if hasattr(entity, 'get_points'):
                    points = entity.get_points(format='xyb')
                    prev_point = None
                    for p in points:
                        x, y, bulge = p[0], p[1], p[2]
                        vertices.append({'x': x, 'y': y, 'bulge': float(bulge)})
                        
                        if prev_point:
                            dx = x - prev_point[0]
                            dy = y - prev_point[1]
                            total_length += math.sqrt(dx*dx + dy*dy)
                        prev_point = (x, y)
                    
                    # Add closing segment length if closed
                    if closed and len(points) > 1:
                        first = points[0]
                        last = points[-1]
                        dx = first[0] - last[0]
                        dy = first[1] - last[1]
                        total_length += math.sqrt(dx*dx + dy*dy)
                else:
                    # Fallback for very old ezdxf versions
                    for vertex in entity.vertices():
                        if len(vertex) >= 2:
                            vertices.append({'x': float(vertex[0]), 'y': float(vertex[1]), 'bulge': 0.0})
            except Exception as e:
                # Fallback if get_points fails
                for vertex in entity.vertices():
                    if len(vertex) >= 2:
                        vertices.append({'x': float(vertex[0]), 'y': float(vertex[1])})

            geometry = {
                'vertices': vertices,
                'closed': closed,
                'total_length': total_length
            }

        elif entity_type == 'POLYLINE':
            vertices = []
            if hasattr(entity, 'vertices') and hasattr(entity.vertices, '__iter__'):
                for vertex in entity.vertices:
                    if hasattr(vertex.dxf, 'location'):
                        loc = vertex.dxf.location
                        # 3D Polylines don't use bulge the same way, but 2D heavy polylines do.
                        bulge = safe_getattr(vertex.dxf, 'bulge', 0.0) 
                        v_data = serialize_dxf_value(loc)
                        if isinstance(v_data, dict):
                            v_data['bulge'] = float(bulge)
                        vertices.append(v_data)

            geometry = {
                'vertices': vertices,
                'closed': safe_getattr(entity, 'is_closed', False)
            }

        elif entity_type in ['POINT', 'SOLID', 'TRACE', 'SHAPE']:
            location = safe_getattr(entity.dxf, 'location')
            geometry = {
                'location': serialize_dxf_value(location)
            }

        elif entity_type == 'ELLIPSE':
            center = safe_getattr(entity.dxf, 'center')
            major_axis = safe_getattr(entity.dxf, 'major_axis')
            ratio = safe_getattr(entity.dxf, 'ratio')
            geometry = {
                'center': serialize_dxf_value(center),
                'major_axis': serialize_dxf_value(major_axis),
                'ratio': float(ratio) if ratio is not None else 1.0
            }

        elif entity_type == 'SPLINE':
            control_points = []
            if hasattr(entity, 'control_points'):
                control_points = [serialize_dxf_value(cp) for cp in entity.control_points]

            fit_points = []
            if hasattr(entity, 'fit_points'):
                fit_points = [serialize_dxf_value(fp) for fp in entity.fit_points]

            geometry = {
                'degree': safe_getattr(entity.dxf, 'degree', 3),
                'control_points': control_points,
                'fit_points': fit_points,
                'closed': safe_getattr(entity, 'closed', False)
            }

        elif entity_type == 'HATCH':
            geometry = {
                'pattern_name': safe_getattr(entity.dxf, 'pattern_name', 'SOLID'),
                'solid_fill': safe_getattr(entity, 'solid_fill', True),
                'associative': safe_getattr(entity, 'associative', False),
                'pattern_scale': float(safe_getattr(entity.dxf, 'pattern_scale', 1.0)), # Added Scale
                'pattern_angle': float(safe_getattr(entity.dxf, 'pattern_angle', 0.0)), # Added Angle
                'color': safe_getattr(entity.dxf, 'color')
            }

        else:
            # Generic geometry extraction for unsupported types
            geometry = {
                'type': entity_type,
                'raw_data': str(entity)[:200]
            }

    except Exception as e:
        geometry = {
            'error': str(e),
            'type': entity_type
        }

    return geometry

def extract_entity_attributes(entity, error_tracker: LayerErrorTracker, layer: str) -> Dict[str, Any]:
    """Extract all attributes from an entity"""
    attributes = {}

    try:
        if hasattr(entity, 'dxf'):
            # Standard DXF attributes
            standard_attrs = [
                'color', 'linetype', 'lineweight', 'thickness', 'extrusion',
                'transparency', 'elevation', 'style', 'flags', 'const_width',
                'radius', 'start_angle', 'end_angle', 'height', 'rotation',
                'width', 'ratio', 'major_axis', 'minor_axis', 'start_param',
                'end_param', 'bulge', 'handle', 'owner', 'paperspace',
                'true_color', 'color_name', 'material_handle', 'plotstyle_handle',
                'lineweight', 'linetype_scale'
            ]

            for attr_name in standard_attrs:
                try:
                    if hasattr(entity.dxf, attr_name):
                        attr_value = getattr(entity.dxf, attr_name)
                        if not callable(attr_value):
                            attributes[attr_name] = serialize_dxf_value(attr_value)
                except Exception as e:
                    error_tracker.add_warning(f"attribute.{attr_name}", str(e),
                                            entity.dxftype(), layer, entity.dxf.get('handle'))

            # Check for extended data (XDATA)
            if hasattr(entity, 'xdata'):
                try:
                    xdata = {}
                    for appid in entity.xdata.keys():
                        xdata[appid] = str(entity.xdata[appid])[:500]
                    if xdata:
                        attributes['xdata'] = xdata
                except:
                    pass

        return attributes

    except Exception as e:
        error_tracker.add_error("attribute_extraction", e, entity.dxftype(), layer,
                              entity.dxf.get('handle') if hasattr(entity, 'dxf') else None)
        return attributes

def extract_text_content(entity) -> Optional[str]:
    """Extract text content from text entities"""
    entity_type = entity.dxftype() if hasattr(entity, 'dxftype') else 'UNKNOWN'

    try:
        if entity_type == 'TEXT':
            return safe_getattr(entity.dxf, 'text', '')
        elif entity_type == 'MTEXT':
            if hasattr(entity, 'text'):
                return entity.text
            elif hasattr(entity.dxf, 'text'):
                return entity.dxf.text
        elif entity_type == 'ATTRIB':
            return safe_getattr(entity.dxf, 'text', '')
        elif entity_type == 'ATTDEF':
            return safe_getattr(entity.dxf, 'default', '')
    except:
        return None

    return None

def extract_block_attributes(entity) -> List[Dict[str, Any]]:
    """Extract attributes from INSERT entities"""
    attributes = []

    try:
        if entity.dxftype() == 'INSERT' and hasattr(entity, 'attribs'):
            for attrib in entity.attribs:
                if hasattr(attrib, 'dxf'):
                    attr_data = {
                        'tag': safe_getattr(attrib.dxf, 'tag', ''),
                        'text': safe_getattr(attrib.dxf, 'text', ''),
                        'position': serialize_dxf_value(safe_getattr(attrib.dxf, 'insert')),
                        'height': float(safe_getattr(attrib.dxf, 'height', 0.0)),
                        'rotation': float(safe_getattr(attrib.dxf, 'rotation', 0.0))
                    }
                    attributes.append(attr_data)
    except:
        pass

    return attributes

def extract_entity_data(entity, error_tracker: LayerErrorTracker, layer: str) -> Dict[str, Any]:
    """Extract complete data from a single entity"""
    entity_data = {}

    try:
        # Basic entity info
        entity_type = entity.dxftype() if hasattr(entity, 'dxftype') else 'UNKNOWN'
        handle = safe_getattr(entity.dxf, 'handle')

        entity_data = {
            'type': entity_type,
            'handle': handle,
            'color': safe_getattr(entity.dxf, 'color', 256),
            'linetype': safe_getattr(entity.dxf, 'linetype', 'BYLAYER'),
            'lineweight': safe_getattr(entity.dxf, 'lineweight', -3),
            'geometry': extract_entity_geometry(entity),
            'attributes': extract_entity_attributes(entity, error_tracker, layer)
        }

        # Text content for text entities
        text_content = extract_text_content(entity)
        if text_content:
            entity_data['text_content'] = text_content

        # Block attributes for INSERT entities
        if entity_type == 'INSERT':
            block_attrs = extract_block_attributes(entity)
            if block_attrs:
                entity_data['block_attributes'] = block_attrs

        # Check for extended data
        if hasattr(entity, 'xdata'):
            try:
                xdata = {}
                for appid in entity.xdata.keys():
                    xdata[str(appid)] = str(entity.xdata[appid])[:200]
                if xdata:
                    entity_data['xdata'] = xdata
            except Exception as e:
                error_tracker.add_warning("xdata_extraction", str(e), entity_type, layer, handle)

        return entity_data

    except Exception as e:
        error_tracker.add_error("entity_extraction", e, 'UNKNOWN', layer,
                              safe_getattr(entity.dxf, 'handle') if hasattr(entity, 'dxf') else None)
        return {
            'type': 'ERROR',
            'error': str(e),
            'layer': layer
        }

def calculate_layer_extents(entities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate bounding box for entities in a layer"""
    if not entities:
        return {'min': [0, 0, 0], 'max': [0, 0, 0]}

    min_x, min_y, min_z = float('inf'), float('inf'), float('inf')
    max_x, max_y, max_z = float('-inf'), float('-inf'), float('-inf')

    for entity in entities:
        geometry = entity.get('geometry', {})

        # Handle different entity types
        if 'start' in geometry and 'end' in geometry:
            points = [geometry['start'], geometry['end']]
        elif 'center' in geometry:
            points = [geometry['center']]
        elif 'position' in geometry:
            points = [geometry['position']]
        elif 'insertion_point' in geometry:
            points = [geometry['insertion_point']]
        elif 'vertices' in geometry:
            points = geometry['vertices']
        else:
            continue

        for point in points if isinstance(points, list) else [points]:
            if isinstance(point, dict):
                x = point.get('x', 0)
                y = point.get('y', 0)
                z = point.get('z', 0)
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                min_z = min(min_z, z)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
                max_z = max(max_z, z)

    if min_x == float('inf'):
        return {'min': [0, 0, 0], 'max': [0, 0, 0]}

    return {
        'min': [min_x, min_y, min_z],
        'max': [max_x, max_y, max_z],
        'center': [(min_x + max_x) / 2, (min_y + max_y) / 2, (min_z + max_z) / 2],
        'size': [max_x - min_x, max_y - min_y, max_z - min_z]
    }

def analyze_layer_statistics(entities: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze and create statistics for a layer"""
    stats = {
        'total_count': len(entities),
        'by_type': {},
        'has_3d': False,
        'has_text': False,
        'has_dimensions': False,
        'has_blocks': False
    }

    type_counts = defaultdict(int)
    examples_by_type = {}

    for entity in entities:
        entity_type = entity.get('type', 'UNKNOWN')
        type_counts[entity_type] += 1

        # Store first example of each type
        if entity_type not in examples_by_type:
            examples_by_type[entity_type] = entity

        # Check for specific entity types
        if entity_type in ['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF']:
            stats['has_text'] = True
        elif entity_type == 'DIMENSION':
            stats['has_dimensions'] = True
        elif entity_type == 'INSERT':
            stats['has_blocks'] = True

        # Check for 3D data
        geometry = entity.get('geometry', {})
        if any(key in geometry for key in ['z', 'extrusion', 'thickness']):
            stats['has_3d'] = True

    # Create by_type structure with counts and examples
    for entity_type, count in type_counts.items():
        stats['by_type'][entity_type] = {
            'count': count,
            'example_entity': examples_by_type.get(entity_type, {})
        }

    return stats

def create_layer_json(layer_name: str, layer_definition: Dict[str, Any],
                     entities: List[Dict[str, Any]], issues: Dict[str, Any],
                     file_info: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Create JSON structure for a single layer"""

    # Layer info from definition
    layer_info = {
        'name': layer_name,
        'color': layer_definition.get('color', 7),
        'linetype': layer_definition.get('linetype', 'CONTINUOUS'),
        'lineweight': layer_definition.get('lineweight', -3),
        'description': layer_definition.get('description', ''),
        'flags': {
            'frozen': bool(layer_definition.get('flags', 0) & 1),
            'locked': bool(layer_definition.get('flags', 0) & 4),
            'plot': not bool(layer_definition.get('flags', 0) & 16),
            'visible': True  # Default, adjust based on flags if needed
        }
    }

    # Calculate statistics
    stats = analyze_layer_statistics(entities)
    extents = calculate_layer_extents(entities)

    # Create the layer JSON
    layer_json = {
        'file_info': {
            'source_path': file_info.get('path', ''),
            'dxf_version': file_info.get('version', 'unknown'),
            'units': 'mm',  # Default, should be extracted from header
            'extents': extents,
            'creation_time': metadata.get('timestamp', '')
        },

        'layer_info': layer_info,

        'entities': entities,

        'entity_statistics': {
            'total_count': stats['total_count'],
            'by_type': stats['by_type']
        },

        'geometry_summary': {
            'bounding_box': {'min': extents['min'], 'max': extents['max']},
            'has_3d': stats['has_3d'],
            'has_text': stats['has_text'],
            'has_dimensions': stats['has_dimensions'],
            'has_blocks': stats['has_blocks']
        },

        'layer_issues': {
            'extraction_errors': issues.get('errors', []),
            'warnings': issues.get('warnings', []),
            'missing_attributes': issues.get('missing_attributes', [])
        },

        'extraction_metadata': {
            'generated': metadata.get('timestamp', ''),
            'processing_time': metadata.get('processing_time', 0),
            'ezdxf_version': metadata.get('ezdxf_version', 'unknown'),
            'entities_processed': stats['total_count']
        }
    }

    return layer_json

def extract_dxf_data(dxf_path: str) -> Tuple[Dict[str, Any], Dict[str, List[Dict[str, Any]]], LayerErrorTracker]:
    """Extract all data from DXF file and organize by layer"""
    error_tracker = LayerErrorTracker()
    start_time = time.time()

    try:
        print(f"🔍 Reading DXF file: {dxf_path}")

        # Try to read the file
        try:
            doc = ezdxf.readfile(dxf_path)
        except Exception as e:
            error_tracker.add_error("file_reading", e)
            print("🔄 Attempting recovery mode...")
            try:
                from ezdxf import recover
                doc, auditor = recover.readfile(dxf_path)
                if auditor.has_errors:
                    print(f"⚡ Recovery fixed {len(auditor.errors)} errors")
                    error_tracker.add_warning("file_recovery", f"Fixed {len(auditor.errors)} errors during recovery")
            except Exception as recovery_error:
                error_tracker.add_error("recovery_mode", recovery_error)
                return {}, {}, error_tracker

        print(f"✅ Successfully loaded DXF file")

        # Extract file information
        file_info = extract_file_info(doc, dxf_path)

        # Extract drawing properties from header
        drawing_properties = extract_drawing_properties(doc)

        # Extract layers definition
        layers_definition = extract_layers_definition(doc, error_tracker)

        # Extract entities and group by layer
        entities_by_layer = extract_all_entities_by_layer(doc, error_tracker)

        # Extract blocks
        blocks = extract_blocks(doc, error_tracker)

        # Extract styles
        styles = extract_styles(doc, error_tracker)

        # Extract tables
        tables = extract_tables(doc, error_tracker)

        # Extract semantic data
        semantic_data = extract_semantic_data(entities_by_layer, error_tracker)

        # Calculate processing time
        processing_time = time.time() - start_time

        # Prepare global data
        global_data = {
            'file_info': {**file_info, 'drawing_properties': drawing_properties},
            'layers_definition': layers_definition,
            'blocks': blocks,
            'styles': styles,
            'tables': tables,
            'semantic_data': semantic_data,
            'processing_time': processing_time,
            'timestamp': datetime.now().isoformat()
        }

        return global_data, entities_by_layer, error_tracker

    except Exception as e:
        error_tracker.add_error("main_extraction", e)
        return {}, {}, error_tracker

def extract_file_info(doc, dxf_path: str) -> Dict[str, Any]:
    """Extract file information"""
    return {
        'path': str(dxf_path),
        'dxf_version': safe_getattr(doc, 'dxfversion', 'unknown'),
        'acad_version': safe_getattr(doc, 'acad_release', 'unknown'),
        'encoding': safe_getattr(doc, 'encoding', 'unknown'),
        'file_size': Path(dxf_path).stat().st_size if Path(dxf_path).exists() else 0
    }

def extract_drawing_properties(doc) -> Dict[str, Any]:
    """Extract drawing properties from header"""
    properties = {
        'title': '',
        'subject': '',
        'author': '',
        'keywords': '',
        'comments': ''
    }

    if hasattr(doc, 'header'):
        header = doc.header
        # Map header variables to properties
        header_mapping = {
            '$TITLE': 'title',
            '$SUBJECT': 'subject',
            '$AUTHOR': 'author',
            '$KEYWORDS': 'keywords',
            '$COMMENTS': 'comments'
        }

        for header_var, prop_name in header_mapping.items():
            try:
                if header_var in header.__dict__:
                    value = header.get(header_var, '')
                    if value:
                        properties[prop_name] = str(value)
            except:
                pass

    return properties

def extract_layers_definition(doc, error_tracker: LayerErrorTracker) -> List[Dict[str, Any]]:
    """Extract layer definitions"""
    layers = []

    if hasattr(doc, 'layers'):
        for layer in doc.layers:
            try:
                layer_def = {
                    'name': safe_getattr(layer.dxf, 'name', 'unknown'),
                    'color': safe_getattr(layer.dxf, 'color', 7),
                    'linetype': safe_getattr(layer.dxf, 'linetype', 'CONTINUOUS'),
                    'lineweight': safe_getattr(layer.dxf, 'lineweight', -3),
                    'flags': safe_getattr(layer.dxf, 'flags', 0),
                    'description': safe_getattr(layer.dxf, 'description', '')
                }
                layers.append(layer_def)
            except Exception as e:
                error_tracker.add_error(f"layer_definition_{safe_getattr(layer.dxf, 'name', 'unknown')}", e)

    return layers

def extract_all_entities_by_layer(doc, error_tracker: LayerErrorTracker) -> Dict[str, List[Dict[str, Any]]]:
    """Extract all entities from modelspace and paperspace, grouped by layer"""
    entities_by_layer = defaultdict(list)

    # Extract from modelspace
    if hasattr(doc, 'modelspace'):
        try:
            msp = doc.modelspace()
            print(f"📐 Processing Model Space ({len(msp)} entities)")
            extract_entities_to_layer(msp, entities_by_layer, error_tracker, 'Model')
        except Exception as e:
            error_tracker.add_error("modelspace_loading", e)

    # Extract from paperspace layouts
    if hasattr(doc, 'layout_names'):
        try:
            layout_names = list(doc.layout_names())
            for layout_name in layout_names:
                if layout_name == 'Model':
                    continue
                try:
                    layout = doc.layout(layout_name)
                    print(f"  📄 Processing layout: '{layout_name}' ({len(layout)} entities)")
                    extract_entities_to_layer(layout, entities_by_layer, error_tracker, layout_name)
                except Exception as e:
                    error_tracker.add_error(f"layout_{layout_name}", e)
        except Exception as e:
            error_tracker.add_error("layouts_loading", e)

    return dict(entities_by_layer)

def extract_entities_to_layer(entities, entities_by_layer: defaultdict,
                            error_tracker: LayerErrorTracker, source: str):
    """Extract entities from a collection and add to layer dictionary"""
    for entity in entities:
        try:
            layer = safe_getattr(entity.dxf, 'layer', '0')
            entity_data = extract_entity_data(entity, error_tracker, layer)

            # Add source information
            if source != 'Model':
                entity_data['source'] = source

            entities_by_layer[layer].append(entity_data)

        except Exception as e:
            error_tracker.add_error("entity_processing", e, 'UNKNOWN', 'unknown')

def extract_blocks(doc, error_tracker: LayerErrorTracker) -> List[Dict[str, Any]]:
    """Extract block definitions"""
    blocks = []

    if hasattr(doc, 'blocks'):
        try:
            for block_name in doc.blocks.block_names():
                if block_name.startswith('*'):
                    continue
                try:
                    block = doc.blocks[block_name]
                    block_def = {
                        'name': block_name,
                        'base_point': serialize_dxf_value(safe_getattr(block, 'base_point')),
                        'entity_count': len(block),
                        'is_xref': block.is_xref if hasattr(block, 'is_xref') else False,
                        'attributes': []  # Would need to extract ATTDEF entities
                    }
                    blocks.append(block_def)
                except Exception as e:
                    error_tracker.add_error(f"block_{block_name}", e)
        except Exception as e:
            error_tracker.add_error("blocks_extraction", e)

    return blocks

def extract_styles(doc, error_tracker: LayerErrorTracker) -> Dict[str, List[Dict[str, Any]]]:
    """Extract text and dimension styles"""
    styles = {
        'text_styles': [],
        'dimension_styles': [],
        'multileader_styles': []
    }

    # Text styles
    if hasattr(doc, 'styles'):
        try:
            for style in doc.styles:
                try:
                    text_style = {
                        'name': safe_getattr(style.dxf, 'name', 'unknown'),
                        'font': safe_getattr(style.dxf, 'font', 'standard'),
                        'height': float(safe_getattr(style.dxf, 'height', 0.0)),
                        'width_factor': float(safe_getattr(style.dxf, 'width', 1.0))
                    }
                    styles['text_styles'].append(text_style)
                except Exception as e:
                    error_tracker.add_error(f"text_style_{safe_getattr(style.dxf, 'name', 'unknown')}", e)
        except Exception as e:
            error_tracker.add_error("text_styles_extraction", e)

    # Dimension styles (simplified - would need more complete extraction)
    if hasattr(doc, 'dimstyles'):
        try:
            for dimstyle in doc.dimstyles:
                try:
                    dim_style = {
                        'name': safe_getattr(dimstyle.dxf, 'name', 'unknown')
                    }
                    styles['dimension_styles'].append(dim_style)
                except Exception as e:
                    error_tracker.add_error(f"dim_style_{safe_getattr(dimstyle.dxf, 'name', 'unknown')}", e)
        except Exception as e:
            error_tracker.add_error("dim_styles_extraction", e)

    return styles

def extract_tables(doc, error_tracker: LayerErrorTracker) -> Dict[str, List[Dict[str, Any]]]:
    """Extract various tables from DXF"""
    tables = {
        'linetypes': [],
        'views': [],
        'viewports': [],
        'ucs': []
    }

    # Linetypes
    if hasattr(doc, 'linetypes'):
        try:
            for linetype in doc.linetypes:
                try:
                    lt_info = {
                        'name': safe_getattr(linetype.dxf, 'name', 'unknown'),
                        'description': safe_getattr(linetype.dxf, 'description', '')
                    }
                    tables['linetypes'].append(lt_info)
                except Exception as e:
                    error_tracker.add_error(f"linetype_{safe_getattr(linetype.dxf, 'name', 'unknown')}", e)
        except Exception as e:
            error_tracker.add_error("linetypes_extraction", e)

    return tables

def extract_semantic_data(entities_by_layer: Dict[str, List[Dict[str, Any]]],
                         error_tracker: LayerErrorTracker) -> Dict[str, Any]:
    """Extract semantic data from all entities"""
    all_text_content = []
    dimension_values = []
    block_references = []
    unique_texts = set()

    for layer_name, entities in entities_by_layer.items():
        for entity in entities:
            entity_type = entity.get('type', '')

            # Collect text content
            text_content = entity.get('text_content')
            if text_content:
                all_text_content.append({
                    'text': text_content,
                    'layer': layer_name,
                    'type': entity_type
                })
                unique_texts.add(text_content.strip())

            # Collect dimension values
            if entity_type == 'DIMENSION':
                geometry = entity.get('geometry', {})
                measured_value = geometry.get('measured_value')
                if measured_value:
                    dimension_values.append({
                        'value': measured_value,
                        'layer': layer_name
                    })

            # Collect block references
            if entity_type == 'INSERT':
                geometry = entity.get('geometry', {})
                block_ref = {
                    'block_name': geometry.get('block_name', ''),
                    'attributes': entity.get('block_attributes', []),
                    'insertion_point': geometry.get('insertion_point'),
                    'layer': layer_name
                }
                block_references.append(block_ref)

    return {
        'all_text_content': all_text_content,
        'dimension_values': dimension_values,
        'block_references': block_references,
        'unique_texts': list(unique_texts),
        'total_unique_texts': len(unique_texts)
    }

def create_summary_json(global_data: Dict[str, Any], entities_by_layer: Dict[str, List[Dict[str, Any]]],
                       error_tracker: LayerErrorTracker, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Create summary JSON with global information"""

    # Calculate entity statistics
    entity_stats = calculate_global_entity_statistics(entities_by_layer)

    # Calculate drawing structure
    drawing_structure = calculate_drawing_structure(entities_by_layer)

    # Create layers summary
    layers_summary = []
    for layer_name, entities in entities_by_layer.items():
        # Find layer definition
        layer_def = next((ld for ld in global_data['layers_definition']
                         if ld['name'] == layer_name), {})

        layer_info = {
            'name': layer_name,
            'color': layer_def.get('color', 7),
            'linetype': layer_def.get('linetype', 'CONTINUOUS'),
            'entity_count': len(entities),
            'json_file': f"{create_safe_filename(layer_name)}.json",
            'flags': {
                'frozen': bool(layer_def.get('flags', 0) & 1),
                'locked': bool(layer_def.get('flags', 0) & 4),
                'plot': not bool(layer_def.get('flags', 0) & 16),
                'visible': True
            },
            'description': layer_def.get('description', '')
        }
        layers_summary.append(layer_info)

    # Create summary JSON
    summary_json = {
        'file_info': global_data['file_info'],

        'layers': layers_summary,

        'entity_statistics': entity_stats,

        'drawing_structure': drawing_structure,

        'blocks': global_data.get('blocks', []),

        'styles': global_data.get('styles', {}),

        'tables': global_data.get('tables', {}),

        'semantic_data': global_data.get('semantic_data', {}),

        'global_issues': error_tracker.get_global_issues(),

        'extraction_summary': {
            'timestamp': metadata.get('timestamp', ''),
            'processing_time': round(metadata.get('processing_time', 0), 2),
            'layers_extracted': len(entities_by_layer),
            'entities_extracted': sum(len(entities) for entities in entities_by_layer.values()),
            'success_rate': calculate_success_rate(entities_by_layer),
            'tool_version': '1.0.0',
            'ezdxf_version': ezdxf.__version__
        }
    }

    return summary_json

def calculate_global_entity_statistics(entities_by_layer: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Calculate global entity statistics"""
    total_entities = 0
    entities_by_layer_count = {}
    entity_type_counts = defaultdict(int)
    entity_examples = {}
    layers_by_type = defaultdict(set)

    for layer_name, entities in entities_by_layer.items():
        entity_count = len(entities)
        total_entities += entity_count
        entities_by_layer_count[layer_name] = entity_count

        for entity in entities:
            entity_type = entity.get('type', 'UNKNOWN')
            entity_type_counts[entity_type] += 1
            layers_by_type[entity_type].add(layer_name)

            # Store first example of each type
            if entity_type not in entity_examples:
                entity_examples[entity_type] = entity

    # Text statistics
    text_stats = calculate_text_statistics(entities_by_layer)

    # Create by_type structure
    entities_by_type = {}
    for entity_type, count in entity_type_counts.items():
        entities_by_type[entity_type] = {
            'count': count,
            'example_entity': entity_examples.get(entity_type, {}),
            'layers_present': list(layers_by_type[entity_type])
        }

    return {
        'total_entities': total_entities,
        'entities_by_layer': entities_by_layer_count,
        'entities_by_type': entities_by_type,
        'text_statistics': text_stats
    }

def calculate_text_statistics(entities_by_layer: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Calculate statistics about text entities"""
    total_text_entities = 0
    all_texts = []

    for layer_name, entities in entities_by_layer.items():
        for entity in entities:
            entity_type = entity.get('type', '')
            if entity_type in ['TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF']:
                total_text_entities += 1
                text_content = entity.get('text_content', '')
                if text_content:
                    all_texts.append(text_content)

    if not all_texts:
        return {
            'total_text_entities': 0,
            'unique_texts': [],
            'text_length_distribution': {'min': 0, 'max': 0, 'avg': 0}
        }

    text_lengths = [len(text) for text in all_texts]
    unique_texts = list(set([text.strip() for text in all_texts if text.strip()]))

    return {
        'total_text_entities': total_text_entities,
        'unique_texts': unique_texts[:100],  # Limit to first 100
        'text_length_distribution': {
            'min': min(text_lengths),
            'max': max(text_lengths),
            'avg': sum(text_lengths) / len(text_lengths)
        }
    }

def calculate_drawing_structure(entities_by_layer: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Calculate overall drawing structure"""
    all_extents = {'min': [float('inf'), float('inf'), float('inf')],
                   'max': [float('-inf'), float('-inf'), float('-inf')]}
    has_3d = False
    has_paperspace = False

    for layer_name, entities in entities_by_layer.items():
        for entity in entities:
            # Check for paperspace entities
            if entity.get('source') and entity['source'] != 'Model':
                has_paperspace = True

            # Check for 3D
            if entity.get('attributes', {}).get('thickness', 0) != 0:
                has_3d = True

            # Update extents
            geometry = entity.get('geometry', {})
            update_extents_with_geometry(geometry, all_extents)

    # Calculate final extents
    if all_extents['min'][0] == float('inf'):
        extents = {'min': [0, 0, 0], 'max': [0, 0, 0], 'center': [0, 0, 0]}
    else:
        min_coords = all_extents['min']
        max_coords = all_extents['max']
        center = [(min_coords[i] + max_coords[i]) / 2 for i in range(3)]
        extents = {
            'min': min_coords,
            'max': max_coords,
            'center': center
        }

    return {
        'extents': extents,
        'scale': 1.0,  # Would need to extract from header
        'coordinate_system': 'WCS',  # World Coordinate System
        'has_3d': has_3d,
        'has_paperspace': has_paperspace
    }

def update_extents_with_geometry(geometry: Dict[str, Any], extents: Dict[str, List[float]]):
    """Update extents with geometry data"""
    points = []

    if 'start' in geometry and 'end' in geometry:
        points.extend([geometry['start'], geometry['end']])
    elif 'center' in geometry:
        points.append(geometry['center'])
    elif 'position' in geometry:
        points.append(geometry['position'])
    elif 'insertion_point' in geometry:
        points.append(geometry['insertion_point'])
    elif 'vertices' in geometry:
        points.extend(geometry['vertices'])

    for point in points:
        if isinstance(point, dict):
            x = point.get('x', 0)
            y = point.get('y', 0)
            z = point.get('z', 0)

            extents['min'][0] = min(extents['min'][0], x)
            extents['min'][1] = min(extents['min'][1], y)
            extents['min'][2] = min(extents['min'][2], z)
            extents['max'][0] = max(extents['max'][0], x)
            extents['max'][1] = max(extents['max'][1], y)
            extents['max'][2] = max(extents['max'][2], z)

def calculate_success_rate(entities_by_layer: Dict[str, List[Dict[str, Any]]]) -> float:
    """Calculate extraction success rate"""
    total_entities = 0
    error_entities = 0

    for layer_name, entities in entities_by_layer.items():
        total_entities += len(entities)
        error_entities += sum(1 for e in entities if e.get('type') == 'ERROR')

    if total_entities == 0:
        return 100.0

    success_rate = ((total_entities - error_entities) / total_entities) * 100
    return round(success_rate, 2)

def create_safe_filename(layer_name: str) -> str:
    """Create a safe filename from a layer name"""
    # Replace problematic characters
    safe_name = layer_name.replace('\\', '_').replace('/', '_').replace(':', '_')
    safe_name = safe_name.replace('*', '_').replace('?', '_').replace('"', '_')
    safe_name = safe_name.replace('<', '_').replace('>', '_').replace('|', '_')
    safe_name = safe_name.replace('[', '_').replace(']', '_')

    # Trim length and ensure it's not empty
    if not safe_name or safe_name.isspace():
        safe_name = 'unnamed_layer'
    elif len(safe_name) > 50:
        safe_name = safe_name[:50]

    return safe_name

def save_layers_to_json(dxf_path: str, output_dir: str = None) -> Dict[str, str]:
    """
    Extract DXF file and save separate JSON files for each layer
    Returns dictionary mapping layer names to their output file paths
    """
    print("="*60)
    print("DXF LAYER-BASED EXTRACTION")
    print("="*60)

    # Create output directory
    dxf_path_obj = Path(dxf_path)
    dxf_stem = dxf_path_obj.stem

    if output_dir:
        output_base = Path(output_dir)
    else:
        output_base = Path.cwd() / dxf_stem

    # Create the output directory
    output_base.mkdir(exist_ok=True, parents=True)
    print(f"📁 Output directory: {output_base}")

    # Extract DXF data
    print("🚀 Extracting DXF data by layer...")
    global_data, entities_by_layer, error_tracker = extract_dxf_data(dxf_path)

    if not entities_by_layer:
        print("❌ Extraction failed! No entities found.")
        return {}

    # Prepare metadata
    metadata = {
        'timestamp': datetime.now().isoformat(),
        'processing_time': global_data.get('processing_time', 0),
        'ezdxf_version': ezdxf.__version__
    }

    # Save separate JSON for each layer
    layer_files = {}

    print(f"\n💾 Saving layer data to separate JSON files...")
    print(f"🎨 Found {len(entities_by_layer)} layers with entities")

    for layer_name, entities in entities_by_layer.items():
        try:
            # Create safe filename
            safe_layer_name = create_safe_filename(layer_name)
            json_filename = f"{safe_layer_name}.json"
            json_path = output_base / json_filename

            # Find layer definition
            layer_def = next((ld for ld in global_data.get('layers_definition', [])
                            if ld.get('name') == layer_name), {})

            # Get layer-specific issues
            layer_issues = error_tracker.get_layer_issues(layer_name)

            # Create layer JSON
            layer_json = create_layer_json(
                layer_name=layer_name,
                layer_definition=layer_def,
                entities=entities,
                issues=layer_issues,
                file_info=global_data.get('file_info', {}),
                metadata=metadata
            )

            # Save to JSON file
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(layer_json, f, indent=2, default=str)

            layer_files[layer_name] = str(json_path)

            print(f"  ✅ Layer '{layer_name}': {len(entities)} entities -> {json_filename}")

        except Exception as e:
            print(f"  ❌ Error saving layer '{layer_name}': {str(e)}")
            layer_files[layer_name] = f"ERROR: {str(e)}"

    # Save summary JSON
    try:
        summary_json = create_summary_json(
            global_data=global_data,
            entities_by_layer=entities_by_layer,
            error_tracker=error_tracker,
            metadata=metadata
        )

        summary_path = output_base / "_layers_summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary_json, f, indent=2, default=str)

        print(f"\n📊 Summary file saved: {summary_path}")

    except Exception as e:
        print(f"⚠️ Could not save summary file: {str(e)}")
        traceback.print_exc()

    # Print error summary
    print(error_tracker.get_summary())

    print("\n" + "="*60)
    print("✨ LAYER EXTRACTION COMPLETED!")
    print(f"📁 Files saved in: {output_base}")
    print("="*60)

    return layer_files

if __name__ == "__main__":
    import argparse

    # Set up command line argument parsing
    parser = argparse.ArgumentParser(description='Extract DXF layers to separate JSON files')
    parser.add_argument('input_dxf', nargs='?', default='input.dxf',
                       help='Path to input DXF file (default: input.dxf)')
    parser.add_argument('--output', '-o', default=None,
                       help='Output directory (default: creates folder named after DXF file)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose output')

    args = parser.parse_args()
    input_dxf = args.input_dxf
    output_dir = args.output

    if not Path(input_dxf).exists():
        print(f"❌ Error: DXF file not found at {input_dxf}")
        sys.exit(1)

    try:
        # Process DXF and save layer JSONs
        layer_files = save_layers_to_json(input_dxf, output_dir)

        # Print final summary
        if layer_files:
            print("\n📋 CREATED FILES:")
            successful_layers = 0
            for layer_name, file_path in layer_files.items():
                if not file_path.startswith('ERROR'):
                    print(f"  • {layer_name}: {Path(file_path).name}")
                    successful_layers += 1
                else:
                    print(f"  • {layer_name}: {file_path}")

            print(f"\n✅ Successfully saved {successful_layers} out of {len(layer_files)} layer files")
            print(f"📄 Summary file: _layers_summary.json")
        else:
            print("❌ No layer files were created")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n🛑 Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        traceback.print_exc()
        sys.exit(1)
