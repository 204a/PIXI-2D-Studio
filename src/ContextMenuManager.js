/**
 * 右键菜单管理器
 */

import * as PIXI from 'pixi.js';

export class ContextMenuManager {
    constructor(engine) {
        this.engine = engine;
        this.menu = null;
        this.targetObject = null;
        this.init();
    }
    
    init() {
        // 监听右键
        const canvas = this.engine.app.view || this.engine.app.canvas;
        canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', () => this.closeMenu());
    }
    
    /**
     * 右键菜单事件
     */
    onContextMenu(e) {
        e.preventDefault();
        
        if (this.engine.isRunning) return;

        const globalPoint = this._clientToGlobal(e.clientX, e.clientY);
        let picked = this.pickGameObjectWithGlobal(globalPoint);
        if (
            !picked &&
            this.engine.selectedObject &&
            this._hitGameObject(globalPoint, this.engine.selectedObject)
        ) {
            picked = this.engine.selectedObject;
        }
        this.targetObject = picked;

        if (!this.targetObject) {
            this.showCanvasMenu(e.clientX, e.clientY);
        } else {
            this.engine.selectObject(this.targetObject);
            this.showObjectMenu(e.clientX, e.clientY);
        }
    }

    /**
     * DOM 坐标转为与 Pixi 交互一致的 global（含 resolution / 画布缩放），与 containsPoint、getBounds 同一空间
     */
    _clientToGlobal(clientX, clientY) {
        const pt = new PIXI.Point();
        const renderer = this.engine.app?.renderer;
        if (renderer?.events?.mapPositionToPoint) {
            renderer.events.mapPositionToPoint(pt, clientX, clientY);
            return pt;
        }
        const canvas = this.engine.app.view || this.engine.app.canvas;
        if (!canvas) return pt;
        const rect = canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        const res = renderer?.resolution ?? 1;
        pt.x = (sx * (canvas.width / rect.width)) / res;
        pt.y = (sy * (canvas.height / rect.height)) / res;
        return pt;
    }

    _hitGameObject(globalPoint, obj) {
        const disp = obj.displayObject;
        if (!disp) return false;
        // 隐藏后 visible=false，containsPoint 常失效；仍用包络盒拾取，才能右键「显示对象」
        const useBoundsOnly = obj.properties.hidden || !disp.visible;
        if (!useBoundsOnly) {
            try {
                if (typeof disp.containsPoint === 'function' && disp.containsPoint(globalPoint)) {
                    return true;
                }
            } catch (_) {}
        }
        try {
            const b = disp.getBounds();
            return (
                globalPoint.x >= b.x &&
                globalPoint.x <= b.x + b.width &&
                globalPoint.y >= b.y &&
                globalPoint.y <= b.y + b.height
            );
        } catch (_) {
            return false;
        }
    }

    /**
     * 画布上最顶层的游戏对象（含已隐藏；仅排除整层隐藏；与 eventMode 无关）
     */
    pickGameObjectAt(clientX, clientY) {
        return this.pickGameObjectWithGlobal(this._clientToGlobal(clientX, clientY));
    }

    pickGameObjectWithGlobal(globalPoint) {
        const lm = this.engine.layerManager;
        const candidates = this.engine.gameObjects.filter((o) => {
            const disp = o.displayObject;
            if (!disp) return false;
            const lid = o.properties.layerId || 'layer_default';
            const layer = lm?.getLayer(lid);
            if (layer && layer.visible === false) return false;
            return true;
        });

        candidates.sort((a, b) => (b.displayObject.zIndex ?? 0) - (a.displayObject.zIndex ?? 0));

        for (const obj of candidates) {
            if (this._hitGameObject(globalPoint, obj)) {
                return obj;
            }
        }
        return null;
    }
    
