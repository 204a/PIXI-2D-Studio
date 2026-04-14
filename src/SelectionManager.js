import * as PIXI from 'pixi.js';

/**
 * 选择管理器 - 多选和批量操作
 */

export class SelectionManager {
    constructor(engine) {
        this.engine = engine;
        this.selectedObjects = []; // 选中的对象列表
        this.isBoxSelecting = false;
        this.boxSelectStart = { x: 0, y: 0 };
        this.boxSelectEnd = { x: 0, y: 0 };
        this.selectionBox = null;
        this.ctrlPressed = false;
        this.shiftPressed = false;
        
        this.init();
    }
    
    init() {
        // 创建选择框图形
        this.selectionBox = new PIXI.Graphics();
        this.selectionBox.visible = false;
        this.engine.app.stage.addChild(this.selectionBox);
        
        // 监听键盘
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') this.ctrlPressed = true;
            if (e.key === 'Shift') this.shiftPressed = true;
            
            // Ctrl+A 全选
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !this.engine.isRunning) {
                e.preventDefault();
                this.selectAll();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') this.ctrlPressed = false;
            if (e.key === 'Shift') this.shiftPressed = false;
        });
        
        // 监听画布拖拽框选
        const canvas = this.engine.app.view || this.engine.app.canvas;
        this.engine.app.stage.on('pointerdown', (e) => this.onBoxSelectStart(e));
        this.engine.app.stage.on('pointermove', (e) => this.onBoxSelectMove(e));
        this.engine.app.stage.on('pointerup', (e) => this.onBoxSelectEnd(e));
    }
    
    /**
     * 开始框选
     */
    onBoxSelectStart(e) {
        // 只有按住Ctrl且不在运行模式才能框选
        if (!this.ctrlPressed || this.engine.isRunning || this.engine.viewportController.spacePressed) {
            return;
        }
        
        // 点击到对象时不启动框选
        if (e.target !== this.engine.app.stage) {
            return;
        }
        
        this.isBoxSelecting = true;
        const worldPos = this.engine.viewportController.screenToWorld(e.global.x, e.global.y);
        this.boxSelectStart = { x: worldPos.x, y: worldPos.y };
        this.boxSelectEnd = { x: worldPos.x, y: worldPos.y };
        
        this.selectionBox.visible = true;
        this.drawSelectionBox();
    }
    
    /**
     * 框选移动
     */
    onBoxSelectMove(e) {
        if (!this.isBoxSelecting) return;
        
        const worldPos = this.engine.viewportController.screenToWorld(e.global.x, e.global.y);
        this.boxSelectEnd = { x: worldPos.x, y: worldPos.y };
        this.drawSelectionBox();
    }
    
    /**
     * 结束框选
     */
    onBoxSelectEnd(e) {
        if (!this.isBoxSelecting) return;
        
        this.isBoxSelecting = false;
        this.selectionBox.visible = false;
        
        // 计算选择框范围
        const minX = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
        const maxX = Math.max(this.boxSelectStart.x, this.boxSelectEnd.x);
        const minY = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
        const maxY = Math.max(this.boxSelectStart.y, this.boxSelectEnd.y);
        
        // 如果选择框太小，忽略
        if (Math.abs(maxX - minX) < 5 && Math.abs(maxY - minY) < 5) {
            return;
        }
        
        // 查找在选择框内的对象
        const objectsInBox = this.engine.gameObjects.filter(obj => {
            const bounds = obj.displayObject.getBounds();
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            
            return centerX >= minX && centerX <= maxX && 
                   centerY >= minY && centerY <= maxY;
        });
        
        if (objectsInBox.length > 0) {
            this.setSelection(objectsInBox);
        }
    }
    
    /**
     * 绘制选择框
     */
    drawSelectionBox() {
        this.selectionBox.clear();
        
        const viewport = this.engine.viewportController.viewport;
        const scale = this.engine.viewportController.scale;
        
        // 转换为屏幕坐标
        const startScreen = this.engine.viewportController.worldToScreen(
            this.boxSelectStart.x, this.boxSelectStart.y
        );
        const endScreen = this.engine.viewportController.worldToScreen(
            this.boxSelectEnd.x, this.boxSelectEnd.y
        );
        
        const width = endScreen.x - startScreen.x;
        const height = endScreen.y - startScreen.y;
        
        // 绘制半透明蓝色选择框
        this.selectionBox.lineStyle(2 / scale, 0x2196F3, 1);
        this.selectionBox.beginFill(0x2196F3, 0.1);
        this.selectionBox.drawRect(
            this.boxSelectStart.x, 
            this.boxSelectStart.y, 
            this.boxSelectEnd.x - this.boxSelectStart.x,
            this.boxSelectEnd.y - this.boxSelectStart.y
        );
        this.selectionBox.endFill();
    }
    
    /**
     * 设置选中对象
     */
    setSelection(objects) {
        this.clearSelection();
        this.selectedObjects = Array.isArray(objects) ? objects : [objects];
        this.updateVisualFeedback();
        
        // 通知编辑器更新
        if (this.engine.editorUI) {
            this.engine.editorUI.onMultiSelect(this.selectedObjects);
        }
    }
    
    /**
     * 添加到选择（Shift+点击）
     */
    addToSelection(obj) {
        if (!this.selectedObjects.includes(obj)) {
            this.selectedObjects.push(obj);
            this.updateVisualFeedback();
            
            if (this.engine.editorUI) {
                this.engine.editorUI.onMultiSelect(this.selectedObjects);
            }
        }
    }
    
    /**
     * 从选择中移除
     */
    removeFromSelection(obj) {
        const index = this.selectedObjects.indexOf(obj);
        if (index > -1) {
            this.selectedObjects.splice(index, 1);
            this.updateVisualFeedback();
            
            if (this.engine.editorUI) {
                if (this.selectedObjects.length > 0) {
                    this.engine.editorUI.onMultiSelect(this.selectedObjects);
                } else {
                    this.engine.editorUI.clearSelection();
                }
            }
        }
    }
    
    /**
     * 清除选择
     */
    clearSelection() {
        this.selectedObjects = [];
        this.updateVisualFeedback();
    }
    
    /**
     * 全选
     */
    selectAll() {
        this.selectedObjects = [...this.engine.gameObjects];
        this.updateVisualFeedback();
        
        if (this.engine.editorUI) {
            this.engine.editorUI.onMultiSelect(this.selectedObjects);
        }
        
        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus(`已选中 ${this.selectedObjects.length} 个对象`);
        }
    }
    
    /**
     * 更新视觉反馈
     */
    updateVisualFeedback() {
        // 清除所有对象的选中效果
        this.engine.gameObjects.forEach(obj => {
            if (obj.displayObject._selectionOutline) {
                obj.displayObject._selectionOutline.clear();
                obj.displayObject._selectionOutline.visible = false;
            }
        });
        
        // 为选中对象添加边框
        this.selectedObjects.forEach(obj => {
            this.addSelectionOutline(obj);
        });
    }
    
    /**
     * 添加选中边框
     */
    addSelectionOutline(obj) {
        if (!obj.displayObject._selectionOutline) {
            obj.displayObject._selectionOutline = new PIXI.Graphics();
            obj.displayObject.addChild(obj.displayObject._selectionOutline);
        }
        
        const outline = obj.displayObject._selectionOutline;
        outline.clear();
        outline.visible = true;
        
        const bounds = obj.displayObject.getLocalBounds();
        outline.lineStyle(2, 0x2196F3, 1);
        outline.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    
    /**
     * 获取选中数量
     */
    getSelectionCount() {
        return this.selectedObjects.length;
    }
    
    /**
     * 是否有多选
     */
    hasMultipleSelection() {
        return this.selectedObjects.length > 1;
    }
    
    /**
     * 批量移动
     */
    moveSelection(deltaX, deltaY) {
        this.selectedObjects.forEach(obj => {
            obj.displayObject.x += deltaX;
            obj.displayObject.y += deltaY;
            obj.properties.x = obj.displayObject.x;
            obj.properties.y = obj.displayObject.y;
        });
    }
    
    /**
     * 批量删除
     */
    deleteSelection() {
        const toDelete = [...this.selectedObjects];
        toDelete.forEach(obj => {
            this.engine.removeGameObject(obj);
        });
        this.clearSelection();
    }
    
    /**
     * 批量复制
     */
    copySelection() {
        return this.selectedObjects.map(obj => ({
            type: obj.type,
            properties: { ...obj.properties }
        }));
    }
    
    /**
     * 批量设置属性
     */
    setPropertyForSelection(property, value) {
        this.selectedObjects.forEach(obj => {
            if (property === 'alpha') {
                obj.displayObject.alpha = value;
                obj.properties.alpha = value;
            } else if (property === 'rotation') {
                obj.displayObject.rotation = value * Math.PI / 180;
                obj.properties.rotation = value;
            } else if (property === 'scaleX') {
                obj.displayObject.scale.x = value;
                obj.properties.scaleX = value;
            } else if (property === 'scaleY') {
                obj.displayObject.scale.y = value;
                obj.properties.scaleY = value;
            }
        });
    }
    
    /**
     * 获取选中对象的中心点
     */
    getSelectionCenter() {
        if (this.selectedObjects.length === 0) return { x: 0, y: 0 };
        
        let sumX = 0, sumY = 0;
        this.selectedObjects.forEach(obj => {
            sumX += obj.displayObject.x;
            sumY += obj.displayObject.y;
        });
        
        return {
            x: sumX / this.selectedObjects.length,
            y: sumY / this.selectedObjects.length
        };
    }
}
