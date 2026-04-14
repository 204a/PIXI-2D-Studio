/**
 * 编辑器UI控制器
 * 负责处理用户界面交互、属性面板、工具栏等
 */

export class EditorUI {
    constructor(engine) {
        this.engine = engine;
        this.dragSource = null; // 拖拽源组件
        
        // 等待引擎初始化完成
        this.initPromise = this.init();
    }
    
    /**
     * 初始化UI
     */
    async init() {
        console.log('EditorUI.init() 开始');
        
        // 等待引擎初始化完成
        console.log('等待引擎初始化...');
        await this.engine.initPromise;
        console.log('引擎初始化完成，开始设置UI');
        
        this.setupComponentDrag();
        console.log('组件拖拽设置完成');
        
        this.setupToolbar();
        console.log('工具栏设置完成');
        
        this.setupSceneObjectList();
        console.log('场景对象列表设置完成');
        
        this.setupFPSCounter();
        console.log('FPS计数器设置完成');

        this.setupAudioPanel();
        console.log('音频面板设置完成');

        // 等待引擎初始化完成后设置事件
        // 点击画布空白处取消选择
        const canvas = this.engine.app.view || this.engine.app.canvas;
        canvas.addEventListener('click', (e) => {
            // 检查是否点击的是canvas本身（不是对象）
            if (e.target === canvas) {
                // 确保点击的不是PixiJS对象
                const pixiEvent = e;
                // 只有真正点击空白处才清除选择
                if (!this.engine.selectedObject || this.clickedEmpty) {
                    this.clearSelection();
                }
                this.clickedEmpty = false;
            }
        });
        
        // 监听画布上的pointerdown来判断是否点击空白
        this.engine.app.stage.eventMode = 'static';
        this.engine.app.stage.on('pointerdown', (e) => {
            // 如果点击的是stage本身（没有击中任何对象）
            if (e.target === this.engine.app.stage) {
                this.clickedEmpty = true;
                this.clearSelection();
            }
        });
        
        console.log('Canvas点击事件设置完成');
        
        // 设置引擎回调
        this.engine.onObjectSelected = (obj) => {
            this.updatePropertiesPanel(obj);
            // 更新事件列表
            if (window.eventEditorUI) {
                window.eventEditorUI.updateEventsList(obj);
            }
        };
        this.engine.onSceneChanged = () => this.updateSceneObjectList();
        console.log('引擎回调设置完成');
        
        // 存储editorUI引用到engine（供其他模块使用）
        this.engine.editorUI = this;
        
        // 键盘快捷键
        this.setupKeyboardShortcuts();
        console.log('键盘快捷键设置完成');
        
        console.log('EditorUI.init() 完成');
    }
    
