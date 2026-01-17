// scripts/geometry-renderer.js
class GeometryRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas with id "${canvasId}" not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.bounds = { min: [0, 0], max: [100, 100] };
        this.entities = [];
        this.selectedEntities = new Set();
        this.isPanning = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.showGrid = true;
        this.showDimensions = true;
        this.gridSize = 50;
        this.backgroundColor = '#f8f9fa';
        this.gridColor = '#e5e7eb';
        this.axisColor = '#9ca3af';
        this.selectionColor = 'rgba(37, 99, 235, 0.3)';
        this.measurementLineColor = '#ef4444';
        
        this.setupEventListeners();
        this.setupCanvasDimensions();
    }

    setupCanvasDimensions() {
        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = container.clientWidth * dpr;
        this.canvas.height = container.clientHeight * dpr;
        
        this.canvas.style.width = `${container.clientWidth}px`;
        this.canvas.style.height = `${container.clientHeight}px`;
        
        this.ctx.scale(dpr, dpr);
        
        this.draw();
    }

    setupEventListeners() {
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    setEntities(entities) {
        this.entities = entities;
        this.calculateBounds();
        this.zoomToFit();
        this.draw();
    }

    calculateBounds() {
        if (this.entities.length === 0) {
            this.bounds = { min: [0, 0], max: [100, 100], center: [50, 50], size: [100, 100] };
            return;
        }
        
        this.bounds = DXFUtils.calculateBoundingBox(this.entities);
    }

    zoomToFit(padding = 40) {
        if (!this.bounds) return;
        
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        
        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;
        
        const scaleX = availableWidth / this.bounds.size[0];
        const scaleY = availableHeight / this.bounds.size[1];
        
        this.scale = Math.min(scaleX, scaleY) || 1;
        
        this.offset.x = padding - this.bounds.min[0] * this.scale;
        this.offset.y = padding - this.bounds.min[1] * this.scale;
        
        this.draw();
    }

    zoomIn() {
        this.scale *= 1.2;
        this.draw();
    }

    zoomOut() {
        this.scale *= 0.8;
        this.draw();
    }

    pan(dx, dy) {
        this.offset.x += dx;
        this.offset.y += dy;
        this.draw();
    }

    worldToScreen(x, y) {
        return {
            x: x * this.scale + this.offset.x,
            y: y * this.scale + this.offset.y
        };
    }

    screenToWorld(x, y) {
        return {
            x: (x - this.offset.x) / this.scale,
            y: (y - this.offset.y) / this.scale
        };
    }

    draw() {
        this.clearCanvas();
        
        if (this.showGrid) {
            this.drawGrid();
            this.drawAxes();
        }
        
        this.drawEntities();
        
        if (this.selectedEntities.size > 0) {
            this.drawSelection();
        }
    }

    clearCanvas() {
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);
    }

    drawGrid() {
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        
        const worldStart = this.screenToWorld(0, 0);
        const worldEnd = this.screenToWorld(canvasWidth, canvasHeight);
        
        const startX = Math.floor(worldStart.x / this.gridSize) * this.gridSize;
        const endX = Math.ceil(worldEnd.x / this.gridSize) * this.gridSize;
        const startY = Math.floor(worldStart.y / this.gridSize) * this.gridSize;
        const endY = Math.ceil(worldEnd.y / this.gridSize) * this.gridSize;
        
        this.ctx.strokeStyle = this.gridColor;
        this.ctx.lineWidth = 1;
        
        // Draw vertical grid lines
        for (let x = startX; x <= endX; x += this.gridSize) {
            const screenX = this.worldToScreen(x, 0).x;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, canvasHeight);
            this.ctx.stroke();
        }
        
        // Draw horizontal grid lines
        for (let y = startY; y <= endY; y += this.gridSize) {
            const screenY = this.worldToScreen(0, y).y;
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(canvasWidth, screenY);
            this.ctx.stroke();
        }
    }

    drawAxes() {
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        
        const origin = this.worldToScreen(0, 0);
        
        this.ctx.strokeStyle = this.axisColor;
        this.ctx.lineWidth = 2;
        
        // X axis
        this.ctx.beginPath();
        this.ctx.moveTo(0, origin.y);
        this.ctx.lineTo(canvasWidth, origin.y);
        this.ctx.stroke();
        
        // Y axis
        this.ctx.beginPath();
        this.ctx.moveTo(origin.x, 0);
        this.ctx.lineTo(origin.x, canvasHeight);
        this.ctx.stroke();
        
        // Axis labels
        this.ctx.fillStyle = this.axisColor;
        this.ctx.font = '12px Inter';
        this.ctx.fillText('X', canvasWidth - 20, origin.y - 10);
        this.ctx.fillText('Y', origin.x + 10, 20);
    }

    drawEntities() {
        this.entities.forEach((entity, index) => {
            this.ctx.save();
            
            const isSelected = this.selectedEntities.has(index);
            const color = DXFUtils.getEntityColor(entity.type);
            
            if (isSelected) {
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 3;
                this.ctx.globalAlpha = 0.8;
            } else {
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                this.ctx.globalAlpha = 0.6;
            }
            
            this.drawEntity(entity);
            
            this.ctx.restore();
        });
    }

    drawEntity(entity) {
        const geom = entity.geometry;
        if (!geom) return;
        
        switch (entity.type) {
            case 'LINE':
                this.drawLine(geom);
                break;
            case 'CIRCLE':
                this.drawCircle(geom);
                break;
            case 'ARC':
                this.drawArc(geom);
                break;
            case 'TEXT':
            case 'MTEXT':
                this.drawText(entity);
                break;
            case 'LWPOLYLINE':
            case 'POLYLINE':
                this.drawPolyline(geom);
                break;
            case 'INSERT':
                this.drawInsert(entity);
                break;
            case 'DIMENSION':
                this.drawDimension(geom);
                break;
            case 'POINT':
                this.drawPoint(geom);
                break;
            case 'SPLINE':
                this.drawSpline(geom);
                break;
            case 'ELLIPSE':
                this.drawEllipse(geom);
                break;
            default:
                this.drawGeneric(entity);
        }
    }

    drawLine(geom) {
        if (!geom.start || !geom.end) return;
        
        const start = this.worldToScreen(geom.start.x, geom.start.y);
        const end = this.worldToScreen(geom.end.x, geom.end.y);
        
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        
        // Draw endpoints
        this.drawPointMarker(start.x, start.y, 'start');
        this.drawPointMarker(end.x, end.y, 'end');
        
        // Draw length if showDimensions is true
        if (this.showDimensions && geom.length) {
            this.drawDimensionText(
                (start.x + end.x) / 2,
                (start.y + end.y) / 2,
                `L=${geom.length.toFixed(2)}`
            );
        }
    }

    drawCircle(geom) {
        if (!geom.center || geom.radius === undefined) return;
        
        const center = this.worldToScreen(geom.center.x, geom.center.y);
        const radius = geom.radius * this.scale;
        
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw center point
        this.drawPointMarker(center.x, center.y, 'center');
        
        // Draw radius line and dimension
        if (this.showDimensions) {
            const radiusPoint = this.worldToScreen(
                geom.center.x + geom.radius,
                geom.center.y
            );
            
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(center.x, center.y);
            this.ctx.lineTo(radiusPoint.x, radiusPoint.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            this.drawDimensionText(
                (center.x + radiusPoint.x) / 2,
                (center.y + radiusPoint.y) / 2,
                `R=${geom.radius.toFixed(2)}`
            );
        }
    }

    drawArc(geom) {
        if (!geom.center || geom.radius === undefined) return;
        
        const center = this.worldToScreen(geom.center.x, geom.center.y);
        const radius = geom.radius * this.scale;
        const startAngle = (geom.start_angle || 0) * Math.PI / 180;
        const endAngle = (geom.end_angle || 360) * Math.PI / 180;
        
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, startAngle, endAngle);
        this.ctx.stroke();
        
        // Draw center point
        this.drawPointMarker(center.x, center.y, 'center');
    }

    drawText(entity) {
        const geom = entity.geometry;
        if (!geom.position) return;
        
        const position = this.worldToScreen(geom.position.x, geom.position.y);
        const text = entity.text_content || '';
        const height = (geom.height || 1) * this.scale;
        const rotation = geom.rotation || 0;
        
        this.ctx.save();
        this.ctx.translate(position.x, position.y);
        this.ctx.rotate(rotation * Math.PI / 180);
        
        this.ctx.fillStyle = DXFUtils.getEntityColor(entity.type);
        this.ctx.font = `${height}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, 0, 0);
        
        this.ctx.restore();
    }

    drawPolyline(geom) {
        if (!geom.vertices || !Array.isArray(geom.vertices)) return;
        
        const vertices = geom.vertices.filter(v => v && (v.x !== undefined || v.y !== undefined));
        if (vertices.length < 2) return;
        
        this.ctx.beginPath();
        
        const firstVertex = vertices[0];
        const firstScreen = this.worldToScreen(firstVertex.x, firstVertex.y);
        this.ctx.moveTo(firstScreen.x, firstScreen.y);
        
        for (let i = 1; i < vertices.length; i++) {
            const vertex = vertices[i];
            const screen = this.worldToScreen(vertex.x, vertex.y);
            this.ctx.lineTo(screen.x, screen.y);
        }
        
        if (geom.closed) {
            this.ctx.closePath();
        }
        
        this.ctx.stroke();
        
        // Draw vertices
        vertices.forEach((vertex, i) => {
            const screen = this.worldToScreen(vertex.x, vertex.y);
            this.drawPointMarker(screen.x, screen.y, `vertex-${i}`);
        });
    }

    drawInsert(entity) {
        const geom = entity.geometry;
        if (!geom.insertion_point) return;
        
        const position = this.worldToScreen(geom.insertion_point.x, geom.insertion_point.y);
        
        // Draw insertion point as a cross
        const size = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(position.x - size, position.y);
        this.ctx.lineTo(position.x + size, position.y);
        this.ctx.moveTo(position.x, position.y - size);
        this.ctx.lineTo(position.x, position.y + size);
        this.ctx.stroke();
        
        // Draw block name
        if (geom.block_name) {
            this.ctx.fillStyle = DXFUtils.getEntityColor('INSERT');
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(geom.block_name, position.x, position.y - 15);
        }
    }

    drawDimension(geom) {
        if (!geom.definition_points) return;
        
        const defPoints = geom.definition_points;
        
        // Draw dimension lines
        this.ctx.setLineDash([5, 3]);
        this.ctx.strokeStyle = DXFUtils.getEntityColor('DIMENSION');
        
        if (defPoints.defpoint && defPoints.defpoint2) {
            const p1 = this.worldToScreen(defPoints.defpoint.x, defPoints.defpoint.y);
            const p2 = this.worldToScreen(defPoints.defpoint2.x, defPoints.defpoint2.y);
            
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
        
        // Draw dimension value
        if (geom.text_position && geom.measured_value !== undefined) {
            const textPos = this.worldToScreen(geom.text_position.x, geom.text_position.y);
            this.ctx.fillStyle = DXFUtils.getEntityColor('DIMENSION');
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(geom.measured_value.toFixed(2), textPos.x, textPos.y);
        }
    }

    drawPoint(geom) {
        if (!geom.location) return;
        
        const position = this.worldToScreen(geom.location.x, geom.location.y);
        this.drawPointMarker(position.x, position.y, 'point');
    }

    drawSpline(geom) {
        if (!geom.control_points || geom.control_points.length < 2) return;
        
        this.ctx.beginPath();
        
        const firstPoint = geom.control_points[0];
        const firstScreen = this.worldToScreen(firstPoint.x, firstPoint.y);
        this.ctx.moveTo(firstScreen.x, firstScreen.y);
        
        for (let i = 1; i < geom.control_points.length; i++) {
            const point = geom.control_points[i];
            const screen = this.worldToScreen(point.x, point.y);
            this.ctx.lineTo(screen.x, screen.y);
        }
        
        this.ctx.stroke();
        
        // Draw control points
        geom.control_points.forEach((point, i) => {
            const screen = this.worldToScreen(point.x, point.y);
            this.drawPointMarker(screen.x, screen.y, `control-${i}`, '#8b5cf6');
        });
    }

    drawEllipse(geom) {
        if (!geom.center || !geom.major_axis) return;
        
        const center = this.worldToScreen(geom.center.x, geom.center.y);
        const ratio = geom.ratio || 1;
        
        this.ctx.beginPath();
        this.ctx.ellipse(
            center.x, center.y,
            geom.major_axis.length * this.scale,
            geom.major_axis.length * this.scale * ratio,
            0, 0, Math.PI * 2
        );
        this.ctx.stroke();
    }

    drawGeneric(entity) {
        // Try to draw any points we can find in the geometry
        const geom = entity.geometry;
        if (!geom) return;
        
        const points = DXFUtils.extractPointsFromGeometry(geom);
        if (points.length === 0) return;
        
        // Draw points
        points.forEach((point, i) => {
            const screen = this.worldToScreen(point.x, point.y);
            this.drawPointMarker(screen.x, screen.y, `generic-${i}`, '#6b7280');
        });
        
        // Connect points if there are multiple
        if (points.length > 1) {
            this.ctx.beginPath();
            const firstScreen = this.worldToScreen(points[0].x, points[0].y);
            this.ctx.moveTo(firstScreen.x, firstScreen.y);
            
            for (let i = 1; i < points.length; i++) {
                const screen = this.worldToScreen(points[i].x, points[i].y);
                this.ctx.lineTo(screen.x, screen.y);
            }
            
            this.ctx.stroke();
        }
    }

    drawPointMarker(x, y, type = 'point', color = null) {
        this.ctx.save();
        
        if (color) {
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = color;
        } else {
            this.ctx.fillStyle = this.ctx.strokeStyle;
        }
        
        const size = 4;
        
        switch (type) {
            case 'start':
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();
                break;
            case 'end':
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            case 'center':
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(x, y, size * 2, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
            default:
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fill();
        }
        
        this.ctx.restore();
    }

    drawDimensionText(x, y, text) {
        this.ctx.save();
        this.ctx.fillStyle = '#374151';
        this.ctx.font = '11px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }

    drawSelection() {
        // Highlight selected entities
        this.selectedEntities.forEach(index => {
            const entity = this.entities[index];
            const geom = entity.geometry;
            if (!geom) return;
            
            const points = DXFUtils.extractPointsFromGeometry(geom);
            if (points.length === 0) return;
            
            // Calculate bounding box for selected entity
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            points.forEach(point => {
                const screen = this.worldToScreen(point.x, point.y);
                minX = Math.min(minX, screen.x);
                minY = Math.min(minY, screen.y);
                maxX = Math.max(maxX, screen.x);
                maxY = Math.max(maxY, screen.y);
            });
            
            if (minX === Infinity) return;
            
            // Draw selection rectangle
            this.ctx.save();
            this.ctx.strokeStyle = this.selectionColor;
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            
            const padding = 5;
            this.ctx.strokeRect(
                minX - padding,
                minY - padding,
                maxX - minX + padding * 2,
                maxY - minY + padding * 2
            );
            
            this.ctx.restore();
        });
    }

    handleWheel(event) {
        event.preventDefault();
        
        const delta = event.deltaY > 0 ? 0.9 : 1.1;
        const mouseX = event.offsetX;
        const mouseY = event.offsetY;
        
        const worldBefore = this.screenToWorld(mouseX, mouseY);
        this.scale *= delta;
        const worldAfter = this.screenToWorld(mouseX, mouseY);
        
        this.offset.x += (worldAfter.x - worldBefore.x) * this.scale;
        this.offset.y += (worldAfter.y - worldBefore.y) * this.scale;
        
        this.draw();
    }

    handleMouseDown(event) {
        if (event.button === 0) { // Left click
            this.lastMousePos = { x: event.offsetX, y: event.offsetY };
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
        } else if (event.button === 2) { // Right click
            // Select entity
            const worldPos = this.screenToWorld(event.offsetX, event.offsetY);
            this.selectEntityAt(worldPos.x, worldPos.y);
        }
    }

    handleMouseMove(event) {
        if (this.isPanning) {
            const dx = event.offsetX - this.lastMousePos.x;
            const dy = event.offsetY - this.lastMousePos.y;
            
            this.pan(dx, dy);
            
            this.lastMousePos = { x: event.offsetX, y: event.offsetY };
        } else {
            // Update cursor based on hover
            const worldPos = this.screenToWorld(event.offsetX, event.offsetY);
            const entityIndex = this.findEntityAt(worldPos.x, worldPos.y);
            this.canvas.style.cursor = entityIndex !== -1 ? 'pointer' : 'default';
        }
    }

    handleMouseUp(event) {
        if (event.button === 0) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }

    handleDoubleClick(event) {
        this.zoomToFit();
    }

    handleContextMenu(event) {
        event.preventDefault();
        // Context menu handling would go here
    }

    handleResize() {
        this.setupCanvasDimensions();
    }

    findEntityAt(x, y, tolerance = 10) {
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            const points = DXFUtils.extractPointsFromGeometry(entity.geometry);
            
            for (const point of points) {
                const screen = this.worldToScreen(point.x, point.y);
                const worldClick = this.screenToWorld(screen.x, screen.y);
                
                const distance = Math.sqrt(
                    Math.pow(worldClick.x - x, 2) + Math.pow(worldClick.y - y, 2)
                );
                
                if (distance < tolerance / this.scale) {
                    return i;
                }
            }
        }
        return -1;
    }

    selectEntityAt(x, y) {
        const index = this.findEntityAt(x, y);
        if (index !== -1) {
            if (this.selectedEntities.has(index)) {
                this.selectedEntities.delete(index);
            } else {
                this.selectedEntities.add(index);
            }
            this.draw();
            
            // Dispatch selection event
            this.canvas.dispatchEvent(new CustomEvent('entitySelected', {
                detail: { index, entity: this.entities[index] }
            }));
        }
    }

    clearSelection() {
        this.selectedEntities.clear();
        this.draw();
    }

    getSelectedEntities() {
        return Array.from(this.selectedEntities).map(i => this.entities[i]);
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.draw();
    }

    toggleDimensions() {
        this.showDimensions = !this.showDimensions;
        this.draw();
    }

    exportAsImage(filename = 'geometry.png') {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        
        // Draw white background
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw grid and axes if enabled
        if (this.showGrid) {
            // Simplified grid drawing for export
            const scale = this.scale * dpr;
            const offset = { x: this.offset.x * dpr, y: this.offset.y * dpr };
            
            // Draw entities
            this.entities.forEach(entity => {
                // Draw entity on temp canvas
                // This would need the actual drawing logic adapted for the temp context
            });
        }
        
        // Create download link
        const link = document.createElement('a');
        link.href = tempCanvas.toDataURL('image/png');
        link.download = filename;
        link.click();
    }
}