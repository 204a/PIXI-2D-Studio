import * as PIXI from 'pixi.js';

/**
 * 场景固定网格（世界坐标）：显示 + 拖拽吸附（可与对齐 manager 组合使用）
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

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) {
            this.show();
        } else {
            this.hide();
        }
    }

    show() {
        this.enabled = true;
        this.visible = true;
        if (!this.gridGraphics) {
            this.gridGraphics = new PIXI.Graphics();
            this.gridGraphics.zIndex = -1000;
            const container = this.engine.viewportController
                ? this.engine.viewportController.viewport
                : this.engine.app.stage;
            container.addChildAt(this.gridGraphics, 0);
        }
        this.drawGrid();
    }

    hide() {
        this.enabled = false;
        this.visible = false;
        if (this.gridGraphics) {
            this.gridGraphics.clear();
        }
    }

    /**
     * 按当前视口可见范围绘制世界坐标网格
     */
    drawGrid() {
        if (!this.gridGraphics || !this.visible) return;

        const vp = this.engine.viewportController;
        const gs = this.gridSize;
        if (!vp || gs <= 0) return;

        const screenW = this.engine.app.screen.width;
        const screenH = this.engine.app.screen.height;

        const tl = vp.screenToWorld(0, 0);
        const tr = vp.screenToWorld(screenW, 0);
        const bl = vp.screenToWorld(0, screenH);
        const br = vp.screenToWorld(screenW, screenH);

        const minX = Math.min(tl.x, tr.x, bl.x, br.x);
        const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
        const minY = Math.min(tl.y, tr.y, bl.y, br.y);
        const maxY = Math.max(tl.y, tr.y, bl.y, br.y);

        const pad = gs * 2;
        const startX = Math.floor(minX / gs) * gs - pad;
        const endX = Math.ceil(maxX / gs) * gs + pad;
        const startY = Math.floor(minY / gs) * gs - pad;
        const endY = Math.ceil(maxY / gs) * gs + pad;

        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1, 0x555555, 0.35);

        for (let x = startX; x <= endX; x += gs) {
            this.gridGraphics.moveTo(x, startY);
            this.gridGraphics.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gs) {
            this.gridGraphics.moveTo(startX, y);
            this.gridGraphics.lineTo(endX, y);
        }
    }

    snap(value) {
        if (!this.snapEnabled) return value;
        const gs = this.gridSize;
        return Math.round(value / gs) * gs;
    }

    snapObject(gameObject) {
        if (!this.snapEnabled) return;

        gameObject.displayObject.x = this.snap(gameObject.displayObject.x);
        gameObject.displayObject.y = this.snap(gameObject.displayObject.y);
        gameObject.properties.x = gameObject.displayObject.x;
        gameObject.properties.y = gameObject.displayObject.y;
    }

    setGridSize(size) {
        const n = Number(size);
        if (!Number.isFinite(n)) return;
        this.gridSize = Math.max(4, Math.min(512, Math.round(n)));
        if (this.visible) {
            this.drawGrid();
        }
    }

    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
    }

    updateScale(_scale) {
        if (this.visible) {
            this.drawGrid();
        }
    }
}
