/**
 * 画布覆盖层：标尺 + 参考线
 * - 标尺随 viewport 缩放/平移变化
 * - 从标尺区域拖拽生成参考线；双击参考线删除
 */

export class OverlayManager {
    constructor(engine) {
        this.engine = engine;
        this.enabledRuler = true;
        this.enabledGuides = true;

        this.guides = []; // { axis:'x'|'y', world:number }
        this._draggingGuide = null; // { axis, startWorld }

        this._initDom();
        this.update();
    }

    _initDom() {
        this.overlay = document.getElementById('overlay-ui');
        this.canvasTop = document.getElementById('ruler-top');
        this.canvasLeft = document.getElementById('ruler-left');
        this.guidesLayer = document.getElementById('guides-layer');

        // 允许在标尺区域接收事件（否则 pointer-events:none）
        if (this.canvasTop) this.canvasTop.style.pointerEvents = 'auto';
        if (this.canvasLeft) this.canvasLeft.style.pointerEvents = 'auto';
        if (this.guidesLayer) this.guidesLayer.style.pointerEvents = 'auto';

        this.canvasTop?.addEventListener('pointerdown', (e) => this._onRulerDown(e, 'y'));
        this.canvasLeft?.addEventListener('pointerdown', (e) => this._onRulerDown(e, 'x'));
        window.addEventListener('pointermove', (e) => this._onPointerMove(e));
        window.addEventListener('pointerup', () => this._onPointerUp());
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this._hoverGuideEl) {
                const idx = parseInt(this._hoverGuideEl.getAttribute('data-guide-idx') || '-1', 10);
                if (idx >= 0) {
                    this.guides.splice(idx, 1);
                    this._renderGuides();
                }
            }
        });
    }

    setRulerEnabled(v) {
        this.enabledRuler = !!v;
        this._syncVisibility();
        this.update();
    }

    setGuidesEnabled(v) {
        this.enabledGuides = !!v;
        this._syncVisibility();
        this._renderGuides();
    }

    _syncVisibility() {
        if (!this.overlay) return;
        if (this.canvasTop) this.canvasTop.style.display = this.enabledRuler ? 'block' : 'none';
        if (this.canvasLeft) this.canvasLeft.style.display = this.enabledRuler ? 'block' : 'none';
        const corner = document.getElementById('ruler-corner');
        if (corner) corner.style.display = this.enabledRuler ? 'block' : 'none';
        if (this.guidesLayer) this.guidesLayer.style.display = this.enabledGuides ? 'block' : 'none';
    }

    _getViewport() {
        return this.engine.viewportController;
    }

    _onRulerDown(e, axis) {
        if (!this.enabledGuides) return;
        if (this.engine.isRunning) return;
        e.preventDefault();
        const vp = this._getViewport();
        if (!vp) return;

        const world = vp.screenToWorld(e.clientX, e.clientY);
        const worldVal = axis === 'x' ? world.x : world.y;
        this._draggingGuide = { axis, world: worldVal };

        // 临时参考线
        this._tempEl?.remove();
        this._tempEl = this._createGuideEl(axis, worldVal, true);
        this.guidesLayer.appendChild(this._tempEl);
        this._positionGuideEl(this._tempEl, axis, worldVal);
    }

    _onPointerMove(e) {
        if (!this._draggingGuide) return;
        const vp = this._getViewport();
        if (!vp) return;
        const world = vp.screenToWorld(e.clientX, e.clientY);
        const worldVal = this._draggingGuide.axis === 'x' ? world.x : world.y;
        this._draggingGuide.world = worldVal;
        if (this._tempEl) this._positionGuideEl(this._tempEl, this._draggingGuide.axis, worldVal);
    }

    _onPointerUp() {
        if (!this._draggingGuide) return;
        const { axis, world } = this._draggingGuide;
        this._draggingGuide = null;
        this._tempEl?.remove();
        this._tempEl = null;

        // 过滤太靠边的误拖
        if (Number.isFinite(world)) {
            this.guides.push({ axis, world });
            this._renderGuides();
        }
    }

    _createGuideEl(axis, worldVal, isTemp = false) {
        const el = document.createElement('div');
        el.className = 'guide-line';
        el.style.position = 'absolute';
        el.style.background = isTemp ? 'rgba(255,255,255,0.55)' : 'rgba(186, 85, 211, 0.9)';
        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.25)';
        el.style.pointerEvents = 'auto';
        el.style.cursor = axis === 'x' ? 'ew-resize' : 'ns-resize';
        el.style.zIndex = 5000;

        if (axis === 'x') {
            el.style.top = '0px';
            el.style.bottom = '0px';
            el.style.width = '1px';
        } else {
            el.style.left = '0px';
            el.style.right = '0px';
            el.style.height = '1px';
        }

        if (!isTemp) {
            el.title = '双击删除参考线';
            el.addEventListener('dblclick', () => {
                const idx = parseInt(el.getAttribute('data-guide-idx') || '-1', 10);
                if (idx >= 0) {
                    this.guides.splice(idx, 1);
                    this._renderGuides();
                }
            });
            el.addEventListener('mouseenter', () => { this._hoverGuideEl = el; });
            el.addEventListener('mouseleave', () => { this._hoverGuideEl = null; });
        }

        return el;
    }

    _positionGuideEl(el, axis, worldVal) {
        const vp = this._getViewport();
        if (!vp) return;
        const p = vp.worldToScreen(axis === 'x' ? worldVal : 0, axis === 'y' ? worldVal : 0);
        if (axis === 'x') {
            el.style.left = `${Math.round(p.x)}px`;
        } else {
            el.style.top = `${Math.round(p.y)}px`;
        }
    }

    _renderGuides() {
        if (!this.guidesLayer) return;
        this.guidesLayer.innerHTML = '';
        if (!this.enabledGuides) return;

        this.guides.forEach((g, idx) => {
            const el = this._createGuideEl(g.axis, g.world, false);
            el.setAttribute('data-guide-idx', String(idx));
            this.guidesLayer.appendChild(el);
            this._positionGuideEl(el, g.axis, g.world);
        });
    }

    /**
     * 给拖拽用的吸附：返回 {snapX, snapY}（世界坐标）
     */
    snapToGuides(worldX, worldY, thresholdWorld = 5) {
        if (!this.enabledGuides) return null;
        const vp = this._getViewport();
        const scale = vp ? vp.scale : 1;
        const threshold = thresholdWorld / Math.max(0.0001, scale); // 屏幕 5px → 世界距离

        let snapX = null;
        let snapY = null;
        for (const g of this.guides) {
            if (g.axis === 'x') {
                if (Math.abs(worldX - g.world) <= threshold) snapX = g.world;
            } else {
                if (Math.abs(worldY - g.world) <= threshold) snapY = g.world;
            }
        }
        if (snapX === null && snapY === null) return null;
        return { snapX, snapY };
    }

    /**
     * 标尺绘制
     */
    update() {
        this._syncVisibility();
        if (this.enabledGuides) this._renderGuides();
        if (!this.enabledRuler) return;
        this._drawRulers();
    }

    _drawRulers() {
        const vp = this._getViewport();
        if (!vp || !this.canvasTop || !this.canvasLeft) return;

        const rect = document.getElementById('game-canvas')?.getBoundingClientRect();
        if (!rect) return;

        // 同步 canvas 像素尺寸（避免模糊）
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
        // 每 50px 一个主刻度，最小 10px
        const majorPx = 50;
        const minorPx = 10;

        const drawTicksX = () => {
            ctxTop.fillStyle = '#aaa';
            ctxTop.strokeStyle = '#666';
            ctxTop.font = '10px Arial';
            const startWorld = vp.screenToWorld(20, 0).x;
            const endWorld = vp.screenToWorld(rect.width, 0).x;
            const startScreen = vp.worldToScreen(startWorld, 0).x;
            // 让刻度从一个整齐的 minor 开始
            const minorWorldStep = minorPx / scale;
            const first = Math.floor(startWorld / minorWorldStep) * minorWorldStep;
            for (let w = first; w <= endWorld; w += minorWorldStep) {
                const sx = vp.worldToScreen(w, 0).x - 20; // top ruler 左侧从 20 开始
                const isMajor = Math.abs(((w / (majorPx / scale)) % 1)) < 1e-6;
                const len = isMajor ? 10 : 5;
                ctxTop.beginPath();
                ctxTop.moveTo(sx + 0.5, topH);
                ctxTop.lineTo(sx + 0.5, topH - len);
                ctxTop.stroke();
                if (isMajor) {
                    const label = Math.round(w);
                    ctxTop.fillText(String(label), sx + 2, 10);
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
            const first = Math.floor(startWorld / minorWorldStep) * minorWorldStep;
            for (let w = first; w <= endWorld; w += minorWorldStep) {
                const sy = vp.worldToScreen(0, w).y - 20;
                const isMajor = Math.abs(((w / (majorPx / scale)) % 1)) < 1e-6;
                const len = isMajor ? 10 : 5;
                ctxLeft.beginPath();
                ctxLeft.moveTo(leftW, sy + 0.5);
                ctxLeft.lineTo(leftW - len, sy + 0.5);
                ctxLeft.stroke();
                if (isMajor) {
                    const label = Math.round(w);
                    ctxLeft.save();
                    ctxLeft.translate(2, sy + 10);
                    ctxLeft.rotate(-Math.PI / 2);
                    ctxLeft.fillText(String(label), 0, 0);
                    ctxLeft.restore();
                }
            }
        };

        drawTicksX();
        drawTicksY();
    }
}

