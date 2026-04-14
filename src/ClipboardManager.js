/**
 * 剪贴板管理器 - 处理复制/粘贴/剪切
 */

export class ClipboardManager {
    constructor(engine) {
        this.engine = engine;
        this.clipboard = null; // 存储复制的对象数据
        this.pasteOffset = 20; // 粘贴时的偏移量
        this.init();
    }
    
    init() {
        // 监听键盘快捷键
        window.addEventListener('keydown', (e) => {
            // 不在运行模式下才响应
            if (this.engine.isRunning) return;
            
            // Ctrl/Cmd + C: 复制
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (this.engine.selectedObject) {
                    e.preventDefault();
                    this.copy();
                }
            }
            
            // Ctrl/Cmd + V: 粘贴
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (this.clipboard) {
                    e.preventDefault();
                    this.paste();
                }
            }
            
            // Ctrl/Cmd + X: 剪切
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                if (this.engine.selectedObject) {
                    e.preventDefault();
                    this.cut();
                }
            }
            
            // Ctrl/Cmd + D: 快速复制（原地复制）
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                if (this.engine.selectedObject) {
                    e.preventDefault();
                    this.duplicate();
                }
            }
        });
    }
    
    /**
     * 复制对象
     */
    copy() {
        // 支持多选复制
        if (this.engine.selectionManager && this.engine.selectionManager.getSelectionCount() > 1) {
            this.clipboard = this.engine.selectionManager.copySelection();
            if (this.engine.editorUI) {
                this.engine.editorUI.updateStatus(`✅ 已复制 ${this.clipboard.length} 个对象`);
            }
            return;
        }
        
        const obj = this.engine.selectedObject;
        if (!obj) return;
        
        // 深拷贝对象数据
        this.clipboard = {
            type: obj.type,
            properties: JSON.parse(JSON.stringify(obj.properties)),
            parentId: obj.parentId,
            // 复制行为
            behaviors: this.copyBehaviors(obj.id)
        };
        
        console.log('已复制对象:', obj.type);
        
        // 更新状态栏
        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus(`✅ 已复制 ${this.getObjectName(obj)}`);
        }
    }
    
    /**
     * 复制对象的所有行为
     */
    copyBehaviors(objectId) {
        const behaviors = this.engine.behaviorSystem.getObjectBehaviors(objectId);
        return behaviors.map(behavior => ({
            eventType: behavior.eventType,
            actions: JSON.parse(JSON.stringify(behavior.actions)),
            conditions: JSON.parse(JSON.stringify(behavior.conditions)),
            order: behavior.order,
            subEvents: behavior.subEvents ? [...behavior.subEvents] : []
        }));
    }
    
    /**
     * 粘贴对象
     */
    paste() {
        if (!this.clipboard) return;
        
        // 支持批量粘贴
        if (Array.isArray(this.clipboard)) {
            const pastedObjects = [];
            this.clipboard.forEach(objData => {
                const newProps = { ...objData.properties };
                newProps.x += this.pasteOffset;
                newProps.y += this.pasteOffset;
                
                const newObj = this.engine.createGameObject(objData.type, newProps, false);
                pastedObjects.push(newObj);
            });
            
            // 选中新粘贴的对象
            if (this.engine.selectionManager && pastedObjects.length > 1) {
                this.engine.selectionManager.setSelection(pastedObjects);
            } else if (pastedObjects.length === 1) {
                this.engine.selectObject(pastedObjects[0]);
            }
            
            if (this.engine.editorUI) {
                this.engine.editorUI.updateStatus(`✅ 已粘贴 ${pastedObjects.length} 个对象`);
                this.engine.editorUI.updateSceneObjectList();
            }
            return;
        }
        
        // 创建新对象，位置偏移
        const newProps = { ...this.clipboard.properties };
        newProps.x += this.pasteOffset;
        newProps.y += this.pasteOffset;
        
        const newObj = this.engine.createGameObject(this.clipboard.type, newProps, true);
        
        if (!newObj) return;
        
        // 恢复行为
        this.pasteBehaviors(newObj.id, this.clipboard.behaviors);
        
        // 选中新对象
        this.engine.selectObject(newObj);
        
        console.log('已粘贴对象:', newObj.type);
        
        // 更新状态栏
        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus(`✅ 已粘贴 ${this.getObjectName(newObj)}`);
        }
        
        // 通知UI更新
        if (this.engine.onSceneChanged) {
            this.engine.onSceneChanged();
        }
    }
    
    /**
     * 粘贴行为到新对象
     */
    pasteBehaviors(newObjectId, behaviors) {
        behaviors.forEach(behavior => {
            this.engine.behaviorSystem.addBehavior(
                newObjectId,
                behavior.eventType,
                behavior.actions,
                {
                    conditions: behavior.conditions,
                    order: behavior.order
                }
            );
        });
    }
    
    /**
     * 剪切对象
     */
    cut() {
        const obj = this.engine.selectedObject;
        if (!obj) return;
        
        // 先复制
        this.copy();
        
        // 再删除
        this.engine.removeGameObject(obj);
        
        console.log('已剪切对象');
        
        // 更新状态栏
        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus(`✂️ 已剪切 ${this.getObjectName(obj)}`);
        }
        
        // 通知UI更新
        if (this.engine.onSceneChanged) {
            this.engine.onSceneChanged();
        }
    }
    
    /**
     * 快速复制（Ctrl+D）
     */
    duplicate() {
        const obj = this.engine.selectedObject;
        if (!obj) return;
        
        // 临时保存当前剪贴板
        const oldClipboard = this.clipboard;
        
        // 复制并粘贴
        this.copy();
        this.paste();
        
        // 恢复剪贴板（避免影响Ctrl+C/V）
        this.clipboard = oldClipboard;
    }
    
    /**
     * 获取对象显示名称
     */
    getObjectName(obj) {
        const names = {
            'sprite': '精灵',
            'text': '文本',
            'rectangle': '矩形',
            'circle': '圆形',
            'container': '容器',
            'particle': '粒子'
        };
        return names[obj.type] || obj.type;
    }
    
    /**
     * 清空剪贴板
     */
    clear() {
        this.clipboard = null;
    }
    
    /**
     * 检查剪贴板是否有内容
     */
    hasClipboard() {
        return this.clipboard !== null;
    }
}
