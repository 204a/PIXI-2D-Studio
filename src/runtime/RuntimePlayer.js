import * as PIXI from 'pixi.js';
import { NineSlicePlane } from '@pixi/mesh-extras';
import { BehaviorSystem } from '../BehaviorSystem.js';
import { ParticleSystem } from '../ParticleSystem.js';
import { HistoryManager } from '../HistoryManager.js';
import { InputManager } from '../InputManager.js';
import { PlatformerBehavior } from '../PlatformerBehavior.js';
import { ResourceManager } from '../ResourceManager.js';
import { AnimationSystem } from '../AnimationSystem.js';
import { TweenSystem } from '../TweenSystem.js';
import { AudioManager } from '../AudioManager.js';
import { CameraManager } from '../CameraManager.js';
import { PhysicsSystem } from '../PhysicsSystem.js';

/**
 * 纯运行时播放器：加载 sceneData 并直接游玩（无编辑 UI）
 */
export class RuntimePlayer {
    getWorldContainer() {
        return this.world || this.app.stage;
    }

    constructor(containerId) {
        this.containerId = containerId;
        this.app = null;
        this.world = null;
        this.gameObjects = [];
        this.selectedObject = null;
        this.isRunning = true;
        this.initialStates = [];
        this.cameraManager = null;

        // 系统
        this.behaviorSystem = new BehaviorSystem(this);
        this.particleSystem = null;
        this.historyManager = new HistoryManager(this);
        this.inputManager = new InputManager();
        this.resourceManager = new ResourceManager();
        this.animationSystem = new AnimationSystem(this);
        this.tweenSystem = new TweenSystem(this);
        this.audioManager = new AudioManager(this);
        this.platformerBehaviors = [];
        this.physicsSystem = new PhysicsSystem(this);
    }

    async start(sceneData) {
        await this._initPixi();
        this.cameraManager = new CameraManager(this);
        this.cameraManager.import(sceneData.camera || {});
        if (sceneData.project) {
            const ps = sceneData.project;
            if (ps.targetFPS > 0 && this.app.ticker) {
                this.app.ticker.maxFPS = ps.targetFPS;
            }
        }
        await this._loadResources(sceneData);
        if (sceneData.animations) {
            this.animationSystem.import(sceneData.animations);
        }
        this._buildObjects(sceneData);
        // 还原对象动画
        this.gameObjects.forEach((obj) => {
            if (obj.type === 'sprite' && obj.properties.animationName) {
                this.animationSystem.addAnimationToObject(obj, obj.properties.animationName, {
                    speed: obj.properties.animSpeed || 0.1,
                    autoPlay: true
                });
            }
        });
        this._restoreParenting(sceneData);
        this._setupPlatformerBehaviors();

        // 启动物理系统（Matter.js）
        if (this.physicsSystem) {
            this.physicsSystem.start();
        }

        if (sceneData.behaviors) {
            this.behaviorSystem.import(sceneData.behaviors);
        }

        this.particleSystem = new ParticleSystem(this);

        this._installTicker();
        this.behaviorSystem.start();
    }