    /**
     * 显示对象右键菜单
     */
    showObjectMenu(x, y) {
        const obj = this.targetObject;
        const canCopy = this.engine.clipboardManager.hasClipboard();
        const selectedCount = this.engine.selectionManager ? 
            this.engine.selectionManager.selectedObjects.length : 1;
        
        const menuItems = [
            {
                label: '复制',
                icon: '📋',
                shortcut: 'Ctrl+C',
                action: () => this.engine.clipboardManager.copy()
            },
            {
                label: '剪切',
                icon: '✂️',
                shortcut: 'Ctrl+X',
                action: () => this.engine.clipboardManager.cut()
            },
            {
                label: '粘贴',
                icon: '📄',
                shortcut: 'Ctrl+V',
                disabled: !canCopy,
                action: () => this.engine.clipboardManager.paste()
            },
            {
                label: '复制',
                icon: '📑',
                shortcut: 'Ctrl+D',
                action: () => this.engine.clipboardManager.duplicate()
            },
            { separator: true },
            {
                label: '删除',
                icon: '🗑️',
                shortcut: 'Delete',
                color: '#e74c3c',
                action: () => {
                    this.engine.removeGameObject(obj);
                    if (this.engine.onSceneChanged) {
                        this.engine.onSceneChanged();
                    }
                }
            }
        ];
        
        // 如果选中多个对象，显示对齐选项
        if (selectedCount >= 2) {
            menuItems.push(
                { separator: true },
                {
                    label: '左对齐',
                    icon: '⬅️',
                    action: () => this.engine.alignmentManager.alignLeft()
                },
                {
                    label: '水平居中',
                    icon: '↔️',
                    action: () => this.engine.alignmentManager.alignCenterHorizontal()
                },
                {
                    label: '右对齐',
                    icon: '➡️',
                    action: () => this.engine.alignmentManager.alignRight()
                },
                {
                    label: '顶部对齐',
                    icon: '⬆️',
                    action: () => this.engine.alignmentManager.alignTop()
                },
                {
                    label: '垂直居中',
                    icon: '↕️',
                    action: () => this.engine.alignmentManager.alignCenterVertical()
                },
                {
                    label: '底部对齐',
                    icon: '⬇️',
                    action: () => this.engine.alignmentManager.alignBottom()
                }
            );
            
            // 分布功能（至少3个对象）
            if (selectedCount >= 3) {
                menuItems.push(
                    { separator: true },
                    {
                        label: '水平分布',
                        icon: '⬌',
                        action: () => this.engine.alignmentManager.distributeHorizontal()
                    },
                    {
                        label: '垂直分布',
                        icon: '⬍',
                        action: () => this.engine.alignmentManager.distributeVertical()
                    }
                );
            }
            
            menuItems.push(
                { separator: true },
                {
                    label: '匹配宽度',
                    icon: '📏',
                    action: () => this.engine.alignmentManager.matchWidth()
                },
                {
                    label: '匹配高度',
                    icon: '📐',
                    action: () => this.engine.alignmentManager.matchHeight()
                },
                {
                    label: '匹配大小',
                    icon: '📦',
                    action: () => this.engine.alignmentManager.matchSize()
                }
            );
        }
        
        menuItems.push(
            { separator: true },
            {
                label: '置于顶层',
                icon: '⬆️',
                action: () => this.bringToFront(obj)
            },
            {
                label: '置于底层',
                icon: '⬇️',
                action: () => this.sendToBack(obj)
            },
            { separator: true },
            {
                label: obj.properties.locked ? '解锁对象' : '锁定对象',
                icon: obj.properties.locked ? '🔓' : '🔒',
                action: () => this.toggleLock(obj)
            },
            {
                label: obj.properties.hidden ? '显示对象' : '隐藏对象',
                icon: obj.properties.hidden ? '👁️‍🗨️' : '👁️',
                action: () => this.toggleVisibility(obj)
            }
        );
        
        // 如果是容器类型，添加容器相关选项
        if (obj.type === 'container') {
            menuItems.splice(5, 0, { separator: true });
            menuItems.splice(6, 0, {
                label: '清空容器',
                icon: '🗑️',
                action: () => this.clearContainer(obj)
            });
        }
        
        this.createMenu(x, y, menuItems);
    }
    
    /**
     * 显示画布右键菜单
     */
    showCanvasMenu(x, y) {
        const canPaste = this.engine.clipboardManager.hasClipboard();
        
        const menuItems = [
            {
                label: '粘贴',
                icon: '📄',
                shortcut: 'Ctrl+V',
                disabled: !canPaste,
                action: () => this.engine.clipboardManager.paste()
            },
            { separator: true },
            {
                label: '全选',
                icon: '☑️',
                shortcut: 'Ctrl+A',
                disabled: true, // 暂未实现多选
                action: () => {}
            },
            { separator: true },
            {
                label: '显示网格',
                icon: this.engine.gridSystem.visible ? '✅' : '⬜',
                shortcut: 'G',
                action: () => this.engine.gridSystem.toggle()
            },
            {
                label: '重置视图',
                icon: '🔄',
                action: () => {
                    if (this.engine.viewportController) {
                        this.engine.viewportController.resetZoom();
                    }
                }
            },
            {
                label: '适应内容',
                icon: '📐',
                disabled: this.engine.gameObjects.length === 0,
                action: () => {
                    if (this.engine.viewportController) {
                        this.engine.viewportController.fitToContent();
                    }
                }
            }
        ];
        
        this.createMenu(x, y, menuItems);
    }
    
