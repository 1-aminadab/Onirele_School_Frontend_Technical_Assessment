import { Navigation } from './navigation.js';
import { DragDrop } from './dragdrop.js';
import { VirtualList } from './virtuallist.js';
import { PerformanceMonitor } from './performance.js';

class App {
    constructor() {
        this.components = new Map();
        this.performanceMonitor = null;
        this.animationObserver = null;
        this.init();
    }
    
    init() {
        this.performanceMonitor = new PerformanceMonitor();
        this.setupAnimations();
        
        // Staggered component initialization for smooth loading
        this.components.set('navigation', new Navigation());
        
        setTimeout(() => {
            this.components.set('dragdrop', new DragDrop());
        }, 100);
        
        setTimeout(() => {
            this.components.set('virtuallist', new VirtualList());
        }, 200);
        
        this.setupPerformanceTracking();
        this.setupErrorHandling();
        this.setupScrollAnimations();
        
        console.log('✨ Modern App initialized successfully');
    }
    
    setupAnimations() {
        // Add entrance animations to feature items
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        this.animationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fadeInUp');
                    this.animationObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        // Observe feature items
        document.querySelectorAll('.feature-item, .metric-item, .instruction-item, .shortcut-item').forEach(item => {
            this.animationObserver.observe(item);
        });
    }
    
    setupScrollAnimations() {
        // Add parallax effect to section backgrounds
        let ticking = false;
        
        const updateParallax = () => {
            const scrolled = window.pageYOffset;
            const sections = document.querySelectorAll('.content-section');
            
            sections.forEach((section, index) => {
                const rate = scrolled * -0.5;
                const yPos = -(rate / (index + 1));
                const transform = `translateY(${yPos}px)`;
                
                if (section.style.transform !== transform) {
                    section.style.transform = transform;
                }
            });
            
            ticking = false;
        };
        
        const requestParallax = () => {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', requestParallax, { passive: true });
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
        
        if (this.animationObserver) {
            this.animationObserver.disconnect();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
