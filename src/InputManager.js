/**
 * 输入管理器 - 键盘和鼠标输入
 */

export class InputManager {
    constructor() {
        this.keys = {};
        this.keysPressed = {};
        this.keysReleased = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseButtons = {};
        this.mouseButtonsPressed = {};
        this.mouseButtonsReleased = {};
        
        this.init();
    }
    
    init() {
        // 键盘事件
        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.key]) {
                this.keysPressed[e.key] = true;
            }
            this.keys[e.key] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            this.keysReleased[e.key] = true;
        });
        
        // 鼠标事件
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        window.addEventListener('mousedown', (e) => {
            if (!this.mouseButtons[e.button]) {
                this.mouseButtonsPressed[e.button] = true;
            }
            this.mouseButtons[e.button] = true;
        });
        
        window.addEventListener('mouseup', (e) => {
            this.mouseButtons[e.button] = false;
            this.mouseButtonsReleased[e.button] = true;
        });

        // 触摸映射为鼠标左键与坐标（移动端预览/游玩）
        const touchXY = (e) => {
            const t = e.touches && e.touches[0] ? e.touches[0] : e.changedTouches && e.changedTouches[0];
            if (t) {
                this.mouseX = t.clientX;
                this.mouseY = t.clientY;
            }
        };
        window.addEventListener(
            'touchstart',
            (e) => {
                touchXY(e);
                if (!this.mouseButtons[0]) this.mouseButtonsPressed[0] = true;
                this.mouseButtons[0] = true;
            },
            { passive: true }
        );
        window.addEventListener(
            'touchend',
            (e) => {
                touchXY(e);
                this.mouseButtons[0] = false;
                this.mouseButtonsReleased[0] = true;
            },
            { passive: true }
        );
        window.addEventListener('touchmove', (e) => touchXY(e), { passive: true });
    }
    
    /**
     * 检查按键是否按下
     */
    isKeyDown(key) {
        return this.keys[key] === true;
    }
    
    /**
     * 检查按键是否刚按下（只触发一次）
     */
    isKeyPressed(key) {
        return this.keysPressed[key] === true;
    }
    
    /**
     * 检查按键是否刚释放
     */
    isKeyReleased(key) {
        return this.keysReleased[key] === true;
    }
    
    /**
     * 清除一次性状态（每帧结束调用）
     */
    update() {
        this.keysPressed = {};
        this.keysReleased = {};
        this.mouseButtonsPressed = {};
        this.mouseButtonsReleased = {};
    }
    
    /**
     * 检查鼠标按键是否按下
     */
    isMouseDown(button = 0) {
        return this.mouseButtons[button] === true;
    }
    
    /**
     * 检查鼠标按键是否刚按下
     */
    isMousePressed(button = 0) {
        return this.mouseButtonsPressed[button] === true;
    }
    
    /**
     * 检查鼠标按键是否刚释放
     */
    isMouseReleased(button = 0) {
        return this.mouseButtonsReleased[button] === true;
    }
    
    /**
     * 获取鼠标位置
     */
    getMousePosition() {
        return { x: this.mouseX, y: this.mouseY };
    }
}