    /**
     * 设置组件拖拽
     */
    setupComponentDrag() {
        const componentItems = document.querySelectorAll('.component-item');
        
        componentItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.dragSource = {
                    type: item.dataset.type,
                    name: item.textContent.trim()
                };
                e.dataTransfer.effectAllowed = 'copy';
                console.log('开始拖拽:', this.dragSource.type);
            });
            
            item.setAttribute('draggable', 'true');
        });
        
        // 画布容器接收拖放
        const canvasContainer = document.getElementById('game-canvas');
        
        if (!canvasContainer) {
            console.error('找不到 game-canvas 容器');
            return;
        }
        
        // 同时监听容器和实际的canvas元素
        const pixiCanvas = this.engine.app.view || this.engine.app.canvas;
        
        [canvasContainer, pixiCanvas].forEach(element => {
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });
            
            element.addEventListener('drop', (e) => {
                e.preventDefault();
                
                if (this.dragSource) {
                    // 获取实际的canvas位置
                    const rect = pixiCanvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    console.log('放置组件:', this.dragSource.type, '位置:', x, y);
                    this.createComponent(this.dragSource.type, x, y);
                    this.dragSource = null;
                }
            });
        });
        
        console.log('拖拽事件已绑定');
    }
    
    /**
     * 创建组件
     */
    createComponent(type, x, y) {
        const properties = { x, y };
        
        // 根据类型设置默认属性
        switch (type) {
            case 'text':
                properties.text = '新文本';
                properties.fontSize = 24;
                properties.color = 0xFFFFFF;
                break;
            case 'rectangle':
                properties.width = 100;
                properties.height = 100;
                properties.color = 0xe74c3c;
                break;
            case 'circle':
                properties.radius = 50;
                properties.color = 0x2ecc71;
                break;
            case 'sprite':
                properties.width = 100;
                properties.height = 100;
                properties.color = 0x3498db;
                break;
            case 'container':
                // 容器默认属性
                break;
            case 'particle':
                properties.emissionRate = 10;
                properties.maxParticles = 100;
                break;
        }
        
        const obj = this.engine.createGameObject(type, properties);
        
        if (obj) {
            this.engine.selectObject(obj);
            this.updateSceneObjectList();
            this.updateStatus(`创建了 ${type}`);
        }
    }
    
    /**
     * 设置工具栏
     */
    setupToolbar() {
        // 运行按钮
        document.getElementById('btn-play').addEventListener('click', () => {
            this.engine.play();
            this.updateStatus('游戏运行中...');
            this.setRunningMode(true);
        });
        
        // 停止按钮
        document.getElementById('btn-stop').addEventListener('click', () => {
            this.engine.stop();
            this.updateStatus('游戏已停止');
            this.updateSceneObjectList();
            this.setRunningMode(false);
        });
        
        // 清空按钮
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('确定要清空场景吗？')) {
                this.engine.clearScene();
                this.updateSceneObjectList();
                this.clearPropertiesPanel();
                this.updateStatus('场景已清空');
            }
        });
        
        // 导出按钮
        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportScene();
        });

        const sceneImportInput = document.getElementById('scene-import-input');
        const btnImport = document.getElementById('btn-import');
        if (sceneImportInput && btnImport) {
            btnImport.addEventListener('click', () => sceneImportInput.click());
            sceneImportInput.addEventListener('change', () => {
                const file = sceneImportInput.files && sceneImportInput.files[0];
                sceneImportInput.value = '';
                if (file) this.importSceneFromFile(file);
            });
        }

        // 对齐工具栏
        this.setupAlignmentToolbar();
    }
    
    /**
     * 设置对齐工具栏
     */
    setupAlignmentToolbar() {
        // 创建对齐工具栏面板
        const toolbar = document.querySelector('.toolbar');
        
        const alignmentPanel = document.createElement('div');
        alignmentPanel.id = 'alignment-toolbar';
        alignmentPanel.style.cssText = `
            display: none;
            position: absolute;
            top: 50px;
            left: 10px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            padding: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            z-index: 1000;
        `;
        
        alignmentPanel.innerHTML = `
            <div style="margin-bottom: 8px; color: #aaa; font-size: 12px; font-weight: 600;">对齐工具</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 8px;">
                <button id="align-left" title="左对齐" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white;">⬅️</button>
                <button id="align-center-h" title="水平居中" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white;">↔️</button>
                <button id="align-right" title="右对齐" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white;">➡️</button>
                <button id="align-top" title="顶部对齐" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white;">⬆️</button>
                <button id="align-center-v" title="垂直居中" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white;">↕️</button>
                <button id="align-bottom" title="底部对齐" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white;">⬇️</button>
            </div>
            <div style="margin-bottom: 8px; color: #aaa; font-size: 12px; font-weight: 600;">分布</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-bottom: 8px;">
                <button id="distribute-h" title="水平分布" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white; font-size: 11px;">⬌ 水平</button>
                <button id="distribute-v" title="垂直分布" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white; font-size: 11px;">⬍ 垂直</button>
            </div>
            <div style="margin-bottom: 8px; color: #aaa; font-size: 12px; font-weight: 600;">匹配大小</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
                <button id="match-width" title="匹配宽度" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white; font-size: 11px;">宽</button>
                <button id="match-height" title="匹配高度" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white; font-size: 11px;">高</button>
                <button id="match-size" title="匹配大小" style="padding: 8px; cursor: pointer; background: #3a3a3a; border: none; border-radius: 3px; color: white; font-size: 11px;">全</button>
            </div>
        `;
        
        document.body.appendChild(alignmentPanel);
        
        // 绑定对齐按钮事件
        document.getElementById('align-left').addEventListener('click', () => {
            this.engine.alignmentManager.alignLeft();
            this.updateStatus('已左对齐');
        });
        
        document.getElementById('align-right').addEventListener('click', () => {
            this.engine.alignmentManager.alignRight();
            this.updateStatus('已右对齐');
        });
        
        document.getElementById('align-top').addEventListener('click', () => {
            this.engine.alignmentManager.alignTop();
            this.updateStatus('已顶部对齐');
        });
        
        document.getElementById('align-bottom').addEventListener('click', () => {
            this.engine.alignmentManager.alignBottom();
            this.updateStatus('已底部对齐');
        });
        
        document.getElementById('align-center-h').addEventListener('click', () => {
            this.engine.alignmentManager.alignCenterHorizontal();
            this.updateStatus('已水平居中对齐');
        });
        
        document.getElementById('align-center-v').addEventListener('click', () => {
            this.engine.alignmentManager.alignCenterVertical();
            this.updateStatus('已垂直居中对齐');
        });
        
        document.getElementById('distribute-h').addEventListener('click', () => {
            this.engine.alignmentManager.distributeHorizontal();
            this.updateStatus('已水平分布');
        });
        
        document.getElementById('distribute-v').addEventListener('click', () => {
            this.engine.alignmentManager.distributeVertical();
            this.updateStatus('已垂直分布');
        });
        
        document.getElementById('match-width').addEventListener('click', () => {
            this.engine.alignmentManager.matchWidth();
            this.updateStatus('已匹配宽度');
        });
        
        document.getElementById('match-height').addEventListener('click', () => {
            this.engine.alignmentManager.matchHeight();
            this.updateStatus('已匹配高度');
        });
        
        document.getElementById('match-size').addEventListener('click', () => {
            this.engine.alignmentManager.matchSize();
            this.updateStatus('已匹配大小');
        });
        
        // 添加快捷键 A 切换对齐面板
        window.addEventListener('keydown', (e) => {
            if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !this.engine.isRunning) {
                // 确保不在输入框中
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    const panel = document.getElementById('alignment-toolbar');
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    this.updateStatus(panel.style.display === 'none' ? '对齐面板已隐藏' : '对齐面板已显示（按A切换）');
                }
            }
        });
        
        // 监听选择变化，自动显示/隐藏对齐面板
        this.engine.onObjectSelected = ((originalCallback) => {
            return (obj) => {
                if (originalCallback) originalCallback(obj);
                this.updateAlignmentPanelVisibility();
            };
        })(this.engine.onObjectSelected);
    }
    
    /**
     * 更新对齐面板显示状态
     */
    updateAlignmentPanelVisibility() {
        const panel = document.getElementById('alignment-toolbar');
        if (!panel) return;
        
        const selectedCount = this.engine.selectionManager ? 
            this.engine.selectionManager.selectedObjects.length : 
            (this.engine.selectedObject ? 1 : 0);
        
        // 至少选中2个对象才显示对齐工具
        if (selectedCount >= 2 && !this.engine.isRunning) {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }
    
    /**
     * 设置运行模式UI状态
     */
    setRunningMode(isRunning) {
        // 禁用/启用工具栏按钮
        const btnPlay = document.getElementById('btn-play');
        const btnStop = document.getElementById('btn-stop');
        const btnClear = document.getElementById('btn-clear');
        const btnExport = document.getElementById('btn-export');
        const btnImport = document.getElementById('btn-import');

        btnPlay.disabled = isRunning;
        btnStop.disabled = !isRunning;
        btnClear.disabled = isRunning;
        btnExport.disabled = isRunning;
        if (btnImport) btnImport.disabled = isRunning;

        // 按钮样式
        btnPlay.style.opacity = isRunning ? '0.5' : '1';
        btnStop.style.opacity = !isRunning ? '0.5' : '1';
        btnClear.style.opacity = isRunning ? '0.5' : '1';
        btnExport.style.opacity = isRunning ? '0.5' : '1';
        if (btnImport) btnImport.style.opacity = isRunning ? '0.5' : '1';

        btnPlay.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        btnStop.style.cursor = !isRunning ? 'not-allowed' : 'pointer';
        btnClear.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        btnExport.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        if (btnImport) btnImport.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        
        // 禁用/启用左侧组件拖拽
        document.querySelectorAll('.component-item').forEach(item => {
            item.draggable = !isRunning;
            item.style.opacity = isRunning ? '0.5' : '1';
            item.style.cursor = isRunning ? 'not-allowed' : 'move';
        });
        
        // 禁用/启用属性面板
        document.querySelectorAll('#properties-content input, #properties-content select, #properties-content button').forEach(input => {
            input.disabled = isRunning;
            input.style.opacity = isRunning ? '0.5' : '1';
            input.style.cursor = isRunning ? 'not-allowed' : 'auto';
        });
        
        // 禁用/启用事件编辑器
        const addEventBtn = document.getElementById('btn-add-event');
        if (addEventBtn) {
            addEventBtn.disabled = isRunning;
            addEventBtn.style.opacity = isRunning ? '0.5' : '1';
            addEventBtn.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        }
        
        document.querySelectorAll('.behavior-item button').forEach(btn => {
            btn.disabled = isRunning;
            btn.style.opacity = isRunning ? '0.5' : '1';
            btn.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        });
        
        // 禁用/启用场景对象列表
        document.querySelectorAll('.scene-object-item').forEach(item => {
            item.style.pointerEvents = isRunning ? 'none' : 'auto';
            item.style.opacity = isRunning ? '0.5' : '1';
            item.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        });
        
        // 清除选择
        if (isRunning) {
            this.clearSelection();
        }
    }
    
    /**
     * 更新属性面板
     */
    updatePropertiesPanel(gameObject) {
        if (!gameObject) return;
        
        // 显示事件面板
        const eventPanel = document.getElementById('event-panel');
        if (eventPanel) {
            eventPanel.style.display = 'block';
        }
        
        const panel = document.getElementById('properties-content');
        const props = gameObject.properties;
        
        let html = `
            <div class="property-group">
                <label>对象ID</label>
                <input type="text" value="${gameObject.id}" disabled>
            </div>
            
            <div class="property-group">
                <label>类型</label>
                <input type="text" value="${gameObject.type}" disabled>
            </div>
            
            <div class="property-group">
                <label>X 坐标</label>
                <input type="number" id="prop-x" value="${Math.round(props.x)}">
            </div>
            
            <div class="property-group">
                <label>Y 坐标</label>
                <input type="number" id="prop-y" value="${Math.round(props.y)}">
            </div>
            
            <div class="property-group">
                <label>透明度 (0-1)</label>
                <input type="number" id="prop-alpha" value="${props.alpha}" min="0" max="1" step="0.1">
            </div>
            
            <div class="property-group">
                <label>旋转角度</label>
                <input type="number" id="prop-rotation" value="${props.rotation || 0}">
            </div>
        `;
        
        // 根据类型添加特定属性
        if (gameObject.type === 'text') {
            html += `
                <div class="property-group">
                    <label>文本内容</label>
                    <input type="text" id="prop-text" value="${props.text || ''}">
                </div>
                
                <div class="property-group">
                    <label>字体大小</label>
                    <input type="number" id="prop-fontSize" value="${props.fontSize || 24}">
                </div>
            `;
        }
        
        if (gameObject.type === 'rectangle' || gameObject.type === 'sprite') {
            html += `
                <div class="property-group">
                    <label>宽度</label>
                    <input type="number" id="prop-width" value="${props.width}">
                </div>
                
                <div class="property-group">
                    <label>高度</label>
                    <input type="number" id="prop-height" value="${props.height}">
                </div>
                
                <div class="property-group">
                    <label>颜色 (十六进制)</label>
                    <input type="text" id="prop-color" value="${'0x' + (props.color || 0).toString(16).padStart(6, '0')}">
                </div>
                
                <div class="property-group">
                    <label>标签（用于碰撞检测）</label>
                    <input type="text" id="prop-tag" value="${props.tag || ''}" placeholder="如：enemy, platform, player" style="width: 100%; padding: 10px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
                </div>
            `;
            
            // 精灵特有：图片上传
            if (gameObject.type === 'sprite') {
                const resources = this.engine.resourceManager.getAllResources();
                html += `
                    <div class="property-group">
                        <label>贴图</label>
                        ${resources.length > 0 ? `
                            <select id="prop-texture" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-bottom: 5px;">
                                <option value="">无贴图（纯色）</option>
                                ${resources.map(r => `
                                    <option value="${r.name}" ${props.textureName === r.name ? 'selected' : ''}>${r.name}</option>
                                `).join('')}
                            </select>
                        ` : ''}
                        <input type="file" id="prop-upload-image" accept="image/*" multiple style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 12px; margin-bottom: 5px;">
                        <small style="color: #666; font-size: 11px; display: block; margin-bottom: 5px;">多选文件创建动画</small>
                        ${props.textureName ? `
                            <button id="btn-remove-texture" style="width: 100%; padding: 6px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">删除贴图</button>
                        ` : ''}
                    </div>
                `;
                
                // 如果有动画
                if (props.animationName) {
                    html += `
                        <div class="property-group">
                            <label>动画</label>
                            <div style="background: #2a2a2a; padding: 8px; border-radius: 4px;">
                                <div style="margin-bottom: 5px; font-size: 12px;">当前: ${props.animationName}</div>
                                <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                                    <button id="btn-play-anim" style="flex: 1; padding: 6px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">播放</button>
                                    <button id="btn-stop-anim" style="flex: 1; padding: 6px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">停止</button>
                                </div>
                                <div style="margin-bottom: 5px;">
                                    <label style="font-size: 11px; color: #aaa;">速度</label>
                                    <input type="number" id="prop-anim-speed" value="${props.animSpeed || 0.1}" step="0.05" min="0.01" max="2" style="width: 100%; padding: 4px; background: #333; border: 1px solid #444; color: #fff; border-radius: 3px; font-size: 11px;">
                                </div>
                                <button id="btn-remove-anim" style="width: 100%; padding: 6px; background: #666; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">删除动画</button>
                            </div>
                        </div>
                    `;
                }
            }
            
            // 平台和角色属性
            html += `
                <div class="property-group">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="checkbox" id="prop-isPlatform" ${props.isPlatform ? 'checked' : ''} style="width: auto;">
                        是平台（可站立）
                    </label>
                </div>
                
                <div class="property-group">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="checkbox" id="prop-isPlayer" ${props.isPlayer ? 'checked' : ''} style="width: auto;">
                        是角色（可控制）
                    </label>
                </div>
            `;
            
            // 如果是角色，显示控制设置
            if (props.isPlayer) {
                html += `
                    <div class="property-group">
                        <label>控制方式</label>
                        <select id="prop-controlType" style="width: 100%; padding: 10px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
                            <option value="wasd" ${props.controlType === 'wasd' ? 'selected' : ''}>WASD键</option>
                            <option value="arrows" ${props.controlType === 'arrows' ? 'selected' : ''}>方向键</option>
                        </select>
                    </div>
                `;
            }
        }
        
        if (gameObject.type === 'circle') {
            html += `
                <div class="property-group">
                    <label>半径</label>
                    <input type="number" id="prop-radius" value="${props.radius || 50}">
                </div>
            `;
        }
        
        // 容器特殊属性
        if (gameObject.type === 'container') {
            const children = this.engine.getContainerChildren(gameObject);
            html += `
                <div class="property-group">
                    <label>子对象数量</label>
                    <input type="text" value="${children.length}" disabled>
                </div>
                <div class="property-group">
                    <label>子对象列表</label>
                    <div style="background: #2a2a2a; padding: 8px; border-radius: 4px; font-size: 12px;">
                        ${children.length > 0 ? children.map(c => `
                            <div style="padding: 4px; margin: 2px 0; background: #333; border-radius: 3px;">
                                ${this.getObjectIcon(c.type)} ${c.type}
                                <button onclick="window.editorUI.removeFromContainer('${c.id}')" style="float: right; font-size: 10px; padding: 2px 6px; background: #e74c3c; color: white; border: none; border-radius: 2px; cursor: pointer;">移除</button>
                            </div>
                        `).join('') : '<div style="color: #666;">无子对象</div>'}
                    </div>
                </div>
            `;
        }
        
        // 父子关系
        if (gameObject.parentId) {
            const parent = this.engine.gameObjects.find(o => o.id === gameObject.parentId);
            html += `
                <div class="property-group">
                    <label>父容器</label>
                    <div style="background: #2a2a2a; padding: 8px; border-radius: 4px;">
                        ${parent ? `${this.getObjectIcon(parent.type)} ${parent.type}` : '未知'}
                        <button onclick="window.editorUI.removeFromContainer('${gameObject.id}')" style="margin-left: 10px; padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">移出容器</button>
                    </div>
                </div>
            `;
        } else {
            // 显示可用的容器
            const containers = this.engine.gameObjects.filter(o => o.type === 'container' && o.id !== gameObject.id);
            if (containers.length > 0 && gameObject.type !== 'container') {
                html += `
                    <div class="property-group">
                        <label>添加到容器</label>
                        <select id="select-container" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
                            <option value="">选择容器...</option>
                            ${containers.map(c => `
                                <option value="${c.id}">${this.getObjectIcon(c.type)} ${c.type} - ${c.id.substring(0, 8)}</option>
                            `).join('')}
                        </select>
                        <button id="btn-add-to-container" style="width: 100%; margin-top: 8px; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">添加到容器</button>
                    </div>
                `;
            }
        }
        
        // 删除按钮
        html += `
            <div class="property-group" style="margin-top: 20px;">
                <button id="btn-delete-object" style="width: 100%; padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🗑️ 删除对象
                </button>
            </div>
        `;
        
        panel.innerHTML = html;
        
        // 绑定属性变化事件
        this.bindPropertyInputs(gameObject);
        
        // 删除按钮
        document.getElementById('btn-delete-object').addEventListener('click', () => {
            this.engine.removeGameObject(gameObject);
            this.updateSceneObjectList();
            this.clearPropertiesPanel();
        });
        
        // 添加到容器按钮
        const btnAddToContainer = document.getElementById('btn-add-to-container');
        if (btnAddToContainer) {
            btnAddToContainer.addEventListener('click', () => {
                const select = document.getElementById('select-container');
                const containerId = select.value;
                if (containerId) {
                    const container = this.engine.gameObjects.find(o => o.id === containerId);
                    if (container) {
                        this.engine.addChildToContainer(gameObject, container);
                        this.updatePropertiesPanel(gameObject);
                        this.updateSceneObjectList();
                        this.updateStatus('已添加到容器');
                    }
                }
            });
        }
    }
    
    /**
     * 从容器移除对象
     */
    removeFromContainer(childId) {
        const child = this.engine.gameObjects.find(o => o.id === childId);
        if (child) {
            this.engine.removeChildFromContainer(child);
            this.updatePropertiesPanel(child);
            this.updateSceneObjectList();
            this.updateStatus('已从容器移除');
        }
    }
    
    /**
     * 绑定属性输入框
     */
    bindPropertyInputs(gameObject) {
        const inputs = {
            'prop-x': 'x',
            'prop-y': 'y',
            'prop-alpha': 'alpha',
            'prop-rotation': 'rotation',
            'prop-text': 'text',
            'prop-fontSize': 'fontSize',
            'prop-width': 'width',
            'prop-height': 'height',
            'prop-radius': 'radius',
            'prop-color': 'color',
            'prop-tag': 'tag'
        };
        
        Object.keys(inputs).forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => {
                    let value = input.value;
                    const propName = inputs[inputId];
                    
                    // 类型转换
                    if (['x', 'y', 'width', 'height', 'radius', 'fontSize', 'rotation'].includes(propName)) {
                        value = parseFloat(value) || 0;
                    } else if (propName === 'alpha') {
                        value = Math.max(0, Math.min(1, parseFloat(value) || 0));
                    } else if (propName === 'color') {
                        value = parseInt(value, 16) || 0;
                    }
                    
                    // tag是字符串，直接赋值
                    if (propName === 'tag') {
                        gameObject.properties.tag = value;
                    } else {
                        this.engine.updateObjectProperties(gameObject, { [propName]: value });
                    }
                });
            }
        });
        
        // 平台复选框
        const isPlatformCheckbox = document.getElementById('prop-isPlatform');
        if (isPlatformCheckbox) {
            isPlatformCheckbox.addEventListener('change', () => {
                gameObject.properties.isPlatform = isPlatformCheckbox.checked;
            });
        }
        
        // 角色复选框
        const isPlayerCheckbox = document.getElementById('prop-isPlayer');
        if (isPlayerCheckbox) {
            isPlayerCheckbox.addEventListener('change', () => {
                gameObject.properties.isPlayer = isPlayerCheckbox.checked;
                
                if (isPlayerCheckbox.checked) {
                    // 添加平台角色行为
                    const controlType = document.getElementById('prop-controlType')?.value || 'arrows';
                    const keys = controlType === 'wasd' ? {
                        leftKey: 'a',
                        rightKey: 'd',
                        jumpKey: 'w'
                    } : {
                        leftKey: 'ArrowLeft',
                        rightKey: 'ArrowRight',
                        jumpKey: 'ArrowUp'
                    };
                    
                    gameObject.properties.controlType = controlType;
                    this.engine.addPlatformerBehavior(gameObject, keys);
                    this.updatePropertiesPanel(gameObject);
                } else {
                    // 移除平台角色行为
                    this.engine.removePlatformerBehavior(gameObject);
                }
            });
        }
        
        // 控制方式切换
        const controlTypeSelect = document.getElementById('prop-controlType');
        if (controlTypeSelect) {
            controlTypeSelect.addEventListener('change', () => {
                gameObject.properties.controlType = controlTypeSelect.value;
                // 重新添加行为
                this.engine.removePlatformerBehavior(gameObject);
                
                const keys = controlTypeSelect.value === 'wasd' ? {
                    leftKey: 'a',
                    rightKey: 'd',
                    jumpKey: 'w'
                } : {
                    leftKey: 'ArrowLeft',
                    rightKey: 'ArrowRight',
                    jumpKey: 'ArrowUp'
                };
                
                this.engine.addPlatformerBehavior(gameObject, keys);
            });
        }
        
        // 贴图选择
        const textureSelect = document.getElementById('prop-texture');
        if (textureSelect) {
            textureSelect.addEventListener('change', async () => {
                const textureName = textureSelect.value;
                gameObject.properties.textureName = textureName;
                
                // 重新创建精灵
                await this.recreateSprite(gameObject);
            });
        }
        
        // 图片上传
        const uploadInput = document.getElementById('prop-upload-image');
        if (uploadInput) {
            uploadInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (files.length === 0) return;
                
                // 多个文件 = 创建动画
                if (files.length > 1) {
                    const frames = [];
                    for (let file of files) {
                        const result = await this.engine.resourceManager.loadImageFromFile(file);
                        if (result) {
                            frames.push(result.name);
                        }
                    }
                    
                    if (frames.length > 0) {
                        const animName = `anim_${Date.now()}`;
                        this.engine.animationSystem.createAnimation(animName, frames);
                        this.engine.animationSystem.addAnimationToObject(gameObject, animName);
                        gameObject.properties.animationName = animName;
                        this.updatePropertiesPanel(gameObject);
                    }
                } else {
                    // 单个文件 = 静态贴图
                    const file = files[0];
                    const result = await this.engine.resourceManager.loadImageFromFile(file);
                    if (result) {
                        gameObject.properties.textureName = result.name;
                        await this.recreateSprite(gameObject);
                        this.updatePropertiesPanel(gameObject);
                    }
                }
            });
        }
        
        // 动画控制按钮
        const playAnimBtn = document.getElementById('btn-play-anim');
        const stopAnimBtn = document.getElementById('btn-stop-anim');
        const animSpeedInput = document.getElementById('prop-anim-speed');
        
        if (playAnimBtn) {
            playAnimBtn.addEventListener('click', () => {
                this.engine.animationSystem.playAnimation(gameObject);
            });
        }
        
        if (stopAnimBtn) {
            stopAnimBtn.addEventListener('click', () => {
                this.engine.animationSystem.stopAnimation(gameObject);
            });
        }
        
        if (animSpeedInput) {
            animSpeedInput.addEventListener('input', () => {
                const speed = parseFloat(animSpeedInput.value) || 0.1;
                gameObject.properties.animSpeed = speed;
                this.engine.animationSystem.setAnimationSpeed(gameObject, speed);
            });
        }
        
        // 删除贴图按钮
        const removeTextureBtn = document.getElementById('btn-remove-texture');
        if (removeTextureBtn) {
            removeTextureBtn.addEventListener('click', async () => {
                gameObject.properties.textureName = null;
                await this.recreateSprite(gameObject);
                this.updatePropertiesPanel(gameObject);
            });
        }
        
        // 删除动画按钮
        const removeAnimBtn = document.getElementById('btn-remove-anim');
        if (removeAnimBtn) {
            removeAnimBtn.addEventListener('click', async () => {
                this.engine.animationSystem.removeObjectAnimation(gameObject);
                gameObject.properties.animationName = null;
                gameObject.properties.animSpeed = null;
                await this.recreateSprite(gameObject);
                this.updatePropertiesPanel(gameObject);
            });
        }
    }
    
    /**
     * 重新创建精灵（应用新贴图）
     */
    async recreateSprite(gameObject) {
        const oldSprite = gameObject.displayObject;
        const parent = oldSprite.parent;
        const index = parent.getChildIndex(oldSprite);
        
        // 创建新精灵
        const newSprite = this.engine.createSpriteObject(gameObject.properties);
        
        // 替换
        parent.removeChildAt(index);
        parent.addChildAt(newSprite, index);
        
        gameObject.displayObject = newSprite;
        
        // 重新设置交互
        this.engine.setupInteraction(gameObject);
    }
    
    /**
     * 清空属性面板
     */
    clearPropertiesPanel() {
        const panel = document.getElementById('properties-content');
        panel.innerHTML = '<p style="color: #666; padding: 20px 0;">选择一个对象查看属性</p>';
        
        // 隐藏事件面板
        const eventPanel = document.getElementById('event-panel');
        if (eventPanel) {
            eventPanel.style.display = 'none';
        }
    }
    
    /**
     * 多选属性面板
     */
    onMultiSelect(objects) {
        if (objects.length === 0) {
            this.clearPropertiesPanel();
            return;
        }
        
        const panel = document.getElementById('properties-content');
        
        let html = `
            <div class="property-group">
                <label>已选中对象</label>
                <input type="text" value="${objects.length} 个对象" disabled>
            </div>
            
            <div class="property-group">
                <label>批量操作</label>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="btn-batch-delete" style="flex: 1; min-width: 80px; padding: 8px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">删除全部</button>
                    <button id="btn-batch-copy" style="flex: 1; min-width: 80px; padding: 8px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">复制全部</button>
                </div>
            </div>
            
            <div class="property-group">
                <label>批量透明度</label>
                <input type="range" id="batch-alpha" min="0" max="1" step="0.1" value="1" style="width: 100%;">
                <span id="batch-alpha-value" style="color: #aaa; font-size: 12px;">1.0</span>
            </div>
            
            <div class="property-group">
                <label>批量旋转</label>
                <input type="number" id="batch-rotation" value="0" style="width: 100%; padding: 10px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
            </div>
        `;
        
        panel.innerHTML = html;
        
        // 绑定批量删除
        document.getElementById('btn-batch-delete').addEventListener('click', () => {
            if (confirm(`确定要删除这 ${objects.length} 个对象吗？`)) {
                this.engine.selectionManager.deleteSelection();
                this.updateSceneObjectList();
            }
        });
        
        // 绑定批量复制
        document.getElementById('btn-batch-copy').addEventListener('click', () => {
            const data = this.engine.selectionManager.copySelection();
            this.engine.clipboardManager.clipboard = data;
            this.updateStatus(`已复制 ${objects.length} 个对象`);
        });
        
        // 绑定批量透明度
        const alphaSlider = document.getElementById('batch-alpha');
        const alphaValue = document.getElementById('batch-alpha-value');
        alphaSlider.addEventListener('input', () => {
            const value = parseFloat(alphaSlider.value);
            alphaValue.textContent = value.toFixed(1);
            this.engine.selectionManager.setPropertyForSelection('alpha', value);
        });
        
        // 绑定批量旋转
        document.getElementById('batch-rotation').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value) || 0;
            this.engine.selectionManager.setPropertyForSelection('rotation', value);
        });
        
        // 隐藏事件面板
        const eventPanel = document.getElementById('event-panel');
        if (eventPanel) {
            eventPanel.style.display = 'none';
        }
    }
    
    /**
     * 取消选择
     */
    clearSelection() {
        this.engine.selectedObject = null;
        this.engine.transformControls.hide();
        this.clearPropertiesPanel();
        this.updateSceneObjectList();  // 更新列表以移除高亮
    }
    
    /**
     * 设置场景对象列表
     */
    setupSceneObjectList() {
        this.updateSceneObjectList();
    }
    
    /**
     * 更新场景对象列表
     */
    updateSceneObjectList() {
        const list = document.getElementById('scene-objects');
        
        if (this.engine.gameObjects.length === 0) {
            list.innerHTML = '<p style="padding: 10px 0;">暂无对象</p>';
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
        
        // 只显示顶层对象（没有父对象的）
        const topLevelObjects = this.engine.gameObjects.filter(obj => !obj.parentId);
        
        topLevelObjects.forEach((obj, index) => {
            html += this.renderObjectItem(obj, 0);
            
            // 如果是容器，显示子对象
            if (obj.type === 'container') {
                const children = this.engine.getContainerChildren(obj);
                children.forEach(child => {
                    html += this.renderObjectItem(child, 1);
                });
            }
        });
        
        html += '</div>';
        list.innerHTML = html;
        
        // 绑定点击事件
        document.querySelectorAll('.scene-object-item').forEach((item) => {
            const objId = item.dataset.objId;
            const obj = this.engine.gameObjects.find(o => o.id === objId);
            
            if (obj) {
                item.addEventListener('click', (e) => {
                    // 运行时不允许选择
                    if (this.engine.isRunning) return;
                    
                    // Shift点击累加选择
                    if (e.shiftKey && this.engine.selectionManager) {
                        this.engine.selectionManager.addToSelection(obj);
                        return;
                    }
                    
                    // 普通点击
                    this.engine.selectObject(obj);
                    this.updatePropertiesPanel(obj);
                });
                
                item.addEventListener('mouseenter', () => {
                    // 运行时不显示悬停效果
                    if (this.engine.isRunning) return;
                    const isSelected = this.engine.selectedObject === obj;
                    if (!isSelected) {
                        item.style.background = '#3a3a3a';
                    }
                });
                
                item.addEventListener('mouseleave', () => {
                    const isSelected = this.engine.selectedObject === obj;
                    item.style.background = isSelected ? '#444' : '#333';
                });
            }
        });
        
        // 如果是运行模式，应用禁用样式
        if (this.engine.isRunning) {
            document.querySelectorAll('.scene-object-item').forEach(item => {
                item.style.pointerEvents = 'none';
                item.style.opacity = '0.5';
                item.style.cursor = 'not-allowed';
            });
        }
    }
    
    /**
     * 渲染单个对象项（支持缩进）
     */
    renderObjectItem(obj, level) {
        const isSelected = this.engine.selectedObject === obj;
        const indent = level * 15;
        
        return `
            <div class="scene-object-item" data-obj-id="${obj.id}" style="
                padding: 8px;
                padding-left: ${8 + indent}px;
                background: ${isSelected ? '#444' : '#333'};
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.2s;
                ${level > 0 ? 'border-left: 2px solid #9b59b6;' : ''}
            ">
                <div style="font-size: 13px;">
                    ${level > 0 ? '└ ' : ''}${this.getObjectIcon(obj.type)} ${obj.type}
                    ${obj.type === 'container' ? ` (${this.engine.getContainerChildren(obj).length})` : ''}
                </div>
                <div style="font-size: 11px; color: #999; margin-top: 2px;">ID: ${obj.id.substring(0, 12)}...</div>
            </div>
        `;
    }
    
    /**
     * 获取对象图标
     */
    getObjectIcon(type) {
        const icons = {
            'sprite': '📦',
            'text': '📝',
            'rectangle': '⬜',
            'circle': '⭕',
            'container': '📁',
            'particle': '✨'
        };
        return icons[type] || '❓';
    }
    
    /**
     * 设置FPS计数器
     */
    setupFPSCounter() {
        setInterval(() => {
            const fps = Math.round(this.engine.app.ticker.FPS);
            document.getElementById('fps-counter').textContent = `FPS: ${fps}`;
        }, 500);
    }
    
    /**
     * 左侧音频资源列表（供事件动作使用）
     */
    setupAudioPanel() {
        const fileInput = document.getElementById('audio-file-input');
        const btn = document.getElementById('btn-audio-upload');
        if (!fileInput || !btn) return;

        btn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async () => {
            const files = Array.from(fileInput.files || []);
            fileInput.value = '';
            if (files.length === 0) return;
            for (const file of files) {
                try {
                    await this.engine.resourceManager.loadAudioFromFile(file);
                } catch (e) {
                    console.error('音频加载失败', file.name, e);
                    this.updateStatus(`音频加载失败: ${file.name}`);
                }
            }
            this.refreshAudioList();
            this.updateStatus(`已添加 ${files.length} 个音频`);
        });

        this.refreshAudioList();
    }

    refreshAudioList() {
        const el = document.getElementById('audio-list');
        if (!el) return;
        const list = this.engine.resourceManager.getAllAudioResources();
        if (list.length === 0) {
            el.innerHTML = '<p style="padding: 6px 0; color: #666;">暂无音频</p>';
            return;
        }
        el.innerHTML = list.map((a) => `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px solid #333;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this._escapeAttr(a.name)}">${this._escapeHtml(a.name)}</span>
                <button type="button" class="btn-audio-del" style="flex-shrink:0;padding:4px 8px;background:#e74c3c;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">删</button>
            </div>
        `).join('');

        el.querySelectorAll('.btn-audio-del').forEach((b, i) => {
            b.addEventListener('click', () => {
                const name = list[i].name;
                this.engine.resourceManager.removeAudio(name);
                this.refreshAudioList();
                this.updateStatus('已删除音频: ' + name);
            });
        });
    }

    _escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    _escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    /**
     * 更新状态栏
     */
    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }
    
    /**
     * 导出场景
     */
    exportScene() {
        const sceneData = this.engine.exportScene();
        const json = JSON.stringify(sceneData, null, 2);
        
        // 创建下载链接
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene_${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.updateStatus('场景已导出');
    }

    /**
     * 从 JSON 文件导入场景（含贴图 dataURL、音频、行为、容器层级）
     */
    async importSceneFromFile(file) {
        if (this.engine.isRunning) {
            this.engine.stop();
            this.setRunningMode(false);
        }
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await this.engine.importScene(data);
            if (this.engine.selectionManager) {
                this.engine.selectionManager.clearSelection();
            }
            this.engine.selectedObject = null;
            this.engine.transformControls.hide();
            this.clearPropertiesPanel();
            this.refreshAudioList();
            this.updateSceneObjectList();
            if (window.eventEditorUI) {
                window.eventEditorUI.updateEventsList(null);
            }
            const n = data.objects ? data.objects.length : 0;
            this.updateStatus(`场景已导入（${n} 个对象）`);
        } catch (err) {
            console.error(err);
            this.updateStatus('导入失败: ' + (err.message || String(err)));
        }
    }
    
    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Z: 撤销
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (this.engine.historyManager.undo()) {
                    this.updateStatus('已撤销');
                    this.updateSceneObjectList();
                }
            }
            
            // Ctrl/Cmd + Shift + Z: 重做
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                if (this.engine.historyManager.redo()) {
                    this.updateStatus('已重做');
                    this.updateSceneObjectList();
                }
            }
            
            // Delete: 删除选中对象
            if (e.key === 'Delete') {
                // 多选删除
                if (this.engine.selectionManager && this.engine.selectionManager.getSelectionCount() > 0) {
                    const count = this.engine.selectionManager.getSelectionCount();
                    this.engine.selectionManager.deleteSelection();
                    this.updateSceneObjectList();
                    this.clearPropertiesPanel();
                    this.updateStatus(`已删除 ${count} 个对象`);
                } else if (this.engine.selectedObject) {
                    // 单选删除
                    this.engine.removeGameObject(this.engine.selectedObject);
                    this.updateSceneObjectList();
                    this.clearPropertiesPanel();
                    this.updateStatus('已删除对象');
                }
            }
            
            // G: 切换网格
            if (e.key === 'g' || e.key === 'G') {
                this.engine.gridSystem.toggle();
                this.updateStatus(`网格${this.engine.gridSystem.enabled ? '已显示' : '已隐藏'}`);
            }

            // R: 变换控件 缩放+旋转 / 仅旋转
            if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const tag = (e.target && e.target.tagName) || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                if (this.engine.isRunning) return;
                e.preventDefault();
                this.engine.transformControls.toggleGizmoMode();
            }
        });
    }
}