    async _initPixi() {
        const root = document.getElementById(this.containerId);
        if (!root) throw new Error('找不到容器: ' + this.containerId);

        const w = root.clientWidth || window.innerWidth;
        const h = root.clientHeight || window.innerHeight;

        try {
            this.app = new PIXI.Application();
            if (typeof this.app.init === 'function') {
                await this.app.init({
                    width: w,
                    height: h,
                    backgroundColor: 0x111111,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            } else {
                throw new Error('no init');
            }
        } catch {
            this.app = new PIXI.Application({
                width: w,
                height: h,
                backgroundColor: 0x111111,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
        }

        const canvas = this.app.view || this.app.canvas;
        root.appendChild(canvas);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';

        this.world = new PIXI.Container();
        this.app.stage.addChild(this.world);

        window.addEventListener('resize', () => {
            const ww = root.clientWidth || window.innerWidth;
            const hh = root.clientHeight || window.innerHeight;
            this.app.renderer.resize(ww, hh);
        });
    }

    async _loadResources(sceneData) {
        const imgs = sceneData.imageResources;
        if (imgs && Array.isArray(imgs)) {
            for (const item of imgs) {
                if (item && item.name && item.url) {
                    await this.resourceManager.loadImageFromURL(item.url, item.name);
                }
            }
        }
        const audios = sceneData.audioResources;
        if (audios && Array.isArray(audios)) {
            for (const item of audios) {
                if (item && item.name && item.url) {
                    this.resourceManager.loadAudioFromURL(item.url, item.name);
                }
            }
        }
    }

    _buildObjects(sceneData) {
        this.gameObjects = [];
        const objects = sceneData.objects || [];
        for (const objData of objects) {
            const obj = this.createGameObject(objData.type, objData.properties, false);
            if (obj) {
                obj.id = objData.id;
                obj.parentId = objData.parentId;
            }
        }
    }

    _restoreParenting(sceneData) {
        const objects = sceneData.objects || [];
        for (const objData of objects) {
            if (!objData.parentId) continue;
            const child = this.gameObjects.find((g) => g.id === objData.id);
            const parent = this.gameObjects.find((g) => g.id === objData.parentId);
            if (child && parent && (parent.type === 'container' || parent.type === 'scrollView')) {
                // 使用存档中的局部坐标挂载
                if (child.displayObject.parent) child.displayObject.parent.removeChild(child.displayObject);
                const target =
                    parent.type === 'scrollView' && parent._scrollContent ? parent._scrollContent : parent.displayObject;
                target.addChild(child.displayObject);
                child.displayObject.x = child.properties.x ?? 0;
                child.displayObject.y = child.properties.y ?? 0;
            }
        }
    }

    _setupPlatformerBehaviors() {
        this.platformerBehaviors = [];
        this.gameObjects.forEach(obj => {
            if (obj.properties.isPlayer) {
                const controlType = obj.properties.controlType || 'arrows';
                const keys = controlType === 'wasd' ? {
                    leftKey: 'a',
                    rightKey: 'd',
                    jumpKey: 'w'
                } : {
                    leftKey: 'ArrowLeft',
                    rightKey: 'ArrowRight',
                    jumpKey: 'ArrowUp'
                };
                this.addPlatformerBehavior(obj, keys);
            }
        });
    }

    _installTicker() {
        this.app.ticker.add(() => {
            const deltaTime = this.app.ticker.deltaTime / 60;
            this.update(deltaTime);
        });
    }

    update(deltaTime) {
        if (!this.isRunning) return;

        if (this.particleSystem) this.particleSystem.update(deltaTime);

        const platforms = this.gameObjects.filter(o => o.properties.isPlatform);
        this.platformerBehaviors.forEach(behavior => {
            behavior.update(deltaTime, this.inputManager, platforms);
        });

        if (this.physicsSystem) {
            this.physicsSystem.update(deltaTime);
        }

        this.tweenSystem.update(deltaTime);
        this.inputManager.update();

        if (this.cameraManager && this.world) {
            this.cameraManager.updateRuntimeFollow(deltaTime, this.world);
        }
    }

    // ====== 被 BehaviorSystem/AnimationSystem 调用的接口（与 GameEngine 形状保持一致） ======

    addPlatformerBehavior(gameObject, config) {
        const behavior = new PlatformerBehavior(gameObject, config);
        this.platformerBehaviors.push(behavior);
        return behavior;
    }

    removePlatformerBehavior(gameObject) {
        const index = this.platformerBehaviors.findIndex(b => b.gameObject === gameObject);
        if (index > -1) this.platformerBehaviors.splice(index, 1);
    }

    // 运行态无需交互
    setupInteraction() {}

    redrawRectangle(gameObject, properties) {
        const obj = gameObject.displayObject;
        const props = gameObject.properties;
        if (properties.width) props.width = properties.width;
        if (properties.height) props.height = properties.height;
        obj.clear();
        obj.beginFill(props.color || 0xe74c3c);
        obj.drawRect(0, 0, props.width, props.height);
        obj.endFill();
    }

    redrawGraphics(gameObject) {
        const obj = gameObject.displayObject;
        const props = gameObject.properties;
        obj.clear();
        obj.beginFill(props.color);
        if (gameObject.type === 'rectangle' || gameObject.type === 'sprite') {
            obj.drawRect(0, 0, props.width, props.height);
        }
        obj.endFill();
    }

    updateObjectProperties(gameObject, properties) {
        const obj = gameObject.displayObject;
        if (properties.x !== undefined) {
            obj.x = properties.x;
            gameObject.properties.x = properties.x;
        }
        if (properties.y !== undefined) {
            obj.y = properties.y;
            gameObject.properties.y = properties.y;
        }
        if (properties.alpha !== undefined) {
            obj.alpha = properties.alpha;
            gameObject.properties.alpha = properties.alpha;
        }
        if (properties.rotation !== undefined) {
            obj.rotation = properties.rotation * Math.PI / 180;
            gameObject.properties.rotation = properties.rotation;
        }

        if (gameObject.type === 'scrollView') {
            const props = gameObject.properties;
            if (properties.width !== undefined) props.width = properties.width;
            if (properties.height !== undefined) props.height = properties.height;
            if (properties.contentHeight !== undefined) props.contentHeight = properties.contentHeight;
            if (properties.wheelEnabled !== undefined) props.wheelEnabled = !!properties.wheelEnabled;
            if (properties.scrollY !== undefined) props.scrollY = properties.scrollY;
            const w = props.width || 260;
            const h = props.height || 180;
            const maxScroll = Math.max(0, (props.contentHeight || 0) - h);
            props.scrollY = Math.max(0, Math.min(maxScroll, props.scrollY || 0));
            if (gameObject._scrollMask && gameObject._scrollMask.clear) {
                gameObject._scrollMask.clear();
                gameObject._scrollMask.beginFill(0xffffff);
                gameObject._scrollMask.drawRect(0, 0, w, h);
                gameObject._scrollMask.endFill();
            }
            const bg = obj.children && obj.children[0];
            if (bg && bg.clear) {
                bg.clear();
                bg.lineStyle(2, 0x888888, 0.8);
                bg.beginFill(0x000000, 0.15);
                bg.drawRoundedRect(0, 0, w, h, 6);
                bg.endFill();
            }
            obj.hitArea = new PIXI.Rectangle(0, 0, w, h);
            if (gameObject._scrollContent) {
                gameObject._scrollContent.y = -(props.scrollY || 0);
            }
        }
    }

    createGameObject(type, properties = {}, _saveHistory = false) {
        const gameObject = {
            id: `obj_${Date.now()}_${Math.random()}`,
            type,
            properties: {
                x: properties.x || 100,
                y: properties.y || 100,
                width: properties.width || 100,
                height: properties.height || 100,
                alpha: properties.alpha !== undefined ? properties.alpha : 1,
                rotation: properties.rotation || 0,
                scaleX: properties.scaleX || 1,
                scaleY: properties.scaleY || 1,
                ...properties
            },
            displayObject: null,
            parentId: null
        };

        switch (type) {
            case 'sprite':
                gameObject.displayObject = this._createSprite(gameObject.properties);
                break;
            case 'text':
                gameObject.displayObject = this._createText(gameObject.properties);
                break;
            case 'rectangle':
                gameObject.displayObject = this._createRect(gameObject.properties);
                break;
            case 'circle':
                gameObject.displayObject = this._createCircle(gameObject.properties);
                break;
            case 'container':
                gameObject.displayObject = this._createContainer(gameObject.properties);
                break;
            case 'particle':
                // 运行态先创建一个容器，占位；真正发射器由 ParticleSystem.createEmitter 管理
                gameObject.displayObject = new PIXI.Container();
                gameObject.displayObject.x = gameObject.properties.x;
                gameObject.displayObject.y = gameObject.properties.y;
                break;
            case 'button':
                gameObject.displayObject = this._createButton(gameObject);
                break;
            case 'progressBar':
                gameObject.displayObject = this._createProgressBar(gameObject);
                break;
            case 'inputField':
                gameObject.displayObject = this._createInputField(gameObject);
                break;
            case 'nineSlice':
                gameObject.displayObject = this._createNineSlice(gameObject.properties);
                break;
            case 'scrollView':
                gameObject.displayObject = this._createScrollView(gameObject);
                break;
            default:
                return null;
        }

        const container = this.world || this.app.stage;
        container.addChild(gameObject.displayObject);
        this.gameObjects.push(gameObject);
        return gameObject;
    }

    _createSprite(props) {
        let sprite;
        if (props.textureName) {
            const texture = this.resourceManager.getTexture(props.textureName);
            if (texture) {
                sprite = new PIXI.Sprite(texture);
                sprite.width = props.width || sprite.width;
                sprite.height = props.height || sprite.height;
            }
        }
        if (!sprite) {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(props.color || 0x3498db);
            graphics.drawRect(0, 0, props.width, props.height);
            graphics.endFill();
            sprite = graphics;
        }
        sprite.x = props.x;
        sprite.y = props.y;
        sprite.alpha = props.alpha;
        sprite.rotation = (props.rotation || 0) * Math.PI / 180;
        sprite.scale.set(props.scaleX || 1, props.scaleY || 1);
        return sprite;
    }

    _createText(props) {
        const text = new PIXI.Text(props.text || '文本', {
            fontFamily: props.fontFamily || 'Arial',
            fontSize: props.fontSize || 24,
            fill: props.color || 0xffffff,
            align: props.align || 'left'
        });
        text.x = props.x;
        text.y = props.y;
        text.alpha = props.alpha;
        text.rotation = (props.rotation || 0) * Math.PI / 180;
        return text;
    }

    _createRect(props) {
        const g = new PIXI.Graphics();
        g.beginFill(props.color || 0xe74c3c);
        g.drawRect(0, 0, props.width, props.height);
        g.endFill();
        g.x = props.x;
        g.y = props.y;
        g.alpha = props.alpha;
        g.rotation = (props.rotation || 0) * Math.PI / 180;
        return g;
    }

    _createCircle(props) {
        const g = new PIXI.Graphics();
        const r = props.radius || 50;
        g.beginFill(props.color || 0x2ecc71);
        g.drawCircle(r, r, r);
        g.endFill();
        g.x = props.x;
        g.y = props.y;
        g.alpha = props.alpha;
        return g;
    }

    _createContainer(props) {
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha;
        return c;
    }

    _createButton(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 120;
        const h = props.height || 40;
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha !== undefined ? props.alpha : 1;
        c.rotation = (props.rotation || 0) * Math.PI / 180;
        const bg = new PIXI.Graphics();
        const colors = {
            normal: props.colorNormal ?? 0x4a5fc7,
            hover: props.colorHover ?? 0x5d6fd8,
            pressed: props.colorPressed ?? 0x3547a0,
            disabled: props.colorDisabled ?? 0x666666
        };
        const draw = (fill) => {
            bg.clear();
            bg.beginFill(fill);
            bg.drawRoundedRect(0, 0, w, h, 8);
            bg.endFill();
        };
        const applyState = (st) => {
            if (props.disabled) {
                draw(colors.disabled);
                return;
            }
            if (st === 'hover') draw(colors.hover);
            else if (st === 'down') draw(colors.pressed);
            else draw(colors.normal);
        };
        applyState('normal');
        const label = new PIXI.Text(props.label || '按钮', {
            fontFamily: props.fontFamily || 'Arial',
            fontSize: props.fontSize || 16,
            fill: props.colorText ?? 0xffffff
        });
        label.anchor.set(0.5);
        label.x = w / 2;
        label.y = h / 2;
        c.addChild(bg, label);
        c.hitArea = new PIXI.Rectangle(0, 0, w, h);
        c.eventMode = 'static';
        gameObject._buttonLabel = label;
        gameObject._buttonBg = bg;
        c.on('pointerover', () => applyState('hover'));
        c.on('pointerout', () => applyState('normal'));
        c.on('pointerdown', () => applyState('down'));
        c.on('pointerup', () => applyState('hover'));
        c.on('pointerupoutside', () => applyState('normal'));
        return c;
    }

    _createProgressBar(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 200;
        const h = props.height || 24;
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha !== undefined ? props.alpha : 1;
        const bg = new PIXI.Graphics();
        bg.beginFill(props.colorBg ?? 0x222222);
        bg.drawRoundedRect(0, 0, w, h, 6);
        bg.endFill();
        const fill = new PIXI.Graphics();
        c.addChild(bg, fill);
        gameObject._progressFill = fill;
        this._applyProgress(gameObject, props.value ?? 0.5);
        return c;
    }

    _applyProgress(gameObject, raw) {
        const props = gameObject.properties;
        const v = Math.max(0, Math.min(1, Number(raw) || 0));
        props.value = v;
        const fill = gameObject._progressFill;
        if (!fill) return;
        const w = props.width || 200;
        const h = props.height || 24;
        fill.clear();
        fill.beginFill(props.colorFill ?? 0x27ae60);
        fill.drawRoundedRect(0, 0, w * v, h, 6);
        fill.endFill();
    }

    applyProgressBarValue(gameObject, raw) {
        this._applyProgress(gameObject, raw);
    }

    _createInputField(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 220;
        const h = props.height || 36;
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha !== undefined ? props.alpha : 1;
        const bg = new PIXI.Graphics();
        bg.lineStyle(2, props.borderColor ?? 0x888888);
        bg.beginFill(props.backgroundColor ?? 0x1e1e1e);
        bg.drawRoundedRect(0, 0, w, h, 6);
        bg.endFill();
        const textStr = props.value != null && props.value !== '' ? props.value : (props.placeholder || '');
        const t = new PIXI.Text(textStr, {
            fontFamily: props.fontFamily || 'Arial',
            fontSize: props.fontSize || 15,
            fill: props.color ?? 0xeeeeee
        });
        t.x = 10;
        t.y = Math.max(4, (h - t.height) / 2);
        c.addChild(bg, t);
        c.hitArea = new PIXI.Rectangle(0, 0, w, h);
        c.eventMode = 'static';
        gameObject._inputText = t;
        const rt = this;
        c.on('pointertap', () => {
            const cur = props.value || '';
            const next = window.prompt('输入内容', cur);
            if (next !== null) {
                props.value = next;
                t.text = next || props.placeholder || '';
            }
        });
        return c;
    }

    _createNineSlice(props) {
        const tex = props.textureName
            ? this.resourceManager.getTexture(props.textureName)
            : PIXI.Texture.WHITE;
        const plane = new NineSlicePlane(
            tex,
            props.sliceLeft ?? 12,
            props.sliceTop ?? 12,
            props.sliceRight ?? 12,
            props.sliceBottom ?? 12
        );
        plane.x = props.x;
        plane.y = props.y;
        plane.width = props.width || 120;
        plane.height = props.height || 80;
        plane.alpha = props.alpha !== undefined ? props.alpha : 1;
        plane.rotation = (props.rotation || 0) * Math.PI / 180;
        return plane;
    }

    _createScrollView(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 260;
        const h = props.height || 180;
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha !== undefined ? props.alpha : 1;
        c.rotation = (props.rotation || 0) * Math.PI / 180;

        const bg = new PIXI.Graphics();
        bg.lineStyle(2, 0x888888, 0.8);
        bg.beginFill(0x000000, 0.15);
        bg.drawRoundedRect(0, 0, w, h, 6);
        bg.endFill();

        const content = new PIXI.Container();
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff);
        mask.drawRect(0, 0, w, h);
        mask.endFill();
        content.mask = mask;

        c.addChild(bg, content, mask);
        c.hitArea = new PIXI.Rectangle(0, 0, w, h);
        c.eventMode = 'static';

        gameObject._scrollContent = content;
        gameObject._scrollMask = mask;

        c.on('wheel', (e) => {
            if (props.wheelEnabled === false) return;
            const delta = e.deltaY || 0;
            this.updateObjectProperties(gameObject, { scrollY: (props.scrollY || 0) + delta });
        });

        this.updateObjectProperties(gameObject, { scrollY: props.scrollY || 0 });
        return c;
    }
}

