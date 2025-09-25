export class DragDrop {
    constructor() {
        // DOM elements
        this.dragContainer = document.getElementById('drag-container');
        this.dragZone = document.getElementById('drag-zone');
        this.droppedItems = document.getElementById('dropped-items');
        this.sourceList = document.querySelector('.draggable-items');
        
        // State management
        this.items = new Map(); // Master item registry
        this.currentDragItem = null;
        this.dragPreview = null;
        this.isDragging = false;
        this.touchStartPos = { x: 0, y: 0 };
        this.dragStartTime = 0;
        this.abortController = new AbortController();
        
        // Configuration
        this.config = {
            animationDuration: 300,
            snapBackDuration: 200,
            dragThreshold: 5,
            touchHoldDelay: 150,
            enableSorting: true,
            enableCategories: true,
            persistState: true,
            maxDroppedItems: 20
        };
        
        // Validation
        if (!this.dragContainer || !this.dragZone || !this.droppedItems || !this.sourceList) {
            console.error('Required drag & drop elements not found');
            return;
        }
        
        this.init();
    }
    
    init() {
        this.initializeItems();
        this.loadPersistedState();
        this.setupEventListeners();
        this.createControlPanel();
        this.render();
    }

    initializeItems() {
        // Initialize items from DOM
        const sourceItems = this.sourceList.querySelectorAll('.draggable-item');
        sourceItems.forEach((element, index) => {
            const id = element.dataset.item || `item-${index}`;
            const itemData = {
                id,
                text: element.textContent.trim(),
                category: element.dataset.category || 'default',
                originalIndex: index,
                state: 'source', // 'source', 'dropped', 'removed'
                timestamp: Date.now(),
                element: element
            };
            this.items.set(id, itemData);
        });
    }

    loadPersistedState() {
        if (!this.config.persistState) return;
        
        try {
            const saved = localStorage.getItem('dragdrop-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.restoreState(state);
            }
        } catch (error) {
            console.warn('Failed to load persisted state:', error);
        }
    }

    saveState() {
        if (!this.config.persistState) return;
        
        const state = {
            items: Array.from(this.items.entries()).map(([id, item]) => ({
                id: item.id,
                state: item.state,
                droppedPosition: item.droppedPosition || null,
                timestamp: item.timestamp
            })),
            // No history tracking
        };
        
        localStorage.setItem('dragdrop-state', JSON.stringify(state));
    }

    createControlPanel() {
        const controlPanel = document.createElement('div');
        controlPanel.className = 'drag-control-panel';
        controlPanel.innerHTML = `
            <button id="clear-all-btn" class="control-btn">
                <span aria-hidden="true">🗑</span> Clear All
            </button>
            <span class="item-counter">
                <span id="dropped-count">0</span> / <span id="max-items">${this.config.maxDroppedItems}</span> items
            </span>
        `;
        
        this.dragContainer.insertBefore(controlPanel, this.dragContainer.firstChild);
        this.setupControlPanelEvents();
    }

    setupControlPanelEvents() {
        document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAll());
    }

    setupEventListeners() {
        // Drag and drop events
        this.sourceList.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.sourceList.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        // Touch events for mobile
        this.sourceList.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Keyboard events
        this.sourceList.addEventListener('keydown', (e) => this.handleKeyboardInteraction(e));
        
        // Drop zone events
        this.setupDropZones();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => this.saveState());
    }

    setupDropZones() {
        // Main drop zone
        this.dragZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dragZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dragZone.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Source list as a drop zone for returning items
        this.sourceList.addEventListener('dragover', (e) => this.handleSourceDragOver(e));
        this.sourceList.addEventListener('drop', (e) => this.handleSourceDrop(e));
    }

    handleDragStart(e) {
        const item = e.target.closest('.draggable-item');
        if (!item || item.getAttribute('aria-disabled') === 'true') {
            e.preventDefault();
            return;
        }

        this.currentDragItem = this.items.get(item.dataset.item);
        this.dragStartTime = Date.now();
        this.isDragging = true;
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.currentDragItem.id);
        e.dataTransfer.setData('application/json', JSON.stringify(this.currentDragItem));
        
        item.classList.add('dragging');
        item.setAttribute('aria-grabbed', 'true');
        
        this.createDragPreview(item);
        this.announceToScreenReader(`Started dragging ${this.currentDragItem.text}`);
        
        // Add visual feedback to valid drop zones
        this.highlightDropZones(true);
    }

    handleDragEnd(e) {
        if (this.currentDragItem) {
            const item = this.currentDragItem.element;
            item.classList.remove('dragging');
            item.setAttribute('aria-grabbed', 'false');
        }
        
        this.highlightDropZones(false);
        this.cleanup();
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!this.dragZone.classList.contains('drag-over')) {
            this.dragZone.classList.add('drag-over');
            this.animateDropZone(this.dragZone);
        }
    }

    handleDragLeave(e) {
        const rect = this.dragZone.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            this.dragZone.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        
        try {
            const itemId = e.dataTransfer.getData('text/plain');
            const item = this.items.get(itemId);
            
            if (item && this.canDropItem(item)) {
                this.dropItem(item);
            }
        } catch (error) {
            console.error('Drop failed:', error);
            this.announceToScreenReader('Drop failed. Please try again.');
        }
        
        this.dragZone.classList.remove('drag-over');
    }

    handleSourceDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.sourceList.classList.add('return-target');
    }

    handleSourceDrop(e) {
        e.preventDefault();
        this.sourceList.classList.remove('return-target');
        
        const itemId = e.dataTransfer.getData('text/plain');
        const item = this.items.get(itemId);
        
        if (item && item.state === 'dropped') {
            this.returnItemToSource(item);
        }
    }

    canDropItem(item) {
        if (!item || item.state !== 'source') return false;
        
        const droppedCount = Array.from(this.items.values())
            .filter(i => i.state === 'dropped').length;
            
        if (droppedCount >= this.config.maxDroppedItems) {
            this.announceToScreenReader(`Maximum ${this.config.maxDroppedItems} items allowed in drop zone`);
            return false;
        }
        
        return true;
    }

    dropItem(item) {
        if (!this.canDropItem(item)) return;
        
        // Update item state
        item.state = 'dropped';
        item.droppedPosition = this.getNextDropPosition();
        item.timestamp = Date.now();
        
        // Create dropped element
        this.createDroppedElement(item);
        
        // Update source element
        this.updateSourceElement(item, true);
        
        this.announceToScreenReader(`${item.text} dropped successfully`);
        this.updateCounter();
        this.saveState();
    }

    createDroppedElement(item) {
        const droppedElement = document.createElement('div');
        droppedElement.className = 'dropped-item';
        droppedElement.dataset.item = item.id;
        droppedElement.setAttribute('tabindex', '0');
        droppedElement.setAttribute('role', 'button');
        droppedElement.setAttribute('aria-label', `${item.text} - click to remove`);
        
        droppedElement.innerHTML = `
            <div class="dropped-item-content">
                <span class="dropped-item-text">${item.text}</span>
                <div class="dropped-item-controls">
                    <button class="remove-btn" aria-label="Remove ${item.text}">
                        <span aria-hidden="true">×</span>
                    </button>
                    <button class="return-btn" aria-label="Return ${item.text} to source">
                        <span aria-hidden="true">↶</span>
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        const removeBtn = droppedElement.querySelector('.remove-btn');
        const returnBtn = droppedElement.querySelector('.return-btn');
        
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.permanentlyRemoveItem(item);
        });
        
        returnBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.returnItemToSource(item);
        });
        
        // Double-click to return
        droppedElement.addEventListener('dblclick', () => {
            this.returnItemToSource(item);
        });
        
        // Keyboard support
        droppedElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.returnItemToSource(item);
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.permanentlyRemoveItem(item);
            }
        });
        
        // Add with animation
        droppedElement.style.opacity = '0';
        droppedElement.style.transform = 'scale(0.8) translateY(-20px)';
        this.droppedItems.appendChild(droppedElement);
        
        requestAnimationFrame(() => {
            droppedElement.style.transition = `all ${this.config.animationDuration}ms ease`;
            droppedElement.style.opacity = '1';
            droppedElement.style.transform = 'scale(1) translateY(0)';
        });
        
        item.droppedElement = droppedElement;
    }

    removeDroppedItem(item) {
        if (item.state !== 'dropped') return;
        
        
        // Animate out
        const droppedElement = item.droppedElement;
        if (droppedElement) {
            droppedElement.style.transition = `all ${this.config.animationDuration}ms ease`;
            droppedElement.style.opacity = '0';
            droppedElement.style.transform = 'scale(0.8) translateX(100px)';
            
            setTimeout(() => {
                if (droppedElement.parentNode) {
                    droppedElement.parentNode.removeChild(droppedElement);
                }
            }, this.config.animationDuration);
        }
        
        // Update state
        item.state = 'source';
        item.droppedPosition = null;
        item.droppedElement = null;
        
        // Restore source element
        this.updateSourceElement(item, false);
        
        this.announceToScreenReader(`${item.text} removed from drop zone`);
        this.updateCounter();
        this.saveState();
    }

    permanentlyRemoveItem(item) {
        if (item.state !== 'dropped') return;
        
        if (!confirm(`Permanently remove "${item.text}"? This cannot be undone.`)) return;
        
        
        // Animate out
        const droppedElement = item.droppedElement;
        if (droppedElement) {
            droppedElement.style.transition = `all ${this.config.animationDuration}ms ease`;
            droppedElement.style.opacity = '0';
            droppedElement.style.transform = 'scale(0.8) translateX(100px)';
            
            setTimeout(() => {
                if (droppedElement.parentNode) {
                    droppedElement.parentNode.removeChild(droppedElement);
                }
            }, this.config.animationDuration);
        }
        
        // Permanently remove from source list
        const sourceElement = item.element;
        if (sourceElement && sourceElement.parentNode) {
            sourceElement.style.transition = `all ${this.config.animationDuration}ms ease`;
            sourceElement.style.opacity = '0';
            sourceElement.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                if (sourceElement.parentNode) {
                    sourceElement.parentNode.removeChild(sourceElement);
                }
            }, this.config.animationDuration);
        }
        
        // Update state to permanently removed
        item.state = 'removed';
        item.droppedPosition = null;
        item.droppedElement = null;
        
        this.announceToScreenReader(`${item.text} permanently removed`);
        this.updateCounter();
        this.saveState();
    }

    returnItemToSource(item) {
        if (item.state !== 'dropped') return;
        
        this.removeDroppedItem(item); // This handles the animation and state update
        
        this.announceToScreenReader(`${item.text} returned to source list`);
    }

    updateSourceElement(item, disable) {
        const element = item.element;
        if (!element) return;
        
        if (disable) {
            element.style.opacity = '0.4';
            element.setAttribute('aria-disabled', 'true');
            element.setAttribute('draggable', 'false');
            element.classList.add('item-disabled');
        } else {
            element.style.opacity = '1';
            element.setAttribute('aria-disabled', 'false');
            element.setAttribute('draggable', 'true');
            element.classList.remove('item-disabled');
        }
    }

    getNextDropPosition() {
        const droppedItems = Array.from(this.items.values())
            .filter(item => item.state === 'dropped')
            .length;
        return droppedItems;
    }

    clearAll() {
        if (!confirm('Clear all dropped items? This action cannot be undone.')) return;
        
        Array.from(this.items.values())
            .filter(item => item.state === 'dropped')
            .forEach(item => this.removeDroppedItem(item));
            
        this.announceToScreenReader('All items cleared from drop zone');
    }

    updateCounter() {
        const droppedCount = Array.from(this.items.values())
            .filter(item => item.state === 'dropped').length;
            
        const counter = document.getElementById('dropped-count');
        if (counter) {
            counter.textContent = droppedCount;
            
            // Visual feedback for approaching limit
            const percentage = (droppedCount / this.config.maxDroppedItems) * 100;
            if (percentage > 80) {
                counter.style.color = '#e74c3c';
            } else if (percentage > 60) {
                counter.style.color = '#f39c12';
            } else {
                counter.style.color = '#27ae60';
            }
        }
    }


    // Touch event handlers
    handleTouchStart(e) {
        const item = e.target.closest('.draggable-item');
        if (!item || item.getAttribute('aria-disabled') === 'true') return;
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.touchStartPos = { x: touch.clientX, y: touch.clientY };
            this.currentDragItem = this.items.get(item.dataset.item);
            this.touchStartTime = Date.now();
            
            // Prevent default to enable touch dragging
            e.preventDefault();
        }
    }

    handleTouchMove(e) {
        if (!this.currentDragItem || e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - this.touchStartPos.y);
        const deltaTime = Date.now() - this.touchStartTime;
        
        if (!this.isDragging && 
            (deltaX > this.config.dragThreshold || deltaY > this.config.dragThreshold) &&
            deltaTime > this.config.touchHoldDelay) {
            
            this.isDragging = true;
            this.currentDragItem.element.classList.add('dragging');
            this.createDragPreview(this.currentDragItem.element);
            this.highlightDropZones(true);
            this.announceToScreenReader(`Started dragging ${this.currentDragItem.text}`);
        }
        
        if (this.isDragging && this.dragPreview) {
            this.dragPreview.style.left = `${touch.clientX - 50}px`;
            this.dragPreview.style.top = `${touch.clientY - 25}px`;
            
            // Check what's under the touch point
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (elementBelow) {
                if (this.dragZone.contains(elementBelow) || elementBelow === this.dragZone) {
                    this.dragZone.classList.add('drag-over');
                    this.sourceList.classList.remove('return-target');
                } else if (this.sourceList.contains(elementBelow) || elementBelow === this.sourceList) {
                    this.sourceList.classList.add('return-target');
                    this.dragZone.classList.remove('drag-over');
                } else {
                    this.dragZone.classList.remove('drag-over');
                    this.sourceList.classList.remove('return-target');
                }
            }
        }
        
        e.preventDefault();
    }

    handleTouchEnd(e) {
        if (!this.isDragging || !this.currentDragItem) {
            this.cleanup();
            return;
        }
        
        const touch = e.changedTouches[0];
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (elementBelow) {
            if (this.dragZone.contains(elementBelow) || elementBelow === this.dragZone) {
                if (this.canDropItem(this.currentDragItem)) {
                    this.dropItem(this.currentDragItem);
                }
            } else if ((this.sourceList.contains(elementBelow) || elementBelow === this.sourceList) && 
                       this.currentDragItem.state === 'dropped') {
                this.returnItemToSource(this.currentDragItem);
            }
        }
        
        this.cleanup();
    }

    // Keyboard interaction
    handleKeyboardInteraction(e) {
        const item = e.target.closest('.draggable-item');
        if (!item) return;
        
        const itemData = this.items.get(item.dataset.item);
        if (!itemData) return;
        
        switch (e.key) {
            case ' ':
            case 'Enter':
                e.preventDefault();
                if (itemData.state === 'source') {
                    if (this.canDropItem(itemData)) {
                        this.dropItem(itemData);
                    }
                }
                break;
                
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                if (itemData.state === 'dropped') {
                    this.permanentlyRemoveItem(itemData);
                }
                break;
                
            case 'Escape':
                // Cancel any current drag operation
                this.cleanup();
                break;
        }
    }

    // Utility methods
    createDragPreview(element) {
        if (this.dragPreview) {
            this.dragPreview.remove();
        }
        
        this.dragPreview = element.cloneNode(true);
        this.dragPreview.classList.add('drag-preview');
        this.dragPreview.style.position = 'fixed';
        this.dragPreview.style.pointerEvents = 'none';
        this.dragPreview.style.zIndex = '10000';
        this.dragPreview.style.opacity = '0.9';
        this.dragPreview.style.transform = 'rotate(2deg) scale(1.05)';
        this.dragPreview.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
        
        document.body.appendChild(this.dragPreview);
    }

    highlightDropZones(highlight) {
        if (highlight) {
            this.dragZone.classList.add('drop-zone-active');
            if (this.currentDragItem && this.currentDragItem.state === 'source') {
                this.sourceList.classList.add('return-zone-active');
            }
        } else {
            this.dragZone.classList.remove('drop-zone-active', 'drag-over');
            this.sourceList.classList.remove('return-zone-active', 'return-target');
        }
    }

    animateDropZone(zone) {
        zone.style.transform = 'scale(1.02)';
        setTimeout(() => {
            zone.style.transform = 'scale(1)';
        }, 200);
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.textContent = message;
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    render() {
        this.updateCounter();
    }

    cleanup() {
        this.isDragging = false;
        this.currentDragItem = null;
        
        if (this.dragPreview) {
            this.dragPreview.remove();
            this.dragPreview = null;
        }
        
        this.highlightDropZones(false);
        
        // Remove dragging class from all items
        this.sourceList.querySelectorAll('.dragging').forEach(item => {
            item.classList.remove('dragging');
            item.setAttribute('aria-grabbed', 'false');
        });
    }

    destroy() {
        this.saveState();
        this.abortController.abort();
        this.cleanup();
        
        // Remove control panel
        const controlPanel = document.querySelector('.drag-control-panel');
        if (controlPanel) {
            controlPanel.remove();
        }
        
        // Clean up any remaining event listeners
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        window.removeEventListener('beforeunload', this.saveState);
    }
}