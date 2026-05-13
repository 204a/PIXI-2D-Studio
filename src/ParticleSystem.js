import * as PIXI from 'pixi.js';

/**
 * 粒子系统 - 用于创建特效
 */

export class ParticleSystem {
    constructor(engine) {
        this.engine = engine;
        this.emitters = []; // 所有发射器
    }

    _num(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    _color(value, fallback) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const cleaned = value.trim().replace(/^#/, '0x');
            const n = Number(cleaned);
            if (Number.isFinite(n)) return n;
        }
        return fallback;
    }
    
    /**
     * 创建粒子发射器
     */
    createEmitter(options = {}) {
        const emitter = {
            id: `emitter_${Date.now()}_${Math.random()}`,
            container: new PIXI.Container(),
            particles: [],
            isActive: options.isActive !== false,
            
            // 发射器配置
            config: {
                x: this._num(options.x, 0),
                y: this._num(options.y, 0),
                emissionRate: Math.max(0, this._num(options.emissionRate, 10)), // 每秒发射数量
                maxParticles: Math.max(1, Math.floor(this._num(options.maxParticles, 100))),
                lifespan: Math.max(16, this._num(options.lifespan, 2000)), // 粒子生命周期（毫秒）
                
                // 粒子初始属性
                startColor: this._color(options.startColor, 0xFFFFFF),
                endColor: this._color(options.endColor, 0x000000),
                startAlpha: this._num(options.startAlpha, 1),
                endAlpha: this._num(options.endAlpha, 0),
                startScale: this._num(options.startScale, 1),
                endScale: this._num(options.endScale, 0.5),
                
                // 速度和方向
                speed: this._num(options.speed, 2),
                speedVariation: this._num(options.speedVariation, 0.5),
                angle: this._num(options.angle, 0),
                angleSpread: this._num(options.angleSpread, 360),
                
                // 重力
                gravity: this._num(options.gravity, 0),
                particleSize: Math.max(1, this._num(options.particleSize, 3))
            },
            
            lastEmitTime: Date.now(),
            particlePool: [] // 对象池
        };

        emitter.container.x = emitter.config.x;
        emitter.container.y = emitter.config.y;
        emitter.container.alpha = this._num(options.alpha, 1);
        emitter.container.rotation = this._num(options.rotation, 0) * Math.PI / 180;
        
        const root = this.engine.getWorldContainer?.() ?? this.engine.app.stage;
        root.addChild(emitter.container);
        this.emitters.push(emitter);
        
        return emitter;
    }

    updateEmitter(emitter, options = {}) {
        if (!emitter) return;
        const config = emitter.config;
        if (options.x !== undefined) {
            config.x = this._num(options.x, config.x);
            emitter.container.x = config.x;
        }
        if (options.y !== undefined) {
            config.y = this._num(options.y, config.y);
            emitter.container.y = config.y;
        }
        if (options.alpha !== undefined) emitter.container.alpha = this._num(options.alpha, emitter.container.alpha);
        if (options.rotation !== undefined) emitter.container.rotation = this._num(options.rotation, 0) * Math.PI / 180;
        if (options.isActive !== undefined) emitter.isActive = !!options.isActive;

        const numericKeys = [
            'emissionRate',
            'maxParticles',
            'lifespan',
            'startAlpha',
            'endAlpha',
            'startScale',
            'endScale',
            'speed',
            'speedVariation',
            'angle',
            'angleSpread',
            'gravity',
            'particleSize'
        ];
        numericKeys.forEach((key) => {
            if (options[key] !== undefined) config[key] = this._num(options[key], config[key]);
        });
        if (options.startColor !== undefined) config.startColor = this._color(options.startColor, config.startColor);
        if (options.endColor !== undefined) config.endColor = this._color(options.endColor, config.endColor);

        config.emissionRate = Math.max(0, config.emissionRate);
        config.maxParticles = Math.max(1, Math.floor(config.maxParticles));
        config.lifespan = Math.max(16, config.lifespan);
        config.particleSize = Math.max(1, config.particleSize);

        while (emitter.particles.length > config.maxParticles) {
            const particle = emitter.particles.pop();
            if (particle?.sprite?.parent) particle.sprite.parent.removeChild(particle.sprite);
            if (particle?.sprite) emitter.particlePool.push(particle.sprite);
        }
    }
    
