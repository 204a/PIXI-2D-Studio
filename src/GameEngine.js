import * as PIXI from 'pixi.js';
import { NineSlicePlane } from '@pixi/mesh-extras';
import { BehaviorSystem } from './BehaviorSystem.js';
import { GridSystem } from './GridSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { HistoryManager } from './HistoryManager.js';
import { InputManager } from './InputManager.js';
import { PlatformerBehavior } from './PlatformerBehavior.js';
import { ResourceManager } from './ResourceManager.js';
import { AnimationSystem } from './AnimationSystem.js';
import { TransformControls } from './TransformControls.js';
import { ClipboardManager } from './ClipboardManager.js';
import { ViewportController } from './ViewportController.js';
import { ContextMenuManager } from './ContextMenuManager.js';
import { TweenSystem } from './TweenSystem.js';
import { SelectionManager } from './SelectionManager.js';
import { AlignmentManager } from './AlignmentManager.js';
import { AudioManager } from './AudioManager.js';
import { OverlayManager } from './OverlayManager.js';
import { LayerManager } from './LayerManager.js';
import { CameraManager } from './CameraManager.js';
import { SceneManager } from './SceneManager.js';
import { PhysicsSystem } from './PhysicsSystem.js';

/**
 * 游戏引擎核心类
 * 负责PixiJS应用初始化、游戏对象管理、渲染和更新
 */

export class GameEngine {
    /** 游戏内容与粒子等待挂载的根容器（与相机视口一致） */
    getWorldContainer() {
        return this.viewportController ? this.viewportController.viewport : this.app.stage;
    }

    constructor(containerId) {
        this.containerId = containerId;
        this.app = null;
        this.gameObjects = []; // 所有游戏对象
        this.selectedObject = null; // 当前选中的对象
        this.isRunning = false; // 是否在运行模式
        this.initialStates = []; // 初始状态快照
        
        // 键盘输入状态
        this.keys = {};
        
        // 回调函数
        this.onObjectSelected = null;
        this.onSceneChanged = null;
        
        // 异步初始化
        this.initPromise = this.init();
    }
    
    /**
     * 初始化PixiJS应用
     */
    async init() {
        console.log('GameEngine.init() 开始');
        
        // 获取容器尺寸
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('找不到画布容器:', this.containerId);
            throw new Error('找不到画布容器: ' + this.containerId);
        }
        
        console.log('找到容器:', container);
        
        // 确保容器可见以获取正确尺寸
        const app = document.getElementById('app');
        const wasHidden = app && app.style.visibility === 'hidden';
        if (wasHidden) {
            app.style.visibility = 'visible';
            app.style.opacity = '0';
        }
        
        const rect = container.getBoundingClientRect();
        const width = rect.width > 0 ? rect.width : 800;
        const height = rect.height > 0 ? rect.height : 600;
        
        console.log('Canvas尺寸:', width, 'x', height);
        
