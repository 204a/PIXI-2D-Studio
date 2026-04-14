import * as PIXI from 'pixi.js';

/**
 * 网格和对齐系统
 */

export class GridSystem {
    constructor(engine) {
        this.engine = engine;
        this.enabled = false;
        this.visible = false;
        this.gridSize = 20;
        this.snapEnabled = true;
        this.gridGraphics = null;
    }
    
    /**
     * 切换网格显示
     */
    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    /**
     * 显示网格
     */
    show() {
        this.enabled = true;
        this.visible = true;
        if (!this.gridGraphics) {
            this.gridGraphics = new PIXI.Graphics();
            this.gridGraphics.zIndex = -1000; // 确保在最底层
            // 添加到viewport或stage
            const container = this.engine.viewportController ? this.engine.viewportController.viewport : this.engine.app.stage;
            container.addChildAt(this.gridGraphics, 0);
        }
        this.drawGrid();
    }
    
    /**
     * 隐藏网格
     */
    hide() {
        this.enabled = false;
        if (this.gridGraphics) {
            this.gridGraphics.clear();
        }
    }
    
    /**
     * 绘制网格
     */
    drawGrid() {
        if (!this.gridGraphics) return;
        
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1, 0x333333, 0.3);
        
        const width = this.engine.app.screen.width;
        const height = this.engine.app.screen.height;
        
        // 绘制竖线
        for (let x = 0; x <= width; x += this.gridSize) {
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, height);
        }
        
        // 绘制横线
        for (let y = 0; y <= height; y += this.gridSize) {
            this.gridGraphics.moveTo(0, y);
            this.gridGraphics.lineTo(width, y);
        }
    }
    
    /**
     * 吸附坐标到网格
     */
    snap(value) {
        if (!this.snapEnabled) return value;
        return Math.round(value / this.gridSize) * this.gridSize;
    }
    
    /**
     * 吸附对象到网格
     */
    snapObject(gameObject) {
        if (!this.snapEnabled) return;
        
        gameObject.displayObject.x = this.snap(gameObject.displayObject.x);
        gameObject.displayObject.y = this.snap(gameObject.displayObject.y);
        gameObject.properties.x = gameObject.displayObject.x;
        gameObject.properties.y = gameObject.displayObject.y;
    }
    
    /**
     * 设置网格大小
     */
    setGridSize(size) {
        this.gridSize = Math.max(5, Math.min(100, size));
        if (this.enabled) {
            this.drawGrid();
        }
    }
    
    /**
     * 切换吸附
     */
    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
    }
    
    /**
     * 更新缩放（响应viewport缩放）
     */
    updateScale(scale) {
        // 网格不需要缩放，因为它在viewport内部
        // 但可以根据缩放级别调整网格密度
        if (this.enabled) {
            this.drawGrid();
        }
    }
}

