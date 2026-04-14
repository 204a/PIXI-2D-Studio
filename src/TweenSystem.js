/**
 * 补间动画系统
 * 支持位置、旋转、缩放、透明度等属性的平滑过渡
 */

export class TweenSystem {
    constructor(engine) {
        this.engine = engine;
        this.tweens = []; // 所有活动的补间动画
        this.nextId = 1;
    }
    
    /**
     * 创建补间动画
     * @param {Object} target - 目标对象
     * @param {Object} properties - 要补间的属性 {x: 100, y: 200, alpha: 0.5}
     * @param {Number} duration - 持续时间（秒）
     * @param {Object} options - 可选配置 {ease, delay, repeat, yoyo, onStart, onUpdate, onComplete}
     */
    to(target, properties, duration, options = {}) {
        const tween = {
            id: this.nextId++,
            target,
            startValues: {},
            endValues: properties,
            duration,
            elapsed: 0,
            delay: options.delay || 0,
            delayElapsed: 0,
            ease: this.getEaseFunction(options.ease || 'linear'),
            repeat: options.repeat || 0, // -1表示无限循环
            repeatCount: 0,
            yoyo: options.yoyo || false,
            isReversing: false,
            paused: false,
            onStart: options.onStart,
            onUpdate: options.onUpdate,
            onComplete: options.onComplete,
            started: false
        };
        
        // 记录起始值
        for (const key in properties) {
            if (key === 'rotation') {
                // 特殊处理旋转（弧度）
                tween.startValues[key] = target.rotation || 0;
            } else if (key === 'alpha') {
                tween.startValues[key] = target.alpha !== undefined ? target.alpha : 1;
            } else if (key === 'scaleX' || key === 'scaleY') {
                tween.startValues[key] = target.scale ? target.scale[key === 'scaleX' ? 'x' : 'y'] : 1;
            } else {
                tween.startValues[key] = target[key] || 0;
            }
        }
        
        this.tweens.push(tween);
        return tween.id;
    }
    
    /**
     * 创建序列补间（链式动画）
     */
    createSequence(target) {
        const sequence = {
            target,
            steps: [],
            currentStep: 0,
            tweenId: null
        };
        
        const api = {
            to: (properties, duration, options = {}) => {
                sequence.steps.push({ properties, duration, options });
                return api;
            },
            delay: (time) => {
                sequence.steps.push({ delay: time });
                return api;
            },
            start: () => {
                this.startSequence(sequence);
                return sequence;
            }
        };
        
        return api;
    }
    
    /**
     * 启动序列动画
     */
    startSequence(sequence) {
        if (sequence.currentStep >= sequence.steps.length) {
            sequence.currentStep = 0;
            return;
        }
        
        const step = sequence.steps[sequence.currentStep];
        
        if (step.delay) {
            setTimeout(() => {
                sequence.currentStep++;
                this.startSequence(sequence);
            }, step.delay * 1000);
        } else {
            const options = {
                ...step.options,
                onComplete: () => {
                    if (step.options.onComplete) step.options.onComplete();
                    sequence.currentStep++;
                    this.startSequence(sequence);
                }
            };
            
            sequence.tweenId = this.to(sequence.target, step.properties, step.duration, options);
        }
    }
    
    /**
     * 暂停补间
     */
    pause(tweenId) {
        const tween = this.tweens.find(t => t.id === tweenId);
        if (tween) tween.paused = true;
    }
    
    /**
     * 恢复补间
     */
    resume(tweenId) {
        const tween = this.tweens.find(t => t.id === tweenId);
        if (tween) tween.paused = false;
    }
    
    /**
     * 停止补间
     */
    stop(tweenId) {
        const index = this.tweens.findIndex(t => t.id === tweenId);
        if (index !== -1) {
            this.tweens.splice(index, 1);
        }
    }
    
    /**
     * 停止目标对象的所有补间
     */
    stopAllByTarget(target) {
        this.tweens = this.tweens.filter(t => t.target !== target);
    }
    
    /**
     * 清除所有补间
     */
    clear() {
        this.tweens = [];
    }
    