        // 创建PixiJS应用 - 使用兼容的初始化方式
        console.log('创建PixiJS应用...');
        try {
            // 尝试新API (PixiJS 8.x)
            this.app = new PIXI.Application();
            if (typeof this.app.init === 'function') {
                console.log('使用新API: app.init()');
                await this.app.init({
                    width,
                    height,
                    backgroundColor: 0x2a2a2a,
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            } else {
                throw new Error('init方法不存在，使用旧API');
            }
        } catch (e) {
            // 降级到旧API (PixiJS 7.x)
            console.log('使用旧API: new Application(options)');
            this.app = new PIXI.Application({
                width,
                height,
                backgroundColor: 0x2a2a2a,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
        }
        
        console.log('PixiJS初始化完成');
        
        // 将canvas添加到容器
        const canvas = this.app.view || this.app.canvas;
        container.appendChild(canvas);
        console.log('Canvas已添加到容器');
        
        // 设置canvas样式以填充容器
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        
        // 初始化视口控制器（必须在其他系统之前）
        this.viewportController = new ViewportController(this);
        
        // 初始化子系统
        this.behaviorSystem = new BehaviorSystem(this);
        this.gridSystem = new GridSystem(this);
        this.particleSystem = new ParticleSystem(this);
        this.historyManager = new HistoryManager(this);
        this.inputManager = new InputManager();
        this.resourceManager = new ResourceManager();
        this.audioManager = new AudioManager(this);
        this.animationSystem = new AnimationSystem(this);
        this.transformControls = new TransformControls(this);
        this.clipboardManager = new ClipboardManager(this);
        this.contextMenuManager = new ContextMenuManager(this);
        this.tweenSystem = new TweenSystem(this);
        this.selectionManager = new SelectionManager(this);
        this.alignmentManager = new AlignmentManager(this);
        this.overlayManager = new OverlayManager(this);
        this.layerManager = new LayerManager(this);
        this.cameraManager = new CameraManager(this);
        this.sceneManager = new SceneManager(this);
        this.physicsSystem = new PhysicsSystem(this);
        this.projectSettings = {
            designWidth: 800,
            designHeight: 600,
            targetFPS: 60
        };

        // 平台角色行为列表
        this.platformerBehaviors = [];
        
        // 初始化全局拖拽系统
        this.draggingObject = null;
        this.setupGlobalDragListeners();
        
        if (this.app.ticker && this.projectSettings.targetFPS > 0) {
            this.app.ticker.maxFPS = this.projectSettings.targetFPS;
        }

        // 设置更新循环
        this.app.ticker.add(() => {
            const deltaTime = this.app.ticker.deltaTime / 60;
            if (this.overlayManager) this.overlayManager.update();
            this.update(deltaTime);
        });
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.resize());
        
        // 监听键盘输入
        this.setupKeyboardInput();
        
        console.log('游戏引擎初始化完成');
    }
    
    /**
     * 设置键盘输入
     */
    setupKeyboardInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }
    
    /**
     * 检查按键是否被按下
     */
    isKeyPressed(key) {
        return this.keys[key] === true;
    }
    
    /**
     * 更新循环
     */
    update(deltaTime) {
        if (this.isRunning) {
            // 更新粒子系统
            this.particleSystem.update(deltaTime);
            
            // 更新平台角色行为
            const platforms = this.gameObjects.filter(o => o.properties.isPlatform);
            this.platformerBehaviors.forEach(behavior => {
                behavior.update(deltaTime, this.inputManager, platforms);
            });

            // 更新物理系统（Matter.js 最小版）
            if (this.physicsSystem) {
                this.physicsSystem.update(deltaTime);
            }
            
            // 更新补间动画系统
            this.tweenSystem.update(deltaTime);
            
            // 更新输入管理器（清除一次性状态）
            this.inputManager.update();

            if (this.cameraManager) {
                this.cameraManager.update(deltaTime);
            }
        }
    }
    
    /**
     * 添加平台角色行为
     */
    addPlatformerBehavior(gameObject, config) {
        const behavior = new PlatformerBehavior(gameObject, config);
        this.platformerBehaviors.push(behavior);
        return behavior;
    }
    
    /**
     * 移除平台角色行为
     */
    removePlatformerBehavior(gameObject) {
        const index = this.platformerBehaviors.findIndex(b => b.gameObject === gameObject);
        if (index > -1) {
            this.platformerBehaviors.splice(index, 1);
        }
    }
    
    /**
     * 创建游戏对象
     */
    createGameObject(type, properties = {}, saveHistory = true) {
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
                layerId: properties.layerId || this.layerManager?.activeLayerId || 'layer_default',
                ...properties
            },
            displayObject: null,
            parentId: null
        };
        
        // 根据类型创建PixiJS显示对象
        switch (type) {
            case 'sprite':
                gameObject.displayObject = this.createSpriteObject(gameObject.properties);
                break;
            case 'text':
                gameObject.displayObject = this.createTextObject(gameObject.properties);
                break;
            case 'rectangle':
                gameObject.displayObject = this.createRectangleObject(gameObject.properties);
                break;
            case 'circle':
                gameObject.displayObject = this.createCircleObject(gameObject.properties);
                break;
            case 'container':
                gameObject.displayObject = this.createContainerObject(gameObject.properties);
                break;
            case 'particle':
                gameObject.displayObject = this.createParticleObject(gameObject.properties);
                break;
            case 'button':
                gameObject.displayObject = this.createButtonObject(gameObject);
                break;
            case 'progressBar':
                gameObject.displayObject = this.createProgressBarObject(gameObject);
                break;
            case 'inputField':
                gameObject.displayObject = this.createInputFieldObject(gameObject);
                break;
            case 'nineSlice':
                gameObject.displayObject = this.createNineSliceObject(gameObject.properties);
                break;
            case 'scrollView':
                gameObject.displayObject = this.createScrollViewObject(gameObject);
                break;
            default:
                console.error('未知的对象类型:', type);
                return null;
        }
        
        if (!gameObject.displayObject) {
            return null;
        }
        
        // 设置交互
        this.setupInteraction(gameObject);
        
        // 添加到viewport（如果存在）或stage
        const container = this.viewportController ? this.viewportController.viewport : this.app.stage;
        container.addChild(gameObject.displayObject);
        this.gameObjects.push(gameObject);

        if (this.layerManager) {
            this.layerManager.applyToAllObjects();
        }
        
        // 保存历史记录
        if (saveHistory) {
            this.historyManager.saveState(`创建${type}`);
        }
        
