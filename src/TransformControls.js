import * as PIXI from 'pixi.js';

/** 缩放手柄拖拽灵敏度（1=原样，越小越不跟手、越精细） */
const SCALE_HANDLE_SENSITIVITY = 0.55;

/**
 * 变换控制器 - 提供缩放框和控制点
 */

export class TransformControls {
    constructor(engine) {
        this.engine = engine;
        this.container = new PIXI.Container();
        this.container.zIndex = 10000; // 确保在最上层
        this.selectedObject = null;
        this.isDragging = false;
        this.dragHandle = null;
        /** @type {'all'|'rotate'} */
        this.gizmoMode = 'all';

        // 控制点
        this.handles = {
            topLeft: null,
            topCenter: null,
            topRight: null,
            middleLeft: null,
            middleRight: null,
            bottomLeft: null,
            bottomCenter: null,
            bottomRight: null
        };
        
        // 边框
        this.border = null;

        this.rotationLine = null;
        this.rotationHandle = null;

        this.init();
    }
    
    init() {
        // 容器会在首次选择对象时添加到viewport
        this.container.visible = false;
        this.container.zIndex = 10000; // 确保在最上层
        
        // 创建边框
        this.border = new PIXI.Graphics();
        this.container.addChild(this.border);
        
        // 创建8个控制点
        const handleSize = 8;
        const handleColor = 0x2196F3;
        
        Object.keys(this.handles).forEach(key => {
            const handle = new PIXI.Graphics();
            handle.beginFill(handleColor);
            handle.drawRect(-handleSize/2, -handleSize/2, handleSize, handleSize);
            handle.endFill();
            handle.beginFill(0xFFFFFF);
            handle.drawRect(-handleSize/2 + 1, -handleSize/2 + 1, handleSize - 2, handleSize - 2);
            handle.endFill();
            
            handle.eventMode = 'static';
            handle.cursor = this.getCursorForHandle(key);
            handle.handleType = key;
            
            // 鼠标按下
            handle.on('pointerdown', (e) => {
                if (this.engine.isRunning) return;
                this.isDragging = true;
                this.dragHandle = key;
                this.dragStartPos = { x: e.global.x, y: e.global.y };
                const parent = this.selectedObject.displayObject.parent;
                this.dragStartLocal = parent
                    ? parent.toLocal(e.global)
                    : new PIXI.Point(e.global.x, e.global.y);
                this.objStartBounds = this.getVisualBoundsForGizmo();
                this.objStartFontSize = this.selectedObject && this.selectedObject.type === 'text'
                    ? (this.selectedObject.properties.fontSize || 24)
                    : null;
                e.stopPropagation();
            });
            
            this.handles[key] = handle;
            this.container.addChild(handle);
        });

        this.rotationLine = new PIXI.Graphics();
        this.container.addChild(this.rotationLine);

        const rh = 7;
        this.rotationHandle = new PIXI.Graphics();
        this.rotationHandle.beginFill(0x4caf50);
        this.rotationHandle.drawCircle(0, 0, rh);
        this.rotationHandle.endFill();
        this.rotationHandle.lineStyle(2, 0xffffff, 1);
        this.rotationHandle.drawCircle(0, 0, rh);
        this.rotationHandle.eventMode = 'static';
        this.rotationHandle.cursor = 'grab';
        this.rotationHandle.handleType = 'rotate';
        this.rotationHandle.on('pointerdown', (e) => {
            if (this.engine.isRunning || !this.selectedObject) return;
            this.isDragging = true;
            this.dragHandle = 'rotate';
            this._initRotateDrag(e);
            e.stopPropagation();
        });
        this.container.addChild(this.rotationHandle);

        this._applyGizmoModeVisibility();

        // 全局鼠标移动和释放
        this.engine.app.stage.on('pointermove', (e) => this.onPointerMove(e));
        this.engine.app.stage.on('pointerup', () => this.onPointerUp());
        this.engine.app.stage.on('pointerupoutside', () => this.onPointerUp());
    }

