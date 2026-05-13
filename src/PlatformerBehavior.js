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
        this.autoFlip = config.autoFlip !== false;
        this.baseScaleX = Math.abs(gameObject.properties.scaleX || this.obj.scale?.x || 1) || 1;
        
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

        if (!this.gameObject.properties.facing) {
            this.gameObject.properties.facing = 'right';
        }
        this.syncFacing();
    }

    /**
     * 根据 facing 同步视觉朝向；properties.x 始终保留为碰撞用的左上角坐标。
     */
    syncFacing() {
        if (!this.autoFlip || !this.obj.scale) return;

        const props = this.gameObject.properties;
        const width = props.width || 50;
        const facingLeft = props.facing === 'left';
        const scaleX = facingLeft ? -this.baseScaleX : this.baseScaleX;

        this.obj.scale.x = scaleX;
        this.obj.x = (props.x || 0) + (facingLeft ? width : 0);
        props.scaleX = scaleX;
    }

    setFacing(direction) {
        if (!this.autoFlip || this.gameObject.properties.facing === direction) return;
        this.gameObject.properties.facing = direction;
        this.syncFacing();
    }
    
    /**
     * 更新
     */
    update(deltaTime, inputManager, platforms) {
        const dt = deltaTime;
        
        // 水平移动
        if (inputManager.isKeyDown(this.keys.left)) {
            this.gameObject.properties.x -= this.speed * dt;
            this.setFacing('left');
            this.syncFacing();
        }
        
        if (inputManager.isKeyDown(this.keys.right)) {
            this.gameObject.properties.x += this.speed * dt;
            this.setFacing('right');
            this.syncFacing();
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
        this.gameObject.properties.y += this.velocityY * dt;
        this.obj.y = this.gameObject.properties.y;
        
        // 碰撞检测
        this.isOnGround = false;
        if (platforms) {
            platforms.forEach(platform => {
                if (this.checkCollision(platform)) {
                    // 站在平台上
                    if (this.velocityY > 0) {
                        const platformTop = platform.displayObject.y;
                        this.gameObject.properties.y = platformTop - (this.gameObject.properties.height || 50);
                        this.obj.y = this.gameObject.properties.y;
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
        
        const x1 = props.x || 0;
        const y1 = props.y || 0;
        const w1 = props.width || 50;
        const h1 = props.height || 50;
        
        const x2 = pProps.x ?? platform.displayObject.x;
        const y2 = pProps.y ?? platform.displayObject.y;
        const w2 = pProps.width || 100;
        const h2 = pProps.height || 20;
        
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    }
}


