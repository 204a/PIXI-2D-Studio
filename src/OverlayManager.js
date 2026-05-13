/**
 * 画布覆盖层：标尺（DOM Canvas）
 * 对齐辅助改用场景内固定网格（GridSystem），不再使用拖拽参考线。
 */

import * as PIXI from 'pixi.js';

export class OverlayManager {
    constructor(engine) {
        this.engine = engine;
        this.enabledRuler = true;
        this.enabledPlayViewportFrame = true;
        this.playViewportFrame = null;

        this._initDom();
        this._initPlayViewportFrame();
        this.update();
    }

    _initDom() {
        this.overlay = document.getElementById('overlay-ui');
        this.canvasTop = document.getElementById('ruler-top');
        this.canvasLeft = document.getElementById('ruler-left');

        if (this.canvasTop) this.canvasTop.style.pointerEvents = 'auto';
        if (this.canvasLeft) this.canvasLeft.style.pointerEvents = 'auto';
    }

    _initPlayViewportFrame() {
        const parent = this.engine.viewportController
            ? this.engine.viewportController.viewport
            : this.engine.app.stage;
        if (!parent) return;

        this.playViewportFrame = new PIXI.Graphics();
        this.playViewportFrame.eventMode = 'none';
        this.playViewportFrame.zIndex = 999999;
        parent.sortableChildren = true;
        parent.addChild(this.playViewportFrame);
    }

    setRulerEnabled(v) {
        this.enabledRuler = !!v;
        this._syncVisibility();
        this.update();
    }

    _syncVisibility() {
        if (this.canvasTop) this.canvasTop.style.display = this.enabledRuler ? 'block' : 'none';
        if (this.canvasLeft) this.canvasLeft.style.display = this.enabledRuler ? 'block' : 'none';
        const corner = document.getElementById('ruler-corner');
        if (corner) corner.style.display = this.enabledRuler ? 'block' : 'none';
    }

    _getViewport() {
        return this.engine.viewportController;
    }

    /**
     * 标尺绘制
     */
    update() {
        this._syncVisibility();
        this._drawPlayViewportFrame();
        if (this.enabledRuler) {
            this._drawRulers();
        }
    }

    _drawPlayViewportFrame() {
        if (!this.playViewportFrame) return;

        const g = this.playViewportFrame;
        g.clear();
        g.visible = !!this.enabledPlayViewportFrame;
        if (!g.visible) return;

        const ps = this.engine.projectSettings || {};
        const w = Math.max(1, Number(ps.designWidth) || 800);
        const h = Math.max(1, Number(ps.designHeight) || 600);
        const scale = this.engine.viewportController?.scale || 1;
        const lw = 2 / scale;
        const tick = 14 / scale;

        // 运行时可见范围：左上角为世界坐标 (0,0)，大小来自项目设计宽高。
        g.lineStyle(lw, 0xffc107, 0.95);
        g.drawRect(0, 0, w, h);

        g.lineStyle(lw, 0xfff3cd, 0.9);
        g.moveTo(0, 0);
        g.lineTo(tick, 0);
        g.moveTo(0, 0);
        g.lineTo(0, tick);
        g.moveTo(w, 0);
        g.lineTo(w - tick, 0);
        g.moveTo(w, 0);
        g.lineTo(w, tick);
        g.moveTo(0, h);
        g.lineTo(tick, h);
        g.moveTo(0, h);
        g.lineTo(0, h - tick);
        g.moveTo(w, h);
        g.lineTo(w - tick, h);
        g.moveTo(w, h);
        g.lineTo(w, h - tick);
    }