    toggleGizmoMode() {
        this.gizmoMode = this.gizmoMode === 'all' ? 'rotate' : 'all';
        this._applyGizmoModeVisibility();
        this.updateTransform();
        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus(
                this.gizmoMode === 'rotate' ? '变换：仅旋转（R 恢复）' : '变换：缩放 + 旋转'
            );
        }
    }

    _applyGizmoModeVisibility() {
        const showScale = this.gizmoMode === 'all';
        Object.values(this.handles).forEach((h) => {
            if (h) h.visible = showScale;
        });
        this.border.visible = showScale;
    }

    _initRotateDrag(e) {
        const obj = this.selectedObject.displayObject;
        const wb = obj.getBounds();
        const cx = wb.x + wb.width / 2;
        const cy = wb.y + wb.height / 2;
        this._rotateCenterGlobal = new PIXI.Point(cx, cy);
        this._rotatePivotLocal = new PIXI.Point();
        obj.worldTransform.applyInverse(this._rotateCenterGlobal, this._rotatePivotLocal);
        this._rotateStartObjectRot = obj.rotation;
        this._rotateStartMouseAngle = Math.atan2(
            e.global.y - this._rotateCenterGlobal.y,
            e.global.x - this._rotateCenterGlobal.x
        );
    }
    
    getCursorForHandle(handleType) {
        const cursors = {
            topLeft: 'nwse-resize',
            topCenter: 'ns-resize',
            topRight: 'nesw-resize',
            middleLeft: 'ew-resize',
            middleRight: 'ew-resize',
            bottomLeft: 'nesw-resize',
            bottomCenter: 'ns-resize',
            bottomRight: 'nwse-resize'
        };
        return cursors[handleType] || 'default';
    }
    
    /**
     * 选中对象，显示缩放框
     */
    selectObject(gameObject) {
        if (this.engine.isRunning) {
            this.hide();
            return;
        }
        
        // 确保容器已添加到viewport
        if (!this.container.parent) {
            const parent = this.engine.viewportController ? this.engine.viewportController.viewport : this.engine.app.stage;
            parent.addChild(this.container);
        }
        
        this.selectedObject = gameObject;
        if (gameObject) {
            this.show();
            this._applyGizmoModeVisibility();
            this.updateTransform();
        } else {
            this.hide();
        }
    }
    
    /**
     * 更新变换框位置和大小
     */
    updateTransform() {
        if (!this.selectedObject) return;

        const bounds = this.getVisualBoundsForGizmo();

        // 获取viewport缩放（如果存在）
        const viewportScale = this.engine.viewportController ? this.engine.viewportController.scale : 1;
        const lineWidth = 2 / viewportScale; // 补偿缩放，保持视觉粗细

        // 绘制边框
        this.border.clear();
        this.border.lineStyle(lineWidth, 0x2196F3, 1);
        this.border.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // 更新控制点位置和缩放
        const hw = bounds.width / 2;
        const hh = bounds.height / 2;
        const handleScale = 1 / viewportScale; // 补偿缩放，保持视觉大小

        this.handles.topLeft.position.set(bounds.x, bounds.y);
        this.handles.topLeft.scale.set(handleScale);

        this.handles.topCenter.position.set(bounds.x + hw, bounds.y);
        this.handles.topCenter.scale.set(handleScale);

        this.handles.topRight.position.set(bounds.x + bounds.width, bounds.y);
        this.handles.topRight.scale.set(handleScale);

        this.handles.middleLeft.position.set(bounds.x, bounds.y + hh);
        this.handles.middleLeft.scale.set(handleScale);

        this.handles.middleRight.position.set(bounds.x + bounds.width, bounds.y + hh);
        this.handles.middleRight.scale.set(handleScale);

        this.handles.bottomLeft.position.set(bounds.x, bounds.y + bounds.height);
        this.handles.bottomLeft.scale.set(handleScale);

        this.handles.bottomCenter.position.set(bounds.x + hw, bounds.y + bounds.height);
        this.handles.bottomCenter.scale.set(handleScale);

        this.handles.bottomRight.position.set(bounds.x + bounds.width, bounds.y + bounds.height);
        this.handles.bottomRight.scale.set(handleScale);

        const topX = bounds.x + hw;
        const topY = bounds.y;
        const arm = 40 / viewportScale;
        const hx = topX;
        const hy = topY - arm;

        this.rotationLine.clear();
        this.rotationLine.lineStyle(lineWidth, 0x4caf50, 0.9);
        this.rotationLine.moveTo(topX, topY);
        this.rotationLine.lineTo(hx, hy);
        this.rotationHandle.position.set(hx, hy);
        this.rotationHandle.scale.set(handleScale);
        this.rotationLine.visible = true;
        this.rotationHandle.visible = true;
    }

    /**
     * 世界空间 AABB（getBounds）转换到与 gizmo 相同的父级坐标（viewport 本地），用于旋转后仍贴合视觉
     */
    getVisualBoundsForGizmo() {
        const disp = this.selectedObject.displayObject;
        const wb = disp.getBounds();
        const parent = this.container.parent;
        if (!parent) {
            return { x: wb.x, y: wb.y, width: wb.width, height: wb.height };
        }
        const corners = [
            new PIXI.Point(wb.x, wb.y),
            new PIXI.Point(wb.x + wb.width, wb.y),
            new PIXI.Point(wb.x, wb.y + wb.height),
            new PIXI.Point(wb.x + wb.width, wb.y + wb.height)
        ];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of corners) {
            const lp = parent.toLocal(p);
            minX = Math.min(minX, lp.x);
            maxX = Math.max(maxX, lp.x);
            minY = Math.min(minY, lp.y);
            maxY = Math.max(maxY, lp.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    /**
     * 未旋转时的逻辑边界（缩放拖拽与属性一致）；旋转时用 getVisualBoundsForGizmo 显示
     */
    getObjectBounds() {
        const obj = this.selectedObject.displayObject;
        const props = this.selectedObject.properties;

        let x = obj.x;
        let y = obj.y;
        let width = props.width || 100;
        let height = props.height || 100;

        if (this.selectedObject.type === 'text') {
            const bounds = obj.getBounds();
            return {
                x: obj.x,
                y: obj.y,
                width: bounds.width,
                height: bounds.height
            };
        }

        if (this.selectedObject.type === 'circle') {
            const radius = props.radius || 50;
            width = radius * 2;
            height = radius * 2;
        }

        if (['button', 'progressBar', 'inputField', 'nineSlice'].includes(this.selectedObject.type)) {
            width = props.width || 100;
            height = props.height || 40;
        }

        return { x, y, width, height };
    }
    
    /**
     * 鼠标移动处理
     */
    onPointerMove(e) {
        if (!this.isDragging || !this.dragHandle) return;

        if (this.dragHandle === 'rotate') {
            this._onRotatePointerMove(e);
            return;
        }

        const obj = this.selectedObject.displayObject;
        const parent = obj.parent;
        const curLocal = parent ? parent.toLocal(e.global) : new PIXI.Point(e.global.x, e.global.y);
        const dx = (curLocal.x - this.dragStartLocal.x) * SCALE_HANDLE_SENSITIVITY;
        const dy = (curLocal.y - this.dragStartLocal.y) * SCALE_HANDLE_SENSITIVITY;

        const bounds = { ...this.objStartBounds };
        const props = this.selectedObject.properties;

        // 根据拖拽的控制点调整大小
        switch (this.dragHandle) {
            case 'topLeft':
                bounds.x += dx;
                bounds.y += dy;
                bounds.width -= dx;
                bounds.height -= dy;
                break;
            case 'topCenter':
                bounds.y += dy;
                bounds.height -= dy;
                break;
            case 'topRight':
                bounds.y += dy;
                bounds.width += dx;
                bounds.height -= dy;
                break;
            case 'middleLeft':
                bounds.x += dx;
                bounds.width -= dx;
                break;
            case 'middleRight':
                bounds.width += dx;
                break;
            case 'bottomLeft':
                bounds.x += dx;
                bounds.width -= dx;
                bounds.height += dy;
                break;
            case 'bottomCenter':
                bounds.height += dy;
                break;
            case 'bottomRight':
                bounds.width += dx;
                bounds.height += dy;
                break;
        }
        
        // 最小尺寸限制
        bounds.width = Math.max(10, bounds.width);
        bounds.height = Math.max(10, bounds.height);
        
        // 应用变换（有旋转时用绕局部中心的均匀缩放，避免把 AABB 左上角当 position）
        if (Math.abs(obj.rotation) > 1e-4) {
            this._applyTransformRotatedUniform(bounds);
        } else {
            this.applyTransform(bounds);
        }
        this.updateTransform();
        
        // 通知UI更新
        if (this.engine.onObjectSelected) {
            this.engine.onObjectSelected(this.selectedObject);
        }
    }

    _onRotatePointerMove(e) {
        const obj = this.selectedObject.displayObject;
        const props = this.selectedObject.properties;
        const parent = obj.parent;
        if (!parent || !this._rotateCenterGlobal || !this._rotatePivotLocal) return;

        const shift = !!(e.nativeEvent && e.nativeEvent.shiftKey) || !!e.shiftKey;

        let curAngle = Math.atan2(
            e.global.y - this._rotateCenterGlobal.y,
            e.global.x - this._rotateCenterGlobal.x
        );
        let delta = curAngle - this._rotateStartMouseAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;

        let newRot = this._rotateStartObjectRot + delta;
        if (shift) {
            const snap = (15 * Math.PI) / 180;
            newRot = Math.round(newRot / snap) * snap;
        }

        obj.rotation = newRot;
        props.rotation = (newRot * 180) / Math.PI;

        const pivotGlobal = new PIXI.Point();
        obj.toGlobal(this._rotatePivotLocal, pivotGlobal);
        const pPivot = parent.toLocal(pivotGlobal);
        const pTarget = parent.toLocal(this._rotateCenterGlobal);
        obj.x += pTarget.x - pPivot.x;
        obj.y += pTarget.y - pPivot.y;
        props.x = obj.x;
        props.y = obj.y;

        this.updateTransform();

        if (this.engine.onObjectSelected) {
            this.engine.onObjectSelected(this.selectedObject);
        }
        if (this.engine.editorUI) {
            const deg = ((newRot * 180) / Math.PI).toFixed(1);
            this.engine.editorUI.updateStatus(`旋转 ${deg}°（Shift：15° 吸附）`);
        }
    }

    /**
     * 有旋转时：根据 AABB 变化估算均匀缩放，保持局部几何中心在父坐标中不动
     */
    _applyTransformRotatedUniform(bounds) {
        const obj = this.selectedObject.displayObject;
        const props = this.selectedObject.properties;
        const oldB = this.objStartBounds;
        const sx = bounds.width / Math.max(1e-6, oldB.width);
        const sy = bounds.height / Math.max(1e-6, oldB.height);
        let s = 1;
        switch (this.dragHandle) {
            case 'middleLeft':
            case 'middleRight':
                s = sx;
                break;
            case 'topCenter':
            case 'bottomCenter':
                s = sy;
                break;
            default:
                s = (sx + sy) / 2;
        }
        s = Math.max(0.05, s);

        const lb = obj.getLocalBounds();
        const lc = new PIXI.Point(lb.x + lb.width / 2, lb.y + lb.height / 2);
        const beforeG = new PIXI.Point();
        obj.toGlobal(lc, beforeG);
        const parent = obj.parent;
        const beforeP = parent ? parent.toLocal(beforeG) : beforeG;

        const t = this.selectedObject.type;
        if (t === 'rectangle') {
            props.width = Math.max(10, props.width * s);
            props.height = Math.max(10, props.height * s);
            this.engine.redrawRectangle(this.selectedObject, props);
        } else if (t === 'sprite') {
            const nw = Math.max(10, obj.width * s);
            const nh = Math.max(10, obj.height * s);
            obj.width = nw;
            obj.height = nh;
            props.width = nw;
            props.height = nh;
        } else if (t === 'circle') {
            const r = Math.max(5, (props.radius || 50) * s);
            props.radius = r;
            obj.clear();
            obj.beginFill(props.color || 0x2ecc71);
            obj.drawCircle(r, r, r);
            obj.endFill();
        } else if (t === 'text') {
            const fs = Math.max(8, Math.round((props.fontSize || 24) * s));
            props.fontSize = fs;
            obj.style.fontSize = fs;
        } else if (t === 'container') {
            props.width = Math.max(10, (props.width || 100) * s);
            props.height = Math.max(10, (props.height || 100) * s);
        }

        const afterG = new PIXI.Point();
        obj.toGlobal(lc, afterG);
        const afterP = parent ? parent.toLocal(afterG) : afterG;
        if (parent) {
            obj.x += beforeP.x - afterP.x;
            obj.y += beforeP.y - afterP.y;
        }
        props.x = obj.x;
        props.y = obj.y;
    }

    /**
     * 应用变换到对象（无旋转或旋转≈0）
     */
    applyTransform(bounds) {
        const obj = this.selectedObject.displayObject;
        const props = this.selectedObject.properties;

        obj.x = bounds.x;
        obj.y = bounds.y;
        props.x = bounds.x;
        props.y = bounds.y;
        
        // 根据对象类型调整大小
        if (this.selectedObject.type === 'rectangle') {
            props.width = bounds.width;
            props.height = bounds.height;
            this.engine.redrawRectangle(this.selectedObject, props);
        } else if (this.selectedObject.type === 'sprite') {
            obj.width = bounds.width;
            obj.height = bounds.height;
            props.width = bounds.width;
            props.height = bounds.height;
        } else if (this.selectedObject.type === 'circle') {
            const radius = Math.min(bounds.width, bounds.height) / 2;
            props.radius = radius;
            
            // 重绘圆形
            obj.clear();
            obj.beginFill(props.color || 0x2ecc71);
            obj.drawCircle(radius, radius, radius);
            obj.endFill();
        } else if (this.selectedObject.type === 'text') {
            // 文本根据宽度/高度调整字体大小
            const originalBounds = this.objStartBounds;
            const scaleX = bounds.width / originalBounds.width;
            const scaleY = bounds.height / originalBounds.height;
            const scale = Math.min(scaleX, scaleY); // 使用较小的缩放比例保持比例
            
            const originalFontSize = this.objStartFontSize || 24;
            const newFontSize = Math.max(8, Math.round(originalFontSize * scale));
            
            obj.style.fontSize = newFontSize;
            props.fontSize = newFontSize;
        } else if (this.selectedObject.type === 'container') {
            // 容器需要特殊处理
            props.width = bounds.width;
            props.height = bounds.height;
        } else if (['button', 'progressBar', 'inputField'].includes(this.selectedObject.type)) {
            props.width = bounds.width;
            props.height = bounds.height;
            obj.x = bounds.x;
            obj.y = bounds.y;
            props.x = bounds.x;
            props.y = bounds.y;
            this.engine.updateObjectProperties(this.selectedObject, {
                width: bounds.width,
                height: bounds.height,
                x: bounds.x,
                y: bounds.y
            });
        } else if (this.selectedObject.type === 'nineSlice') {
            props.width = bounds.width;
            props.height = bounds.height;
            obj.x = bounds.x;
            obj.y = bounds.y;
            props.x = bounds.x;
            props.y = bounds.y;
            obj.width = bounds.width;
            obj.height = bounds.height;
        }
    }
    
    /**
     * 鼠标释放处理
     */
    onPointerUp() {
        if (this.isDragging) {
            const wasRotate = this.dragHandle === 'rotate';
            this.isDragging = false;
            this.dragHandle = null;
            this._rotateCenterGlobal = null;
            this._rotatePivotLocal = null;

            this.engine.historyManager.saveState(wasRotate ? '旋转' : '调整大小');
        }
    }
    
    /**
     * 显示控制框
     */
    show() {
        this.container.visible = true;
    }
    
    /**
     * 隐藏控制框
     */
    hide() {
        this.container.visible = false;
        this.selectedObject = null;
    }
    
    /**
     * 销毁
     */
    destroy() {
        this.container.destroy({ children: true });
    }
}