    /**
     * 更新所有补间动画
     */
    update(deltaTime) {
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const tween = this.tweens[i];
            
            if (tween.paused) continue;
            
            // 处理延迟
            if (tween.delay > 0) {
                tween.delayElapsed += deltaTime;
                if (tween.delayElapsed < tween.delay) {
                    continue;
                }
                tween.delay = 0; // 延迟结束
            }
            
            // 首次启动回调
            if (!tween.started) {
                tween.started = true;
                if (tween.onStart) tween.onStart();
            }
            
            tween.elapsed += deltaTime;
            const progress = Math.min(tween.elapsed / tween.duration, 1);
            const easedProgress = tween.ease(progress);
            
            // 如果是反向播放（yoyo）
            const actualProgress = tween.isReversing ? 1 - easedProgress : easedProgress;
            
            // 更新属性
            for (const key in tween.endValues) {
                const startValue = tween.startValues[key];
                const endValue = tween.endValues[key];
                const currentValue = startValue + (endValue - startValue) * actualProgress;
                
                if (key === 'rotation') {
                    tween.target.rotation = currentValue;
                } else if (key === 'alpha') {
                    tween.target.alpha = currentValue;
                } else if (key === 'scaleX') {
                    if (!tween.target.scale) tween.target.scale = { x: 1, y: 1 };
                    tween.target.scale.x = currentValue;
                } else if (key === 'scaleY') {
                    if (!tween.target.scale) tween.target.scale = { x: 1, y: 1 };
                    tween.target.scale.y = currentValue;
                } else {
                    tween.target[key] = currentValue;
                }
            }
            
            // 更新回调
            if (tween.onUpdate) tween.onUpdate(actualProgress);
            
            // 动画完成
            if (progress >= 1) {
                // 处理yoyo（来回播放）
                if (tween.yoyo && !tween.isReversing) {
                    tween.isReversing = true;
                    tween.elapsed = 0;
                    continue;
                }
                
                // 处理重复
                if (tween.repeat === -1 || tween.repeatCount < tween.repeat) {
                    tween.repeatCount++;
                    tween.elapsed = 0;
                    tween.isReversing = false;
                    
                    // 重置起始值为当前值
                    for (const key in tween.endValues) {
                        if (key === 'rotation') {
                            tween.startValues[key] = tween.target.rotation;
                        } else if (key === 'alpha') {
                            tween.startValues[key] = tween.target.alpha;
                        } else if (key === 'scaleX' || key === 'scaleY') {
                            tween.startValues[key] = tween.target.scale[key === 'scaleX' ? 'x' : 'y'];
                        } else {
                            tween.startValues[key] = tween.target[key];
                        }
                    }
                    continue;
                }
                
                // 完成回调
                if (tween.onComplete) tween.onComplete();
                
                // 移除补间
                this.tweens.splice(i, 1);
            }
        }
    }
    
    /**
     * 获取缓动函数
     */
    getEaseFunction(easeName) {
        const easeFunctions = {
            linear: t => t,
            
            // 二次方缓动
            easeInQuad: t => t * t,
            easeOutQuad: t => t * (2 - t),
            easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            
            // 三次方缓动
            easeInCubic: t => t * t * t,
            easeOutCubic: t => (--t) * t * t + 1,
            easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
            
            // 四次方缓动
            easeInQuart: t => t * t * t * t,
            easeOutQuart: t => 1 - (--t) * t * t * t,
            easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
            
            // 五次方缓动
            easeInQuint: t => t * t * t * t * t,
            easeOutQuint: t => 1 + (--t) * t * t * t * t,
            easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
            
            // 弹性缓动
            easeInElastic: t => {
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
            },
            easeOutElastic: t => {
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            },
            
            // 回弹缓动
            easeInBounce: t => 1 - easeFunctions.easeOutBounce(1 - t),
            easeOutBounce: t => {
                const n1 = 7.5625;
                const d1 = 2.75;
                if (t < 1 / d1) {
                    return n1 * t * t;
                } else if (t < 2 / d1) {
                    return n1 * (t -= 1.5 / d1) * t + 0.75;
                } else if (t < 2.5 / d1) {
                    return n1 * (t -= 2.25 / d1) * t + 0.9375;
                } else {
                    return n1 * (t -= 2.625 / d1) * t + 0.984375;
                }
            },
            
            // 超出缓动
            easeInBack: t => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return c3 * t * t * t - c1 * t * t;
            },
            easeOutBack: t => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            }
        };
        
        return easeFunctions[easeName] || easeFunctions.linear;
    }
    
    /**
     * 获取活动补间数量
     */
    getActiveTweenCount() {
        return this.tweens.length;
    }
}
