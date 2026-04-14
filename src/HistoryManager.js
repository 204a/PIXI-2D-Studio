/**
 * 历史记录管理器 - 支持撤销和重做功能
 */

export class HistoryManager {
    constructor(engine) {
        this.engine = engine;
        this.history = []; // 历史记录栈
        this.currentIndex = -1; // 当前位置
        this.maxHistory = 50; // 最大历史记录数
    }
    
    /**
     * 保存当前状态
     */
    saveState(action = 'unknown') {
        // 如果不在历史记录末尾，清除后面的记录
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        // 保存当前场景状态
        const state = {
            action,
            timestamp: Date.now(),
            objects: this.engine.gameObjects.map(obj => ({
                id: obj.id,
                type: obj.type,
                properties: JSON.parse(JSON.stringify(obj.properties)),
                parentId: obj.parentId
            }))
        };
        
        this.history.push(state);
        this.currentIndex++;
        
        // 限制历史记录数量
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.currentIndex--;
        }
    }
    
    /**
     * 撤销
     */
    undo() {
        if (!this.canUndo()) {
            console.log('无法撤销');
            return false;
        }
        
        this.currentIndex--;
        this.restoreState(this.history[this.currentIndex]);
        return true;
    }
    
    /**
     * 重做
     */
    redo() {
        if (!this.canRedo()) {
            console.log('无法重做');
            return false;
        }
        
        this.currentIndex++;
        this.restoreState(this.history[this.currentIndex]);
        return true;
    }
    
    /**
     * 检查是否可以撤销
     */
    canUndo() {
        return this.currentIndex > 0;
    }
    
    /**
     * 检查是否可以重做
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    
    /**
     * 恢复到指定状态
     */
    restoreState(state) {
        if (!state) return;
        
        // 清除当前所有对象
        this.engine.clearScene(false); // 不保存历史
        
        // 重建对象
        state.objects.forEach(objData => {
            const obj = this.engine.createGameObject(objData.type, objData.properties, false);
            obj.id = objData.id;
            obj.parentId = objData.parentId;
        });
        
        // 通知UI更新
        if (this.engine.onSceneChanged) {
            this.engine.onSceneChanged();
        }
    }
    
    /**
     * 清空历史记录
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
    }
    
    /**
     * 获取历史记录信息
     */
    getInfo() {
        return {
            total: this.history.length,
            current: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}


