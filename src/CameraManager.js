import { Point } from 'pixi.js';

/**
 * 运行态相机：跟随目标对象 + 世界边界限制（视口坐标系与 ViewportController 一致）
 */
export class CameraManager {
    constructor(engine) {
        this.engine = engine;
        this.followTargetId = null;
        /** @type {{ x: number, y: number, width: number, height: number } | null} */
        this.bounds = null;
        this.smoothing = 0.12;
        this.enabled = true;
        this._savedViewport = null;
    }

    export() {
        return {
            followTargetId: this.followTargetId,
            bounds: this.bounds,
            smoothing: this.smoothing,
            enabled: this.enabled
        };
    }

    import(data) {
        if (!data || typeof data !== 'object') {
            this.followTargetId = null;
            this.bounds = null;
            this.smoothing = 0.12;
            this.enabled = true;
            return;
        }
        this.followTargetId = data.followTargetId ?? null;
        this.bounds = data.bounds ?? null;
        this.smoothing = typeof data.smoothing === 'number' ? data.smoothing : 0.12;
        this.enabled = data.enabled !== false;
    }

    onPlay() {
        const vc = this.engine.viewportController;
        if (vc) {
            this._savedViewport = {
                x: vc.viewport.x,
                y: vc.viewport.y,
                scale: vc.scale
            };
        }
    }

    onStop() {
        const vc = this.engine.viewportController;
        if (vc && this._savedViewport) {
            vc.viewport.x = this._savedViewport.x;
            vc.viewport.y = this._savedViewport.y;
            vc.setZoom(this._savedViewport.scale);
            this._savedViewport = null;
        }
    }

    /**
     * @param {PIXI.Container} root — 运行时 world 容器；编辑器不传则用 viewportController.viewport
     */
    updateRuntimeFollow(deltaTime, root = null) {
        if (!this.enabled || !this.followTargetId) return;
        const obj = this.engine.gameObjects.find((o) => o.id === this.followTargetId);
        if (!obj || !obj.displayObject) return;

        const p = new Point();
        obj.displayObject.getGlobalPosition(p);

        const sw = this.engine.app.screen.width;
        const sh = this.engine.app.screen.height;
        const cx = sw / 2;
        const cy = sh / 2;

        const dx = cx - p.x;
        const dy = cy - p.y;
        const smooth = Math.min(1, this.smoothing);
        const k = 1 - Math.pow(1 - smooth, deltaTime * 60);

        if (root) {
            root.x += dx * k;
            root.y += dy * k;
            if (this.bounds && this.bounds.width > 0 && this.bounds.height > 0) {
                this._clampContainer(root, 1, sw, sh);
            }
        } else {
            const vc = this.engine.viewportController;
            if (!vc) return;
            vc.viewport.x += dx * k;
            vc.viewport.y += dy * k;
            if (this.bounds && this.bounds.width > 0 && this.bounds.height > 0) {
                this._clampViewport(vc, sw, sh);
            }
        }
    }

    update(deltaTime) {
        if (!this.engine.isRunning) return;
        this.updateRuntimeFollow(deltaTime, null);
    }

    _clampViewport(vc, sw, sh) {
        const s = vc.scale;
        const b = this.bounds;
        let minX = sw - (b.x + b.width) * s;
        let maxX = -b.x * s;
        if (minX > maxX) {
            const t = (minX + maxX) / 2;
            minX = maxX = t;
        }
        let minY = sh - (b.y + b.height) * s;
        let maxY = -b.y * s;
        if (minY > maxY) {
            const t = (minY + maxY) / 2;
            minY = maxY = t;
        }
        vc.viewport.x = Math.max(minX, Math.min(maxX, vc.viewport.x));
        vc.viewport.y = Math.max(minY, Math.min(maxY, vc.viewport.y));
    }

    _clampContainer(world, scale, sw, sh) {
        const b = this.bounds;
        let minX = sw - (b.x + b.width) * scale;
        let maxX = -b.x * scale;
        if (minX > maxX) {
            const t = (minX + maxX) / 2;
            minX = maxX = t;
        }
        let minY = sh - (b.y + b.height) * scale;
        let maxY = -b.y * scale;
        if (minY > maxY) {
            const t = (minY + maxY) / 2;
            minY = maxY = t;
        }
        world.x = Math.max(minX, Math.min(maxX, world.x));
        world.y = Math.max(minY, Math.min(maxY, world.y));
    }
}
