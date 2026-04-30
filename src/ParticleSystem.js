import * as PIXI from 'pixi.js';

/**
 * 粒子系统 - 用于创建特效
 */

export class ParticleSystem {
    constructor(engine) {
        this.engine = engine;
        this.emitters = []; // 所有发射器
    }
    
    /**
     * 创建粒子发射器
     */
    createEmitter(options = {}) {
        const emitter = {
            id: `emitter_${Date.now()}_${Math.random()}`,
            container: new PIXI.Container(),
            particles: [],
            isActive: true,
            
            // 发射器配置
            config: {
                x: options.x || 0,
                y: options.y || 0,
                emissionRate: options.emissionRate || 10, // 每秒发射数量
                maxParticles: options.maxParticles || 100,
                lifespan: options.lifespan || 2000, // 粒子生命周期（毫秒）
                
                // 粒子初始属性
                startColor: options.startColor || 0xFFFFFF,
                endColor: options.endColor || 0x000000,
                startAlpha: options.startAlpha || 1,
                endAlpha: options.endAlpha || 0,
                startScale: options.startScale || 1,
                endScale: options.endScale || 0.5,
                
                // 速度和方向
                speed: options.speed || 2,
                speedVariation: options.speedVariation || 0.5,
                angle: options.angle || 0,
                angleSpread: options.angleSpread || 360,
                
                // 重力
                gravity: options.gravity || 0
            },
            
            lastEmitTime: Date.now(),
            particlePool: [] // 对象池
        };
        
        const root = this.engine.getWorldContainer?.() ?? this.engine.app.stage;
        root.addChild(emitter.container);
        this.emitters.push(emitter);
        
        return emitter;
    }
    
    /**
     * 更新粒子系统
     */
    update(deltaTime) {
        const now = Date.now();
        
        this.emitters.forEach(emitter => {
            if (!emitter.isActive) return;
            
            const config = emitter.config;
            
            // 发射新粒子
            const timeSinceLastEmit = now - emitter.lastEmitTime;
            const emitInterval = 1000 / config.emissionRate;
            
            if (timeSinceLastEmit >= emitInterval && emitter.particles.length < config.maxParticles) {
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
        } else {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xFFFFFF);
            graphics.drawCircle(0, 0, 3);
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
        
        sprite.x = config.x;
        sprite.y = config.y;
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
            const root = this.engine.getWorldContainer?.() ?? this.engine.app.stage;
            root.removeChild(emitter.container);
            this.emitters.splice(index, 1);
        }
    }
    
    /**
     * 清空所有粒子
     */
    clear() {
        const root = this.engine.getWorldContainer?.() ?? this.engine.app.stage;
        this.emitters.forEach(emitter => {
            root.removeChild(emitter.container);
        });
        this.emitters = [];
    }
}