    /**
     * 更新粒子系统
     */
    update(deltaTime) {
        const now = Date.now();
        
        this.emitters.forEach(emitter => {
            const config = emitter.config;
            
            // 发射新粒子
            const timeSinceLastEmit = now - emitter.lastEmitTime;
            const emitInterval = 1000 / config.emissionRate;
            
            if (emitter.isActive && config.emissionRate > 0 && timeSinceLastEmit >= emitInterval && emitter.particles.length < config.maxParticles) {
                this.emitParticle(emitter);
                emitter.lastEmitTime = now;
            }
            
            // 更新现有粒子
            for (let i = emitter.particles.length - 1; i >= 0; i--) {
                const particle = emitter.particles[i];
                const age = now - particle.birthTime;
                const lifeProgress = age / config.lifespan;
                
                // 粒子死亡
                if (lifeProgress >= 1) {
                    emitter.container.removeChild(particle.sprite);
                    emitter.particles.splice(i, 1);
                    emitter.particlePool.push(particle.sprite);
                    continue;
                }
                
                // 更新位置
                particle.sprite.x += particle.vx * deltaTime;
                particle.sprite.y += particle.vy * deltaTime;
                
                // 应用重力
                particle.vy += config.gravity * deltaTime;
                
                // 更新颜色和透明度
                particle.sprite.alpha = this.lerp(config.startAlpha, config.endAlpha, lifeProgress);
                particle.sprite.scale.set(this.lerp(config.startScale, config.endScale, lifeProgress));
                
                // 颜色渐变
                particle.sprite.tint = this.lerpColor(config.startColor, config.endColor, lifeProgress);
            }
        });
    }
    
    /**
     * 发射单个粒子
     */
    emitParticle(emitter) {
        const config = emitter.config;
        
        // 从对象池获取或创建新粒子
        let sprite;
        if (emitter.particlePool.length > 0) {
            sprite = emitter.particlePool.pop();
            sprite.alpha = 1;
            if (sprite.clear) {
                sprite.clear();
                sprite.beginFill(0xFFFFFF);
                sprite.drawCircle(0, 0, config.particleSize);
                sprite.endFill();
            }
        } else {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xFFFFFF);
            graphics.drawCircle(0, 0, config.particleSize);
            graphics.endFill();
            sprite = graphics;
        }
        
        // 随机角度和速度
        const angleRad = (config.angle + (Math.random() - 0.5) * config.angleSpread) * Math.PI / 180;
        const speed = config.speed * (1 + (Math.random() - 0.5) * config.speedVariation);
        
        const particle = {
            sprite,
            birthTime: Date.now(),
            vx: Math.cos(angleRad) * speed,
            vy: Math.sin(angleRad) * speed
        };
        
        sprite.x = 0;
        sprite.y = 0;
        sprite.scale.set(config.startScale);
        sprite.tint = config.startColor;
        sprite.alpha = config.startAlpha;
        
        emitter.container.addChild(sprite);
        emitter.particles.push(particle);
    }
    
    /**
     * 线性插值
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    }
    
    /**
     * 颜色插值
     */
    lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        const r = Math.round(this.lerp(r1, r2, t));
        const g = Math.round(this.lerp(g1, g2, t));
        const b = Math.round(this.lerp(b1, b2, t));
        
        return (r << 16) | (g << 8) | b;
    }
    
    /**
     * 移除发射器
     */
    removeEmitter(emitterId) {
        const index = this.emitters.findIndex(e => e.id === emitterId);
        if (index > -1) {
            const emitter = this.emitters[index];
            if (emitter.container.parent) {
                emitter.container.parent.removeChild(emitter.container);
            }
            this.emitters.splice(index, 1);
        }
    }
    
    /**
     * 清空所有粒子
     */
    clear() {
        this.emitters.forEach(emitter => {
            if (emitter.container.parent) {
                emitter.container.parent.removeChild(emitter.container);
            }
        });
        this.emitters = [];
    }
}

