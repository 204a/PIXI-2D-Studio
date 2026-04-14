import * as PIXI from 'pixi.js';

/**
 * 视口控制器 - 画布缩放和平移
 */

export class ViewportController {
    constructor(engine) {
        this.engine = engine;
        this.viewport = new PIXI.Container();
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 4;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.spacePressed = false;
        this.middleButtonPressed = false;
        
        this.init();
    }
    
    init() {
        // 创建viewport容器
        this.viewport = new PIXI.Container();
        this.viewport.sortableChildren = true;
        
        // 将viewport添加到stage
        this.engine.app.stage.addChild(this.viewport);
        
        // 监听滚轮缩放
        const canvas = this.engine.app.view || this.engine.app.canvas;
        canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        // 监听空格键
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.engine.isRunning) {
                this.spacePressed = true;
                canvas.style.cursor = 'grab';
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                this.isPanning = false;
                canvas.style.cursor = 'default';
            }
        });
        
        // 监听鼠标平移（支持空格+左键和中键）
        this.engine.app.stage.on('pointerdown', (e) => this.onPanStart(e));
        this.engine.app.stage.on('pointermove', (e) => this.onPanMove(e));
        this.engine.app.stage.on('pointerup', (e) => this.onPanEnd(e));
        this.engine.app.stage.on('pointerupoutside', (e) => this.onPanEnd(e));
        
        // 监听原生鼠标事件（用于检测中键）
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 && !this.engine.isRunning) { // 中键
                e.preventDefault();
                this.middleButtonPressed = true;
                canvas.style.cursor = 'grab';
                
                // 立即开始拖拽
                this.isPanning = true;
                const rect = canvas.getBoundingClientRect();
                this.panStart = {
                    x: e.clientX - rect.left - this.viewport.x,
                    y: e.clientY - rect.top - this.viewport.y
                };
                canvas.style.cursor = 'grabbing';
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (this.middleButtonPressed && this.isPanning && !this.engine.isRunning) {
                const rect = canvas.getBoundingClientRect();
                this.viewport.x = e.clientX - rect.left - this.panStart.x;
                this.viewport.y = e.clientY - rect.top - this.panStart.y;
            }
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 1) { // 中键
                this.middleButtonPressed = false;
                this.isPanning = false;
                canvas.style.cursor = 'default';
            }
        });
        
        // 防止中键默认行为（滚动）
        canvas.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        });
        
        // 添加缩放UI
        this.createZoomUI();
    }
    
    /**
     * 创建缩放UI控件
     */
    createZoomUI() {
        const toolbar = document.querySelector('.toolbar');
        if (!toolbar) return;
        
        const zoomControls = document.createElement('div');
        zoomControls.style.cssText = 'display: flex; gap: 5px; align-items: center; margin-left: 10px; border-left: 1px solid #444; padding-left: 10px;';
        
        zoomControls.innerHTML = `
            <button id="zoom-out" style="padding: 6px 10px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">−</button>
            <span id="zoom-display" style="color: white; font-size: 13px; min-width: 50px; text-align: center;">100%</span>
            <button id="zoom-in" style="padding: 6px 10px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">+</button>
            <button id="zoom-reset" style="padding: 6px 10px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">重置</button>
        `;
        
        toolbar.appendChild(zoomControls);
        
        // 绑定事件
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom());
        
        this.updateZoomDisplay();
    }
    
    /**
     * 滚轮缩放
     */
    onWheel(e) {
        if (this.engine.isRunning) return;
        
        e.preventDefault();
        
        const canvas = this.engine.app.view || this.engine.app.canvas;
        const rect = canvas.getBoundingClientRect();
        
        // 计算鼠标在canvas中的位置
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 计算缩放前鼠标在viewport中的位置
        const worldPosBefore = {
            x: (mouseX - this.viewport.x) / this.viewport.scale.x,
            y: (mouseY - this.viewport.y) / this.viewport.scale.y
        };
        
        // 更新缩放
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * delta));
        
        this.setZoom(newScale);
        
        // 计算缩放后鼠标在viewport中的位置
        const worldPosAfter = {
            x: (mouseX - this.viewport.x) / this.viewport.scale.x,
            y: (mouseY - this.viewport.y) / this.viewport.scale.y
        };
        
        // 调整viewport位置，使鼠标位置保持不变
        this.viewport.x += (worldPosBefore.x - worldPosAfter.x) * this.viewport.scale.x;
        this.viewport.y += (worldPosBefore.y - worldPosAfter.y) * this.viewport.scale.y;
    }
    
    /**
     * 开始平移
     */
    onPanStart(e) {
        // 支持空格+左键 或 中键拖拽
        const canPan = (this.spacePressed && e.data.button === 0) || this.middleButtonPressed;
        
        if (!canPan || this.engine.isRunning) return;
        
        this.isPanning = true;
        this.panStart = {
            x: e.global.x - this.viewport.x,
            y: e.global.y - this.viewport.y
        };
        
        const canvas = this.engine.app.view || this.engine.app.canvas;
        canvas.style.cursor = 'grabbing';
    }
    
    /**
     * 平移移动
     */
    onPanMove(e) {
        if (!this.isPanning) return;
        
        this.viewport.x = e.global.x - this.panStart.x;
        this.viewport.y = e.global.y - this.panStart.y;
    }
    
    /**
     * 结束平移
     */
    onPanEnd(e) {
        // 只处理空格+左键的拖拽结束（中键拖拽在mouseup中处理）
        if (this.isPanning && !this.middleButtonPressed) {
            this.isPanning = false;
            const canvas = this.engine.app.view || this.engine.app.canvas;
            
            if (this.spacePressed) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    }
    
    /**
     * 设置缩放级别
     */
    setZoom(scale) {
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
        this.viewport.scale.set(this.scale);
        this.updateZoomDisplay();
        
        // 更新网格
        if (this.engine.gridSystem) {
            this.engine.gridSystem.updateScale(this.scale);
        }
    }
    
    /**
     * 放大
     */
    zoomIn() {
        const center = this.getViewportCenter();
        this.zoomToPoint(this.scale * 1.25, center);
    }
    
    /**
     * 缩小
     */
    zoomOut() {
        const center = this.getViewportCenter();
        this.zoomToPoint(this.scale / 1.25, center);
    }
    
    /**
     * 重置缩放
     */
    resetZoom() {
        const center = this.getViewportCenter();
        this.viewport.x = 0;
        this.viewport.y = 0;
        this.setZoom(1);
    }
    
    /**
     * 缩放到指定点
     */
    zoomToPoint(newScale, point) {
        const worldPosBefore = {
            x: (point.x - this.viewport.x) / this.viewport.scale.x,
            y: (point.y - this.viewport.y) / this.viewport.scale.y
        };
        
        this.setZoom(newScale);
        
        const worldPosAfter = {
            x: (point.x - this.viewport.x) / this.viewport.scale.x,
            y: (point.y - this.viewport.y) / this.viewport.scale.y
        };
        
        this.viewport.x += (worldPosBefore.x - worldPosAfter.x) * this.viewport.scale.x;
        this.viewport.y += (worldPosBefore.y - worldPosAfter.y) * this.viewport.scale.y;
    }
    
    /**
     * 获取视口中心点
     */
    getViewportCenter() {
        return {
            x: this.engine.app.screen.width / 2,
            y: this.engine.app.screen.height / 2
        };
    }
    
    /**
     * 更新缩放显示
     */
    updateZoomDisplay() {
        const display = document.getElementById('zoom-display');
        if (display) {
            display.textContent = Math.round(this.scale * 100) + '%';
        }
    }
    
    /**
     * 适应所有对象
     */
    fitToContent() {
        if (this.engine.gameObjects.length === 0) return;
        
        // 计算所有对象的边界
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.engine.gameObjects.forEach(obj => {
            const bounds = obj.displayObject.getBounds();
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const padding = 50;
        
        // 计算合适的缩放比例
        const scaleX = (this.engine.app.screen.width - padding * 2) / contentWidth;
        const scaleY = (this.engine.app.screen.height - padding * 2) / contentHeight;
        const newScale = Math.min(scaleX, scaleY, this.maxScale);
        
        this.setZoom(newScale);
        
        // 居中
        this.viewport.x = (this.engine.app.screen.width - contentWidth * newScale) / 2 - minX * newScale;
        this.viewport.y = (this.engine.app.screen.height - contentHeight * newScale) / 2 - minY * newScale;
    }
    
    /**
     * 获取世界坐标（屏幕坐标转换）
     */
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.viewport.x) / this.scale,
            y: (screenY - this.viewport.y) / this.scale
        };
    }
    
    /**
     * 获取屏幕坐标（世界坐标转换）
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.scale + this.viewport.x,
            y: worldY * this.scale + this.viewport.y
        };
    }
}
