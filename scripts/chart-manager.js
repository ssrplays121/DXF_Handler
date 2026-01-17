// scripts/chart-manager.js
class ChartManager {
    constructor() {
        this.charts = new Map();
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            family: "'Inter', sans-serif",
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: {
                        family: "'Inter', sans-serif",
                        size: 12
                    },
                    bodyFont: {
                        family: "'Inter', sans-serif",
                        size: 12
                    },
                    padding: 10,
                    cornerRadius: 6
                }
            },
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            }
        };
    }

    createChart(canvasId, type, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            console.error(`Canvas with id "${canvasId}" not found`);
            return null;
        }

        // Destroy existing chart if it exists
        this.destroyChart(canvasId);

        const mergedOptions = this.mergeOptions(type, options);
        const chart = new Chart(ctx, {
            type,
            data,
            options: mergedOptions
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    createEntityDistributionChart(canvasId, entityStats) {
        const labels = Object.keys(entityStats);
        const data = Object.values(entityStats).map(s => s.count);
        const colors = DXFUtils.generateColors(labels.length, 0.8);

        return this.createChart(canvasId, 'pie', {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 1,
                hoverOffset: 15
            }]
        }, {
            plugins: {
                title: {
                    display: true,
                    text: 'Entity Type Distribution',
                    font: {
                        size: 16,
                        weight: '600'
                    }
                }
            }
        });
    }

    createBarChart(canvasId, entityStats, title = 'Entity Statistics') {
        const labels = Object.keys(entityStats);
        const data = Object.values(entityStats).map(s => s.count);
        const colors = DXFUtils.generateColors(labels.length, 0.7);

        return this.createChart(canvasId, 'bar', {
            labels,
            datasets: [{
                label: 'Count',
                data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.7', '1')),
                borderWidth: 1,
                borderRadius: 4
            }]
        }, {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count',
                        font: {
                            weight: '600'
                        }
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Entity Type',
                        font: {
                            weight: '600'
                        }
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16,
                        weight: '600'
                    }
                }
            }
        });
    }

    createStackedBarChart(canvasId, dataByLayer, entityTypes) {
        const layers = Object.keys(dataByLayer);
        const colors = DXFUtils.generateColors(entityTypes.length, 0.7);

        const datasets = entityTypes.map((type, index) => ({
            label: type,
            data: layers.map(layer => dataByLayer[layer][type] || 0),
            backgroundColor: colors[index],
            borderColor: colors[index].replace('0.7', '1'),
            borderWidth: 1
        }));

        return this.createChart(canvasId, 'bar', {
            labels: layers,
            datasets
        }, {
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Layers'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Entity Count'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Entity Distribution by Layer',
                    font: {
                        size: 16,
                        weight: '600'
                    }
                }
            }
        });
    }

    createLineChart(canvasId, dataPoints, label = 'Value') {
        const labels = dataPoints.map((_, i) => `Point ${i + 1}`);
        const data = dataPoints;

        return this.createChart(canvasId, 'line', {
            labels,
            datasets: [{
                label,
                data,
                borderColor: DXFUtils.getEntityColor('LINE'),
                backgroundColor: DXFUtils.getEntityColor('LINE').replace(')', ', 0.1)'),
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        }, {
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: label
                    }
                }
            }
        });
    }

    createRadarChart(canvasId, entityStats) {
        const labels = Object.keys(entityStats);
        const data = Object.values(entityStats).map(s => s.count);

        return this.createChart(canvasId, 'radar', {
            labels,
            datasets: [{
                label: 'Entity Count',
                data,
                backgroundColor: DXFUtils.getEntityColor('LINE').replace(')', ', 0.2)'),
                borderColor: DXFUtils.getEntityColor('LINE'),
                borderWidth: 2,
                pointBackgroundColor: DXFUtils.getEntityColor('LINE')
            }]
        }, {
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        });
    }

    mergeOptions(type, customOptions) {
        const typeSpecificOptions = this.getTypeSpecificOptions(type);
        return {
            ...this.defaultOptions,
            ...typeSpecificOptions,
            ...customOptions
        };
    }

    getTypeSpecificOptions(type) {
        const options = {
            pie: {
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            },
            bar: {
                scales: {
                    y: {
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            },
            line: {
                scales: {
                    y: {
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    }
                }
            }
        };

        return options[type] || {};
    }

    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvasId);
        }
    }

    destroyAllCharts() {
        this.charts.forEach((chart, canvasId) => {
            chart.destroy();
        });
        this.charts.clear();
    }

    resizeChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.resize();
        }
    }

    resizeAllCharts() {
        this.charts.forEach(chart => {
            chart.resize();
        });
    }

    updateChartData(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.data = newData;
            chart.update();
        }
    }

    getChartInstance(canvasId) {
        return this.charts.get(canvasId);
    }

    exportChartAsImage(canvasId, filename = 'chart.png') {
        const chart = this.charts.get(canvasId);
        if (!chart) {
            console.error(`Chart with id "${canvasId}" not found`);
            return;
        }

        const canvas = chart.canvas;
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        link.click();
    }

    getChartData(canvasId) {
        const chart = this.charts.get(canvasId);
        return chart ? chart.data : null;
    }
}