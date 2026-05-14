import Matter from 'matter-js';

/**
 * Matter.js 最小物理系统：
 * - 仅支持矩形/圆形刚体（像素单位）
 * - 支持对象初始旋转；默认固定角速度，避免碰撞后不可控自转
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
        /** 每帧填充 id→对象，同步刚体坐标时用 Map 查找比反复 find 更直观 */
        this._idToObj = new Map();
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

    _shapeInfo(gameObject) {
        const props = gameObject.properties || {};
        const shape = props.rigidShape || props.collisionShape || (gameObject.type === 'circle' ? 'circle' : 'rect');
        if (shape === 'circle') {
            const r = props.radius || Math.max(1, Math.min(props.width || 0, props.height || 0) / 2) || 20;
            return { shape, width: r * 2, height: r * 2, radius: r };
        }
        return {
            shape,
            width: Math.max(1, props.width || 50),
            height: Math.max(1, props.height || 50),
            radius: 0
        };
    }

    _centerFromTopLeft(props, width, height, angle) {
        const x = props.x || 0;
        const y = props.y || 0;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return {
            x: x + c * width / 2 - s * height / 2,
            y: y + s * width / 2 + c * height / 2
        };
    }

    _topLeftFromCenter(cx, cy, width, height, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return {
            x: cx - c * width / 2 + s * height / 2,
            y: cy - s * width / 2 - c * height / 2
        };
    }

    _createBodyFor(gameObject) {
        const props = gameObject.properties || {};

        const isStatic = !!props.rigidStatic;
        const friction = typeof props.rigidFriction === 'number' ? props.rigidFriction : 0.1;
        // Matter 默认 frictionStatic=0.5，远大于面板里的 friction，碰撞时会「焊死」难以侧向挣脱；与摩擦系数对齐可明显减弱粘连
        const frictionStatic =
            typeof props.rigidFrictionStatic === 'number'
                ? props.rigidFrictionStatic
                : friction;
        const restitution =
            typeof props.rigidRestitution === 'number' ? props.rigidRestitution : 0.0;
        const density = typeof props.rigidDensity === 'number' ? props.rigidDensity : 0.001;
        const frictionAir =
            typeof props.rigidFrictionAir === 'number' ? props.rigidFrictionAir : 0;
        const angle = ((Number(props.rotation) || 0) * Math.PI) / 180;

        const info = this._shapeInfo(gameObject);
        const center = this._centerFromTopLeft(props, info.width, info.height, angle);

        const bodyOpts = {
            isStatic,
            friction,
            frictionStatic,
            restitution,
            density,
            frictionAir,
            // 默认 slop 偏大时，小物体弹跳会被接触修正吃掉一部分能量。
            slop: 0.01
        };

        let body = null;
        if (info.shape === 'circle') {
            body = Matter.Bodies.circle(center.x, center.y, info.radius, bodyOpts);
        } else {
            body = Matter.Bodies.rectangle(center.x, center.y, info.width, info.height, bodyOpts);
        }

        if (!body) return null;

        // 让碰撞回调能反查到对象
        body.plugin = body.plugin || {};
        body.plugin.gameObjectId = gameObject.id;

        // 保留用户设置的初始角度，但固定角速度，避免碰撞后不断自转。
        Matter.Body.setInertia(body, Infinity);
        Matter.Body.setAngle(body, angle);

        return body;
    }

    /**
     * 每帧：模拟一步 Matter → 把刚体坐标写回 Pixi 精灵（仅运行态调用）
     */
    update(deltaTime) {
        if (!this.matterEngine || !this.world) return;

        // 上一帧收集到的碰撞对，留给「物理碰撞进入」条件作对照
        this._collisionEnterPairsLastStep = this._collisionEnterPairsThisStep;
        this._collisionEnterPairsThisStep = new Set();

        const ms = Math.max(0, deltaTime) * 1000;
        Matter.Engine.update(this.matterEngine, ms);

        this._fillGameObjectMap(this._idToObj);
        this._syncEachBodyToSprite(this._idToObj);
    }

    _fillGameObjectMap(map) {
        map.clear();
        const list = this.engine.gameObjects;
        for (let i = 0; i < list.length; i++) {
            map.set(list[i].id, list[i]);
        }
    }

    /** Matter.Body.position 是中心点；Pixi 矩形一般为左上角，圆形按半径偏移 */
    _syncEachBodyToSprite(idToObj) {
        for (const [id, body] of this.bodies.entries()) {
            const obj = idToObj.get(id);
            if (!obj?.displayObject) continue;
            const props = obj.properties || {};

            const info = this._shapeInfo(obj);
            const disp = obj.displayObject;
            if (disp.pivot?.set) {
                disp.pivot.set(info.width / 2, info.height / 2);
            }
            disp.x = body.position.x;
            disp.y = body.position.y;
            disp.rotation = body.angle;

            const topLeft = this._topLeftFromCenter(body.position.x, body.position.y, info.width, info.height, body.angle);
            props.x = topLeft.x;
            props.y = topLeft.y;
            props.rotation = (body.angle * 180) / Math.PI;
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

