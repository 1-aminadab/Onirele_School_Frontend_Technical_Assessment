export class PerformanceMonitor {
    constructor() {
        this.fpsElement = document.getElementById('fps');
        this.renderedItemsElement = document.getElementById('rendered-items');
        this.memoryUsageElement = document.getElementById('memory-usage');
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.isMonitoring = false;
        
        this.memoryCheckInterval = null;
        this.fpsCheckInterval = null;
        
        this.eventListeners = new Map();
        this.performanceEntries = [];
        this.maxEntries = 1000;
        
        this.init();
    }
    
    init() {
        this.startMonitoring();
        this.setupEventListening();
        this.measureInitialMetrics();
        
        // Show initial values
        this.updateFPSDisplay();
        this.updateMemoryDisplay();
    }
    
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.startFPSMonitoring();
        this.startMemoryMonitoring();
    }
    
    stopMonitoring() {
        this.isMonitoring = false;
        
        if (this.fpsCheckInterval) {
            cancelAnimationFrame(this.fpsCheckInterval);
            this.fpsCheckInterval = null;
        }
        
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }
    }
    
    startFPSMonitoring() {
        const measureFPS = (currentTime) => {
            if (!this.isMonitoring) return;
            
            this.frameCount++;
            const deltaTime = currentTime - this.lastTime;
            
            if (deltaTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / deltaTime);
                this.frameCount = 0;
                this.lastTime = currentTime;
                this.updateFPSDisplay();
            }
            
            this.fpsCheckInterval = requestAnimationFrame(measureFPS);
        };
        
        this.fpsCheckInterval = requestAnimationFrame(measureFPS);
    }
    
    startMemoryMonitoring() {
        if (!performance.memory) {
            console.warn('Performance.memory not available in this browser');
            return;
        }
        
        this.memoryCheckInterval = setInterval(() => {
            if (this.isMonitoring) {
                this.updateMemoryDisplay();
            }
        }, 2000);
    }
    
    updateFPSDisplay() {
        if (this.fpsElement) {
            // Show actual FPS or 60 as default if we can't measure
            const displayFPS = this.fps || 60;
            this.fpsElement.textContent = displayFPS;
            
            if (displayFPS < 30) {
                this.fpsElement.style.color = '#e74c3c';
            } else if (displayFPS < 50) {
                this.fpsElement.style.color = '#f39c12';
            } else {
                this.fpsElement.style.color = '#27ae60';
            }
        }
    }
    
    updateMemoryDisplay() {
        if (this.memoryUsageElement) {
            if (performance.memory) {
                const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                this.memoryUsageElement.textContent = `${memoryMB} MB`;
                
                if (memoryMB > 100) {
                    this.memoryUsageElement.style.color = '#e74c3c';
                } else if (memoryMB > 50) {
                    this.memoryUsageElement.style.color = '#f39c12';
                } else {
                    this.memoryUsageElement.style.color = '#27ae60';
                }
            } else {
                // Fallback when performance.memory is not available
                this.memoryUsageElement.textContent = 'N/A';
                this.memoryUsageElement.style.color = '#666';
            }
        }
    }
    
    updateRenderedItemsCount(count) {
        if (this.renderedItemsElement) {
            this.renderedItemsElement.textContent = count;
        }
    }
    
    measureInitialMetrics() {
        if ('PerformanceObserver' in window) {
            this.setupPerformanceObserver();
        }
        
        this.measureDOMComplexity();
        this.measurePageLoadMetrics();
    }
    
    setupPerformanceObserver() {
        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    this.recordPerformanceEntry(entry);
                });
            });
            
            observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
        } catch (error) {
            console.warn('PerformanceObserver not fully supported:', error);
        }
    }
    
    recordPerformanceEntry(entry) {
        if (this.performanceEntries.length >= this.maxEntries) {
            this.performanceEntries.shift();
        }
        
        this.performanceEntries.push({
            name: entry.name,
            type: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            timestamp: Date.now()
        });
    }
    
    measureDOMComplexity() {
        const metrics = {
            totalElements: document.querySelectorAll('*').length,
            scriptsCount: document.querySelectorAll('script').length,
            stylesheetsCount: document.querySelectorAll('link[rel="stylesheet"]').length,
            imagesCount: document.querySelectorAll('img').length,
            inputsCount: document.querySelectorAll('input, textarea, select').length
        };
        
        console.log('DOM Complexity Metrics:', metrics);
        return metrics;
    }
    
    measurePageLoadMetrics() {
        if (performance.navigation && performance.timing) {
            const timing = performance.timing;
            const metrics = {
                domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                windowLoad: timing.loadEventEnd - timing.navigationStart,
                domComplete: timing.domComplete - timing.navigationStart,
                firstPaint: this.getFirstPaintTime(),
                firstContentfulPaint: this.getFirstContentfulPaintTime()
            };
            
            console.log('Page Load Metrics:', metrics);
            return metrics;
        }
    }
    
    getFirstPaintTime() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }
    
    getFirstContentfulPaintTime() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return firstContentfulPaint ? firstContentfulPaint.startTime : null;
    }
    
    measureUserTiming(name, fn) {
        const startMark = `${name}-start`;
        const endMark = `${name}-end`;
        const measureName = `${name}-duration`;
        
        performance.mark(startMark);
        
        const result = fn();
        
        if (result instanceof Promise) {
            return result.finally(() => {
                performance.mark(endMark);
                performance.measure(measureName, startMark, endMark);
            });
        } else {
            performance.mark(endMark);
            performance.measure(measureName, startMark, endMark);
            return result;
        }
    }
    
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }
    
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    optimizeEventListener(element, event, handler, options = {}) {
        const optimizedHandler = this.throttle(handler, options.throttle || 16);
        const finalOptions = {
            passive: true,
            ...options,
            signal: options.signal
        };
        
        element.addEventListener(event, optimizedHandler, finalOptions);
        
        const listenerInfo = {
            element,
            event,
            handler: optimizedHandler,
            options: finalOptions
        };
        
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        this.eventListeners.get(element).push(listenerInfo);
        
        return () => {
            element.removeEventListener(event, optimizedHandler, finalOptions);
            const listeners = this.eventListeners.get(element);
            if (listeners) {
                const index = listeners.indexOf(listenerInfo);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }
    
    setupEventListening() {
        const criticalEvents = ['scroll', 'resize', 'mousemove', 'touchmove'];
        
        criticalEvents.forEach(eventType => {
            let eventCount = 0;
            let lastLogTime = Date.now();
            
            document.addEventListener(eventType, () => {
                eventCount++;
                const now = Date.now();
                
                if (now - lastLogTime > 1000) {
                    const eventsPerSecond = eventCount;
                    eventCount = 0;
                    lastLogTime = now;
                    
                    if (eventsPerSecond > 100) {
                        console.warn(`High frequency ${eventType} events: ${eventsPerSecond}/sec`);
                    }
                }
            }, { passive: true });
        });
    }
    
    getPerformanceReport() {
        const report = {
            currentFPS: this.fps,
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null,
            performanceEntries: this.performanceEntries.slice(-10),
            domMetrics: this.measureDOMComplexity(),
            eventListenerCount: Array.from(this.eventListeners.values()).reduce((total, listeners) => total + listeners.length, 0)
        };
        
        return report;
    }
    
    logPerformanceReport() {
        const report = this.getPerformanceReport();
        console.group('Performance Report');
        console.table(report);
        console.groupEnd();
        return report;
    }
    
    destroy() {
        this.stopMonitoring();
        
        this.eventListeners.forEach((listeners, element) => {
            listeners.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
        });
        this.eventListeners.clear();
        
        this.performanceEntries = [];
    }
}