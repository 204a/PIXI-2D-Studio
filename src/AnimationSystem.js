import * as PIXI from 'pixi.js';

/**
 * 动画系统 - 支持精灵帧动画
 */

export class AnimationSystem {
    constructor(engine) {
        this.engine = engine;
        this.animations = new Map(); // 动画数据
        this.animatedSprites = new Map(); // 播放中的动画精灵
    }
    
    /**
     * 创建动画（从多张图片）
     */
    createAnimation(name, frames) {
        const textures = frames.map(frame => {
            if (typeof frame === 'string') {
                // 资源名称
                return this.engine.resourceManager.getTexture(frame);
            }
            return frame;
        }).filter(t => t);
        
        this.animations.set(name, textures);
        return textures;
    }
    
    /**
     * 为游戏对象添加动画
     */
    addAnimationToObject(gameObject, animationName, config = {}) {
        const textures = this.animations.get(animationName);
        if (!textures || textures.length === 0) {
            console.error('动画不存在:', animationName);
            return null;
        }
        
        // 创建AnimatedSprite
        const animatedSprite = new PIXI.AnimatedSprite(textures);
        animatedSprite.animationSpeed = config.speed || 0.1;
        animatedSprite.loop = config.loop !== false;
        animatedSprite.x = gameObject.displayObject.x;
        animatedSprite.y = gameObject.displayObject.y;
        animatedSprite.width = gameObject.properties.width || animatedSprite.width;
        animatedSprite.height = gameObject.properties.height || animatedSprite.height;
        
        // 替换displayObject
        const parent = gameObject.displayObject.parent;
        const index = parent.getChildIndex(gameObject.displayObject);
        parent.removeChild(gameObject.displayObject);
        parent.addChildAt(animatedSprite, index);
        
        gameObject.displayObject = animatedSprite;
        gameObject.properties.animationName = animationName;
        
        // 自动播放
        if (config.autoPlay !== false) {
            animatedSprite.play();
        }
        
        this.animatedSprites.set(gameObject.id, animatedSprite);
        this.engine.setupInteraction(gameObject);
        
        return animatedSprite;
    }
    
    /**
     * 播放动画
     */
    playAnimation(gameObject) {
        const sprite = this.animatedSprites.get(gameObject.id);
        if (sprite) {
            sprite.play();
        }
    }
    
    /**
     * 停止动画
     */
    stopAnimation(gameObject) {
        const sprite = this.animatedSprites.get(gameObject.id);
        if (sprite) {
            sprite.stop();
        }
    }
    
    /**
     * 设置动画速度
     */
    setAnimationSpeed(gameObject, speed) {
        const sprite = this.animatedSprites.get(gameObject.id);
        if (sprite) {
            sprite.animationSpeed = speed;
        }
    }
    
    /**
     * 跳转到指定帧
     */
    gotoFrame(gameObject, frame) {
        const sprite = this.animatedSprites.get(gameObject.id);
        if (sprite) {
            sprite.gotoAndStop(frame);
        }
    }
    
    /**
     * 删除动画
     */
    removeAnimation(name) {
        this.animations.delete(name);
    }
    
    /**
     * 移除对象的动画
     */
    removeObjectAnimation(gameObject) {
        const sprite = this.animatedSprites.get(gameObject.id);
        if (sprite) {
            sprite.stop();
            this.animatedSprites.delete(gameObject.id);
        }
    }
}

