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
        this._lastDeltaTime = 1 / 60;

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
        this._lastDeltaTime = dt;
        
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
        const prevY = this.gameObject.properties.y || 0;
        this.gameObject.properties.y += this.velocityY * dt;
        this.obj.y = this.gameObject.properties.y;
        
        // 碰撞检测
        this.isOnGround = false;
        if (platforms) {
            platforms.forEach(platform => {
                const hit = this.checkCollision(platform, prevY);
                if (hit && this.velocityY > 0) {
                    this.gameObject.properties.y = hit.y;
                    this.obj.y = this.gameObject.properties.y;
                    this.velocityY = 0;
                    this.isOnGround = true;
                }
            });
        }
    }
    
    /**
     * 简单碰撞检测
     */
    checkCollision(platform, prevY = this.gameObject.properties.y || 0) {
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
        const angle = ((pProps.rotation || 0) * Math.PI) / 180;

        const footX = x1 + w1 / 2;
        const footY = y1 + h1;
        const prevFootY = prevY + h1;

        const cur = this._worldToPlatformLocal(footX, footY, x2, y2, angle);
        const prev = this._worldToPlatformLocal(footX, prevFootY, x2, y2, angle);

        // 只处理从平台上方落到上表面的情况，避免从侧面/底部被吸到平台上。
        const tolerance = Math.max(8, Math.abs(this.velocityY) * this._lastDeltaTime + 4);
        const withinX = cur.x >= -w1 * 0.35 && cur.x <= w2 + w1 * 0.35;
        const crossedTop = prev.y <= tolerance && cur.y >= -tolerance && cur.y <= h2 + tolerance;
        if (!withinX || !crossedTop) return null;

        const surface = this._platformLocalToWorld(cur.x, 0, x2, y2, angle);
        return { y: surface.y - h1 };
    }

    _worldToPlatformLocal(x, y, platformX, platformY, angle) {
        const dx = x - platformX;
        const dy = y - platformY;
        const c = Math.cos(-angle);
        const s = Math.sin(-angle);
        return {
            x: dx * c - dy * s,
            y: dx * s + dy * c
        };
    }

    _platformLocalToWorld(x, y, platformX, platformY, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return {
            x: platformX + x * c - y * s,
            y: platformY + x * s + y * c
        };
    }
}


