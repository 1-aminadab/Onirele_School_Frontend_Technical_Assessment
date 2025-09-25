export class VirtualList {
    constructor() {
        this.container = document.getElementById('virtual-list-container');
        this.listElement = document.getElementById('virtual-list');
        this.itemCountElement = document.getElementById('item-count');
        this.visibleItemsElement = document.getElementById('visible-items');
        this.filteredCountElement = document.getElementById('filtered-count');
        this.scrollPositionElement = document.getElementById('scroll-position');
        this.performanceIndicator = document.getElementById('performance-indicator');
        this.renderTimeElement = document.getElementById('render-time');
        this.scrollSpeedElement = document.getElementById('scroll-speed');
        this.itemsPerSecondElement = document.getElementById('items-per-second');
        
        // Control elements
        this.add100Button = document.getElementById('add-100-items');
        this.add1000Button = document.getElementById('add-1000-items');
        this.add10000Button = document.getElementById('add-10000-items');
        this.add100000Button = document.getElementById('add-100000-items');
        this.clearButton = document.getElementById('clear-items');
        this.exportButton = document.getElementById('export-items');
        this.searchInput = document.getElementById('search-input');
        this.searchClear = document.getElementById('search-clear');
        this.viewModeSelect = document.getElementById('view-mode');
        this.virtualToggle = document.getElementById('virtual-toggle');
        
        // Debug: Check if elements are found
        console.log('Performance elements found:', {
            renderTime: !!this.renderTimeElement,
            scrollSpeed: !!this.scrollSpeedElement,
            itemsPerSecond: !!this.itemsPerSecondElement,
            visibleItems: !!this.visibleItemsElement
        });
        
        // Data and state
        this.data = [];
        this.filteredData = [];
        this.selectedItems = new Set();
        this.searchTerm = '';
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.viewMode = 'list';
        
        // Virtual scrolling configuration
        this.itemHeight = 60; // Increased for new layout
        this.containerHeight = 450;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollTop = 0;
        this.totalHeight = 0;
        this.virtualEnabled = false; // Can be toggled, defaults to show all items
        
        // Performance tracking
        this.lastScrollTime = performance.now();
        this.lastScrollTop = 0;
        this.renderStartTime = 0;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.itemsRenderedPerSecond = 0;
        
        this.renderedItems = new Map();
        this.itemPool = [];
        this.abortController = new AbortController();
        
        if (!this.container || !this.listElement) {
            console.error('Virtual List elements not found');
            return;
        }
        
        this.init();
    }
    
    init() {
        this.setupContainer();
        this.setupEventListeners();
        this.setupKeyboardNavigation();
        this.syncToggleState(); // Ensure checkbox matches virtualEnabled state
        this.initializePerformanceDisplay(); // Initialize performance metrics display
        this.startPerformanceUpdates(); // Start continuous performance metric updates
        this.render();
    }
    
    startPerformanceUpdates() {
        // Update performance metrics regularly
        setInterval(() => {
            this.updatePerformanceMetrics();
            this.updateStats();
        }, 100);
    }
    
    setupContainer() {
        this.container.style.position = 'relative';
        
        if (this.virtualEnabled) {
            // Virtual mode: fixed height with scroll
            this.container.style.height = `${this.containerHeight}px`;
            this.container.style.overflow = 'auto';
            this.container.style.maxHeight = `${this.containerHeight}px`;
            this.listElement.style.height = `${this.totalHeight}px`;
        } else {
            // Non-virtual mode: fixed height with internal scroll
            this.container.style.height = `${this.containerHeight}px`;
            this.container.style.overflow = 'auto';
            this.container.style.maxHeight = `${this.containerHeight}px`;
            this.listElement.style.height = 'auto';
        }
        
        this.listElement.style.position = 'relative';
    }
    
    setupEventListeners() {
        // Add item buttons
        this.add100Button?.addEventListener('click', () => {
            this.addItems(100);
        }, { signal: this.abortController.signal });
        
        this.add1000Button?.addEventListener('click', () => {
            this.addItems(1000);
        }, { signal: this.abortController.signal });
        
        this.add10000Button?.addEventListener('click', () => {
            this.addItems(10000);
        }, { signal: this.abortController.signal });
        
        this.add100000Button?.addEventListener('click', () => {
            this.addItems(100000);
        }, { signal: this.abortController.signal });
        
        // Control buttons
        this.clearButton?.addEventListener('click', () => {
            this.clearItems();
        }, { signal: this.abortController.signal });
        
        this.exportButton?.addEventListener('click', () => {
            this.exportData();
        }, { signal: this.abortController.signal });
        
        // Search functionality
        this.searchInput?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        }, { signal: this.abortController.signal });
        
        this.searchClear?.addEventListener('click', () => {
            this.clearSearch();
        }, { signal: this.abortController.signal });
        
        // View mode selection
        this.viewModeSelect?.addEventListener('change', (e) => {
            this.changeViewMode(e.target.value);
        }, { signal: this.abortController.signal });
        
        // Virtual scrolling toggle
        this.virtualToggle?.addEventListener('change', (e) => {
            this.toggleVirtualScrolling(e.target.checked);
        }, { signal: this.abortController.signal });
        
        // Sorting
        this.setupSorting();
        
        // Scrolling (only for virtual mode)
        this.container.addEventListener('scroll', () => {
            if (this.virtualEnabled) {
                this.handleScroll();
            }
        }, { passive: true, signal: this.abortController.signal });
        
        // Resize handling
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        }, { signal: this.abortController.signal });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeyboard(e);
        }, { signal: this.abortController.signal });
    }
    
    setupKeyboardNavigation() {
        this.listElement.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        }, { signal: this.abortController.signal });
        
        this.listElement.addEventListener('focus', () => {
            if (this.data.length > 0 && !this.listElement.querySelector('.virtual-item.focused')) {
                this.focusItem(0);
            }
        }, { signal: this.abortController.signal });
    }
    
    handleKeyNavigation(e) {
        const focusedItem = this.listElement.querySelector('.virtual-item.focused');
        if (!focusedItem) return;
        
        const currentIndex = parseInt(focusedItem.dataset.index);
        let nextIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                nextIndex = Math.min(currentIndex + 1, this.data.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                nextIndex = Math.max(currentIndex - 1, 0);
                break;
            case 'Home':
                e.preventDefault();
                nextIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                nextIndex = this.data.length - 1;
                break;
            case 'PageDown':
                e.preventDefault();
                const itemsPerPage = Math.floor(this.containerHeight / this.itemHeight);
                nextIndex = Math.min(currentIndex + itemsPerPage, this.data.length - 1);
                break;
            case 'PageUp':
                e.preventDefault();
                const itemsPerPageUp = Math.floor(this.containerHeight / this.itemHeight);
                nextIndex = Math.max(currentIndex - itemsPerPageUp, 0);
                break;
        }
        
        if (nextIndex !== currentIndex) {
            this.focusItem(nextIndex);
            this.scrollToItem(nextIndex);
        }
    }
    
    focusItem(index) {
        this.listElement.querySelectorAll('.virtual-item.focused').forEach(item => {
            item.classList.remove('focused');
        });
        
        const item = this.listElement.querySelector(`[data-index="${index}"]`);
        if (item) {
            item.classList.add('focused');
            item.setAttribute('aria-selected', 'true');
        }
    }
    
    scrollToItem(index) {
        const itemTop = index * this.itemHeight;
        const itemBottom = itemTop + this.itemHeight;
        const scrollTop = this.container.scrollTop;
        const scrollBottom = scrollTop + this.containerHeight;
        
        if (itemTop < scrollTop) {
            this.container.scrollTop = itemTop;
        } else if (itemBottom > scrollBottom) {
            this.container.scrollTop = itemBottom - this.containerHeight;
        }
    }
    
    addItems(count) {
        const startIndex = this.data.length;
        const categories = ['urgent', 'normal', 'low'];
        const names = [
            'Review Code', 'Fix Bug', 'Update Docs', 'Team Meeting', 'Deploy App',
            'Write Tests', 'Refactor Code', 'Security Audit', 'Performance Review',
            'Database Optimization', 'UI Enhancement', 'API Development'
        ];
        
        console.log(`Adding ${count} items...`);
        this.renderStartTime = performance.now();
        
        for (let i = 0; i < count; i++) {
            const index = startIndex + i;
            const category = categories[i % categories.length];
            const name = names[i % names.length];
            
            this.data.push({
                id: index + 1,
                name: `${name} #${index + 1}`,
                category: category,
                value: Math.floor(Math.random() * 10000),
                date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                selected: false
            });
        }
        
        this.applyFilters();
        this.updateTotalHeight();
        this.updateStats();
        this.render();
        
        const renderTime = performance.now() - this.renderStartTime;
        console.log(`Added ${count} items in ${renderTime.toFixed(2)}ms`);
        
        // Force immediate performance metrics update
        this.updatePerformanceMetrics();
        
        this.announceToScreenReader(`Added ${count} items. Total: ${this.data.length} items.`);
    }
    
    clearItems() {
        this.data = [];
        this.renderedItems.clear();
        this.returnAllItemsToPool();
        this.updateTotalHeight();
        this.updateItemCount();
        this.render();
        
        this.announceToScreenReader('All items cleared.');
    }
    
    updateTotalHeight() {
        this.totalHeight = this.filteredData.length * this.itemHeight;
        this.listElement.style.height = `${this.totalHeight}px`;
    }
    
    updateItemCount() {
        if (this.itemCountElement) {
            this.itemCountElement.textContent = `${this.data.length} items`;
        }
    }
    
    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        
        requestAnimationFrame(() => {
            this.render();
        });
    }
    
    handleResize() {
        const containerRect = this.container.getBoundingClientRect();
        this.containerHeight = containerRect.height;
        this.render();
    }
    
    getVisibleRange() {
        const buffer = Math.ceil(this.containerHeight / this.itemHeight);
        
        const start = Math.floor(this.scrollTop / this.itemHeight);
        const end = Math.min(
            start + Math.ceil(this.containerHeight / this.itemHeight) + buffer,
            this.filteredData.length
        );
        
        return {
            start: Math.max(0, start - buffer),
            end: end
        };
    }
    
    handleSearch(searchTerm) {
        this.searchTerm = searchTerm;
        this.applyFilters();
        this.updateTotalHeight();
        this.updateStats();
        this.render();
        
        // Reset scroll position to top
        this.container.scrollTop = 0;
        this.scrollTop = 0;
    }
    
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        this.handleSearch('');
    }
    
    changeViewMode(mode) {
        this.viewMode = mode;
        this.listElement.className = `virtual-list view-${mode}`;
        
        // Adjust item height based on view mode
        switch (mode) {
            case 'compact':
                this.itemHeight = 40;
                break;
            case 'card':
                this.itemHeight = 120;
                break;
            default:
                this.itemHeight = 60;
        }
        
        this.updateTotalHeight();
        this.render();
    }
    
    toggleVirtualScrolling(enabled) {
        this.virtualEnabled = enabled;
        
        if (enabled) {
            // Enable virtual scrolling: fixed container height with calculated list height
            this.container.style.height = `${this.containerHeight}px`;
            this.container.style.overflow = 'auto';
            this.container.style.maxHeight = `${this.containerHeight}px`;
            this.listElement.style.height = `${this.totalHeight}px`;
        } else {
            // Disable virtual scrolling: fixed container height with auto list height (scrolls internally)
            this.container.style.height = `${this.containerHeight}px`;
            this.container.style.overflow = 'auto';
            this.container.style.maxHeight = `${this.containerHeight}px`;
            this.listElement.style.height = 'auto';
        }
        
        this.render();
        this.announceToScreenReader(`Virtual scrolling ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    setupSorting() {
        const sortColumns = document.querySelectorAll('.sort-column');
        sortColumns.forEach(column => {
            column.addEventListener('click', () => {
                const sortBy = column.dataset.sort;
                this.handleSort(sortBy);
            });
        });
    }
    
    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Update UI indicators
        document.querySelectorAll('.sort-column').forEach(col => {
            col.classList.remove('sort-asc', 'sort-desc');
        });
        
        const currentColumn = document.querySelector(`[data-sort="${column}"]`);
        if (currentColumn) {
            currentColumn.classList.add(`sort-${this.sortDirection}`);
        }
        
        this.applyFilters();
        this.render();
    }
    
    exportData() {
        const dataToExport = this.data.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            value: item.value,
            date: item.date
        }));
        
        const jsonData = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `virtual-list-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.announceToScreenReader(`Exported ${this.data.length} items to JSON file`);
    }
    
    handleGlobalKeyboard(e) {
        // Handle global keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'f':
                    e.preventDefault();
                    if (this.searchInput) {
                        this.searchInput.focus();
                        this.searchInput.select();
                    }
                    break;
                case 'a':
                    if (e.target.closest('#virtual-list')) {
                        e.preventDefault();
                        this.selectAllVisible();
                    }
                    break;
            }
        }
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (e.target.closest('#virtual-list') && this.selectedItems.size > 0) {
                e.preventDefault();
                this.deleteSelectedItems();
            }
        }
    }
    
    selectAllVisible() {
        this.filteredData.forEach((item, index) => {
            if (index >= this.visibleStart && index < this.visibleEnd) {
                item.selected = true;
                this.selectedItems.add(item.id);
            }
        });
        this.render();
        this.announceToScreenReader(`Selected ${this.visibleEnd - this.visibleStart} visible items`);
    }
    
    deleteSelectedItems() {
        if (this.selectedItems.size === 0) return;
        
        if (confirm(`Delete ${this.selectedItems.size} selected items?`)) {
            this.data = this.data.filter(item => !this.selectedItems.has(item.id));
            this.selectedItems.clear();
            this.applyFilters();
            this.updateTotalHeight();
            this.updateStats();
            this.render();
            this.announceToScreenReader('Selected items deleted');
        }
    }
    
    render() {
        this.renderStartTime = performance.now();
        
        if (this.filteredData.length === 0) {
            this.listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div>No items to display</div>
                    ${this.data.length > 0 ? '<div>Try adjusting your search criteria</div>' : '<div>Click a button above to add items</div>'}
                </div>
            `;
            this.updatePerformanceMetrics();
            this.updateStats();
            return;
        }
        
        if (this.virtualEnabled) {
            this.renderVirtual();
        } else {
            this.renderAll();
        }
        
        this.updatePerformanceMetrics();
        this.updateStats();
    }
    
    renderVirtual() {
        const { start, end } = this.getVisibleRange();
        
        // Clear existing items that are no longer visible
        this.returnItemsToPool(start, end);
        
        // Render visible items
        for (let i = start; i < end; i++) {
            if (i < this.filteredData.length && !this.renderedItems.has(i)) {
                const element = this.createItemElement(this.filteredData[i], i);
                this.renderedItems.set(i, element);
                this.listElement.appendChild(element);
            }
        }
        
        this.visibleStart = start;
        this.visibleEnd = end;
    }
    
    renderAll() {
        // Clear all existing items
        this.listElement.innerHTML = '';
        this.renderedItems.clear();
        
        // Use document fragment for better performance when rendering many items
        const fragment = document.createDocumentFragment();
        
        // Render ALL items with optimizations
        this.filteredData.forEach((item, index) => {
            const element = this.createItemElement(item, index);
            element.style.position = 'relative'; // Remove absolute positioning
            element.style.top = 'auto';
            element.style.height = `${this.itemHeight}px`;
            fragment.appendChild(element);
        });
        
        // Append all items at once for better performance
        this.listElement.appendChild(fragment);
        
        this.visibleStart = 0;
        this.visibleEnd = this.filteredData.length;
        
        // Container maintains fixed height, list content scrolls internally
    }
    
    applyFilters() {
        this.filteredData = this.data.filter(item => {
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                return item.name.toLowerCase().includes(searchLower) ||
                       item.category.toLowerCase().includes(searchLower) ||
                       item.id.toString().includes(searchLower);
            }
            return true;
        });
        
        // Apply sorting
        if (this.sortColumn) {
            this.filteredData.sort((a, b) => {
                let aVal = a[this.sortColumn];
                let bVal = b[this.sortColumn];
                
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                
                if (this.sortDirection === 'asc') {
                    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                } else {
                    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
                }
            });
        }
    }
    
    updateStats() {
        if (this.itemCountElement) {
            this.itemCountElement.textContent = this.data.length;
        }
        if (this.visibleItemsElement) {
            const visibleCount = this.virtualEnabled ? (this.visibleEnd - this.visibleStart) : this.filteredData.length;
            this.visibleItemsElement.textContent = visibleCount;
        }
        if (this.filteredCountElement) {
            this.filteredCountElement.textContent = this.filteredData.length;
        }
    }
    
    updatePerformanceMetrics() {
        const renderTime = performance.now() - this.renderStartTime;
        
        if (this.renderTimeElement) {
            this.renderTimeElement.textContent = `${renderTime.toFixed(1)} ms`;
        }
        
        // Calculate scroll speed (only when scrolling)
        const now = performance.now();
        const timeDelta = now - this.lastScrollTime;
        const scrollDelta = Math.abs(this.scrollTop - this.lastScrollTop);
        
        if (timeDelta > 0 && this.scrollSpeedElement) {
            if (scrollDelta > 0) {
                const scrollSpeed = (scrollDelta / timeDelta) * 1000;
                if (!isNaN(scrollSpeed) && isFinite(scrollSpeed)) {
                    this.scrollSpeedElement.textContent = `${Math.round(scrollSpeed)} px/s`;
                }
            } else {
                // No scrolling, show 0
                this.scrollSpeedElement.textContent = '0 px/s';
            }
        }
        
        this.lastScrollTime = now;
        this.lastScrollTop = this.scrollTop;
        
        // Calculate items rendered per second
        const itemsRendered = this.virtualEnabled ? (this.visibleEnd - this.visibleStart) : this.filteredData.length;
        if (renderTime > 0) {
            this.itemsRenderedPerSecond = Math.round((itemsRendered / renderTime) * 1000);
            if (this.itemsPerSecondElement) {
                this.itemsPerSecondElement.textContent = this.itemsRenderedPerSecond.toString();
            }
        }
        
        // Update scroll position
        if (this.scrollPositionElement) {
            const maxScroll = this.totalHeight - this.containerHeight;
            const percentage = maxScroll > 0 ? (this.scrollTop / maxScroll * 100).toFixed(0) : 0;
            this.scrollPositionElement.textContent = `Scroll: ${percentage}%`;
        }
    }
    
    createItemElement(item, index) {
        let element = this.itemPool.pop();
        
        if (!element) {
            element = document.createElement('div');
            element.className = 'virtual-item';
            element.setAttribute('role', 'option');
            element.setAttribute('tabindex', '-1');
        }
        
        element.dataset.index = index;
        element.dataset.id = item.id;
        
        element.innerHTML = `
            <div class="item-id">${item.id}</div>
            <div class="item-name">${this.highlightSearch(item.name)}</div>
            <div class="item-category ${item.category}">${item.category}</div>
            <div class="item-value">$${item.value.toLocaleString()}</div>
            <div class="item-date">${item.date}</div>
            <div class="item-actions">
                <button class="item-action-btn" title="Edit item" aria-label="Edit ${item.name}">✏</button>
                <button class="item-action-btn" title="Delete item" aria-label="Delete ${item.name}">🗑</button>
            </div>
        `;
        
        // Set positioning based on virtual scrolling mode
        if (this.virtualEnabled) {
            element.style.position = 'absolute';
            element.style.top = `${index * this.itemHeight}px`;
            element.style.width = '100%';
            element.style.left = '0';
            element.style.zIndex = '1';
        } else {
            element.style.position = 'relative';
            element.style.top = 'auto';
        }
        
        element.style.height = `${this.itemHeight}px`;
        
        if (item.selected) {
            element.classList.add('selected');
        } else {
            element.classList.remove('selected');
        }
        
        element.setAttribute('aria-label', `${item.name}, ${item.category} priority, value $${item.value}`);
        element.setAttribute('aria-setsize', this.filteredData.length);
        element.setAttribute('aria-posinset', index + 1);
        
        // Event listeners (use event delegation for better performance when rendering all items)
        element.addEventListener('click', (e) => {
            if (!e.target.closest('.item-action-btn')) {
                this.toggleItemSelection(index);
                this.focusItem(index);
            }
        });
        
        // Action button events
        const editBtn = element.querySelector('.item-action-btn[title="Edit item"]');
        const deleteBtn = element.querySelector('.item-action-btn[title="Delete item"]');
        
        editBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editItem(item.id);
        });
        
        deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteItem(item.id);
        });
        
        return element;
    }
    
    highlightSearch(text) {
        if (!this.searchTerm) return text;
        const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }
    
    toggleItemSelection(index) {
        const item = this.filteredData[index];
        if (!item) return;
        
        item.selected = !item.selected;
        
        if (item.selected) {
            this.selectedItems.add(item.id);
        } else {
            this.selectedItems.delete(item.id);
        }
        
        // Re-render the specific item
        const element = this.renderedItems.get(index);
        if (element) {
            if (item.selected) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        }
    }
    
    editItem(itemId) {
        const item = this.data.find(i => i.id === itemId);
        if (item) {
            const newName = prompt('Enter new name:', item.name);
            if (newName && newName.trim()) {
                item.name = newName.trim();
                this.applyFilters();
                this.render();
                this.announceToScreenReader(`Item renamed to ${item.name}`);
            }
        }
    }
    
    deleteItem(itemId) {
        if (confirm('Are you sure you want to delete this item?')) {
            const index = this.data.findIndex(i => i.id === itemId);
            if (index > -1) {
                const item = this.data[index];
                this.data.splice(index, 1);
                this.selectedItems.delete(itemId);
                this.applyFilters();
                this.updateTotalHeight();
                this.updateStats();
                this.render();
                this.announceToScreenReader(`Deleted ${item.name}`);
            }
        }
    }
    
    returnItemsToPool(visibleStart, visibleEnd) {
        const itemsToRemove = [];
        
        this.renderedItems.forEach((element, index) => {
            if (index < visibleStart || index >= visibleEnd) {
                itemsToRemove.push(index);
            }
        });
        
        itemsToRemove.forEach(index => {
            const element = this.renderedItems.get(index);
            this.renderedItems.delete(index);
            this.returnItemToPool(element);
        });
    }
    
    returnItemToPool(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
            element.classList.remove('focused');
            element.removeAttribute('aria-selected');
            this.itemPool.push(element);
        }
    }
    
    returnAllItemsToPool() {
        this.renderedItems.forEach((element) => {
            this.returnItemToPool(element);
        });
        this.renderedItems.clear();
    }
    
    syncToggleState() {
        // Ensure the checkbox reflects the current virtualEnabled state
        if (this.virtualToggle) {
            this.virtualToggle.checked = this.virtualEnabled;
        }
    }

    initializePerformanceDisplay() {
        // Initialize performance metrics with default values
        if (this.renderTimeElement) {
            this.renderTimeElement.textContent = '0.0 ms';
        }
        if (this.scrollSpeedElement) {
            this.scrollSpeedElement.textContent = '0 px/s';
        }
        if (this.itemsPerSecondElement) {
            this.itemsPerSecondElement.textContent = '0';
        }
        if (this.visibleItemsElement) {
            this.visibleItemsElement.textContent = '0';
        }
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.textContent = message;
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }
    
    getStats() {
        const renderedCount = this.virtualEnabled ? this.renderedItems.size : this.filteredData.length;
        return {
            totalItems: this.data.length,
            renderedItems: renderedCount,
            pooledItems: this.itemPool.length,
            visibleRange: { start: this.visibleStart, end: this.visibleEnd },
            virtualEnabled: this.virtualEnabled,
            filteredItems: this.filteredData.length,
            itemsPerSecond: this.itemsRenderedPerSecond
        };
    }
    
    destroy() {
        this.abortController.abort();
        this.returnAllItemsToPool();
        this.data = [];
    }
}