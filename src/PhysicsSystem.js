import Matter from 'matter-js';

/**
 * Matter.js 最小物理系统：
 * - 仅支持矩形/圆形刚体（像素单位）
 * - 固定角度（避免 Pixi 以左上角为旋转中心导致的视觉偏移）
 * - 记录 collisionStart 作为 “物理碰撞进入”
 */
export class PhysicsSystem {
    constructor(engine) {
        this.engine = engine;
        this.matterEngine = null;
        this.world = null;
        /** @type {Map<string, any>} */
        this.bodies = new Map(); // gameObject.id -> Matter.Body

        /** @type {Set<string>} */
        this._collisionEnterPairsThisStep = new Set();
        /** @type {Set<string>} */
        this._collisionEnterPairsLastStep = new Set();
    }

    static _pairKey(idA, idB) {
        return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
    }

    isEnabledFor(gameObject) {
        return !!gameObject?.properties?.rigidEnabled;
    }

    start() {
        this.stop();

        this.matterEngine = Matter.Engine.create();
        this.world = this.matterEngine.world;
        // 像素单位下给一个“看起来像重力”的默认值
        this.world.gravity.y = 1;

        this._collisionEnterPairsThisStep.clear();
        this._collisionEnterPairsLastStep.clear();

        Matter.Events.on(this.matterEngine, 'collisionStart', (evt) => {
            if (!evt?.pairs) return;
            for (const p of evt.pairs) {
                const aId = p.bodyA?.plugin?.gameObjectId;
                const bId = p.bodyB?.plugin?.gameObjectId;
                if (!aId || !bId) continue;
                this._collisionEnterPairsThisStep.add(PhysicsSystem._pairKey(aId, bId));
            }
        });

        this._rebuildBodies();
    }

    stop() {
        if (this.matterEngine) {
            try {
                Matter.World.clear(this.matterEngine.world, false);
                Matter.Engine.clear(this.matterEngine);
            } catch (_) {}
        }
        this.matterEngine = null;
        this.world = null;
        this.bodies.clear();
        this._collisionEnterPairsThisStep.clear();
        this._collisionEnterPairsLastStep.clear();
    }

    _rebuildBodies() {
        this.bodies.clear();
        if (!this.matterEngine || !this.world) return;

        for (const obj of this.engine.gameObjects) {
            if (!this.isEnabledFor(obj)) continue;
            const body = this._createBodyFor(obj);
            if (!body) continue;
            this.bodies.set(obj.id, body);
            Matter.World.add(this.world, body);
        }
    }

    _createBodyFor(gameObject) {
        const props = gameObject.properties || {};

        const isStatic = !!props.rigidStatic;
        const friction = typeof props.rigidFriction === 'number' ? props.rigidFriction : 0.1;
        const restitution =
            typeof props.rigidRestitution === 'number' ? props.rigidRestitution : 0.0;
        const density = typeof props.rigidDensity === 'number' ? props.rigidDensity : 0.001;

        const shape = props.rigidShape || props.collisionShape || (gameObject.type === 'circle' ? 'circle' : 'rect');

        let body = null;
        if (shape === 'circle') {
            const r = props.radius || Math.max(1, Math.min(props.width || 0, props.height || 0) / 2) || 20;
            const cx = (props.x || 0) + r;
            const cy = (props.y || 0) + r;
            body = Matter.Bodies.circle(cx, cy, r, {
                isStatic,
                friction,
                restitution,
                density
            });
        } else {
            const w = Math.max(1, props.width || 50);
            const h = Math.max(1, props.height || 50);
            const cx = (props.x || 0) + w / 2;
            const cy = (props.y || 0) + h / 2;
            body = Matter.Bodies.rectangle(cx, cy, w, h, {
                isStatic,
                friction,
                restitution,
                density
            });
        }

        if (!body) return null;

        // 让碰撞回调能反查到对象
        body.plugin = body.plugin || {};
        body.plugin.gameObjectId = gameObject.id;

        // 最小版：固定角度，避免 Pixi 左上角旋转中心导致偏移
        Matter.Body.setInertia(body, Infinity);
        Matter.Body.setAngle(body, 0);

        return body;
    }

    /**
     * 每帧推进物理并同步到 Pixi（仅在运行态调用）
     */
    update(deltaTime) {
        if (!this.matterEngine || !this.world) return;

        // collisionEnter：把上一步的集合留作 baseline
        this._collisionEnterPairsLastStep = this._collisionEnterPairsThisStep;
        this._collisionEnterPairsThisStep = new Set();

        const ms = Math.max(0, deltaTime) * 1000;
        Matter.Engine.update(this.matterEngine, ms);

        // 同步刚体到显示对象
        for (const [id, body] of this.bodies.entries()) {
            const obj = this.engine.gameObjects.find((o) => o.id === id);
            if (!obj?.displayObject) continue;
            const props = obj.properties || {};

            const shape = props.rigidShape || props.collisionShape || (obj.type === 'circle' ? 'circle' : 'rect');
            if (shape === 'circle') {
                const r = props.radius || (body.circleRadius || 20);
                obj.displayObject.x = body.position.x - r;
                obj.displayObject.y = body.position.y - r;
            } else {
                const w = Math.max(1, props.width || 50);
                const h = Math.max(1, props.height || 50);
                obj.displayObject.x = body.position.x - w / 2;
                obj.displayObject.y = body.position.y - h / 2;
            }

            props.x = obj.displayObject.x;
            props.y = obj.displayObject.y;
        }
    }

    /**
     * 物理碰撞进入：本步碰撞且上一步未碰撞同一对象
     */
    checkCollisionEnterWithTag(gameObject, tag) {
        if (!this.matterEngine) return false;
        if (!gameObject?.id) return false;

        const candidates = this.engine.gameObjects.filter(
            (o) => o.properties?.tag === tag && o.id !== gameObject.id
        );
        if (candidates.length === 0) return false;

        for (const other of candidates) {
            const key = PhysicsSystem._pairKey(gameObject.id, other.id);
            if (this._collisionEnterPairsLastStep.has(key)) continue;
            if (this._collisionEnterPairsThisStep.has(key)) return true;
        }
        return false;
    }
}