    /**
     * 创建菜单DOM
     */
    createMenu(x, y, items) {
        // 关闭旧菜单
        this.closeMenu();
        
        this.menu = document.createElement('div');
        this.menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 6px 0;
            min-width: 200px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            z-index: 100000;
            font-size: 13px;
            color: #fff;
        `;
        
        items.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #444; margin: 4px 8px;';
                this.menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.style.cssText = `
                    padding: 8px 16px;
                    cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    opacity: ${item.disabled ? '0.4' : '1'};
                    color: ${item.color || '#fff'};
                `;
                
                if (!item.disabled) {
                    menuItem.addEventListener('mouseenter', () => {
                        menuItem.style.background = '#3a3a3a';
                    });
                    menuItem.addEventListener('mouseleave', () => {
                        menuItem.style.background = 'transparent';
                    });
                }
                
                const leftPart = document.createElement('span');
                leftPart.innerHTML = `${item.icon || ''} ${item.label}`;
                menuItem.appendChild(leftPart);
                
                if (item.shortcut) {
                    const shortcut = document.createElement('span');
                    shortcut.style.cssText = 'color: #888; font-size: 11px; margin-left: 20px;';
                    shortcut.textContent = item.shortcut;
                    menuItem.appendChild(shortcut);
                }
                
                if (!item.disabled) {
                    menuItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        item.action();
                        this.closeMenu();
                    });
                }
                
                this.menu.appendChild(menuItem);
            }
        });
        
        document.body.appendChild(this.menu);
        
        // 调整位置防止超出屏幕
        const rect = this.menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            this.menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
        }
    }
    
    /**
     * 关闭菜单
     */
    closeMenu() {
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
    }
    
    /**
     * 置于顶层（同父节点 + 同图层内抬高 Z；渲染顺序由 LayerManager 按 z 排序）
     */
    bringToFront(obj) {
        const disp = obj.displayObject;
        if (!disp?.parent) return;
        const parent = disp.parent;
        const lid = obj.properties.layerId || 'layer_default';
        const peers = this.engine.gameObjects.filter(
            (o) =>
                o.displayObject?.parent === parent && (o.properties.layerId || 'layer_default') === lid
        );
        let maxZ = -Infinity;
        for (const o of peers) {
            const z = Number.isFinite(Number(o.properties.z)) ? Number(o.properties.z) : 0;
            if (z > maxZ) maxZ = z;
        }
        if (!Number.isFinite(maxZ)) maxZ = 0;
        this.engine.updateObjectProperties(obj, { z: maxZ + 1 });

        this.engine.historyManager.saveState('置于顶层');

        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus('✅ 已置于顶层（Z=' + obj.properties.z + '）');
            if (this.engine.selectedObject === obj) {
                this.engine.editorUI.updatePropertiesPanel(obj);
            }
        }
    }

    /**
     * 置于底层（同父节点 + 同图层内降低 Z）
     */
    sendToBack(obj) {
        const disp = obj.displayObject;
        if (!disp?.parent) return;
        const parent = disp.parent;
        const lid = obj.properties.layerId || 'layer_default';
        const peers = this.engine.gameObjects.filter(
            (o) =>
                o.displayObject?.parent === parent && (o.properties.layerId || 'layer_default') === lid
        );
        let minZ = Infinity;
        for (const o of peers) {
            const z = Number.isFinite(Number(o.properties.z)) ? Number(o.properties.z) : 0;
            if (z < minZ) minZ = z;
        }
        if (!Number.isFinite(minZ)) minZ = 0;
        this.engine.updateObjectProperties(obj, { z: minZ - 1 });

        this.engine.historyManager.saveState('置于底层');

        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus('✅ 已置于底层（Z=' + obj.properties.z + '）');
            if (this.engine.selectedObject === obj) {
                this.engine.editorUI.updatePropertiesPanel(obj);
            }
        }
    }
    
    /**
     * 锁定/解锁对象
     */
    toggleLock(obj) {
        obj.properties.locked = !obj.properties.locked;
        if (this.engine.layerManager) {
            this.engine.layerManager.applyToAllObjects();
        } else {
            obj.displayObject.eventMode = obj.properties.locked ? 'none' : 'static';
        }

        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus(
                obj.properties.locked ? '🔒 已锁定' : '🔓 已解锁'
            );
        }
        
        // 更新属性面板
        if (this.engine.onObjectSelected && this.engine.selectedObject === obj) {
            this.engine.onObjectSelected(obj);
        }
    }
    
    /**
     * 显示/隐藏对象
     */
    toggleVisibility(obj) {
        obj.properties.hidden = !obj.properties.hidden;
        // 交给图层系统统一应用可见性（保证切换图层/场景后可恢复）
        if (this.engine.layerManager) {
            this.engine.layerManager.applyToAllObjects();
        } else {
            obj.displayObject.visible = !obj.properties.hidden;
        }
        
        if (this.engine.editorUI) {
            this.engine.editorUI.updateStatus(
                obj.properties.hidden ? '👁️‍🗨️ 已隐藏' : '👁️ 已显示'
            );
        }

        // 更新属性面板
        if (this.engine.onObjectSelected && this.engine.selectedObject === obj) {
            this.engine.onObjectSelected(obj);
        }
    }
    
    /**
     * 清空容器
     */
    clearContainer(containerObj) {
        const children = this.engine.getContainerChildren(containerObj);
        
        if (children.length === 0) {
            if (this.engine.editorUI) {
                this.engine.editorUI.updateStatus('⚠️ 容器已经是空的');
            }
            return;
        }
        
        if (confirm(`确定要清空容器吗？将删除 ${children.length} 个子对象。`)) {
            children.forEach(child => {
                this.engine.removeGameObject(child);
            });
            
            this.engine.historyManager.saveState('清空容器');
            
            if (this.engine.editorUI) {
                this.engine.editorUI.updateStatus(`✅ 已清空容器（删除 ${children.length} 个对象）`);
            }
            
            if (this.engine.onSceneChanged) {
                this.engine.onSceneChanged();
            }
        }
    }
}
