// scripts/dxf-explorer.js
class DXFExplorer {
    constructor() {
        this.data = {
            layers: {},
            summary: null,
            currentLayer: null
        };
        this.currentTab = 'overview';
        this.chartManager = new ChartManager();
        this.geometryRenderer = null;
        this.searchQuery = '';
        this.entityTypeFilter = 'all';
        this.compactView = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTabs();
        this.setupGeometryRenderer();
        this.updateStatus('Ready');
    }

    setupEventListeners() {
        // File input
        document.getElementById('fileInput').addEventListener('change', (e) => this.loadFiles(e));
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
        });
        
        // Search
        document.querySelector('.search-input').addEventListener('input', 
            DXFUtils.debounce((e) => this.searchData(e.target.value), 300));
        
        // Entity filter
        document.getElementById('entityFilter').addEventListener('change', 
            (e) => this.filterEntities(e.target.value));
        
        // Entity type filter
        document.getElementById('entityTypeFilter').addEventListener('change', 
            (e) => this.filterLayersByEntityType(e.target.value));
        
        // Compact view toggle
        document.getElementById('compactView').addEventListener('change', 
            (e) => this.toggleCompactView(e.target.checked));
        
        // Layer actions
        document.getElementById('zoomToFit').addEventListener('click', () => this.zoomToFit());
        document.getElementById('toggleVisibility').addEventListener('click', () => this.toggleVisibility());
        document.getElementById('exportLayer').addEventListener('click', () => this.exportCurrentLayer());
        
        // Geometry controls
        document.getElementById('zoomIn').addEventListener('click', () => this.geometryRenderer?.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.geometryRenderer?.zoomOut());
        document.getElementById('panMode').addEventListener('click', () => this.togglePanMode());
        document.getElementById('measureMode').addEventListener('click', () => this.toggleMeasureMode());
        
        // Entity actions
        document.getElementById('selectAllEntities').addEventListener('click', () => this.selectAllEntities());
        document.getElementById('deselectAllEntities').addEventListener('click', () => this.deselectAllEntities());
        
        // Issue filters
        document.getElementById('showErrors').addEventListener('change', () => this.filterIssues());
        document.getElementById('showWarnings').addEventListener('change', () => this.filterIssues());
        
        // Raw data actions
        document.getElementById('copyJson').addEventListener('click', () => this.copyJson());
        document.getElementById('downloadJson').addEventListener('click', () => this.downloadJson());
        
        // Export actions
        document.getElementById('exportCsv').addEventListener('click', () => this.exportAsCSV());
        document.getElementById('exportExcel').addEventListener('click', () => this.exportAsExcel());
        document.getElementById('exportImage').addEventListener('click', () => this.exportAsImage());
        document.getElementById('exportPdf').addEventListener('click', () => this.exportAsPDF());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Update memory usage periodically
        setInterval(() => this.updateMemoryUsage(), 5000);
    }

    setupTabs() {
        // Show loading for all tabs initially
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.querySelector('.loading')?.classList.remove('hidden');
            tab.querySelector('.hidden')?.classList.add('hidden');
        });
    }

    setupGeometryRenderer() {
        try {
            this.geometryRenderer = new GeometryRenderer('geometryCanvas');
            this.geometryRenderer.canvas.addEventListener('entitySelected', 
                (e) => this.onEntitySelected(e.detail));
        } catch (error) {
            console.warn('Could not initialize geometry renderer:', error);
        }
    }

    async loadFiles(event) {
        const files = Array.from(event.target.files);
        const jsonFiles = files.filter(f => f.name.endsWith('.json'));
        
        if (jsonFiles.length === 0) {
            this.showNotification('No JSON files found in the selected directory.', 'error');
            return;
        }

        // Show selected folder
        const folderPath = files[0].webkitRelativePath.split('/')[0];
        document.getElementById('selectedFolder').classList.add('show');
        document.getElementById('folderPath').textContent = folderPath;

        // Show loading state
        this.showLoading();
        this.updateStatus('Loading files...');

        try {
            // Load summary file
            const summaryFile = jsonFiles.find(f => f.name === '_layers_summary.json');
            if (summaryFile) {
                this.data.summary = await this.parseJSONFile(summaryFile);
            }

            // Load layer files
            const layerPromises = jsonFiles
                .filter(f => f.name !== '_layers_summary.json')
                .map(async file => {
                    const data = await this.parseJSONFile(file);
                    const layerName = data.layer_info?.name || file.name.replace('.json', '');
                    this.data.layers[layerName] = data;
                });

            await Promise.all(layerPromises);

            // Update UI
            this.updateUI();
            this.showMainLayout();
            this.updateStatus(`Loaded ${Object.keys(this.data.layers).length} layers`);
            this.showNotification('Files loaded successfully!', 'success');

        } catch (error) {
            console.error('Error loading files:', error);
            this.showNotification(`Error loading files: ${error.message}`, 'error');
            this.updateStatus('Error loading files');
        }
    }

    async parseJSONFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    resolve(JSON.parse(e.target.result));
                } catch (error) {
                    reject(new Error(`Invalid JSON in ${file.name}: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsText(file);
        });
    }

    showLoading() {
        document.querySelector('.main-layout')?.classList.add('hidden');
    }

    showMainLayout() {
        document.querySelector('.main-layout')?.classList.remove('hidden');
    }

    updateUI() {
        this.updateLayerList();
        this.updateGlobalStats();
        this.updateFileCount();
        
        // Select first layer if available
        const layerNames = Object.keys(this.data.layers);
        if (layerNames.length > 0) {
            this.selectLayer(layerNames[0]);
        } else if (this.data.summary) {
            this.selectLayer('Summary', true);
        }
    }

    updateLayerList() {
        const layerList = document.getElementById('layerList');
        layerList.innerHTML = '';
        
        const layerNames = Object.keys(this.data.layers);
        
        // Add summary item
        if (this.data.summary) {
            const summaryItem = this.createLayerItem('Summary', this.data.summary, true);
            layerList.appendChild(summaryItem);
        }
        
        // Add layer items
        layerNames.forEach(layerName => {
            const layerItem = this.createLayerItem(layerName, this.data.layers[layerName]);
            layerList.appendChild(layerItem);
        });
        
        // Populate entity type filter
        this.populateEntityTypeFilter();
    }

    createLayerItem(name, data, isSummary = false) {
        const li = document.createElement('li');
        li.className = 'layer-item';
        li.dataset.layer = name;
        li.title = isSummary ? 'Drawing summary' : `Layer: ${name}`;
        
        const entityCount = isSummary ? 
            (data.extraction_summary?.entities_extracted || 0) :
            (data.layer_info?.entity_count || 0);
        
        li.innerHTML = `
            <div class="layer-info">
                <div class="layer-name">
                    ${isSummary ? '<i class="fas fa-chart-bar"></i>' : '<i class="fas fa-layer-group"></i>'} ${name}
                </div>
                <div class="layer-count">${entityCount}</div>
            </div>
        `;
        
        li.addEventListener('click', () => this.selectLayer(name, isSummary));
        return li;
    }

    populateEntityTypeFilter() {
        const filter = document.getElementById('entityTypeFilter');
        const entityTypes = new Set();
        
        Object.values(this.data.layers).forEach(layer => {
            const stats = layer.entity_statistics?.by_type || {};
            Object.keys(stats).forEach(type => entityTypes.add(type));
        });
        
        // Clear existing options except "All Types"
        while (filter.options.length > 1) {
            filter.remove(1);
        }
        
        // Add entity type options
        Array.from(entityTypes).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            filter.appendChild(option);
        });
    }

    updateGlobalStats() {
        if (this.data.summary) {
            document.getElementById('totalLayers').textContent = 
                this.data.summary.extraction_summary?.layers_extracted || 0;
            document.getElementById('totalEntities').textContent = 
                this.data.summary.extraction_summary?.entities_extracted || 0;
        }
    }

    updateFileCount() {
        const fileCount = Object.keys(this.data.layers).length + (this.data.summary ? 1 : 0);
        document.getElementById('fileCount').textContent = `Files: ${fileCount}`;
    }

    updateMemoryUsage() {
        const memory = DXFUtils.getMemoryUsage();
        if (memory) {
            const used = DXFUtils.formatBytes(memory.used);
            const total = DXFUtils.formatBytes(memory.total);
            document.getElementById('memoryUsage').textContent = `Memory: ${used} / ${total}`;
        }
    }

    updateStatus(message) {
        document.getElementById('statusIndicator').textContent = message;
    }

    selectLayer(layerName, isSummary = false) {
        // Update active state
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.layer-item[data-layer="${layerName}"]`)?.classList.add('active');
        
        if (isSummary) {
            this.currentLayer = null;
            this.showSummaryData();
        } else {
            this.currentLayer = this.data.layers[layerName];
            this.showLayerData(layerName);
        }
        
        // Switch to overview tab
        this.switchTab('overview');
    }

    showSummaryData() {
        if (!this.data.summary) return;
        
        document.getElementById('currentLayerName').textContent = 'Drawing Summary';
        document.getElementById('layerInfo').innerHTML = `
            <i class="fas fa-file-alt"></i> Total: ${this.data.summary.extraction_summary?.entities_extracted || 0} entities 
            across ${this.data.summary.extraction_summary?.layers_extracted || 0} layers
        `;
        
        // Update all tabs
        this.updateSummaryOverview();
        this.updateSummaryEntities();
        this.updateSummaryStatistics();
        this.updateSummaryIssues();
        this.updateRawData(this.data.summary);
        
        // Clear geometry
        if (this.geometryRenderer) {
            this.geometryRenderer.setEntities([]);
        }
    }

    showLayerData(layerName) {
        const layer = this.data.layers[layerName];
        if (!layer) return;
        
        document.getElementById('currentLayerName').textContent = layerName;
        document.getElementById('layerInfo').innerHTML = `
            <i class="fas fa-cube"></i> ${layer.layer_info?.entity_count || 0} entities | 
            <i class="fas fa-palette"></i> Color: ${layer.layer_info?.color || 'ByLayer'} | 
            <i class="fas fa-stream"></i> Linetype: ${layer.layer_info?.linetype || 'ByLayer'}
        `;
        
        // Update all tabs
        this.updateLayerOverview(layer);
        this.updateEntitiesList(layer);
        this.updateGeometryVisualization(layer);
        this.updateStatistics(layer);
        this.updateIssues(layer);
        this.updateRawData(layer);
    }

    updateLayerOverview(layer) {
        const content = document.getElementById('overviewContent');
        const loading = document.getElementById('overviewLoading');
        
        // Update stats
        document.getElementById('layerEntityCount').textContent = 
            layer.layer_info?.entity_count || 0;
        document.getElementById('layerErrorCount').textContent = 
            layer.layer_issues?.error_count || 0;
        document.getElementById('layerWarningCount').textContent = 
            layer.layer_issues?.warning_count || 0;
        
        const successRate = this.calculateSuccessRate(layer);
        document.getElementById('layerSuccessRate').textContent = 
            `${successRate}%`;
        
        // Update layer properties
        const propsContainer = document.getElementById('layerProperties');
        const layerInfo = layer.layer_info || {};
        
        const properties = {
            'Name': layerInfo.name,
            'Color': layerInfo.color,
            'Linetype': layerInfo.linetype,
            'Lineweight': layerInfo.lineweight,
            'Description': layerInfo.description || 'N/A',
            'Entity Count': layerInfo.entity_count
        };
        
        if (layerInfo.flags) {
            properties['Flags'] = JSON.stringify(layerInfo.flags, null, 2);
        }
        
        propsContainer.innerHTML = this.createPropertiesTable(properties);
        
        // Create type distribution chart
        if (layer.entity_statistics?.by_type) {
            this.chartManager.createEntityDistributionChart(
                'typeDistributionChart',
                layer.entity_statistics.by_type
            );
        }
        
        // Show content
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    updateSummaryOverview() {
        const content = document.getElementById('overviewContent');
        const loading = document.getElementById('overviewLoading');
        
        // Update stats
        document.getElementById('layerEntityCount').textContent = 
            this.data.summary.extraction_summary?.entities_extracted || 0;
        document.getElementById('layerErrorCount').textContent = 
            this.data.summary.global_issues?.error_count || 0;
        document.getElementById('layerWarningCount').textContent = 
            this.data.summary.global_issues?.warning_count || 0;
        document.getElementById('layerSuccessRate').textContent = 
            `${this.data.summary.extraction_summary?.success_rate || 100}%`;
        
        // Update file info
        const propsContainer = document.getElementById('layerProperties');
        const fileInfo = this.data.summary.file_info || {};
        
        const properties = {
            'DXF Version': fileInfo.dxf_version,
            'AutoCAD Version': fileInfo.acad_version,
            'Units': fileInfo.units || 'Unknown',
            'Encoding': fileInfo.encoding,
            'Total Layers': this.data.summary.layers?.length || 0,
            'Total Entities': this.data.summary.extraction_summary?.entities_extracted || 0,
            'File Size': DXFUtils.formatBytes(fileInfo.file_size || 0)
        };
        
        if (fileInfo.drawing_properties) {
            Object.entries(fileInfo.drawing_properties).forEach(([key, value]) => {
                if (value) properties[key] = value;
            });
        }
        
        propsContainer.innerHTML = this.createPropertiesTable(properties);
        
        // Create entity distribution chart
        if (this.data.summary.entity_statistics?.entities_by_type) {
            this.chartManager.createBarChart(
                'typeDistributionChart',
                this.data.summary.entity_statistics.entities_by_type,
                'Global Entity Distribution'
            );
        }
        
        // Show content
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    createPropertiesTable(data) {
        let html = '<div class="entity-details">';
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) continue;
            
            html += `
                <div class="entity-property">
                    <div class="property-label">${key}</div>
                    <div class="property-value">${value}</div>
                </div>
            `;
        }
        html += '</div>';
        return html;
    }

    calculateSuccessRate(layer) {
        const total = layer.layer_info?.entity_count || 0;
        const errors = layer.layer_issues?.error_count || 0;
        if (total === 0) return 100;
        return Math.round(((total - errors) / total) * 100);
    }

    updateEntitiesList(layer) {
        const content = document.getElementById('entitiesContent');
        const loading = document.getElementById('entitiesLoading');
        const container = document.getElementById('entityListContainer');
        
        // Clear existing content
        container.innerHTML = '';
        
        // Get entities
        const entities = layer.entities || [];
        
        // Populate entity type filter
        const entityFilter = document.getElementById('entityFilter');
        entityFilter.innerHTML = '<option value="all">All Entity Types</option>';
        
        const entityTypes = [...new Set(entities.map(e => e.type))].sort();
        entityTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = `${type} (${entities.filter(e => e.type === type).length})`;
            entityFilter.appendChild(option);
        });
        
        // Display all entities initially
        this.displayEntities(entities, container);
        
        // Show content
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    updateSummaryEntities() {
        const content = document.getElementById('entitiesContent');
        const loading = document.getElementById('entitiesLoading');
        const container = document.getElementById('entityListContainer');
        
        container.innerHTML = `
            <div class="info-box">
                <p><i class="fas fa-info-circle"></i> Select a layer from the sidebar to view its entities.</p>
                <p>Use the search box above to find entities across all layers.</p>
            </div>
        `;
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    displayEntities(entities, container) {
        if (entities.length === 0) {
            container.innerHTML = '<p class="text-center">No entities found in this layer.</p>';
            return;
        }
        
        entities.forEach((entity, index) => {
            const entityCard = this.createEntityCard(entity, index);
            container.appendChild(entityCard);
        });
    }

    createEntityCard(entity, index) {
        const card = document.createElement('div');
        card.className = 'entity-card';
        card.dataset.entityType = entity.type;
        card.dataset.entityIndex = index;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'entity-header';
        header.innerHTML = `
            <div>
                <span class="entity-type">${entity.type}</span>
                ${entity.handle ? `<span class="text-sm text-primary ml-4">Handle: ${entity.handle}</span>` : ''}
            </div>
            <i class="fas fa-chevron-down toggle-icon"></i>
        `;
        
        // Create details container
        const details = document.createElement('div');
        details.className = 'entity-details';
        details.style.display = 'none';
        
        // Add properties
        details.appendChild(this.createEntityProperties(entity));
        
        // Add click handler
        header.addEventListener('click', () => {
            const isVisible = details.style.display !== 'none';
            details.style.display = isVisible ? 'none' : 'grid';
            const icon = header.querySelector('.toggle-icon');
            icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        });
        
        card.appendChild(header);
        card.appendChild(details);
        
        return card;
    }

    createEntityProperties(entity) {
        const fragment = document.createDocumentFragment();
        
        // Add basic properties
        const basicProps = ['color', 'linetype', 'lineweight', 'layer'];
        basicProps.forEach(prop => {
            if (entity[prop] !== undefined) {
                const div = document.createElement('div');
                div.className = 'entity-property';
                div.innerHTML = `
                    <div class="property-label">${prop}</div>
                    <div class="property-value">${entity[prop]}</div>
                `;
                fragment.appendChild(div);
            }
        });
        
        // Add geometry properties
        if (entity.geometry) {
            Object.entries(entity.geometry).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                
                const div = document.createElement('div');
                div.className = 'entity-property';
                div.innerHTML = `
                    <div class="property-label">${key}</div>
                    <div class="property-value text-mono">${typeof value === 'object' ? 
                        JSON.stringify(value, null, 2) : value}</div>
                `;
                fragment.appendChild(div);
            });
        }
        
        // Add text content if present
        if (entity.text_content) {
            const div = document.createElement('div');
            div.className = 'entity-property';
            div.style.gridColumn = '1 / -1';
            div.innerHTML = `
                <div class="property-label">Text Content</div>
                <div class="property-value" style="background: #f0f0f0; padding: 8px; border-radius: 4px;">
                    ${entity.text_content}
                </div>
            `;
            fragment.appendChild(div);
        }
        
        // Add block attributes if present
        if (entity.block_attributes && entity.block_attributes.length > 0) {
            const div = document.createElement('div');
            div.className = 'entity-property';
            div.style.gridColumn = '1 / -1';
            
            let attributesHtml = '<div class="property-label">Block Attributes</div>';
            entity.block_attributes.forEach(attr => {
                attributesHtml += `
                    <div style="margin-top: 4px;">
                        <strong>${attr.tag}:</strong> ${attr.text || ''}
                    </div>
                `;
            });
            
            div.innerHTML = attributesHtml;
            fragment.appendChild(div);
        }
        
        return fragment;
    }

    updateGeometryVisualization(layer) {
        const content = document.getElementById('geometryContent');
        const loading = document.getElementById('geometryLoading');
        
        // Get entities with geometry
        const entities = layer.entities || [];
        
        if (this.geometryRenderer) {
            this.geometryRenderer.setEntities(entities);
        }
        
        // Show geometry details
        const detailsContainer = document.getElementById('geometryDetails');
        detailsContainer.innerHTML = this.createGeometryDetails(entities);
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    createGeometryDetails(entities) {
        const fragment = document.createDocumentFragment();
        
        const entitiesWithGeometry = entities.filter(e => e.geometry);
        if (entitiesWithGeometry.length === 0) {
            const div = document.createElement('div');
            div.className = 'info-box';
            div.innerHTML = '<p>No geometry data available for this layer.</p>';
            fragment.appendChild(div);
            return fragment;
        }
        
        // Show summary
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'entity-property';
        summaryDiv.innerHTML = `
            <div class="property-label">Geometry Summary</div>
            <div class="property-value">
                ${entitiesWithGeometry.length} entities with geometry data
            </div>
        `;
        fragment.appendChild(summaryDiv);
        
        return fragment;
    }

    updateStatistics(layer) {
        const content = document.getElementById('statisticsContent');
        const loading = document.getElementById('statisticsLoading');
        const detailsContainer = document.getElementById('detailedStats');
        
        // Create chart
        if (layer.entity_statistics?.by_type) {
            this.chartManager.createBarChart(
                'entityStatisticsChart',
                layer.entity_statistics.by_type,
                'Layer Entity Statistics'
            );
        }
        
        // Update detailed stats
        detailsContainer.innerHTML = this.createDetailedStatistics(layer);
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    updateSummaryStatistics() {
        const content = document.getElementById('statisticsContent');
        const loading = document.getElementById('statisticsLoading');
        const detailsContainer = document.getElementById('detailedStats');
        
        // Create chart
        if (this.data.summary.entity_statistics?.entities_by_type) {
            this.chartManager.createBarChart(
                'entityStatisticsChart',
                this.data.summary.entity_statistics.entities_by_type,
                'Global Entity Statistics'
            );
        }
        
        // Update detailed stats
        detailsContainer.innerHTML = this.createSummaryDetailedStats();
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    createDetailedStatistics(layer) {
        const stats = layer.entity_statistics || {};
        let html = '<div class="entity-details">';
        
        html += `
            <div class="entity-property">
                <div class="property-label">Total Entities</div>
                <div class="property-value">${stats.total_count || 0}</div>
            </div>
        `;
        
        if (stats.by_type) {
            Object.entries(stats.by_type).forEach(([type, data]) => {
                html += `
                    <div class="entity-property">
                        <div class="property-label">${type}</div>
                        <div class="property-value">${data.count}</div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        return html;
    }

    createSummaryDetailedStats() {
        const stats = this.data.summary.entity_statistics || {};
        let html = '<div class="entity-details">';
        
        html += `
            <div class="entity-property">
                <div class="property-label">Total Entities</div>
                <div class="property-value">${stats.total_entities || 0}</div>
            </div>
            <div class="entity-property">
                <div class="property-label">Total Layers</div>
                <div class="property-value">${this.data.summary.extraction_summary?.layers_extracted || 0}</div>
            </div>
        `;
        
        if (stats.text_statistics) {
            const textStats = stats.text_statistics;
            html += `
                <div class="entity-property">
                    <div class="property-label">Text Entities</div>
                    <div class="property-value">${textStats.total_text_entities || 0}</div>
                </div>
                <div class="entity-property">
                    <div class="property-label">Unique Texts</div>
                    <div class="property-value">${textStats.total_unique_texts || 0}</div>
                </div>
            `;
        }
        
        if (this.data.summary.semantic_data) {
            const semantic = this.data.summary.semantic_data;
            html += `
                <div class="entity-property">
                    <div class="property-label">Dimension Values</div>
                    <div class="property-value">${semantic.dimension_values?.length || 0}</div>
                </div>
                <div class="entity-property">
                    <div class="property-label">Block References</div>
                    <div class="property-value">${semantic.block_references?.length || 0}</div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    updateIssues(layer) {
        const content = document.getElementById('issuesContent');
        const loading = document.getElementById('issuesLoading');
        const issuesList = document.getElementById('issuesList');
        
        issuesList.innerHTML = '';
        
        const issues = layer.layer_issues || {};
        const showErrors = document.getElementById('showErrors').checked;
        const showWarnings = document.getElementById('showWarnings').checked;
        
        // Add errors
        if (showErrors) {
            (issues.errors || []).forEach(error => {
                issuesList.appendChild(this.createIssueItem(error, 'error'));
            });
        }
        
        // Add warnings
        if (showWarnings) {
            (issues.warnings || []).forEach(warning => {
                issuesList.appendChild(this.createIssueItem(warning, 'warning'));
            });
        }
        
        if (issuesList.children.length === 0) {
            issuesList.innerHTML = `
                <div class="info-box">
                    <p><i class="fas fa-check-circle"></i> No issues found for this layer.</p>
                </div>
            `;
        }
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    updateSummaryIssues() {
        const content = document.getElementById('issuesContent');
        const loading = document.getElementById('issuesLoading');
        const issuesList = document.getElementById('issuesList');
        
        issuesList.innerHTML = '';
        
        const issues = this.data.summary.global_issues || {};
        const showErrors = document.getElementById('showErrors').checked;
        const showWarnings = document.getElementById('showWarnings').checked;
        
        // Add errors
        if (showErrors) {
            (issues.errors || []).forEach(error => {
                issuesList.appendChild(this.createIssueItem(error, 'error'));
            });
        }
        
        // Add warnings
        if (showWarnings) {
            (issues.warnings || []).forEach(warning => {
                issuesList.appendChild(this.createIssueItem(warning, 'warning'));
            });
        }
        
        if (issuesList.children.length === 0) {
            issuesList.innerHTML = `
                <div class="info-box">
                    <p><i class="fas fa-check-circle"></i> No global issues found.</p>
                </div>
            `;
        }
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    createIssueItem(issue, type) {
        const div = document.createElement('div');
        div.className = `issue-item issue-${type}`;
        
        let html = `
            <div class="issue-type">
                <i class="fas fa-${type === 'error' ? 'times-circle' : 'exclamation-triangle'}"></i>
                ${type.toUpperCase()}
            </div>
            <div class="issue-message">${issue.error_message || issue.message || 'Unknown issue'}</div>
        `;
        
        if (issue.context) {
            html += `<div class="text-xs mt-2"><strong>Context:</strong> ${issue.context}</div>`;
        }
        
        if (issue.entity_type) {
            html += `<div class="text-xs"><strong>Entity:</strong> ${issue.entity_type}</div>`;
        }
        
        if (issue.entity_handle) {
            html += `<div class="text-xs"><strong>Handle:</strong> ${issue.entity_handle}</div>`;
        }
        
        if (issue.timestamp) {
            html += `<div class="text-xs"><strong>Time:</strong> ${new Date(issue.timestamp).toLocaleString()}</div>`;
        }
        
        div.innerHTML = html;
        return div;
    }

    updateRawData(data) {
        const content = document.getElementById('rawContent');
        const loading = document.getElementById('rawLoading');
        const jsonViewer = document.getElementById('jsonViewer');
        
        // Format and display JSON
        jsonViewer.innerHTML = DXFUtils.syntaxHighlight(data);
        
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        this.currentTab = tabName;
        
        // Handle tab-specific actions
        if (tabName === 'geometry' && this.geometryRenderer) {
            this.geometryRenderer.draw();
        } else if (tabName === 'statistics') {
            this.chartManager.resizeAllCharts();
        }
    }

    searchData(query) {
        this.searchQuery = query.toLowerCase().trim();
        
        if (!this.searchQuery) {
            // Reset all filters
            document.querySelectorAll('.entity-card').forEach(card => {
                card.style.display = '';
            });
            return;
        }
        
        // Search in entity cards
        document.querySelectorAll('.entity-card').forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(this.searchQuery) ? '' : 'none';
        });
        
        // Search in layer list
        document.querySelectorAll('.layer-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(this.searchQuery) ? '' : 'none';
        });
    }

    filterEntities(entityType) {
        this.entityTypeFilter = entityType;
        const container = document.getElementById('entityListContainer');
        const cards = container.querySelectorAll('.entity-card');
        
        cards.forEach(card => {
            if (entityType === 'all' || card.dataset.entityType === entityType) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    filterLayersByEntityType(entityType) {
        const layerItems = document.querySelectorAll('.layer-item');
        
        if (entityType === 'all') {
            layerItems.forEach(item => item.style.display = '');
            return;
        }
        
        layerItems.forEach(item => {
            const layerName = item.dataset.layer;
            const layer = this.data.layers[layerName];
            
            if (!layer || layer === this.data.summary) {
                item.style.display = '';
                return;
            }
            
            const hasEntityType = Object.keys(layer.entity_statistics?.by_type || {}).includes(entityType);
            item.style.display = hasEntityType ? '' : 'none';
        });
    }

    filterIssues() {
        if (this.currentLayer) {
            this.updateIssues(this.currentLayer);
        } else if (this.data.summary) {
            this.updateSummaryIssues();
        }
    }

    toggleCompactView(compact) {
        this.compactView = compact;
        
        const entityCards = document.querySelectorAll('.entity-card');
        entityCards.forEach(card => {
            if (compact) {
                card.classList.add('compact');
            } else {
                card.classList.remove('compact');
            }
        });
    }

    zoomToFit() {
        if (this.geometryRenderer) {
            this.geometryRenderer.zoomToFit();
        }
    }

    toggleVisibility() {
        // Toggle layer visibility logic
        this.showNotification('Visibility toggled', 'info');
    }

    exportCurrentLayer() {
        if (!this.currentLayer) return;
        
        const filename = DXFUtils.createSafeFilename(this.currentLayer.layer_info?.name || 'layer') + '.json';
        const content = JSON.stringify(this.currentLayer, null, 2);
        DXFUtils.downloadFile(filename, content);
        
        this.showNotification(`Layer exported as ${filename}`, 'success');
    }

    togglePanMode() {
        if (this.geometryRenderer) {
            this.geometryRenderer.canvas.style.cursor = 'grab';
            this.showNotification('Pan mode activated', 'info');
        }
    }

    toggleMeasureMode() {
        this.showNotification('Measure mode activated', 'info');
    }

    selectAllEntities() {
        const container = document.getElementById('entityListContainer');
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        check.forEach(checkbox => checkbox.checked = true);
        this.showNotification('All entities selected', 'info');
    }

    deselectAllEntities() {
        const container = document.getElementById('entityListContainer');
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = false);
        this.showNotification('All entities deselected', 'info');
    }

    onEntitySelected(detail) {
        // Handle entity selection from geometry renderer
        console.log('Entity selected:', detail);
        
        // Scroll to entity in entities tab
        this.switchTab('entities');
        
        // Find and highlight the entity card
        const entityCard = document.querySelector(`.entity-card[data-entity-index="${detail.index}"]`);
        if (entityCard) {
            entityCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            entityCard.style.animation = 'pulse 1s';
            setTimeout(() => entityCard.style.animation = '', 1000);
        }
    }

    copyJson() {
        const jsonViewer = document.getElementById('jsonViewer');
        const text = jsonViewer.textContent;
        DXFUtils.copyToClipboard(text).then(() => {
            this.showNotification('JSON copied to clipboard', 'success');
        }).catch(err => {
            this.showNotification('Failed to copy JSON', 'error');
        });
    }

    downloadJson() {
        const data = this.currentLayer || this.data.summary;
        if (!data) return;
        
        const filename = DXFUtils.createSafeFilename(data.layer_info?.name || 'summary') + '.json';
        const content = JSON.stringify(data, null, 2);
        DXFUtils.downloadFile(filename, content);
        
        this.showNotification(`JSON downloaded as ${filename}`, 'success');
    }

    exportAsCSV() {
        if (!this.currentLayer) {
            this.showNotification('Please select a layer first', 'warning');
            return;
        }
        
        const entities = this.currentLayer.entities || [];
        if (entities.length === 0) {
            this.showNotification('No entities to export', 'warning');
            return;
        }
        
        // Create CSV data
        const csvData = entities.map(entity => ({
            Type: entity.type,
            Handle: entity.handle || '',
            Color: entity.color || '',
            Layer: entity.layer || '',
            'Text Content': entity.text_content || '',
            'Block Name': entity.geometry?.block_name || ''
        }));
        
        const csv = DXFUtils.createCSV(csvData);
        const filename = DXFUtils.createSafeFilename(this.currentLayer.layer_info?.name || 'layer') + '.csv';
        DXFUtils.downloadFile(filename, csv, 'text/csv');
        
        this.showNotification(`CSV exported as ${filename}`, 'success');
    }

    exportAsExcel() {
        if (!this.currentLayer) {
            this.showNotification('Please select a layer first', 'warning');
            return;
        }
        
        const entities = this.currentLayer.entities || [];
        if (entities.length === 0) {
            this.showNotification('No entities to export', 'warning');
            return;
        }
        
        try {
            // Prepare worksheet data
            const wsData = [
                ['Type', 'Handle', 'Color', 'Layer', 'Text Content', 'Block Name'],
                ...entities.map(entity => [
                    entity.type,
                    entity.handle || '',
                    entity.color || '',
                    entity.layer || '',
                    entity.text_content || '',
                    entity.geometry?.block_name || ''
                ])
            ];
            
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Entities');
            
            const filename = DXFUtils.createSafeFilename(this.currentLayer.layer_info?.name || 'layer') + '.xlsx';
            XLSX.writeFile(wb, filename);
            
            this.showNotification(`Excel file exported as ${filename}`, 'success');
        } catch (error) {
            this.showNotification(`Failed to export Excel: ${error.message}`, 'error');
        }
    }

    exportAsImage() {
        if (!this.geometryRenderer) {
            this.showNotification('Geometry renderer not available', 'error');
            return;
        }
        
        const filename = DXFUtils.createSafeFilename(this.currentLayer?.layer_info?.name || 'geometry') + '.png';
        this.geometryRenderer.exportAsImage(filename);
        this.showNotification(`Image exported as ${filename}`, 'success');
    }

    exportAsPDF() {
        this.showNotification('PDF export not implemented yet', 'info');
        // PDF export would require additional libraries like jsPDF
    }

    handleKeyboardShortcuts(event) {
        // Ctrl+E to export
        if (event.ctrlKey && event.key === 'e') {
            event.preventDefault();
            this.exportCurrentLayer();
        }
        
        // Ctrl+F to focus search
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
            document.querySelector('.search-input').focus();
        }
        
        // Escape to clear search
        if (event.key === 'Escape') {
            const searchInput = document.querySelector('.search-input');
            if (document.activeElement === searchInput) {
                searchInput.value = '';
                this.searchData('');
            }
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                          type === 'error' ? 'times-circle' : 
                          type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            ${message}
        `;
        
        // Add to container
        const container = document.querySelector('.container');
        container.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // Add CSS for notification if not already present
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 1000;
                    animation: slideIn 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    max-width: 400px;
                }
                .notification-success { background: #10b981; }
                .notification-error { background: #ef4444; }
                .notification-warning { background: #f59e0b; }
                .notification-info { background: #3b82f6; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}