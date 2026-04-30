/**
 * 可视化编程系统 - 事件和行为管理
 */

export class BehaviorSystem {
    constructor(engine) {
        this.engine = engine;
        this.behaviors = []; // 所有行为规则
        this.isRunning = false;
        /** @type {Set<string>} 每帧结束时的碰撞对；下一帧开始复制为基线，供 collisionEnter */
        this._collisionPairEnd = new Set();
        /** @type {Set<string>} 本帧“进入碰撞”判定用（上一帧结束时的对） */
        this._collisionEnterBaseline = new Set();
    }

    static _pairKey(idA, idB) {
        return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
    }

    /** 默认碰撞形状：圆形对象用圆，其余用 AABB（包围盒） */
    _resolveShape(gameObject) {
        const p = gameObject.properties;
        if (p.collisionShape === 'circle' || (!p.collisionShape && gameObject.type === 'circle')) {
            return 'circle';
        }
        if (p.collisionShape === 'aabb') {
            return 'aabb';
        }
        return 'aabb';
    }

    _circleParams(gameObject) {
        const obj = gameObject.displayObject;
        const p = gameObject.properties;
        const b = obj.getBounds();
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        let r = p.collisionRadius;
        if (r === undefined || r === null) {
            if (gameObject.type === 'circle') {
                const rad = p.radius || 50;
                const sx = Math.abs(obj.scale?.x ?? 1);
                const sy = Math.abs(obj.scale?.y ?? 1);
                r = rad * (sx + sy) / 2;
            } else {
                r = Math.min(b.width, b.height) / 2;
            }
        }
        return { cx, cy, r };
    }

    _aabbFromBounds(gameObject) {
        const b = gameObject.displayObject.getBounds();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
    }

    _rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    _circleCircle(c1, c2) {
        const dx = c1.cx - c2.cx;
        const dy = c1.cy - c2.cy;
        const rr = c1.r + c2.r;
        return dx * dx + dy * dy <= rr * rr;
    }

    _circleAabb(c, r) {
        const nx = Math.max(r.x, Math.min(c.cx, r.x + r.w));
        const ny = Math.max(r.y, Math.min(c.cy, r.y + r.h));
        const dx = c.cx - nx;
        const dy = c.cy - ny;
        return dx * dx + dy * dy <= c.r * c.r;
    }

    /**
     * 统一碰撞检测：支持 aabb / circle 组合
     */
    collides(go1, go2) {
        if (go1.id === go2.id) return false;
        const s1 = this._resolveShape(go1);
        const s2 = this._resolveShape(go2);
        if (s1 === 'aabb' && s2 === 'aabb') {
            const a = this._aabbFromBounds(go1);
            const b = this._aabbFromBounds(go2);
            return this._rectsOverlap(a, b);
        }
        if (s1 === 'circle' && s2 === 'circle') {
            return this._circleCircle(this._circleParams(go1), this._circleParams(go2));
        }
        if (s1 === 'circle' && s2 === 'aabb') {
            return this._circleAabb(this._circleParams(go1), this._aabbFromBounds(go2));
        }
        if (s1 === 'aabb' && s2 === 'circle') {
            return this._circleAabb(this._circleParams(go2), this._aabbFromBounds(go1));
        }
        const a = this._aabbFromBounds(go1);
        const b = this._aabbFromBounds(go2);
        return this._rectsOverlap(a, b);
    }

    _rebuildCollisionPairsEnd() {
        const pairs = new Set();
        const objs = this.engine.gameObjects;
        for (let i = 0; i < objs.length; i++) {
            for (let j = i + 1; j < objs.length; j++) {
                if (this.collides(objs[i], objs[j])) {
                    pairs.add(BehaviorSystem._pairKey(objs[i].id, objs[j].id));
                }
            }
        }
        this._collisionPairEnd = pairs;
    }
    