    _drawRulers() {
        const vp = this._getViewport();
        if (!vp || !this.canvasTop || !this.canvasLeft) return;

        const rect = document.getElementById('game-canvas')?.getBoundingClientRect();
        if (!rect) return;

        const dpr = window.devicePixelRatio || 1;
        const topW = Math.max(1, rect.width - 20);
        const topH = 20;
        const leftW = 20;
        const leftH = Math.max(1, rect.height - 20);

        const setCanvasSize = (c, w, h) => {
            c.style.width = w + 'px';
            c.style.height = h + 'px';
            c.width = Math.floor(w * dpr);
            c.height = Math.floor(h * dpr);
        };

        setCanvasSize(this.canvasTop, topW, topH);
        setCanvasSize(this.canvasLeft, leftW, leftH);

        const ctxTop = this.canvasTop.getContext('2d');
        const ctxLeft = this.canvasLeft.getContext('2d');
        if (!ctxTop || !ctxLeft) return;

        const paintBg = (ctx, w, h) => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(37,37,37,0.9)';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(0, h - 0.5);
            ctx.lineTo(w, h - 0.5);
            ctx.stroke();
        };
        paintBg(ctxTop, topW, topH);
        paintBg(ctxLeft, leftW, leftH);

        const scale = vp.scale;
        const majorPx = 50;
        const minorPx = 10;
        const majorsPerCycle = majorPx / minorPx;

        const drawTicksX = () => {
            ctxTop.fillStyle = '#aaa';
            ctxTop.strokeStyle = '#666';
            ctxTop.font = '10px Arial';
            const startWorld = vp.screenToWorld(20, 0).x;
            const endWorld = vp.screenToWorld(rect.width, 0).x;
            const minorWorldStep = minorPx / scale;
            if (minorWorldStep <= 0) return;

            const nMin = Math.ceil(Math.min(startWorld, endWorld) / minorWorldStep - 1e-9);
            const nMax = Math.floor(Math.max(startWorld, endWorld) / minorWorldStep + 1e-9);
            let lastLabelRight = -Infinity;

            for (let n = nMin; n <= nMax; n++) {
                const w = n * minorWorldStep;
                const sx = vp.worldToScreen(w, 0).x - 20;
                if (sx < -8 || sx > topW + 8) continue;

                const isMajor = n % majorsPerCycle === 0;
                const len = isMajor ? 10 : 5;
                ctxTop.beginPath();
                ctxTop.moveTo(sx + 0.5, topH);
                ctxTop.lineTo(sx + 0.5, topH - len);
                ctxTop.stroke();

                if (isMajor) {
                    const label = String(Math.round(w));
                    const tw = ctxTop.measureText(label).width;
                    const lx = sx + 2;
                    if (lx + tw < lastLabelRight + 3) continue;
                    if (lx + tw > topW + 2) continue;
                    ctxTop.fillText(label, lx, 10);
                    lastLabelRight = lx + tw;
                }
            }
        };

        const drawTicksY = () => {
            ctxLeft.fillStyle = '#aaa';
            ctxLeft.strokeStyle = '#666';
            ctxLeft.font = '10px Arial';
            const startWorld = vp.screenToWorld(0, 20).y;
            const endWorld = vp.screenToWorld(0, rect.height).y;
            const minorWorldStep = minorPx / scale;
            if (minorWorldStep <= 0) return;

            const nMin = Math.ceil(Math.min(startWorld, endWorld) / minorWorldStep - 1e-9);
            const nMax = Math.floor(Math.max(startWorld, endWorld) / minorWorldStep + 1e-9);
            let lastMajorSy = -Infinity;

            for (let n = nMin; n <= nMax; n++) {
                const w = n * minorWorldStep;
                const sy = vp.worldToScreen(0, w).y - 20;
                if (sy < -8 || sy > leftH + 8) continue;

                const isMajor = n % majorsPerCycle === 0;
                const len = isMajor ? 10 : 5;
                ctxLeft.beginPath();
                ctxLeft.moveTo(leftW, sy + 0.5);
                ctxLeft.lineTo(leftW - len, sy + 0.5);
                ctxLeft.stroke();

                if (isMajor) {
                    if (Math.abs(sy - lastMajorSy) < 12) continue;
                    const label = String(Math.round(w));
                    ctxLeft.save();
                    ctxLeft.translate(2, sy + 10);
                    ctxLeft.rotate(-Math.PI / 2);
                    ctxLeft.fillText(label, 0, 0);
                    ctxLeft.restore();
                    lastMajorSy = sy;
                }
            }
        };

        drawTicksX();
        drawTicksY();
    }
}
