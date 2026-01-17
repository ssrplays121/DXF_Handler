// scripts/utils.js
class DXFUtils {
    static createSafeFilename(name) {
        return name
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100)
            .replace(/^_+|_+$/g, '') || 'unnamed';
    }

    static serializeValue(value) {
        if (value === null || value === undefined) {
            return null;
        }
        
        if (Array.isArray(value)) {
            return value.map(item => this.serializeValue(item));
        }
        
        if (typeof value === 'object') {
            // Handle Vector objects
            if (value.x !== undefined && value.y !== undefined) {
                const result = { x: Number(value.x), y: Number(value.y) };
                if (value.z !== undefined) result.z = Number(value.z);
                return result;
            }
            
            // Convert other objects to string
            try {
                return JSON.parse(JSON.stringify(value, this.replacer));
            } catch {
                return String(value);
            }
        }
        
        return value;
    }

    static replacer(key, value) {
        if (typeof value === 'function') {
            return undefined;
        }
        return value;
    }

    static generateColors(count, alpha = 1) {
        const baseColors = [
            `rgba(37, 99, 235, ${alpha})`,    // Blue
            `rgba(16, 185, 129, ${alpha})`,   // Green
            `rgba(245, 158, 11, ${alpha})`,   // Yellow
            `rgba(239, 68, 68, ${alpha})`,    // Red
            `rgba(139, 92, 246, ${alpha})`,   // Purple
            `rgba(6, 182, 212, ${alpha})`,    // Cyan
            `rgba(249, 115, 22, ${alpha})`,   // Orange
            `rgba(20, 184, 166, ${alpha})`,   // Teal
            `rgba(236, 72, 153, ${alpha})`,   // Pink
            `rgba(107, 114, 128, ${alpha})`   // Gray
        ];
        
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }

    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static getEntityColor(entityType) {
        const colorMap = {
            'LINE': '#2563eb',
            'CIRCLE': '#10b981',
            'ARC': '#f59e0b',
            'TEXT': '#ef4444',
            'MTEXT': '#dc2626',
            'INSERT': '#8b5cf6',
            'DIMENSION': '#06b6d4',
            'LWPOLYLINE': '#f97316',
            'POLYLINE': '#ea580c',
            'POINT': '#84cc16',
            'SPLINE': '#7c3aed',
            'ELLIPSE': '#14b8a6',
            'HATCH': '#f43f5e',
            'default': '#6b7280'
        };
        return colorMap[entityType] || colorMap.default;
    }

    static calculateBoundingBox(entities) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        entities.forEach(entity => {
            const geom = entity.geometry;
            if (!geom) return;
            
            const points = this.extractPointsFromGeometry(geom);
            points.forEach(point => {
                if (point.x !== undefined) {
                    minX = Math.min(minX, point.x);
                    maxX = Math.max(maxX, point.x);
                }
                if (point.y !== undefined) {
                    minY = Math.min(minY, point.y);
                    maxY = Math.max(maxY, point.y);
                }
            });
        });
        
        if (minX === Infinity) {
            return { min: [0, 0], max: [100, 100], center: [50, 50], size: [100, 100] };
        }
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        
        return {
            min: [minX, minY],
            max: [maxX, maxY],
            center: [centerX, centerY],
            size: [sizeX, sizeY]
        };
    }

    static extractPointsFromGeometry(geometry) {
        const points = [];
        
        if (geometry.start && geometry.end) {
            points.push(geometry.start, geometry.end);
        }
        if (geometry.center) {
            points.push(geometry.center);
        }
        if (geometry.position) {
            points.push(geometry.position);
        }
        if (geometry.insertion_point) {
            points.push(geometry.insertion_point);
        }
        if (geometry.vertices && Array.isArray(geometry.vertices)) {
            points.push(...geometry.vertices.filter(v => v && (v.x !== undefined || v.y !== undefined)));
        }
        if (geometry.definition_points) {
            Object.values(geometry.definition_points).forEach(point => {
                if (point) points.push(point);
            });
        }
        
        return points;
    }

    static syntaxHighlight(json) {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, null, 2);
        }
        
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
            function(match) {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${match}</span>`;
            }
        );
    }

    static downloadFile(filename, content, type = 'application/json') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static copyToClipboard(text) {
        return navigator.clipboard.writeText(text);
    }

    static getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    static formatDate(date = new Date()) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    static createCSV(data, headers = null) {
        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }
        
        if (!headers) {
            headers = Object.keys(data[0]);
        }
        
        const csv = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    const string = String(value);
                    return string.includes(',') || string.includes('"') || string.includes('\n') 
                        ? `"${string.replace(/"/g, '""')}"`
                        : string;
                }).join(',')
            )
        ].join('\n');
        
        return csv;
    }
}