    /**
     * 添加行为规则
     */
    addBehavior(objectId, eventType, actions, options = {}) {
        const behavior = {
            id: `behavior_${Date.now()}_${Math.random()}`,
            objectId,
            eventType,
            actions,
            enabled: true,
            order: options.order || 0, // 执行顺序，数字越小越先执行
            conditions: options.conditions || [], // 触发条件
            subEvents: options.subEvents || [], // 子事件列表
            parentId: options.parentId || null // 父事件ID
        };
        
        this.behaviors.push(behavior);
        
        // 按order排序
        this.behaviors.sort((a, b) => a.order - b.order);
        
        return behavior;
    }
    
    /**
     * 删除行为（包括子事件）
     */
    removeBehavior(behaviorId) {
        const behavior = this.behaviors.find(b => b.id === behaviorId);
        if (!behavior) return false;
        
        // 递归删除所有子事件
        if (behavior.subEvents && behavior.subEvents.length > 0) {
            behavior.subEvents.forEach(subId => {
                this.removeBehavior(subId);
            });
        }
        
        // 从父事件的subEvents中移除
        const parent = this.behaviors.find(b => b.subEvents && b.subEvents.includes(behaviorId));
        if (parent) {
            const idx = parent.subEvents.indexOf(behaviorId);
            if (idx > -1) {
                parent.subEvents.splice(idx, 1);
            }
        }
        
        // 删除自己
        const index = this.behaviors.findIndex(b => b.id === behaviorId);
        if (index > -1) {
            this.behaviors.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * 添加子事件
     */
    addSubEvent(parentId, objectId, eventType, actions, options = {}) {
        const parent = this.behaviors.find(b => b.id === parentId);
        if (!parent) {
            console.error('父事件不存在:', parentId);
            return null;
        }
        
        // 创建子事件
        const subEvent = this.addBehavior(objectId, eventType, actions, {
            ...options,
            parentId: parentId
        });
        
        // 添加到父事件的subEvents列表
        if (!parent.subEvents) {
            parent.subEvents = [];
        }
        parent.subEvents.push(subEvent.id);
        
        return subEvent;
    }
    
    /**
     * 获取对象的所有行为
     */
    getObjectBehaviors(objectId) {
        return this.behaviors.filter(b => b.objectId === objectId);
    }
    
    /**
     * 执行行为
     */
    executeBehavior(behavior) {
        if (!behavior.enabled) return;
        
        const obj = this.engine.gameObjects.find(o => o.id === behavior.objectId);
        if (!obj) return;
        
        // 检查触发条件
        if (!this.checkConditions(obj, behavior.conditions)) {
            return;
        }
        
        // 执行动作
        behavior.actions.forEach(action => {
            this.executeAction(obj, action);
        });
        
        // 执行子事件（父事件条件满足时）
        if (behavior.subEvents && behavior.subEvents.length > 0) {
            behavior.subEvents.forEach(subEventId => {
                const subEvent = this.behaviors.find(b => b.id === subEventId);
                if (subEvent) {
                    this.executeBehavior(subEvent);
                }
            });
        }
    }
    
    /**
     * 检查触发条件
     */
    checkConditions(gameObject, conditions) {
        if (!conditions || conditions.length === 0) return true;
        
        // 所有条件都满足才执行
        return conditions.every(condition => {
            const obj = gameObject.displayObject;
            const props = gameObject.properties;
            
            switch (condition.type) {
                case 'positionX':
                    return this.compareValue(obj.x, condition.operator, condition.value);
                    
                case 'positionY':
                    return this.compareValue(obj.y, condition.operator, condition.value);
                    
                case 'alpha':
                    return this.compareValue(obj.alpha, condition.operator, condition.value);
                    
                case 'rotation':
                    const degrees = obj.rotation * 180 / Math.PI;
                    return this.compareValue(degrees, condition.operator, condition.value);
                
                // 按键条件
                case 'keyPressed':
                    return this.engine.inputManager.isKeyDown(condition.key);
                
                case 'keyJustPressed':
                    return this.engine.inputManager.isKeyPressed(condition.key);
                
                case 'keyReleased':
                    return this.engine.inputManager.isKeyReleased(condition.key);
                
                // 鼠标条件
                case 'mouseClicked':
                    return this.engine.inputManager.isMousePressed(0);
                
                case 'mouseDown':
                    return this.engine.inputManager.isMouseDown(0);
                
                case 'mouseReleased':
                    return this.engine.inputManager.isMouseReleased(0);
                
                case 'mouseX':
                    const mousePos = this.engine.inputManager.getMousePosition();
                    return this.compareValue(mousePos.x, condition.operator, condition.value);
                
                case 'mouseY':
                    const mousePosY = this.engine.inputManager.getMousePosition();
                    return this.compareValue(mousePosY.y, condition.operator, condition.value);
                
                case 'mouseHover':
                    // 检查鼠标是否悬停在对象上
                    return this.isMouseOverObject(gameObject);
                
                // 碰撞条件
                case 'collision':
                    return this.checkCollisionWithTag(gameObject, condition.tag);

                case 'collisionEnter':
                    return this.checkCollisionEnterWithTag(gameObject, condition.tag);

                // 物理碰撞进入（Matter.js）
                case 'physicsCollisionEnter':
                    return this.engine.physicsSystem
                        ? this.engine.physicsSystem.checkCollisionEnterWithTag(gameObject, condition.tag)
                        : false;
                    
                default:
                    return true;
            }
        });
    }
    
    /**
     * 检查鼠标是否悬停在对象上
     */
    isMouseOverObject(gameObject) {
        const mousePos = this.engine.inputManager.getMousePosition();
        const obj = gameObject.displayObject;
        const bounds = obj.getBounds();
        
        return mousePos.x >= bounds.x && 
               mousePos.x <= bounds.x + bounds.width &&
               mousePos.y >= bounds.y && 
               mousePos.y <= bounds.y + bounds.height;
    }
    
    /**
     * 检查与特定标签对象的碰撞（持续）
     */
    checkCollisionWithTag(gameObject, tag) {
        const objects = this.engine.gameObjects.filter(
            (o) => o.properties.tag === tag && o.id !== gameObject.id
        );
        return objects.some((obj) => this.collides(gameObject, obj));
    }

    /**
     * 本帧首次碰到该标签（上一帧未碰撞同一对象）
     */
    checkCollisionEnterWithTag(gameObject, tag) {
        const objects = this.engine.gameObjects.filter(
            (o) => o.properties.tag === tag && o.id !== gameObject.id
        );
        return objects.some(
            (other) =>
                this.collides(gameObject, other) &&
                !this._collisionEnterBaseline.has(BehaviorSystem._pairKey(gameObject.id, other.id))
        );
    }
    
    /**
     * 比较值
     */
    compareValue(actual, operator, expected) {
        switch (operator) {
            case '>': return actual > expected;
            case '<': return actual < expected;
            case '>=': return actual >= expected;
            case '<=': return actual <= expected;
            case '==': return Math.abs(actual - expected) < 0.01;
            case '!=': return Math.abs(actual - expected) >= 0.01;
            default: return true;
        }
    }
    
    /**
     * 执行单个动作
     */
    executeAction(gameObject, action) {
        const obj = gameObject.displayObject;
        const props = gameObject.properties;
        
        switch (action.type) {
            case 'move':
                obj.x += action.params.deltaX || 0;
                obj.y += action.params.deltaY || 0;
                props.x = obj.x;
                props.y = obj.y;
                break;
                
            case 'rotate':
                obj.rotation += (action.params.angle || 0) * Math.PI / 180;
                break;
                
            case 'scale':
                obj.scale.x *= action.params.scaleX || 1;
                obj.scale.y *= action.params.scaleY || 1;
                break;
                
            case 'setPosition':
                obj.x = action.params.x !== undefined ? action.params.x : obj.x;
                obj.y = action.params.y !== undefined ? action.params.y : obj.y;
                props.x = obj.x;
                props.y = obj.y;
                break;
                
            case 'changeAlpha':
                obj.alpha = Math.max(0, Math.min(1, obj.alpha + (action.params.delta || 0)));
                props.alpha = obj.alpha;
                break;
                
            case 'setText':
                if (action.params.text === undefined) break;
                if (gameObject.type === 'text') {
                    obj.text = action.params.text;
                    props.text = action.params.text;
                } else if (gameObject.type === 'button' && gameObject._buttonLabel) {
                    gameObject._buttonLabel.text = action.params.text;
                    props.label = action.params.text;
                } else if (gameObject.type === 'inputField' && gameObject._inputText) {
                    gameObject._inputText.text = action.params.text;
                    props.value = action.params.text;
                }
                break;

            case 'setProgress':
                if (gameObject.type === 'progressBar' && this.engine.applyProgressBarValue) {
                    this.engine.applyProgressBarValue(gameObject, action.params.value);
                }
                break;

            case 'setScrollY':
                if (gameObject.type === 'scrollView' && this.engine.updateObjectProperties) {
                    this.engine.updateObjectProperties(gameObject, { scrollY: action.params.scrollY || 0 });
                }
                break;
                
            case 'fadeIn':
                obj.alpha = Math.min(1, obj.alpha + 0.02);
                props.alpha = obj.alpha;
                break;
                
            case 'fadeOut':
                obj.alpha = Math.max(0, obj.alpha - 0.02);
                props.alpha = obj.alpha;
                break;
                
            case 'bounce':
                // 简单的弹跳效果
                if (!obj._bounceData) {
                    obj._bounceData = { direction: 1, speed: 3 };
                }
                obj.y += obj._bounceData.direction * obj._bounceData.speed;
                if (obj.y > action.params.maxY || obj.y < action.params.minY) {
                    obj._bounceData.direction *= -1;
                }
                props.y = obj.y;
                break;
                
            case 'moveTo':
                // 平滑移动到目标位置
                const targetX = action.params.targetX || obj.x;
                const targetY = action.params.targetY || obj.y;
                const speed = action.params.speed || 2;
                
                const dx = targetX - obj.x;
                const dy = targetY - obj.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > speed) {
                    obj.x += (dx / distance) * speed;
                    obj.y += (dy / distance) * speed;
                    props.x = obj.x;
                    props.y = obj.y;
                }
                break;
                
            case 'oscillate':
                // 振荡运动
                if (!obj._oscillateData) {
                    obj._oscillateData = { time: 0 };
                }
                obj._oscillateData.time += 0.05;
                const amplitude = action.params.amplitude || 50;
                obj.x = props.x + Math.sin(obj._oscillateData.time) * amplitude;
                break;
                
            case 'spin':
                // 持续旋转
                obj.rotation += (action.params.speed || 5) * Math.PI / 180;
                break;
                
            case 'playAnimation':
                // 播放动画
                if (gameObject.properties.animationName) {
                    this.engine.animationSystem.playAnimation(gameObject);
                }
                break;
                
            case 'stopAnimation':
                // 停止动画
                if (gameObject.properties.animationName) {
                    this.engine.animationSystem.stopAnimation(gameObject);
                }
                break;
                
            case 'gotoFrame':
                // 跳转到指定帧
                if (gameObject.properties.animationName) {
                    this.engine.animationSystem.gotoFrame(gameObject, action.params.frame || 0);
                }
                break;
                
            case 'tweenTo':
                // 补间动画 - 移动到指定位置
                const tweenProps = {};
                if (action.params.x !== undefined) tweenProps.x = action.params.x;
                if (action.params.y !== undefined) tweenProps.y = action.params.y;
                if (action.params.alpha !== undefined) tweenProps.alpha = action.params.alpha;
                if (action.params.rotation !== undefined) tweenProps.rotation = action.params.rotation * Math.PI / 180;
                if (action.params.scaleX !== undefined) tweenProps.scaleX = action.params.scaleX;
                if (action.params.scaleY !== undefined) tweenProps.scaleY = action.params.scaleY;
                
                this.engine.tweenSystem.to(obj, tweenProps, action.params.duration || 1, {
                    ease: action.params.ease || 'easeInOutQuad',
                    delay: action.params.delay || 0,
                    repeat: action.params.repeat || 0,
                    yoyo: action.params.yoyo || false
                });
                break;
                
            case 'tweenAlpha':
                // 补间透明度
                this.engine.tweenSystem.to(obj, 
                    { alpha: action.params.targetAlpha || 0 }, 
                    action.params.duration || 1, 
                    { ease: action.params.ease || 'easeInOutQuad' }
                );
                break;
                
            case 'tweenScale':
                // 补间缩放
                this.engine.tweenSystem.to(obj, 
                    { 
                        scaleX: action.params.scaleX || 1, 
                        scaleY: action.params.scaleY || 1 
                    }, 
                    action.params.duration || 1, 
                    { ease: action.params.ease || 'easeOutBounce' }
                );
                break;
                
            case 'tweenRotate':
                // 补间旋转
                this.engine.tweenSystem.to(obj, 
                    { rotation: (action.params.angle || 0) * Math.PI / 180 }, 
                    action.params.duration || 1, 
                    { ease: action.params.ease || 'easeInOutQuad' }
                );
                break;
                
            case 'stopTween':
                // 停止对象的所有补间
                this.engine.tweenSystem.stopAllByTarget(obj);
                break;

            case 'playSound':
                if (this.engine.audioManager && action.params && action.params.name) {
                    this.engine.audioManager.playSound(action.params.name, {
                        volume: action.params.volume !== undefined ? action.params.volume : 1,
                        loop: !!action.params.loop,
                        playbackRate: action.params.playbackRate !== undefined ? action.params.playbackRate : 1
                    });
                }
                break;

            case 'playMusic':
                if (this.engine.audioManager && action.params && action.params.name) {
                    this.engine.audioManager.playMusic(action.params.name, {
                        volume: action.params.volume !== undefined ? action.params.volume : 0.7,
                        loop: action.params.loop !== undefined ? !!action.params.loop : true,
                        fadeIn: action.params.fadeIn !== undefined ? action.params.fadeIn : 0
                    });
                }
                break;

            case 'stopMusic':
                if (this.engine.audioManager) {
                    this.engine.audioManager.stopMusic(
                        action.params && action.params.fadeOut !== undefined ? action.params.fadeOut : 0
                    );
                }
                break;
        }
    }
    
    /**
     * 启动系统
     */
    start() {
        this.isRunning = true;
        
        // 执行 'start' 事件
        this.behaviors
            .filter(b => b.eventType === 'start' && b.enabled)
            .forEach(b => this.executeBehavior(b));
        
        // 设置更新循环（collisionEnter 使用上一帧结束时的碰撞快照）
        this.updateHandler = () => {
            if (!this.isRunning) return;

            this._collisionEnterBaseline = new Set(this._collisionPairEnd);

            this.behaviors
                .filter((b) => b.eventType === 'update' && b.enabled)
                .forEach((b) => this.executeBehavior(b));

            this._rebuildCollisionPairsEnd();
        };
        
        this.engine.app.ticker.add(this.updateHandler);
    }
    
    /**
     * 停止系统
     */
    stop() {
        this.isRunning = false;
        if (this.updateHandler) {
            this.engine.app.ticker.remove(this.updateHandler);
        }
    }
    
    /**
     * 导出行为数据
     */
    export() {
        return {
            behaviors: this.behaviors
        };
    }
    
    /**
     * 导入行为数据
     */
    import(data) {
        if (data.behaviors) {
            this.behaviors = data.behaviors;
        }
    }
}