        return gameObject;
    }
    
    /**
     * 创建精灵对象
     */
    createSpriteObject(props) {
        let sprite;
        
        // 如果有纹理，使用纹理创建
        if (props.textureName) {
            const texture = this.resourceManager.getTexture(props.textureName);
            if (texture) {
                sprite = new PIXI.Sprite(texture);
                sprite.width = props.width || sprite.width;
                sprite.height = props.height || sprite.height;
            }
        }
        
        // 否则创建图形
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
        
        console.log('创建精灵:', props.x, props.y, props.textureName ? '(有贴图)' : '(纯色)');
        return sprite;
    }
    
    /**
     * 创建文本对象
     */
    createTextObject(props) {
        const text = new PIXI.Text(props.text || '文本', {
            fontFamily: props.fontFamily || 'Arial',
            fontSize: props.fontSize || 24,
            fill: props.color || 0xFFFFFF,
            align: props.align || 'left'
        });
        
        text.x = props.x;
        text.y = props.y;
        text.alpha = props.alpha;
        text.rotation = (props.rotation || 0) * Math.PI / 180;
        
        console.log('创建文本:', props.x, props.y);
        return text;
    }
    
    /**
     * 创建矩形对象
     */
    createRectangleObject(props) {
        const graphics = new PIXI.Graphics();
        
        // 先绘制图形
        graphics.beginFill(props.color || 0xe74c3c);
        graphics.drawRect(0, 0, props.width, props.height);
        graphics.endFill();
        
        // 再设置位置和属性
        graphics.x = props.x;
        graphics.y = props.y;
        graphics.alpha = props.alpha;
        graphics.rotation = (props.rotation || 0) * Math.PI / 180;
        
        console.log('创建矩形:', props.x, props.y);
        return graphics;
    }
    
    /**
     * 创建圆形对象
     */
    createCircleObject(props) {
        const graphics = new PIXI.Graphics();
        const radius = props.radius || 50;
        
        // 先绘制图形
        graphics.beginFill(props.color || 0x2ecc71);
        graphics.drawCircle(radius, radius, radius);
        graphics.endFill();
        
        // 再设置位置和属性
        graphics.x = props.x;
        graphics.y = props.y;
        graphics.alpha = props.alpha;
        
        console.log('创建圆形:', props.x, props.y);
        return graphics;
    }
    
    /**
     * 创建容器对象
     */
    createContainerObject(props) {
        const container = new PIXI.Container();
        container.x = props.x;
        container.y = props.y;
        container.alpha = props.alpha;
        
        // 添加可视化指示器（容器本身不可见）
        const indicator = new PIXI.Graphics();
        indicator.lineStyle(2, 0x9b59b6, 0.5);
        indicator.drawRect(-5, -5, 110, 110);
        indicator.lineStyle(0);
        indicator.beginFill(0x9b59b6, 0.1);
        indicator.drawRect(-5, -5, 110, 110);
        indicator.endFill();
        indicator.beginFill(0x9b59b6);
        indicator.drawCircle(0, 0, 5);
        indicator.endFill();
        
        // 设置hitArea使容器可点击和拖拽
        container.hitArea = new PIXI.Rectangle(-5, -5, 110, 110);
        
        container.addChild(indicator);
        
        console.log('创建容器:', props.x, props.y);
        return container;
    }
    
    /**
     * 将对象添加到容器
     */
    addChildToContainer(childObject, parentObject, saveHistory = true) {
        if (parentObject.type !== 'container' && parentObject.type !== 'scrollView') {
            console.error('父对象必须是容器/滚动视图类型');
            return false;
        }
        
        // 从当前父容器移除
        const currentParent = childObject.displayObject.parent;
        if (currentParent) {
            currentParent.removeChild(childObject.displayObject);
        }
        
        // 添加到父容器/滚动内容容器
        const targetContainer =
            parentObject.type === 'scrollView' && parentObject._scrollContent
                ? parentObject._scrollContent
                : parentObject.displayObject;
        targetContainer.addChild(childObject.displayObject);
        
        // 更新父子关系
        childObject.parentId = parentObject.id;
        
        // 转换坐标（从世界坐标到局部坐标）
        const parentX = parentObject.displayObject.x;
        const parentY = parentObject.displayObject.y;
        childObject.displayObject.x -= parentX;
        childObject.displayObject.y -= parentY;
        
        console.log('对象已添加到容器');
        if (saveHistory) {
            this.historyManager.saveState('添加到容器');
        }
        
        return true;
    }

    /**
     * 导入场景时：子对象已在 viewport 上创建，按存档的局部坐标挂到容器下
     */
    _reparentImportedObject(childObject, parentObject) {
        if (parentObject.type !== 'container' && parentObject.type !== 'scrollView') return false;
        const disp = childObject.displayObject;
        const vp = this.viewportController ? this.viewportController.viewport : this.app.stage;
        if (disp.parent) {
            disp.parent.removeChild(disp);
        }
        const targetContainer =
            parentObject.type === 'scrollView' && parentObject._scrollContent
                ? parentObject._scrollContent
                : parentObject.displayObject;
        targetContainer.addChild(disp);
        childObject.parentId = parentObject.id;
        const p = childObject.properties;
        disp.x = p.x !== undefined ? p.x : 0;
        disp.y = p.y !== undefined ? p.y : 0;
        return true;
    }
    
    /**
     * 从容器移除对象
     */
    removeChildFromContainer(childObject) {
        if (!childObject.parentId) {
            console.log('对象不在容器中');
            return false;
        }
        
        const parentObject = this.gameObjects.find(obj => obj.id === childObject.parentId);
        if (!parentObject) {
            console.error('找不到父容器');
            return false;
        }
        
        // 转换回世界坐标
        const worldPos = childObject.displayObject.toGlobal({ x: 0, y: 0 });
        
        // 从父容器移除
        const fromContainer =
            parentObject.type === 'scrollView' && parentObject._scrollContent
                ? parentObject._scrollContent
                : parentObject.displayObject;
        fromContainer.removeChild(childObject.displayObject);
        
        // 添加回viewport或stage
        const container = this.viewportController ? this.viewportController.viewport : this.app.stage;
        container.addChild(childObject.displayObject);
        
        // 设置世界坐标
        childObject.displayObject.x = worldPos.x;
        childObject.displayObject.y = worldPos.y;
        
        // 清除父子关系
        childObject.parentId = null;
        
        console.log('对象已从容器移除');
        this.historyManager.saveState('从容器移除');
        
        return true;
    }
    
    /**
     * 获取容器的所有子对象
     */
    getContainerChildren(containerObject) {
        return this.gameObjects.filter(obj => obj.parentId === containerObject.id);
    }
    
    /**
     * 创建粒子发射器对象
     */
    createParticleObject(props) {
        const emitter = this.particleSystem.createEmitter({
            x: props.x,
            y: props.y,
            emissionRate: props.emissionRate || 10,
            maxParticles: props.maxParticles || 100,
            startColor: props.startColor || 0xFFFF00,
            endColor: props.endColor || 0xFF0000
        });
        
        return emitter.container;
    }

    createButtonObject(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 120;
        const h = props.height || 40;
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha !== undefined ? props.alpha : 1;
        c.rotation = (props.rotation || 0) * Math.PI / 180;
        const colors = {
            normal: props.colorNormal ?? 0x4a5fc7,
            hover: props.colorHover ?? 0x5d6fd8,
            pressed: props.colorPressed ?? 0x3547a0,
            disabled: props.colorDisabled ?? 0x666666
        };
        const bg = new PIXI.Graphics();
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
        gameObject._buttonLabel = label;
        gameObject._buttonBg = bg;
        const engine = this;
        c.on('pointerover', () => applyState('hover'));
        c.on('pointerout', () => applyState('normal'));
        c.on('pointerdown', () => applyState('down'));
        c.on('pointerup', () => applyState(engine.isRunning ? 'hover' : 'normal'));
        c.on('pointerupoutside', () => applyState('normal'));
        return c;
    }

    createProgressBarObject(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 200;
        const h = props.height || 24;
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha !== undefined ? props.alpha : 1;
        c.rotation = (props.rotation || 0) * Math.PI / 180;
        const bg = new PIXI.Graphics();
        bg.beginFill(props.colorBg ?? 0x222222);
        bg.drawRoundedRect(0, 0, w, h, 6);
        bg.endFill();
        const fill = new PIXI.Graphics();
        c.addChild(bg, fill);
        gameObject._progressFill = fill;
        this.applyProgressBarValue(gameObject, props.value ?? 0.5);
        return c;
    }

    applyProgressBarValue(gameObject, raw) {
        const props = gameObject.properties;
        const v = Math.max(0, Math.min(1, Number(raw) || 0));
        props.value = v;
        const fill = gameObject._progressFill;
        if (!fill || gameObject.type !== 'progressBar') return;
        const w = props.width || 200;
        const h = props.height || 24;
        fill.clear();
        fill.beginFill(props.colorFill ?? 0x27ae60);
        fill.drawRoundedRect(0, 0, w * v, h, 6);
        fill.endFill();
    }

    createInputFieldObject(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 220;
        const h = props.height || 36;
        const c = new PIXI.Container();
        c.x = props.x;
        c.y = props.y;
        c.alpha = props.alpha !== undefined ? props.alpha : 1;
        c.rotation = (props.rotation || 0) * Math.PI / 180;
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
        gameObject._inputText = t;
        const engine = this;
        c.on('pointertap', () => {
            if (!engine.isRunning) return;
            const cur = props.value || '';
            const next = window.prompt('输入内容', cur);
            if (next !== null) {
                props.value = next;
                t.text = next || props.placeholder || '';
            }
        });
        return c;
    }

    createNineSliceObject(props) {
        const tex = props.textureName
            ? this.resourceManager.getTexture(props.textureName)
            : PIXI.Texture.WHITE;
        const left = props.sliceLeft ?? 12;
        const top = props.sliceTop ?? 12;
        const right = props.sliceRight ?? 12;
        const bottom = props.sliceBottom ?? 12;
        const plane = new NineSlicePlane(tex, left, top, right, bottom);
        plane.x = props.x;
        plane.y = props.y;
        plane.width = props.width || 120;
        plane.height = props.height || 80;
        plane.alpha = props.alpha !== undefined ? props.alpha : 1;
        plane.rotation = (props.rotation || 0) * Math.PI / 180;
        return plane;
    }

    createScrollViewObject(gameObject) {
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
        content.x = 0;
        content.y = 0;

        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff);
        mask.drawRect(0, 0, w, h);
        mask.endFill();
        content.mask = mask;

        c.addChild(bg, content, mask);
        c.hitArea = new PIXI.Rectangle(0, 0, w, h);

        gameObject._scrollContent = content;
        gameObject._scrollMask = mask;

        // 滚轮：运行态可滚动；编辑态仅用于观察（不改变选中/拖拽）
        const engine = this;
        c.on('wheel', (e) => {
            if (!props.wheelEnabled) return;
            if (!engine.isRunning) return;
            const delta = (e.deltaY || 0);
            engine.updateObjectProperties(gameObject, { scrollY: (props.scrollY || 0) + delta });
        });

        // 初始应用 scrollY
        this.updateObjectProperties(gameObject, { scrollY: props.scrollY || 0 });
        return c;
    }

    redrawButton(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 120;
        const h = props.height || 40;
        const bg = gameObject._buttonBg;
        const label = gameObject._buttonLabel;
        if (!bg || !label) return;
        gameObject.displayObject.hitArea = new PIXI.Rectangle(0, 0, w, h);
        label.x = w / 2;
        label.y = h / 2;
        const colors = {
            normal: props.colorNormal ?? 0x4a5fc7,
            disabled: props.colorDisabled ?? 0x666666
        };
        const fill = props.disabled ? colors.disabled : colors.normal;
        bg.clear();
        bg.beginFill(fill);
        bg.drawRoundedRect(0, 0, w, h, 8);
        bg.endFill();
    }

    redrawInputField(gameObject) {
        const props = gameObject.properties;
        const w = props.width || 220;
        const h = props.height || 36;
        const bg = gameObject.displayObject.children[0];
        const t = gameObject._inputText;
        if (!bg || !t || !bg.beginFill) return;
        gameObject.displayObject.hitArea = new PIXI.Rectangle(0, 0, w, h);
        bg.clear();
        bg.lineStyle(2, props.borderColor ?? 0x888888);
        bg.beginFill(props.backgroundColor ?? 0x1e1e1e);
        bg.drawRoundedRect(0, 0, w, h, 6);
        bg.endFill();
        t.y = Math.max(4, (h - t.height) / 2);
    }
    
    /**
     * 设置对象交互
     */
    setupInteraction(gameObject) {
        const obj = gameObject.displayObject;
        obj.eventMode = 'static';
        obj.cursor = 'pointer';
        
        // 鼠标按下
        obj.on('pointerdown', (event) => {
            if (this.isRunning) return;
            
            // 设置当前拖拽对象
            this.draggingObject = {
                gameObject,
                isDragging: false,
                startX: event.global.x,
                startY: event.global.y,
                objStartX: obj.x,
                objStartY: obj.y
            };
            
            // 阻止事件冒泡
            event.stopPropagation();
        });
    }
    
    /**
     * 初始化全局拖拽监听
     */
    setupGlobalDragListeners() {
        // 确保stage可以接收事件
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;
        
        // 全局鼠标移动
        this.app.stage.on('pointermove', (event) => {
            if (!this.draggingObject || this.isRunning) return;
            
            const drag = this.draggingObject;
            const obj = drag.gameObject.displayObject;
            
            const dx = event.global.x - drag.startX;
            const dy = event.global.y - drag.startY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 移动超过5像素才算拖拽
            if (distance > 5) {
                drag.isDragging = true;
                
                // 计算新位置
                let newX = drag.objStartX + dx;
                let newY = drag.objStartY + dy;
                
                // 智能吸附到其他对象
                if (this.alignmentManager) {
                    const snap = this.alignmentManager.snapToObjects(drag.gameObject);
                    if (snap) {
                        if (snap.snapX !== null) newX = snap.snapX;
                        if (snap.snapY !== null) newY = snap.snapY;
                    }
                }

                // 吸附到参考线（Shift 临时禁用）
                if (!(event.nativeEvent && event.nativeEvent.shiftKey) && this.overlayManager) {
                    const gSnap = this.overlayManager.snapToGuides(newX, newY);
                    if (gSnap) {
                        if (gSnap.snapX !== null) newX = gSnap.snapX;
                        if (gSnap.snapY !== null) newY = gSnap.snapY;
                    }
                }
                
                obj.x = newX;
                obj.y = newY;
                
                drag.gameObject.properties.x = obj.x;
                drag.gameObject.properties.y = obj.y;
                
                // 拖拽时也选中对象
                if (this.selectedObject !== drag.gameObject) {
                    this.selectObject(drag.gameObject);
                }
                
                // 更新变换控制框
                this.transformControls.updateTransform();
                
                // 通知UI更新
                if (this.onObjectSelected) {
                    this.onObjectSelected(drag.gameObject);
                }
            }
        });
        
        // 全局鼠标松开
        this.app.stage.on('pointerup', (event) => {
            if (!this.draggingObject) return;
            
            const drag = this.draggingObject;
            
            // 清除辅助线
            if (this.alignmentManager) {
                this.alignmentManager.clearGuides();
            }
            
            // 如果没有拖拽，则是点击选中
            if (!drag.isDragging) {
                this.selectObject(drag.gameObject);
            } else {
                // 拖拽结束，保存历史
                this.historyManager.saveState('移动对象');
            }
            
            this.draggingObject = null;
        });
        
        // 鼠标离开画布
        this.app.stage.on('pointerupoutside', () => {
            if (!this.draggingObject) return;
            
            // 清除辅助线
            if (this.alignmentManager) {
                this.alignmentManager.clearGuides();
            }
            
            if (this.draggingObject.isDragging) {
                this.historyManager.saveState('移动对象');
            }
            
            this.draggingObject = null;
        });
    }
    
    /**
     * 选中对象
     */
    selectObject(gameObject) {
        this.selectedObject = gameObject;
        
        // 更新变换控制框
        this.transformControls.selectObject(gameObject);
        
        if (this.onObjectSelected) {
            this.onObjectSelected(gameObject);
        }
        
        // 通知UI更新场景列表（更新高亮）
        if (this.onSceneChanged) {
            this.onSceneChanged();
        }
    }
    
    /**
     * 更新对象属性
     */
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
        
        if (properties.width !== undefined && gameObject.type === 'rectangle') {
            this.redrawRectangle(gameObject, properties);
        }
        
        if (properties.height !== undefined && gameObject.type === 'rectangle') {
            this.redrawRectangle(gameObject, properties);
        }
        
        if (properties.text !== undefined && gameObject.type === 'text') {
            obj.text = properties.text;
            gameObject.properties.text = properties.text;
        }
        
        if (properties.color !== undefined) {
            gameObject.properties.color = properties.color;
            if (gameObject.type === 'rectangle' || gameObject.type === 'sprite') {
                this.redrawGraphics(gameObject);
            }
        }

        if (gameObject.type === 'progressBar') {
            if (properties.width !== undefined || properties.height !== undefined) {
                const bg = gameObject.displayObject.children[0];
                if (bg && bg.clear) {
                    bg.clear();
                    bg.beginFill(gameObject.properties.colorBg ?? 0x222222);
                    bg.drawRoundedRect(0, 0, gameObject.properties.width || 200, gameObject.properties.height || 24, 6);
                    bg.endFill();
                }
            }
            if (properties.value !== undefined || properties.colorFill !== undefined) {
                this.applyProgressBarValue(gameObject, properties.value ?? gameObject.properties.value);
            }
        }

        if (gameObject.type === 'button') {
            if (gameObject._buttonLabel) {
                if (properties.label !== undefined) gameObject._buttonLabel.text = properties.label;
                if (properties.fontSize !== undefined) gameObject._buttonLabel.style.fontSize = properties.fontSize;
                if (properties.colorText !== undefined) gameObject._buttonLabel.style.fill = properties.colorText;
            }
            if (properties.width !== undefined || properties.height !== undefined || properties.disabled !== undefined) {
                this.redrawButton(gameObject);
            }
        }

        if (gameObject.type === 'inputField') {
            if (gameObject._inputText) {
                if (properties.value !== undefined) gameObject._inputText.text = properties.value || properties.placeholder || '';
                if (properties.fontSize !== undefined) gameObject._inputText.style.fontSize = properties.fontSize;
                if (properties.placeholder !== undefined && properties.value === undefined) {
                    gameObject._inputText.text = properties.placeholder;
                }
            }
            if (properties.width !== undefined || properties.height !== undefined) {
                this.redrawInputField(gameObject);
            }
        }

        if (gameObject.type === 'nineSlice') {
            const plane = gameObject.displayObject;
            if (properties.textureName !== undefined) {
                const tex = gameObject.properties.textureName
                    ? this.resourceManager.getTexture(gameObject.properties.textureName)
                    : PIXI.Texture.WHITE;
                if (tex) plane.texture = tex;
            }
            if (properties.width !== undefined) plane.width = properties.width;
            if (properties.height !== undefined) plane.height = properties.height;
            if (properties.sliceLeft !== undefined) plane.leftWidth = properties.sliceLeft;
            if (properties.sliceRight !== undefined) plane.rightWidth = properties.sliceRight;
            if (properties.sliceTop !== undefined) plane.topHeight = properties.sliceTop;
            if (properties.sliceBottom !== undefined) plane.bottomHeight = properties.sliceBottom;
        }

        if (gameObject.type === 'scrollView') {
            const props = gameObject.properties;
            const c = gameObject._scrollContent;
            const m = gameObject._scrollMask;
            const w = props.width || 260;
            const h = props.height || 180;
            if (m && m.clear) {
                m.clear();
                m.beginFill(0xffffff);
                m.drawRect(0, 0, w, h);
                m.endFill();
            }
            // 背景重绘
            const bg = gameObject.displayObject.children[0];
            if (bg && bg.clear) {
                bg.clear();
                bg.lineStyle(2, 0x888888, 0.8);
                bg.beginFill(0x000000, 0.15);
                bg.drawRoundedRect(0, 0, w, h, 6);
                bg.endFill();
            }
            gameObject.displayObject.hitArea = new PIXI.Rectangle(0, 0, w, h);

            if (properties.wheelEnabled !== undefined) props.wheelEnabled = !!properties.wheelEnabled;
            if (properties.contentHeight !== undefined) props.contentHeight = properties.contentHeight;

            const maxScroll = Math.max(0, (props.contentHeight || 0) - h);
            const next = Math.max(0, Math.min(maxScroll, props.scrollY || 0));
            if (properties.scrollY !== undefined) {
                props.scrollY = properties.scrollY;
            }
            const clamped = Math.max(0, Math.min(maxScroll, props.scrollY || 0));
            props.scrollY = clamped;
            if (c) {
                c.y = -clamped;
            }
        }
        
        // 更新变换控制框
        if (this.selectedObject === gameObject) {
            this.transformControls.updateTransform();
        }
    }
    
    /**
     * 重绘矩形
     */
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
    
    /**
     * 重绘图形对象
     */
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
    
    /**
     * 删除对象
     */
    removeGameObject(gameObject) {
        const index = this.gameObjects.indexOf(gameObject);
        if (index > -1) {
            const parent = gameObject.displayObject.parent;
            if (parent) {
                parent.removeChild(gameObject.displayObject);
            }
            this.gameObjects.splice(index, 1);
            
            if (this.selectedObject === gameObject) {
                this.selectedObject = null;
            }
            
            this.historyManager.saveState('删除对象');
        }
    }
    
    /**
     * 清空场景
     */
    clearScene(saveHistory = true) {
        this.gameObjects.forEach(obj => {
            const parent = obj.displayObject.parent;
            if (parent) {
                parent.removeChild(obj.displayObject);
            }
        });
        
        this.gameObjects = [];
        this.selectedObject = null;
        this.behaviorSystem.behaviors = [];
        
        if (saveHistory) {
            this.historyManager.saveState('清空场景');
        }
    }
    
    /**
     * 开始运行
     */
    play() {
        // 保存初始状态
        this.saveInitialStates();

        if (this.cameraManager) {
            this.cameraManager.onPlay();
        }

        this.isRunning = true;

        // 启动物理系统（Matter.js）
        if (this.physicsSystem) {
            this.physicsSystem.start();
        }
        
        // 隐藏变换控制框
        this.transformControls.hide();
        
        // 禁用编辑交互；按钮/输入框在运行态需保留指针以换态或输入
        this.gameObjects.forEach((obj) => {
            if (obj.type === 'button' || obj.type === 'inputField') {
                obj.displayObject.eventMode = 'static';
            } else {
                obj.displayObject.eventMode = 'none';
            }
        });
        
        // 重新初始化平台角色行为（基于当前属性）
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
        
        // 启动行为系统
        this.behaviorSystem.start();
        
        console.log('游戏开始运行，平台角色数:', this.platformerBehaviors.length);
    }
    
    /**
     * 停止运行
     */
    stop() {
        this.isRunning = false;

        if (this.cameraManager) {
            this.cameraManager.onStop();
        }

        if (this.audioManager) {
            this.audioManager.stopAll();
        }

        // 停止行为系统
        this.behaviorSystem.stop();

        // 停止物理系统
        if (this.physicsSystem) {
            this.physicsSystem.stop();
        }
        
        // 清空平台角色行为
        this.platformerBehaviors = [];
        
        // 恢复初始状态
        this.restoreInitialStates();
        
        // 恢复对象交互
        this.gameObjects.forEach(obj => {
            obj.displayObject.eventMode = 'static';
        });
        
        console.log('游戏停止运行');
    }
    
    /**
     * 保存初始状态
     */
    saveInitialStates() {
        this.initialStates = this.gameObjects.map(obj => ({
            id: obj.id,
            properties: JSON.parse(JSON.stringify(obj.properties))
        }));
    }
    
    /**
     * 恢复初始状态
     */
    restoreInitialStates() {
        this.initialStates.forEach(state => {
            const obj = this.gameObjects.find(o => o.id === state.id);
            if (obj) {
                this.updateObjectProperties(obj, state.properties);
            }
        });
    }
    
    applyProjectSettings(ps) {
        if (!ps || typeof ps !== 'object') return;
        if (ps.designWidth != null) this.projectSettings.designWidth = Number(ps.designWidth) || 800;
        if (ps.designHeight != null) this.projectSettings.designHeight = Number(ps.designHeight) || 600;
        if (ps.targetFPS != null) {
            this.projectSettings.targetFPS = Math.max(0, Number(ps.targetFPS) || 60);
            if (this.app && this.app.ticker && this.projectSettings.targetFPS > 0) {
                this.app.ticker.maxFPS = this.projectSettings.targetFPS;
            }
        }
    }

    getEmptySceneData() {
        return {
            version: '1.0.4',
            objects: [],
            behaviors: { behaviors: [] },
            animations: { animations: [] },
            audioResources: [],
            imageResources: [],
            layers: {
                layers: [{ id: 'layer_default', name: 'Layer 1', visible: true, locked: false }],
                activeLayerId: 'layer_default'
            },
            project: { ...this.projectSettings },
            camera: { followTargetId: null, bounds: null, smoothing: 0.12, enabled: true }
        };
    }

    /**
     * 单场景核心导出（不含多场景槽位）
     */
    exportSceneCore() {
        return {
            version: '1.0.4',
            timestamp: new Date().toISOString(),
            project: { ...this.projectSettings },
            camera: this.cameraManager ? this.cameraManager.export() : {},
            objects: this.gameObjects.map(obj => ({
                id: obj.id,
                type: obj.type,
                properties: obj.properties,
                parentId: obj.parentId
            })),
            behaviors: this.behaviorSystem.export(),
            animations: this.animationSystem.export(),
            audioResources: this.resourceManager.getAllAudioResources(),
            imageResources: this.resourceManager.getAllResources().map(({ name, url }) => ({ name, url })),
            layers: this.layerManager ? this.layerManager.export() : null
        };
    }

    /**
     * 导出场景数据（含多场景槽位 savedScenes）
     */
    exportScene() {
        const core = this.exportSceneCore();
        const out = { ...core };
        if (this.sceneManager) {
            out.savedScenes = this.sceneManager.buildSavedScenesForExport();
            out.activeSceneId = this.sceneManager.activeSceneId;
        }
        return out;
    }

    /**
     * 导入单份场景负载（由 importScene / 场景切换 共用）
     */
    async importScenePayload(sceneData) {
        if (!sceneData || !Array.isArray(sceneData.objects)) {
            throw new Error('无效的场景数据：缺少 objects 数组');
        }

        this.clearScene(false);
        this.animationSystem.reset();

        const imgs = sceneData.imageResources;
        if (imgs && Array.isArray(imgs)) {
            for (const item of imgs) {
                if (item && item.name && item.url) {
                    await this.resourceManager.loadImageFromURL(item.url, item.name);
                }
            }
        }

        if (sceneData.audioResources && Array.isArray(sceneData.audioResources)) {
            sceneData.audioResources.forEach((item) => {
                if (item && item.name && item.url) {
                    this.resourceManager.loadAudioFromURL(item.url, item.name);
                }
            });
        }

        if (sceneData.animations) {
            this.animationSystem.import(sceneData.animations);
        }

        if (this.layerManager && sceneData.layers) {
            this.layerManager.import(sceneData.layers);
        }

        for (const objData of sceneData.objects) {
            const obj = this.createGameObject(objData.type, objData.properties, false);
            if (obj) {
                obj.id = objData.id;
                obj.parentId = objData.parentId;
            }
        }

        for (const obj of this.gameObjects) {
            if (obj.type === 'sprite' && obj.properties.animationName) {
                this.animationSystem.addAnimationToObject(obj, obj.properties.animationName, {
                    speed: obj.properties.animSpeed || 0.1,
                    autoPlay: true
                });
            }
        }

        for (const objData of sceneData.objects) {
            if (!objData.parentId) continue;
            const child = this.gameObjects.find((g) => g.id === objData.id);
            const parent = this.gameObjects.find((g) => g.id === objData.parentId);
            if (child && parent && (parent.type === 'container' || parent.type === 'scrollView')) {
                this._reparentImportedObject(child, parent);
            }
        }

        if (sceneData.behaviors) {
            this.behaviorSystem.import(sceneData.behaviors);
        }

        if (this.layerManager) {
            this.layerManager.applyToAllObjects();
        }

        if (sceneData.project) {
            this.applyProjectSettings(sceneData.project);
        }
        if (this.cameraManager) {
            this.cameraManager.import(sceneData.camera || {});
        }
    }

    /**
     * 导入场景数据（异步加载贴图；支持多场景工程格式）
     */
    async importScene(sceneData) {
        if (!sceneData) {
            throw new Error('无效的场景数据');
        }

        if (sceneData.savedScenes && Array.isArray(sceneData.savedScenes) && sceneData.savedScenes.length > 0) {
            if (sceneData.project) {
                this.applyProjectSettings(sceneData.project);
            }
            if (this.sceneManager) {
                this.sceneManager.importFromFile(sceneData.savedScenes, sceneData.activeSceneId || 'main');
                const slot = this.sceneManager.scenes.get(this.sceneManager.activeSceneId);
                let payload = slot && slot.data;
                if (!payload) {
                    const entry = sceneData.savedScenes.find((s) => s.id === this.sceneManager.activeSceneId);
                    payload = entry && entry.data ? entry.data : sceneData.savedScenes[0].data;
                }
                if (!payload || !Array.isArray(payload.objects)) {
                    throw new Error('多场景数据无效');
                }
                await this.importScenePayload(payload);
            } else {
                await this.importScenePayload(sceneData);
            }
            this.historyManager.saveState('导入场景');
            return;
        }

        if (!Array.isArray(sceneData.objects)) {
            throw new Error('无效的场景数据：缺少 objects 数组');
        }

        await this.importScenePayload(sceneData);
        this.historyManager.saveState('导入场景');
    }
    
    /**
     * 调整大小
     */
    resize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        this.app.renderer.resize(rect.width, rect.height);
        
        if (this.gridSystem) {
            this.gridSystem.drawGrid();
        }
    }
}

