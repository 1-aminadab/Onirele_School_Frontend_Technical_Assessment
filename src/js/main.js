import { Navigation } from './navigation.js';
import { DragDrop } from './dragdrop.js';
import { VirtualList } from './virtuallist.js';
import { PerformanceMonitor } from './performance.js';

class App {
    constructor() {
        this.components = new Map();
        this.performanceMonitor = null;
        this.init();
    }
    
    init() {
        this.performanceMonitor = new PerformanceMonitor();
        
        this.components.set('navigation', new Navigation());
        this.components.set('dragdrop', new DragDrop());
        this.components.set('virtuallist', new VirtualList());
        
        this.setupPerformanceTracking();
        this.setupErrorHandling();
        
        console.log('App initialized successfully');
    }
    
    setupPerformanceTracking() {
        const virtualList = this.components.get('virtuallist');
        if (virtualList && this.performanceMonitor) {
            // Update rendered items count more frequently
            setInterval(() => {
                const stats = virtualList.getStats();
                this.performanceMonitor.updateRenderedItemsCount(stats.renderedItems);
            }, 100);
            
            // Force initial update
            setTimeout(() => {
                const stats = virtualList.getStats();
                this.performanceMonitor.updateRenderedItemsCount(stats.renderedItems);
            }, 500);
        }
    }
    
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }
    
    destroy() {
        this.components.forEach((component, name) => {
            if (component && typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        this.components.clear();
        
        if (this.performanceMonitor) {
            this.performanceMonitor.destroy();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
