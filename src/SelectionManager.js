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
        // 选择框与全局坐标一致（使用 stage 子级、e.global）
        this.selectionBox = new PIXI.Graphics();
        this.selectionBox.visible = false;
        this.selectionBox.eventMode = 'none';
        this.selectionBox.zIndex = 99999;
        this.engine.app.stage.sortableChildren = true;
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
        
        const vp = this.engine.viewportController.viewport;
        // 仅在空白处（命中 viewport 本体）左键开始框选
        vp.on('pointerdown', (e) => this.onBoxSelectStart(e));
        this.engine.app.stage.on('pointermove', (e) => this.onBoxSelectMove(e));
        this.engine.app.stage.on('pointerup', (e) => this.onBoxSelectEnd(e));
        this.engine.app.stage.on('pointerupoutside', (e) => this.onBoxSelectEnd(e));
    }
    
    /**
     * 开始框选
     */
    onBoxSelectStart(e) {
        if (this.engine.isRunning || this.engine.viewportController.spacePressed) return;
        if (e.data.button !== 0) return;
        const vp = this.engine.viewportController.viewport;
        if (e.target !== vp) return;

        this.isBoxSelecting = true;
        // 与 getBounds() 同为全局坐标，避免与视口本地坐标混用导致选不中
        this.boxSelectStart = { x: e.global.x, y: e.global.y };
        this.boxSelectEnd = { x: e.global.x, y: e.global.y };

        this.selectionBox.visible = true;
        this.drawSelectionBox();
    }
    
    /**
     * 框选移动
     */
    onBoxSelectMove(e) {
        if (!this.isBoxSelecting) return;

        this.boxSelectEnd = { x: e.global.x, y: e.global.y };
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
        
        const merge =
            !!(e.nativeEvent && e.nativeEvent.shiftKey) ||
            !!(e.data && e.data.originalEvent && e.data.originalEvent.shiftKey);
        if (objectsInBox.length > 0) {
            this.setSelection(objectsInBox, merge);
        }
    }
    
    /**
     * 绘制选择框
     */
    drawSelectionBox() {
        this.selectionBox.clear();

        const minX = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
        const maxX = Math.max(this.boxSelectStart.x, this.boxSelectEnd.x);
        const minY = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
        const maxY = Math.max(this.boxSelectStart.y, this.boxSelectEnd.y);

        this.selectionBox.lineStyle(2, 0x2196f3, 1);
        this.selectionBox.beginFill(0x2196f3, 0.12);
        this.selectionBox.drawRect(minX, minY, maxX - minX, maxY - minY);
        this.selectionBox.endFill();
    }
    
    /**
     * 设置选中对象；merge=true 时在原有选择上追加（Shift+框选）
     */
    setSelection(objects, merge = false) {
        const incoming = Array.isArray(objects) ? objects : [objects];
        if (merge && this.selectedObjects.length > 0) {
            const ids = new Set(this.selectedObjects.map((o) => o.id));
            incoming.forEach((o) => {
                if (!ids.has(o.id)) {
                    this.selectedObjects.push(o);
                    ids.add(o.id);
                }
            });
        } else {
            this.selectedObjects = [...incoming];
        }

        this.updateVisualFeedback();

        if (this.selectedObjects.length === 1) {
            this.engine.selectObject(this.selectedObjects[0]);
        } else if (this.selectedObjects.length > 1) {
            this.engine.selectedObject = this.selectedObjects[this.selectedObjects.length - 1];
            this.engine.transformControls.hide();
            if (this.engine.editorUI) {
                this.engine.editorUI.onMultiSelect(this.selectedObjects);
            }
        }
    }

    /**
     * Shift+点击：已在选中列表则移除，否则加入
     */
    toggleSelection(obj) {
        const i = this.selectedObjects.indexOf(obj);
        if (i >= 0) {
            this.selectedObjects.splice(i, 1);
        } else {
            this.selectedObjects.push(obj);
        }
        this.updateVisualFeedback();

        if (this.selectedObjects.length === 0) {
            if (this.engine.editorUI) this.engine.editorUI.clearSelection();
        } else if (this.selectedObjects.length === 1) {
            this.engine.selectObject(this.selectedObjects[0]);
        } else {
            this.engine.selectedObject = obj;
            this.engine.transformControls.hide();
            if (this.engine.editorUI) {
                this.engine.editorUI.onMultiSelect(this.selectedObjects);
            }
        }
    }
    
    /**
     * 添加到选择（场景列表 Shift 点击，仅追加不切换）
     */
    addToSelection(obj) {
        if (this.selectedObjects.includes(obj)) return;
        this.selectedObjects.push(obj);
        this.updateVisualFeedback();

        if (this.selectedObjects.length === 1) {
            this.engine.selectObject(this.selectedObjects[0]);
        } else {
            this.engine.selectedObject = obj;
            this.engine.transformControls.hide();
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
        if (this.engine.gameObjects.length === 0) return;
        this.setSelection([...this.engine.gameObjects]);
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
        
        // 单选时 TransformControls 已经显示控制框，避免出现两套蓝框。
        if (this.selectedObjects.length === 1) {
            return;
        }

        // 为多选对象添加边框
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
        
        let bounds = obj.displayObject.getLocalBounds();
        if (obj.type === 'circle') {
            const r = obj.properties.radius || 50;
            bounds = { x: 0, y: 0, width: r * 2, height: r * 2 };
        } else if (obj.type === 'container') {
            bounds = {
                x: 0,
                y: 0,
                width: obj.properties.width || 100,
                height: obj.properties.height || 100
            };
        }
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
        // 多选删除后收起变换框并清面板（removeGameObject 只处理「当前单选」引用）
        if (this.engine.editorUI) {
            this.engine.editorUI.clearSelection();
        }
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
