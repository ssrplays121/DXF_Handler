// scripts/main.js
// Main entry point for the application

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the DXF Explorer application
    try {
        window.dxfExplorer = new DXFExplorer();
        console.log('DXF Layer Explorer initialized successfully');
        
        // Add global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            if (window.dxfExplorer) {
                window.dxfExplorer.showNotification(`Error: ${event.error.message}`, 'error');
            }
        });
        
        // Add unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            if (window.dxfExplorer) {
                window.dxfExplorer.showNotification(`Promise error: ${event.reason.message}`, 'error');
            }
        });
        
    } catch (error) {
        console.error('Failed to initialize DXF Explorer:', error);
        alert(`Failed to initialize application: ${error.message}`);
    }
});

// Add polyfill for File System Access API if needed
if (!('showDirectoryPicker' in window) && !('webkitdirectory' in HTMLInputElement.prototype)) {
    console.warn('File System Access API not supported, using fallback');
    
    // Add warning to UI
    const warning = document.createElement('div');
    warning.className = 'browser-warning';
    warning.innerHTML = `
        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <strong><i class="fas fa-exclamation-triangle"></i> Browser Compatibility Note:</strong>
            <p>Your browser has limited support for directory selection. For full functionality, please use:</p>
            <ul style="margin: 8px 0 8px 20px;">
                <li>Chrome 86+</li>
                <li>Edge 86+</li>
                <li>Opera 72+</li>
            </ul>
            <p>You can still select individual JSON files using the file picker.</p>
        </div>
    `;
    document.querySelector('.file-loader-content').appendChild(warning);
}