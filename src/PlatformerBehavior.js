/**
 * 平台角色行为 - 支持移动、跳跃、重力
 */

export class PlatformerBehavior {
    constructor(gameObject, config = {}) {
        this.gameObject = gameObject;
        this.obj = gameObject.displayObject;
        
        // 配置
        this.speed = config.speed || 200;
        this.jumpForce = config.jumpForce || 400;
        this.gravity = config.gravity || 800;
        this.maxFallSpeed = config.maxFallSpeed || 600;
        
        // 控制键
        this.keys = {
            left: config.leftKey || 'ArrowLeft',
            right: config.rightKey || 'ArrowRight',
            jump: config.jumpKey || 'ArrowUp'
        };
        
        // 状态
        this.velocityY = 0;
        this.isOnGround = false;
        this.canJump = true;
    }
    
    /**
     * 更新
     */
    update(deltaTime, inputManager, platforms) {
        const dt = deltaTime;
        
        // 水平移动
        if (inputManager.isKeyDown(this.keys.left)) {
            this.obj.x -= this.speed * dt;
            this.gameObject.properties.x = this.obj.x;
        }
        
        if (inputManager.isKeyDown(this.keys.right)) {
            this.obj.x += this.speed * dt;
            this.gameObject.properties.x = this.obj.x;
        }
        
        // 跳跃
        if (inputManager.isKeyPressed(this.keys.jump) && this.isOnGround) {
            this.velocityY = -this.jumpForce;
            this.isOnGround = false;
        }
        
        // 应用重力
        this.velocityY += this.gravity * dt;
        if (this.velocityY > this.maxFallSpeed) {
            this.velocityY = this.maxFallSpeed;
        }
        
        // 应用垂直速度
        this.obj.y += this.velocityY * dt;
        this.gameObject.properties.y = this.obj.y;
        
        // 碰撞检测
        this.isOnGround = false;
        if (platforms) {
            platforms.forEach(platform => {
                if (this.checkCollision(platform)) {
                    // 站在平台上
                    if (this.velocityY > 0) {
                        const platformTop = platform.displayObject.y;
                        this.obj.y = platformTop - (this.gameObject.properties.height || 50);
                        this.gameObject.properties.y = this.obj.y;
                        this.velocityY = 0;
                        this.isOnGround = true;
                    }
                }
            });
        }
    }
    
    /**
     * 简单碰撞检测
     */
    checkCollision(platform) {
        const props = this.gameObject.properties;
        const pProps = platform.properties;
        
        const x1 = this.obj.x;
        const y1 = this.obj.y;
        const w1 = props.width || 50;
        const h1 = props.height || 50;
        
        const x2 = platform.displayObject.x;
        const y2 = platform.displayObject.y;
        const w2 = pProps.width || 100;
        const h2 = pProps.height || 20;
        
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    }
}


