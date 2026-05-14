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

    getCurrentSceneId() {
        return this.engine.sceneManager?.activeSceneId || 'main';
    }
    
    /**
     * 保存当前状态
     */
    saveState(action = 'unknown') {
        // 如果不在历史记录末尾，清除后面的记录
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        const sceneData = this.engine.exportSceneCore
            ? this.engine.exportSceneCore()
            : null;

        // 保存当前场景状态；sceneData 用于恢复事件、动画、图层等完整逻辑。
        const state = {
            action,
            timestamp: Date.now(),
            sceneId: this.getCurrentSceneId(),
            sceneData: sceneData ? JSON.parse(JSON.stringify(sceneData)) : null,
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

        const sceneId = this.getCurrentSceneId();
        for (let i = this.currentIndex - 1; i >= 0; i--) {
            if ((this.history[i].sceneId || 'main') === sceneId) {
                this.currentIndex = i;
                this.restoreState(this.history[this.currentIndex]);
                return true;
            }
        }
        return false;
    }
    
    /**
     * 重做
     */
    redo() {
        if (!this.canRedo()) {
            console.log('无法重做');
            return false;
        }

        const sceneId = this.getCurrentSceneId();
        for (let i = this.currentIndex + 1; i < this.history.length; i++) {
            if ((this.history[i].sceneId || 'main') === sceneId) {
                this.currentIndex = i;
                this.restoreState(this.history[this.currentIndex]);
                return true;
            }
        }
        return false;
    }
    
    /**
     * 检查是否可以撤销
     */
    canUndo() {
        const sceneId = this.getCurrentSceneId();
        for (let i = this.currentIndex - 1; i >= 0; i--) {
            if ((this.history[i].sceneId || 'main') === sceneId) return true;
        }
        return false;
    }
    
    /**
     * 检查是否可以重做
     */
    canRedo() {
        const sceneId = this.getCurrentSceneId();
        for (let i = this.currentIndex + 1; i < this.history.length; i++) {
            if ((this.history[i].sceneId || 'main') === sceneId) return true;
        }
        return false;
    }
    
    /**
     * 恢复到指定状态
     */
    restoreState(state) {
        if (!state) return;

        if (state.sceneData && Array.isArray(state.sceneData.objects)) {
            this.restoreSceneData(state.sceneData);
            return;
        }
        
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

    restoreSceneData(sceneData) {
        this.engine.clearScene(false); // 不保存历史

        if (sceneData.project && this.engine.applyProjectSettings) {
            this.engine.applyProjectSettings(sceneData.project);
        }

        if (this.engine.animationSystem) {
            this.engine.animationSystem.reset();
            if (sceneData.animations) {
                this.engine.animationSystem.import(sceneData.animations);
            }
        }

        if (this.engine.layerManager && sceneData.layers) {
            this.engine.layerManager.import(sceneData.layers);
        }

        sceneData.objects.forEach(objData => {
            const obj = this.engine.createGameObject(objData.type, objData.properties, false);
            if (obj) {
                obj.id = objData.id;
                obj.parentId = objData.parentId;
            }
        });

        // 恢复容器父子关系，保持与导入场景一致。
        sceneData.objects.forEach(objData => {
            if (!objData.parentId) return;
            const child = this.engine.gameObjects.find((g) => g.id === objData.id);
            const parent = this.engine.gameObjects.find((g) => g.id === objData.parentId);
            if (child && parent && parent.type === 'container' && this.engine._reparentImportedObject) {
                this.engine._reparentImportedObject(child, parent);
            }
        });

        if (this.engine.animationSystem) {
            this.engine.gameObjects.forEach((obj) => {
                if (obj.type === 'sprite' && obj.properties.animationName) {
                    this.engine.animationSystem.addAnimationToObject(obj, obj.properties.animationName, {
                        speed: obj.properties.animSpeed || 0.1,
                        autoPlay: true
                    });
                }
            });
        }

        if (this.engine.behaviorSystem && sceneData.behaviors) {
            this.engine.behaviorSystem.import(sceneData.behaviors);
        }

        if (this.engine.layerManager) {
            this.engine.layerManager.applyToAllObjects();
        }

        if (this.engine.cameraManager) {
            this.engine.cameraManager.import(sceneData.camera || {});
        }

        this.engine.selectedObject = null;
        if (this.engine.selectionManager) {
            this.engine.selectionManager.clearSelection();
        }
        if (this.engine.transformControls) {
            this.engine.transformControls.hide();
        }

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

    resetToCurrentScene(action = '场景基线') {
        this.clear();
        this.saveState(action);
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


