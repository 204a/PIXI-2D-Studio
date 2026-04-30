/**
 * 编辑器UI控制器
 * 负责处理用户界面交互、属性面板、工具栏等
 */

export class EditorUI {
    constructor(engine) {
        this.engine = engine;
        this.dragSource = null; // 拖拽源组件
        this._runtimeInspectTimer = null;
        
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

        this.setupImageResourcePanel();
        console.log('资源管理器面板设置完成');

        this.setupLayerPanel();
        console.log('图层面板设置完成');

        this.setupProjectScenePanel();
        console.log('项目/相机/多场景面板设置完成');

        this.setupFontAndPrefabPanel();
        this.setupDebugHud();
        console.log('字体/预制件/调试 HUD 设置完成');

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
            case 'button':
                properties.width = 140;
                properties.height = 44;
                properties.label = '按钮';
                properties.colorNormal = 0x4a5fc7;
                properties.fontSize = 16;
                break;
            case 'progressBar':
                properties.width = 220;
                properties.height = 28;
                properties.value = 0.6;
                properties.colorBg = 0x222222;
                properties.colorFill = 0x27ae60;
                break;
            case 'inputField':
                properties.width = 240;
                properties.height = 38;
                properties.placeholder = '请输入…';
                properties.value = '';
                break;
            case 'nineSlice':
                properties.width = 160;
                properties.height = 100;
                properties.sliceLeft = 12;
                properties.sliceTop = 12;
                properties.sliceRight = 12;
                properties.sliceBottom = 12;
                break;
            case 'scrollView':
                properties.width = 260;
                properties.height = 180;
                properties.contentHeight = 400;
                properties.scrollY = 0;
                properties.wheelEnabled = true;
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

        // 🎮 游玩（打包预览）：写入 localStorage 并打开 play.html
        const btnPlayable = document.getElementById('btn-playable');
        if (btnPlayable) {
            btnPlayable.addEventListener('click', () => {
                const sceneData = this.engine.exportScene();
                try {
                    localStorage.setItem('sge.playableScene.v1', JSON.stringify(sceneData));
                    window.open('/play.html', '_blank');
                    this.updateStatus('已打开游玩预览');
                } catch (e) {
                    console.error(e);
                    this.updateStatus('游玩预览失败：场景过大或 localStorage 不可用');
                }
            });
        }

        // 📦 发布：导出可直接部署的 scene.json（与 dist/play.html 配套）
        const btnPublish = document.getElementById('btn-publish');
        if (btnPublish) {
            btnPublish.addEventListener('click', () => {
                const sceneData = this.engine.exportScene();
                const json = JSON.stringify(sceneData, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'scene.json';
                a.click();
                URL.revokeObjectURL(url);
                // 生成嵌入代码片段（最小可用：iframe 指向 play.html）
                const snippet = `<iframe src=\"play.html\" width=\"800\" height=\"600\" style=\"border:0\" allow=\"autoplay\"></iframe>`;
                try {
                    navigator.clipboard?.writeText(snippet);
                } catch {}
                window.prompt('嵌入代码（已尝试复制到剪贴板）', snippet);
                this.updateStatus('已导出 scene.json（并生成嵌入代码片段）');
            });
        }

        // 🚀 一键发布：导出单文件 game.html（双击即可游玩）
        const btnPublishOne = document.getElementById('btn-publish-onefile');
        if (btnPublishOne) {
            btnPublishOne.addEventListener('click', () => {
                try {
                    const sceneData = this.engine.exportScene();
                    const html = this._buildStandaloneGameHtml(sceneData);
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'game.html';
                    a.click();
                    URL.revokeObjectURL(url);
                    this.updateStatus('已导出 game.html（双击即可游玩）');
                } catch (e) {
                    console.error(e);
                    this.updateStatus('一键发布失败：' + (e.message || String(e)));
                }
            });
        }

        // 工具模式（轻量版）：旋转/缩放会切换变换控件模式；标尺/参考线开关
        const setToolBtnActive = (id) => {
            ['tool-select', 'tool-move', 'tool-rotate', 'tool-scale'].forEach((k) => {
                const b = document.getElementById(k);
                if (!b) return;
                b.style.border = k === id ? '1px solid #4CAF50' : 'none';
            });
        };

        document.getElementById('tool-select')?.addEventListener('click', () => {
            setToolBtnActive('tool-select');
            this.updateStatus('工具：选择');
        });
        document.getElementById('tool-move')?.addEventListener('click', () => {
            setToolBtnActive('tool-move');
            this.updateStatus('工具：移动');
        });
        document.getElementById('tool-rotate')?.addEventListener('click', () => {
            setToolBtnActive('tool-rotate');
            if (this.engine.transformControls && this.engine.transformControls.gizmoMode !== 'rotate') {
                this.engine.transformControls.toggleGizmoMode();
            }
            this.updateStatus('工具：旋转（拖绿点）');
        });
        document.getElementById('tool-scale')?.addEventListener('click', () => {
            setToolBtnActive('tool-scale');
            if (this.engine.transformControls && this.engine.transformControls.gizmoMode !== 'all') {
                this.engine.transformControls.toggleGizmoMode();
            }
            this.updateStatus('工具：缩放（拖蓝点）');
        });

        document.getElementById('tool-ruler')?.addEventListener('click', () => {
            if (!this.engine.overlayManager) return;
            this.engine.overlayManager.setRulerEnabled(!this.engine.overlayManager.enabledRuler);
            this.updateStatus(this.engine.overlayManager.enabledRuler ? '已显示标尺' : '已隐藏标尺');
        });
        document.getElementById('tool-guides')?.addEventListener('click', () => {
            if (!this.engine.overlayManager) return;
            this.engine.overlayManager.setGuidesEnabled(!this.engine.overlayManager.enabledGuides);
            this.updateStatus(this.engine.overlayManager.enabledGuides ? '已启用参考线' : '已禁用参考线');
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
        const btnPlayable = document.getElementById('btn-playable');
        if (btnPlayable) btnPlayable.disabled = isRunning;
        const btnPublish = document.getElementById('btn-publish');
        if (btnPublish) btnPublish.disabled = isRunning;
        const btnPublishOne = document.getElementById('btn-publish-onefile');
        if (btnPublishOne) btnPublishOne.disabled = isRunning;

        // 按钮样式
        btnPlay.style.opacity = isRunning ? '0.5' : '1';
        btnStop.style.opacity = !isRunning ? '0.5' : '1';
        btnClear.style.opacity = isRunning ? '0.5' : '1';
        btnExport.style.opacity = isRunning ? '0.5' : '1';
        if (btnImport) btnImport.style.opacity = isRunning ? '0.5' : '1';
        if (btnPlayable) btnPlayable.style.opacity = isRunning ? '0.5' : '1';
        if (btnPublish) btnPublish.style.opacity = isRunning ? '0.5' : '1';
        if (btnPublishOne) btnPublishOne.style.opacity = isRunning ? '0.5' : '1';

        btnPlay.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        btnStop.style.cursor = !isRunning ? 'not-allowed' : 'pointer';
        btnClear.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        btnExport.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        if (btnImport) btnImport.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        if (btnPlayable) btnPlayable.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        if (btnPublish) btnPublish.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        if (btnPublishOne) btnPublishOne.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        
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
            // 运行态允许点选对象用于“只读观察”
            item.style.pointerEvents = 'auto';
            item.style.opacity = isRunning ? '0.85' : '1';
            item.style.cursor = 'pointer';
        });
        
        // 运行态：启动只读属性观察；编辑态：停止观察
        if (isRunning) {
            this.startRuntimeInspector();
            if (this.engine.selectedObject) {
                this.updatePropertiesPanel(this.engine.selectedObject, { readOnly: true });
            }
        } else {
            this.stopRuntimeInspector();
        }

        document.querySelectorAll('.project-scene-panel input, .project-scene-panel select, .project-scene-panel button').forEach((el) => {
            if (el.id === 'btn-proj-apply' || el.id === 'btn-cam-apply' || el.id === 'btn-scene-add') {
                el.disabled = isRunning;
                el.style.opacity = isRunning ? '0.5' : '1';
                el.style.cursor = isRunning ? 'not-allowed' : 'pointer';
            } else {
                el.disabled = isRunning;
                el.style.opacity = isRunning ? '0.5' : '1';
            }
        });
        document.querySelectorAll('#scene-slot-list button').forEach((el) => {
            el.disabled = isRunning;
            el.style.opacity = isRunning ? '0.5' : '1';
            el.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        });
    }
    
    /**
     * 更新属性面板
     */
    updatePropertiesPanel(gameObject, options = {}) {
        if (!gameObject) return;
        const readOnly = !!options.readOnly || !!this.engine.isRunning;
        
        // 事件面板：运行态隐藏（避免误操作）；编辑态显示
        const eventPanel = document.getElementById('event-panel');
        if (eventPanel) {
            eventPanel.style.display = readOnly ? 'none' : 'block';
        }
        
        const panel = document.getElementById('properties-content');
        const props = gameObject.properties;
        const dis = readOnly ? 'disabled' : '';
        
        let html = `
            ${readOnly ? `
            <div style="margin-bottom: 12px; padding: 8px 10px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #aaa; font-size: 12px;">
                运行态观察：属性只读，实时刷新（按 Esc 一键停止返回编辑态）
            </div>` : ''}
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
                <input type="number" id="prop-x" value="${Math.round(props.x)}" ${dis}>
            </div>
            
            <div class="property-group">
                <label>Y 坐标</label>
                <input type="number" id="prop-y" value="${Math.round(props.y)}" ${dis}>
            </div>
            
            <div class="property-group">
                <label>透明度 (0-1)</label>
                <input type="number" id="prop-alpha" value="${props.alpha}" min="0" max="1" step="0.1" ${dis}>
            </div>
            
            <div class="property-group">
                <label>旋转角度</label>
                <input type="number" id="prop-rotation" value="${props.rotation || 0}" ${dis}>
            </div>
        `;
        
        // 根据类型添加特定属性
        if (gameObject.type === 'text') {
            html += `
                <div class="property-group">
                    <label>文本内容</label>
                    <input type="text" id="prop-text" value="${props.text || ''}" ${dis}>
                </div>
                
                <div class="property-group">
                    <label>字体大小</label>
                    <input type="number" id="prop-fontSize" value="${props.fontSize || 24}" ${dis}>
                </div>
            `;
        }
        
        if (gameObject.type === 'rectangle' || gameObject.type === 'sprite') {
            html += `
                <div class="property-group">
                    <label>宽度</label>
                    <input type="number" id="prop-width" value="${props.width}" ${dis}>
                </div>
                
                <div class="property-group">
                    <label>高度</label>
                    <input type="number" id="prop-height" value="${props.height}" ${dis}>
                </div>
                
                <div class="property-group">
                    <label>颜色 (十六进制)</label>
                    <input type="text" id="prop-color" value="${'0x' + (props.color || 0).toString(16).padStart(6, '0')}" ${dis}>
                </div>
                
                <div class="property-group">
                    <label>标签（用于碰撞检测）</label>
                    <input type="text" id="prop-tag" value="${props.tag || ''}" ${dis} placeholder="如：enemy, platform, player" style="width: 100%; padding: 10px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
                </div>
            `;

            // 物理（Matter.js）最小配置：刚体开关/静态/形状/材质
            html += `
                <div class="property-group" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #444;">
                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="prop-rigid-enabled" ${props.rigidEnabled ? 'checked' : ''} ${dis} style="width:auto;">
                        启用刚体（Matter）
                    </label>
                    <small style="color:#666; font-size:11px; display:block; margin-top:4px;">
                        运行态生效；开启后由物理驱动位置（最小版固定角度）
                    </small>
                </div>
                <div class="property-group">
                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="prop-rigid-static" ${props.rigidStatic ? 'checked' : ''} ${dis} style="width:auto;">
                        静态刚体（地面/墙）
                    </label>
                </div>
                <div class="property-group">
                    <label>刚体形状</label>
                    <select id="prop-rigid-shape" ${dis} style="width:100%; padding:8px; background:#333; border:1px solid #444; color:#fff; border-radius:4px;">
                        <option value="" ${!props.rigidShape ? 'selected' : ''}>自动（跟随碰撞形状/类型）</option>
                        <option value="rect" ${props.rigidShape === 'rect' ? 'selected' : ''}>矩形</option>
                        <option value="circle" ${props.rigidShape === 'circle' ? 'selected' : ''}>圆形</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>摩擦 (friction)</label>
                    <input type="number" id="prop-rigid-friction" value="${typeof props.rigidFriction === 'number' ? props.rigidFriction : 0.1}" step="0.05" min="0" max="1" ${dis}>
                </div>
                <div class="property-group">
                    <label>弹性 (restitution)</label>
                    <input type="number" id="prop-rigid-restitution" value="${typeof props.rigidRestitution === 'number' ? props.rigidRestitution : 0.0}" step="0.05" min="0" max="1" ${dis}>
                </div>
                <div class="property-group">
                    <label>密度 (density)</label>
                    <input type="number" id="prop-rigid-density" value="${typeof props.rigidDensity === 'number' ? props.rigidDensity : 0.001}" step="0.001" min="0" ${dis}>
                </div>
            `;
            
            // 精灵特有：图片上传
            if (gameObject.type === 'sprite') {
                const resources = this.engine.resourceManager.getAllResources();
                html += `
                    <div class="property-group">
                        <label>贴图</label>
                        ${resources.length > 0 ? `
                            <select id="prop-texture" ${dis} style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-bottom: 5px;">
                                <option value="">无贴图（纯色）</option>
                                ${resources.map(r => `
                                    <option value="${r.name}" ${props.textureName === r.name ? 'selected' : ''}>${r.name}</option>
                                `).join('')}
                            </select>
                        ` : ''}
                        <input type="file" id="prop-upload-image" ${dis} accept="image/*" multiple style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 12px; margin-bottom: 5px;">
                        <small style="color: #666; font-size: 11px; display: block; margin-bottom: 5px;">多选文件创建动画</small>
                        ${props.textureName ? `
                            <button id="btn-remove-texture" ${dis} style="width: 100%; padding: 6px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">删除贴图</button>
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
                        <input type="checkbox" id="prop-isPlatform" ${props.isPlatform ? 'checked' : ''} ${dis} style="width: auto;">
                        是平台（可站立）
                    </label>
                </div>
                
                <div class="property-group">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="checkbox" id="prop-isPlayer" ${props.isPlayer ? 'checked' : ''} ${dis} style="width: auto;">
                        是角色（可控制）
                    </label>
                </div>
            `;
            
            // 如果是角色，显示控制设置
            if (props.isPlayer) {
                html += `
                    <div class="property-group">
                        <label>控制方式</label>
                        <select id="prop-controlType" ${dis} style="width: 100%; padding: 10px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
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
                    <input type="number" id="prop-radius" value="${props.radius || 50}" ${dis}>
                </div>
                <div class="property-group">
                    <label>标签（碰撞）</label>
                    <input type="text" id="prop-tag" value="${this._escapeAttr(props.tag || '')}" ${dis} placeholder="enemy, pickup…" style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                </div>
                <div class="property-group">
                    <label>碰撞形状</label>
                    <select id="prop-collision-shape" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                        <option value="" ${!props.collisionShape ? 'selected' : ''}>默认（圆对象→圆形）</option>
                        <option value="aabb" ${props.collisionShape === 'aabb' ? 'selected' : ''}>AABB 包围盒</option>
                        <option value="circle" ${props.collisionShape === 'circle' ? 'selected' : ''}>圆形</option>
                    </select>
                </div>
            `;
        }

        if (gameObject.type === 'button') {
            const fonts = this.engine.resourceManager.listFonts();
            const fontOpts =
                '<option value="">系统默认</option>' +
                fonts.map((f) => `<option value="${f.family}" ${props.fontFamily === f.family ? 'selected' : ''}>${this._escapeHtml(f.name)}</option>`).join('');
            html += `
                <div class="property-group">
                    <label>宽 / 高</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <input type="number" id="prop-width" value="${props.width || 120}" ${dis}>
                        <input type="number" id="prop-height" value="${props.height || 40}" ${dis}>
                    </div>
                </div>
                <div class="property-group">
                    <label>标签（碰撞）</label>
                    <input type="text" id="prop-tag" value="${props.tag || ''}" ${dis} placeholder="如：ui" style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                </div>
                <div class="property-group">
                    <label>文案</label>
                    <input type="text" id="prop-label" value="${this._escapeAttr(props.label || '')}" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                </div>
                <div class="property-group">
                    <label>字体</label>
                    <select id="prop-btn-font" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">${fontOpts}</select>
                </div>
                <div class="property-group">
                    <label>字号</label>
                    <input type="number" id="prop-fontSize" value="${props.fontSize || 16}" ${dis}>
                </div>
                <div class="property-group">
                    <label><input type="checkbox" id="prop-btn-disabled" ${props.disabled ? 'checked' : ''} ${dis} style="width:auto;"> 禁用</label>
                </div>
            `;
        }

        if (gameObject.type === 'progressBar') {
            html += `
                <div class="property-group">
                    <label>宽 / 高</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <input type="number" id="prop-width" value="${props.width || 200}" ${dis}>
                        <input type="number" id="prop-height" value="${props.height || 24}" ${dis}>
                    </div>
                </div>
                <div class="property-group">
                    <label>进度 0–1</label>
                    <input type="number" id="prop-progress-value" value="${props.value ?? 0.5}" min="0" max="1" step="0.05" ${dis}>
                </div>
                <div class="property-group">
                    <label>标签（碰撞）</label>
                    <input type="text" id="prop-tag" value="${props.tag || ''}" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                </div>
            `;
        }

        if (gameObject.type === 'inputField') {
            const fonts = this.engine.resourceManager.listFonts();
            const fontOpts =
                '<option value="">系统默认</option>' +
                fonts.map((f) => `<option value="${f.family}" ${props.fontFamily === f.family ? 'selected' : ''}>${this._escapeHtml(f.name)}</option>`).join('');
            html += `
                <div class="property-group">
                    <label>宽 / 高</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <input type="number" id="prop-width" value="${props.width || 220}" ${dis}>
                        <input type="number" id="prop-height" value="${props.height || 36}" ${dis}>
                    </div>
                </div>
                <div class="property-group">
                    <label>占位符</label>
                    <input type="text" id="prop-placeholder" value="${this._escapeAttr(props.placeholder || '')}" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                </div>
                <div class="property-group">
                    <label>当前值</label>
                    <input type="text" id="prop-input-value" value="${this._escapeAttr(props.value || '')}" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                </div>
                <div class="property-group">
                    <label>字体</label>
                    <select id="prop-inp-font" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">${fontOpts}</select>
                </div>
            `;
        }

        if (gameObject.type === 'nineSlice') {
            const resources = this.engine.resourceManager.getAllResources();
            html += `
                <div class="property-group">
                    <label>宽 / 高</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <input type="number" id="prop-width" value="${props.width || 120}" ${dis}>
                        <input type="number" id="prop-height" value="${props.height || 80}" ${dis}>
                    </div>
                </div>
                <div class="property-group">
                    <label>切片 left/top/right/bottom</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <input type="number" id="prop-slice-l" placeholder="左" value="${props.sliceLeft ?? 12}" ${dis}>
                        <input type="number" id="prop-slice-t" placeholder="上" value="${props.sliceTop ?? 12}" ${dis}>
                        <input type="number" id="prop-slice-r" placeholder="右" value="${props.sliceRight ?? 12}" ${dis}>
                        <input type="number" id="prop-slice-b" placeholder="下" value="${props.sliceBottom ?? 12}" ${dis}>
                    </div>
                </div>
                <div class="property-group">
                    <label>贴图</label>
                    <select id="prop-ns-texture" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                        <option value="">白条占位</option>
                        ${resources.map((r) => `<option value="${this._escapeAttr(r.name)}" ${props.textureName === r.name ? 'selected' : ''}>${this._escapeHtml(r.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="property-group">
                    <label>标签（碰撞）</label>
                    <input type="text" id="prop-tag" value="${props.tag || ''}" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                </div>
            `;
        }

        if (gameObject.type === 'scrollView') {
            html += `
                <div class="property-group">
                    <label>宽 / 高</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <input type="number" id="prop-width" value="${props.width || 260}" ${dis}>
                        <input type="number" id="prop-height" value="${props.height || 180}" ${dis}>
                    </div>
                </div>
                <div class="property-group">
                    <label>内容高度</label>
                    <input type="number" id="prop-contentHeight" value="${props.contentHeight || 400}" ${dis}>
                </div>
                <div class="property-group">
                    <label>滚动 Y</label>
                    <input type="number" id="prop-scrollY" value="${props.scrollY || 0}" ${dis}>
                </div>
                <div class="property-group">
                    <label><input type="checkbox" id="prop-wheelEnabled" ${props.wheelEnabled !== false ? 'checked' : ''} ${dis} style="width:auto;"> 鼠标滚轮滚动</label>
                </div>
                <div class="property-group">
                    <label>标签（碰撞）</label>
                    <input type="text" id="prop-tag" value="${props.tag || ''}" ${dis} style="width:100%;padding:8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
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
            const containers = this.engine.gameObjects.filter(
                (o) => (o.type === 'container' || o.type === 'scrollView') && o.id !== gameObject.id
            );
            if (containers.length > 0 && gameObject.type !== 'container' && gameObject.type !== 'scrollView') {
                html += `
                    <div class="property-group">
                        <label>添加到容器</label>
                    <select id="select-container" ${dis} style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px;">
                            <option value="">选择容器...</option>
                            ${containers.map(c => `
                                <option value="${c.id}">${this.getObjectIcon(c.type)} ${c.type} - ${c.id.substring(0, 8)}</option>
                            `).join('')}
                        </select>
                    <button id="btn-add-to-container" ${dis} style="width: 100%; margin-top: 8px; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">添加到容器</button>
                    </div>
                `;
            }
        }
        
        // 删除按钮
        html += `
            <div class="property-group" style="margin-top: 20px;">
                <button id="btn-delete-object" ${dis} style="width: 100%; padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🗑️ 删除对象
                </button>
            </div>
        `;
        
        panel.innerHTML = html;
        
        if (readOnly) return;
        
        // 绑定属性变化事件（仅编辑态）
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

        const collShape = document.getElementById('prop-collision-shape');
        if (collShape) {
            collShape.addEventListener('change', () => {
                const v = collShape.value;
                gameObject.properties.collisionShape = v || undefined;
            });
        }

        const labelIn = document.getElementById('prop-label');
        if (labelIn) {
            labelIn.addEventListener('input', () => {
                this.engine.updateObjectProperties(gameObject, { label: labelIn.value });
            });
        }
        const pval = document.getElementById('prop-progress-value');
        if (pval) {
            pval.addEventListener('input', () => {
                this.engine.applyProgressBarValue(gameObject, parseFloat(pval.value) || 0);
            });
        }
        const ph = document.getElementById('prop-placeholder');
        if (ph) {
            ph.addEventListener('input', () => {
                gameObject.properties.placeholder = ph.value;
                this.engine.updateObjectProperties(gameObject, { placeholder: ph.value });
            });
        }
        const iv = document.getElementById('prop-input-value');
        if (iv) {
            iv.addEventListener('input', () => {
                this.engine.updateObjectProperties(gameObject, { value: iv.value });
            });
        }
        const bf = document.getElementById('prop-btn-font');
        if (bf) {
            bf.addEventListener('change', () => {
                const fam = bf.value || 'Arial';
                if (gameObject._buttonLabel) gameObject._buttonLabel.style.fontFamily = fam;
                gameObject.properties.fontFamily = fam;
            });
        }
        const inf = document.getElementById('prop-inp-font');
        if (inf) {
            inf.addEventListener('change', () => {
                const fam = inf.value || 'Arial';
                if (gameObject._inputText) gameObject._inputText.style.fontFamily = fam;
                gameObject.properties.fontFamily = fam;
            });
        }
        const disCb = document.getElementById('prop-btn-disabled');
        if (disCb) {
            disCb.addEventListener('change', () => {
                gameObject.properties.disabled = disCb.checked;
                this.engine.redrawButton(gameObject);
            });
        }
        const sliceIds = ['prop-slice-l', 'prop-slice-t', 'prop-slice-r', 'prop-slice-b'];
        const sliceKeys = ['sliceLeft', 'sliceTop', 'sliceRight', 'sliceBottom'];
        sliceIds.forEach((sid, idx) => {
            const el = document.getElementById(sid);
            if (el) {
                el.addEventListener('input', () => {
                    this.engine.updateObjectProperties(gameObject, {
                        [sliceKeys[idx]]: parseFloat(el.value) || 0
                    });
                });
            }
        });
        const nst = document.getElementById('prop-ns-texture');
        if (nst) {
            nst.addEventListener('change', () => {
                const name = nst.value || undefined;
                gameObject.properties.textureName = name;
                this.engine.updateObjectProperties(gameObject, { textureName: name });
            });
        }

        const svContentH = document.getElementById('prop-contentHeight');
        if (svContentH) {
            svContentH.addEventListener('input', () => {
                this.engine.updateObjectProperties(gameObject, { contentHeight: parseFloat(svContentH.value) || 0 });
            });
        }
        const svScrollY = document.getElementById('prop-scrollY');
        if (svScrollY) {
            svScrollY.addEventListener('input', () => {
                this.engine.updateObjectProperties(gameObject, { scrollY: parseFloat(svScrollY.value) || 0 });
            });
        }
        const svWheel = document.getElementById('prop-wheelEnabled');
        if (svWheel) {
            svWheel.addEventListener('change', () => {
                this.engine.updateObjectProperties(gameObject, { wheelEnabled: !!svWheel.checked });
            });
        }

        // ===== 物理（Matter.js）最小刚体配置 =====
        const rigidEnabled = document.getElementById('prop-rigid-enabled');
        if (rigidEnabled) {
            rigidEnabled.addEventListener('change', () => {
                gameObject.properties.rigidEnabled = !!rigidEnabled.checked;
            });
        }
        const rigidStatic = document.getElementById('prop-rigid-static');
        if (rigidStatic) {
            rigidStatic.addEventListener('change', () => {
                gameObject.properties.rigidStatic = !!rigidStatic.checked;
            });
        }
        const rigidShape = document.getElementById('prop-rigid-shape');
        if (rigidShape) {
            rigidShape.addEventListener('change', () => {
                const v = rigidShape.value || undefined;
                gameObject.properties.rigidShape = v;
            });
        }
        const rigidF = document.getElementById('prop-rigid-friction');
        if (rigidF) {
            rigidF.addEventListener('input', () => {
                const v = parseFloat(rigidF.value);
                if (Number.isFinite(v)) gameObject.properties.rigidFriction = v;
            });
        }
        const rigidR = document.getElementById('prop-rigid-restitution');
        if (rigidR) {
            rigidR.addEventListener('input', () => {
                const v = parseFloat(rigidR.value);
                if (Number.isFinite(v)) gameObject.properties.rigidRestitution = v;
            });
        }
        const rigidD = document.getElementById('prop-rigid-density');
        if (rigidD) {
            rigidD.addEventListener('input', () => {
                const v = parseFloat(rigidD.value);
                if (Number.isFinite(v)) gameObject.properties.rigidDensity = v;
            });
        }
        
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
            if (typeof this.refreshCameraFollowOptions === 'function') {
                this.refreshCameraFollowOptions();
            }
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

        if (typeof this.refreshCameraFollowOptions === 'function') {
            this.refreshCameraFollowOptions();
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
            'particle': '✨',
            'button': '🔘',
            'progressBar': '📊',
            'inputField': '⌨',
            'nineSlice': '▦',
            'scrollView': '🧾'
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

    setupDebugHud() {
        const el = document.getElementById('debug-hud');
        if (!el) return;
        let on = false;
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' || e.key === 'Backquote') {
                on = !on;
                el.style.display = on ? 'inline' : 'none';
            }
        });
        setInterval(() => {
            if (!on) return;
            const n = this.engine.gameObjects.length;
            const mem = performance.memory
                ? ` mem:${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB`
                : '';
            el.textContent = ` 对象:${n}${mem}`;
        }, 400);
    }

    /** 字体上传 + 简易预制件（localStorage，单对象属性克隆） */
    setupFontAndPrefabPanel() {
        const PREFAB_KEY = 'sge.prefabs.v1';
        const input = document.getElementById('font-file-input');
        const btn = document.getElementById('btn-font-upload');
        if (input && btn) {
            btn.addEventListener('click', () => input.click());
            input.addEventListener('change', async () => {
                const files = Array.from(input.files || []);
                input.value = '';
                for (const f of files) {
                    try {
                        await this.engine.resourceManager.loadFontFromFile(f);
                    } catch (e) {
                        console.error(e);
                        this.updateStatus('字体加载失败: ' + f.name);
                    }
                }
                this._refreshFontList();
                this.updateStatus('已注册字体');
            });
        }
        this._refreshFontList = () => {
            const el = document.getElementById('font-list');
            if (!el) return;
            const list = this.engine.resourceManager.listFonts();
            if (list.length === 0) {
                el.innerHTML = '<p style="color:#666;padding:4px 0;">暂无</p>';
                return;
            }
            el.innerHTML = list
                .map(
                    (f) =>
                        `<div style="padding:4px 0;border-bottom:1px solid #333;font-size:12px;" title="${this._escapeAttr(
                            f.family
                        )}">${this._escapeHtml(f.name)}</div>`
                )
                .join('');
        };
        this._refreshFontList();

        const saveBtn = document.getElementById('btn-prefab-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const go = this.engine.selectedObject;
                if (!go) {
                    this.updateStatus('请先选中一个对象');
                    return;
                }
                const nameIn = document.getElementById('prefab-name-input');
                const name = (nameIn && nameIn.value.trim()) || go.type;
                const raw = localStorage.getItem(PREFAB_KEY);
                let list = [];
                try {
                    list = raw ? JSON.parse(raw) : [];
                } catch {
                    list = [];
                }
                list.push({
                    name,
                    type: go.type,
                    properties: JSON.parse(JSON.stringify(go.properties))
                });
                localStorage.setItem(PREFAB_KEY, JSON.stringify(list));
                if (nameIn) nameIn.value = '';
                this._refreshPrefabList();
                this.updateStatus('已保存预制件: ' + name);
            });
        }
        this._refreshPrefabList = () => {
            const el = document.getElementById('prefab-list');
            if (!el) return;
            let list = [];
            try {
                list = JSON.parse(localStorage.getItem(PREFAB_KEY) || '[]');
            } catch {
                list = [];
            }
            if (list.length === 0) {
                el.innerHTML = '<p style="color:#666;">暂无</p>';
                return;
            }
            el.innerHTML = list
                .map(
                    (p, i) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
                    <button type="button" class="btn-prefab-spawn" data-idx="${i}" style="flex:1;text-align:left;padding:6px 8px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;cursor:pointer;font-size:12px;">＋ ${this._escapeHtml(
                        p.name
                    )} <span style="color:#888">(${this._escapeHtml(p.type)})</span></button>
                    <button type="button" class="btn-prefab-del" data-idx="${i}" style="padding:6px 8px;background:#633;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:11px;">删</button>
                </div>`
                )
                .join('');
            el.querySelectorAll('.btn-prefab-spawn').forEach((b) => {
                b.addEventListener('click', () => {
                    const i = parseInt(b.getAttribute('data-idx'), 10);
                    let fresh = [];
                    try {
                        fresh = JSON.parse(localStorage.getItem(PREFAB_KEY) || '[]');
                    } catch {
                        fresh = [];
                    }
                    const p = fresh[i];
                    if (!p) return;
                    const props = { ...p.properties, x: (p.properties.x || 0) + 24, y: (p.properties.y || 0) + 24 };
                    const obj = this.engine.createGameObject(p.type, props, true);
                    if (obj) {
                        this.engine.selectObject(obj);
                        this.updateSceneObjectList();
                    }
                });
            });
            el.querySelectorAll('.btn-prefab-del').forEach((b) => {
                b.addEventListener('click', () => {
                    const i = parseInt(b.getAttribute('data-idx'), 10);
                    list.splice(i, 1);
                    localStorage.setItem(PREFAB_KEY, JSON.stringify(list));
                    this._refreshPrefabList();
                });
            });
        };
        this._refreshPrefabList();
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

    /**
     * 左侧图片资源管理（缩略图/重命名/删除/应用到选中Sprite）
     */
    setupImageResourcePanel() {
        const input = document.getElementById('image-res-input');
        const btn = document.getElementById('btn-image-upload');
        if (!input || !btn) return;

        btn.addEventListener('click', () => input.click());

        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []);
            input.value = '';
            if (files.length === 0) return;
            for (const file of files) {
                try {
                    await this.engine.resourceManager.loadImageFromFile(file);
                } catch (e) {
                    console.error('图片加载失败', file.name, e);
                    this.updateStatus(`图片加载失败: ${file.name}`);
                }
            }
            this.refreshImageResourceList();
            this.updateStatus(`已添加 ${files.length} 张图片`);
        });

        this.refreshImageResourceList();
    }

    refreshImageResourceList() {
        const el = document.getElementById('image-resource-list');
        if (!el) return;
        const list = this.engine.resourceManager.getAllResources();
        if (list.length === 0) {
            el.innerHTML = '<p style="padding: 6px 0; color: #666;">暂无图片</p>';
            return;
        }

        el.innerHTML = list.map((r) => `
            <div class="img-res-item" style="display:flex; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid #333;">
                <div style="width:34px;height:34px;border:1px solid #444;border-radius:4px;overflow:hidden;background:#222;flex-shrink:0;">
                    <img src="${this._escapeAttr(r.url)}" style="width:100%;height:100%;object-fit:cover;display:block;">
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this._escapeAttr(r.name)}">${this._escapeHtml(r.name)}</div>
                    <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
                        <button type="button" class="btn-img-apply" style="padding:3px 6px;background:#2196F3;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">应用</button>
                        <button type="button" class="btn-img-rename" style="padding:3px 6px;background:#666;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">改名</button>
                        <button type="button" class="btn-img-del" style="padding:3px 6px;background:#e74c3c;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">删</button>
                    </div>
                </div>
            </div>
        `).join('');

        const items = Array.from(el.querySelectorAll('.img-res-item'));
        items.forEach((itemEl, i) => {
            const res = list[i];
            const applyBtn = itemEl.querySelector('.btn-img-apply');
            const renameBtn = itemEl.querySelector('.btn-img-rename');
            const delBtn = itemEl.querySelector('.btn-img-del');

            if (applyBtn) {
                applyBtn.addEventListener('click', async () => {
                    const obj = this.engine.selectedObject;
                    if (!obj || obj.type !== 'sprite') {
                        this.updateStatus('请先选中一个精灵（Sprite）再应用贴图');
                        return;
                    }
                    obj.properties.textureName = res.name;
                    await this.recreateSprite(obj);
                    this.updatePropertiesPanel(obj);
                    this.updateStatus('已应用贴图: ' + res.name);
                });
            }

            if (renameBtn) {
                renameBtn.addEventListener('click', () => {
                    const next = prompt('新名称（用于贴图引用）', res.name);
                    if (!next || next === res.name) return;
                    if (this.engine.resourceManager.getTexture(next)) {
                        this.updateStatus('名称已存在: ' + next);
                        return;
                    }
                    // rename: 复制映射并删除旧名
                    const tex = this.engine.resourceManager.getTexture(res.name);
                    if (tex) {
                        this.engine.resourceManager.textures.set(next, tex);
                    }
                    this.engine.resourceManager.loadedImages.set(next, res.url);
                    this.engine.resourceManager.removeResource(res.name);

                    // 更新引用（Sprite.textureName）
                    this.engine.gameObjects.forEach((o) => {
                        if (o.properties && o.properties.textureName === res.name) {
                            o.properties.textureName = next;
                        }
                    });

                    this.refreshImageResourceList();
                    if (this.engine.selectedObject) {
                        this.updatePropertiesPanel(this.engine.selectedObject);
                    }
                    this.updateStatus('已重命名: ' + res.name + ' → ' + next);
                });
            }

            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (!confirm('删除图片资源：' + res.name + ' ？')) return;
                    this.engine.resourceManager.removeResource(res.name);
                    // 清理引用并重建 sprite
                    for (const o of this.engine.gameObjects) {
                        if (o.type === 'sprite' && o.properties.textureName === res.name) {
                            o.properties.textureName = null;
                            await this.recreateSprite(o);
                        }
                    }
                    this.refreshImageResourceList();
                    if (this.engine.selectedObject) {
                        this.updatePropertiesPanel(this.engine.selectedObject);
                    }
                    this.updateStatus('已删除图片: ' + res.name);
                });
            }
        });
    }

    setupLayerPanel() {
        const btnAdd = document.getElementById('btn-layer-add');
        const btnAssign = document.getElementById('btn-layer-assign');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                const name = prompt('图层名称', 'New Layer');
                if (!name) return;
                this.engine.layerManager.addLayer(name);
                this.refreshLayerList();
                this.updateStatus('已创建图层: ' + name);
            });
        }
        if (btnAssign) {
            btnAssign.addEventListener('click', () => {
                const lm = this.engine.layerManager;
                const lid = lm.activeLayerId;
                const sel = this.engine.selectionManager?.selectedObjects;
                if (sel && sel.length > 0) {
                    lm.assignObjectsToLayer(sel, lid);
                    this.updateSceneObjectList();
                    this.updateStatus('已将选中对象放入当前图层');
                } else if (this.engine.selectedObject) {
                    lm.assignObjectsToLayer([this.engine.selectedObject], lid);
                    this.updateSceneObjectList();
                    this.updateStatus('已将对象放入当前图层');
                } else {
                    this.updateStatus('请先选中对象');
                }
            });
        }
        this.refreshLayerList();
    }

    refreshLayerList() {
        const el = document.getElementById('layer-list');
        if (!el || !this.engine.layerManager) return;
        const lm = this.engine.layerManager;
        const layers = lm.getLayers();
        el.innerHTML = layers.map((l) => `
            <div class="layer-item" style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px solid #333;">
                <button type="button" class="btn-layer-activate" style="flex:1; text-align:left; padding:6px 8px; background:${lm.activeLayerId===l.id?'#2a3a2a':'#2a2a2a'}; color:#fff; border:1px solid #444; border-radius:4px; cursor:pointer;">
                    ${l.visible ? '👁️' : '🚫'} ${l.locked ? '🔒' : '🔓'} ${this._escapeHtml(l.name)}
                </button>
                <button type="button" class="btn-layer-up" style="padding:6px 8px; background:#333; color:#fff; border:1px solid #444; border-radius:4px; cursor:pointer;">↑</button>
                <button type="button" class="btn-layer-down" style="padding:6px 8px; background:#333; color:#fff; border:1px solid #444; border-radius:4px; cursor:pointer;">↓</button>
            </div>
            <div class="layer-actions" style="display:flex; gap:6px; padding:6px 0 10px 0;">
                <button type="button" class="btn-layer-vis" style="flex:1; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px; cursor:pointer; font-size:12px;">${l.visible?'隐藏':'显示'}</button>
                <button type="button" class="btn-layer-lock" style="flex:1; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px; cursor:pointer; font-size:12px;">${l.locked?'解锁':'锁定'}</button>
                <button type="button" class="btn-layer-rename" style="flex:1; padding:6px; background:#333; color:#fff; border:1px solid #444; border-radius:4px; cursor:pointer; font-size:12px;">改名</button>
                <button type="button" class="btn-layer-del" style="flex:1; padding:6px; background:#e74c3c; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">删</button>
            </div>
        `).join('');

        const items = Array.from(el.querySelectorAll('.layer-item'));
        items.forEach((itemEl, i) => {
            const layer = layers[i];
            itemEl.querySelector('.btn-layer-activate')?.addEventListener('click', () => {
                lm.setActiveLayer(layer.id);
                this.refreshLayerList();
                this.updateStatus('当前图层: ' + layer.name);
            });
            itemEl.querySelector('.btn-layer-up')?.addEventListener('click', () => {
                lm.moveLayer(layer.id, -1);
                this.refreshLayerList();
            });
            itemEl.querySelector('.btn-layer-down')?.addEventListener('click', () => {
                lm.moveLayer(layer.id, 1);
                this.refreshLayerList();
            });
        });

        const actions = Array.from(el.querySelectorAll('.layer-actions'));
        actions.forEach((actionEl, i) => {
            const layer = layers[i];
            actionEl.querySelector('.btn-layer-vis')?.addEventListener('click', () => {
                lm.toggleVisible(layer.id);
                this.refreshLayerList();
                this.updateSceneObjectList();
            });
            actionEl.querySelector('.btn-layer-lock')?.addEventListener('click', () => {
                lm.toggleLocked(layer.id);
                this.refreshLayerList();
            });
            actionEl.querySelector('.btn-layer-rename')?.addEventListener('click', () => {
                const name = prompt('图层名称', layer.name);
                if (!name) return;
                lm.renameLayer(layer.id, name);
                this.refreshLayerList();
            });
            actionEl.querySelector('.btn-layer-del')?.addEventListener('click', () => {
                if (!confirm('删除图层：' + layer.name + '？')) return;
                if (!lm.removeLayer(layer.id)) {
                    this.updateStatus('至少保留一个图层');
                    return;
                }
                this.refreshLayerList();
                this.updateSceneObjectList();
            });
        });
    }

    setupProjectScenePanel() {
        const syncProj = () => {
            const ps = this.engine.projectSettings;
            const pw = document.getElementById('proj-w');
            const ph = document.getElementById('proj-h');
            const pf = document.getElementById('proj-fps');
            if (pw) pw.value = ps.designWidth;
            if (ph) ph.value = ps.designHeight;
            if (pf) pf.value = ps.targetFPS;
        };

        const syncCam = () => {
            const cm = this.engine.cameraManager;
            if (!cm) return;
            const bx = document.getElementById('cam-bx');
            const by = document.getElementById('cam-by');
            const bw = document.getElementById('cam-bw');
            const bh = document.getElementById('cam-bh');
            const sm = document.getElementById('cam-smooth');
            const en = document.getElementById('cam-enabled');
            if (bx) bx.value = cm.bounds ? cm.bounds.x : '';
            if (by) by.value = cm.bounds ? cm.bounds.y : '';
            if (bw) bw.value = cm.bounds ? cm.bounds.width : '';
            if (bh) bh.value = cm.bounds ? cm.bounds.height : '';
            if (sm) sm.value = cm.smoothing;
            if (en) en.checked = cm.enabled;
            this.refreshCameraFollowOptions();
            const sel = document.getElementById('camera-follow-select');
            if (sel) sel.value = cm.followTargetId || '';
        };

        this.syncProjectCameraForms = () => {
            syncProj();
            syncCam();
            this.refreshSceneSlotList();
        };

        syncProj();

        document.getElementById('btn-proj-apply')?.addEventListener('click', () => {
            const pw = document.getElementById('proj-w');
            const ph = document.getElementById('proj-h');
            const pf = document.getElementById('proj-fps');
            this.engine.applyProjectSettings({
                designWidth: parseInt(pw?.value, 10) || 800,
                designHeight: parseInt(ph?.value, 10) || 600,
                targetFPS: parseInt(pf?.value, 10)
            });
            this.updateStatus('已应用项目设置');
        });

        document.getElementById('btn-cam-apply')?.addEventListener('click', () => {
            const cm = this.engine.cameraManager;
            if (!cm) return;
            const fid = document.getElementById('camera-follow-select')?.value || '';
            cm.followTargetId = fid || null;
            const bx = parseFloat(document.getElementById('cam-bx')?.value);
            const by = parseFloat(document.getElementById('cam-by')?.value);
            const bw = parseFloat(document.getElementById('cam-bw')?.value);
            const bh = parseFloat(document.getElementById('cam-bh')?.value);
            if ([bx, by, bw, bh].every((n) => Number.isFinite(n)) && bw > 0 && bh > 0) {
                cm.bounds = { x: bx, y: by, width: bw, height: bh };
            } else {
                cm.bounds = null;
            }
            cm.smoothing = Math.min(1, Math.max(0, parseFloat(document.getElementById('cam-smooth')?.value) || 0.12));
            cm.enabled = !!document.getElementById('cam-enabled')?.checked;
            this.updateStatus('已应用相机');
        });

        document.getElementById('btn-scene-add')?.addEventListener('click', async () => {
            const name = prompt('新场景名称', '场景');
            if (name === null) return;
            await this.engine.sceneManager.addScene(name || '新场景');
            this.syncProjectCameraForms();
            this.updateSceneObjectList();
            this.clearPropertiesPanel();
            if (window.eventEditorUI) window.eventEditorUI.updateEventsList(null);
            this.updateStatus('已创建并切换到新场景');
        });

        this.refreshCameraFollowOptions = () => {
            const sel = document.getElementById('camera-follow-select');
            if (!sel || !this.engine.cameraManager) return;
            const cur = this.engine.cameraManager.followTargetId;
            sel.innerHTML = '<option value="">（不跟随）</option>' +
                this.engine.gameObjects.map((o) =>
                    `<option value="${this._escapeAttr(o.id)}">${this._escapeHtml(o.type)} · ${this._escapeHtml(o.id.slice(-8))}</option>`
                ).join('');
            sel.value = cur || '';
        };

        this.refreshSceneSlotList = () => {
            const el = document.getElementById('scene-slot-list');
            const sm = this.engine.sceneManager;
            if (!el || !sm) return;
            const rows = sm.list();
            el.innerHTML = rows.map((r) => `
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                    <button type="button" class="btn-scene-switch" data-scene-id="${this._escapeAttr(r.id)}" style="flex:1;text-align:left;padding:8px;background:${sm.activeSceneId === r.id ? '#2a4a2a' : '#333'};color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;font-size:12px;">
                        ${this._escapeHtml(r.name)}
                    </button>
                    <button type="button" class="btn-scene-ren" data-scene-id="${this._escapeAttr(r.id)}" style="padding:8px;background:#333;color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;font-size:12px;">改名</button>
                    <button type="button" class="btn-scene-del" data-scene-id="${this._escapeAttr(r.id)}" ${r.id === 'main' ? 'disabled' : ''} style="padding:8px;background:#633;color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;font-size:12px;">删</button>
                </div>
            `).join('');

            el.querySelectorAll('.btn-scene-switch').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-scene-id');
                    if (!id || id === sm.activeSceneId) return;
                    await sm.switchTo(id);
                    this.syncProjectCameraForms();
                    this.updateSceneObjectList();
                    this.clearPropertiesPanel();
                    if (window.eventEditorUI) window.eventEditorUI.updateEventsList(null);
                    this.updateStatus('已切换场景');
                });
            });
            el.querySelectorAll('.btn-scene-ren').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-scene-id');
                    const row = sm.list().find((x) => x.id === id);
                    const nn = prompt('场景名称', row?.name || '');
                    if (nn === null || !nn.trim()) return;
                    sm.renameScene(id, nn.trim());
                    this.refreshSceneSlotList();
                });
            });
            el.querySelectorAll('.btn-scene-del').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-scene-id');
                    if (!id || id === 'main') return;
                    if (!confirm('删除该场景槽位？未导出将丢失。')) return;
                    await sm.removeScene(id);
                    this.syncProjectCameraForms();
                    this.updateSceneObjectList();
                    this.updateStatus('已删除场景');
                });
            });
        };

        syncCam();
        this.refreshSceneSlotList();
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

    _buildStandaloneGameHtml(sceneData) {
        // 防止 </script> 截断
        const sceneJson = JSON.stringify(sceneData).replace(/<\/script>/gi, '<\\/script>');

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>game</title>
  <style>
    html, body { height: 100%; margin: 0; background: #111; overflow: hidden; }
    #root { height: 100%; }
    .tip { position: fixed; left: 10px; bottom: 10px; z-index: 9; color: #aaa; font-size: 12px;
      background: rgba(0,0,0,0.35); border: 1px solid #333; border-radius: 8px; padding: 6px 10px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <div class="tip">提示：首次播放音频可能需要点击一次页面（浏览器限制）。</div>
  <script id="scene-data" type="application/json">${sceneJson}</script>
  <script>
  (function () {
    const scene = JSON.parse(document.getElementById('scene-data').textContent);

    // ====== 资源 ======
    const textures = new Map();
    const audioClips = new Map();
    (scene.imageResources || []).forEach(r => { if (r && r.name && r.url) textures.set(r.name, PIXI.Texture.from(r.url)); });
    (scene.audioResources || []).forEach(a => { if (a && a.name && a.url) audioClips.set(a.name, a.url); });

    // ====== 输入 ======
    const input = {
      keys: {}, keysPressed: {}, keysReleased: {},
      mouseX: 0, mouseY: 0, mouseButtons: {}, mouseButtonsPressed: {}, mouseButtonsReleased: {},
      update() { this.keysPressed = {}; this.keysReleased = {}; this.mouseButtonsPressed = {}; this.mouseButtonsReleased = {}; },
      isKeyDown(k){ return this.keys[k]===true; },
      isKeyPressed(k){ return this.keysPressed[k]===true; },
      isKeyReleased(k){ return this.keysReleased[k]===true; },
      isMouseDown(b=0){ return this.mouseButtons[b]===true; },
      isMousePressed(b=0){ return this.mouseButtonsPressed[b]===true; },
      isMouseReleased(b=0){ return this.mouseButtonsReleased[b]===true; },
      getMousePosition(){ return { x:this.mouseX, y:this.mouseY }; }
    };
    window.addEventListener('keydown', (e)=>{ if(!input.keys[e.key]) input.keysPressed[e.key]=true; input.keys[e.key]=true; });
    window.addEventListener('keyup', (e)=>{ input.keys[e.key]=false; input.keysReleased[e.key]=true; });
    window.addEventListener('mousemove', (e)=>{ input.mouseX=e.clientX; input.mouseY=e.clientY; });
    window.addEventListener('mousedown', (e)=>{ if(!input.mouseButtons[e.button]) input.mouseButtonsPressed[e.button]=true; input.mouseButtons[e.button]=true; });
    window.addEventListener('mouseup', (e)=>{ input.mouseButtons[e.button]=false; input.mouseButtonsReleased[e.button]=true; });

    // ====== 音频 ======
    let musicEl = null;
    function playSound(name, vol=1, loop=false, rate=1){
      const url = audioClips.get(name); if(!url) return;
      const a = new Audio(url); a.volume=Math.max(0,Math.min(1,vol)); a.loop=!!loop; a.playbackRate=rate||1;
      a.play().catch(()=>{});
    }
    function playMusic(name, vol=0.7, loop=true){
      const url = audioClips.get(name); if(!url) return;
      if(musicEl){ musicEl.pause(); musicEl=null; }
      const a = new Audio(url); a.volume=Math.max(0,Math.min(1,vol)); a.loop=!!loop; musicEl=a;
      a.play().catch(()=>{});
    }
    function stopMusic(){ if(musicEl){ musicEl.pause(); musicEl.currentTime=0; musicEl=null; } }

    // ====== Pixi 初始化 ======
    const root = document.getElementById('root');
    const app = new PIXI.Application({ width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight,
      backgroundColor: 0x111111, antialias: true, resolution: window.devicePixelRatio||1, autoDensity: true });
    root.appendChild(app.view);
    app.view.style.width='100%'; app.view.style.height='100%'; app.view.style.display='block';
    window.addEventListener('resize', ()=>{ app.renderer.resize(root.clientWidth||window.innerWidth, root.clientHeight||window.innerHeight); });
    if (scene.project && scene.project.targetFPS > 0 && app.ticker) {
      app.ticker.maxFPS = scene.project.targetFPS;
    }

    const world = new PIXI.Container();
    app.stage.addChild(world);

    // ====== 对象构建 ======
    const gameObjects = [];
    function makeObj(data){
      const p = data.properties || {};
      let disp = null;
      if(data.type==='sprite'){
        if(p.textureName && textures.get(p.textureName)){
          disp = new PIXI.Sprite(textures.get(p.textureName));
          disp.width = p.width || disp.width; disp.height = p.height || disp.height;
        } else {
          const g = new PIXI.Graphics();
          g.beginFill(p.color || 0x3498db); g.drawRect(0,0,p.width||100,p.height||100); g.endFill();
          disp = g;
        }
      } else if(data.type==='rectangle'){
        const g = new PIXI.Graphics();
        g.beginFill(p.color || 0xe74c3c); g.drawRect(0,0,p.width||100,p.height||100); g.endFill();
        disp = g;
      } else if(data.type==='circle'){
        const g = new PIXI.Graphics(); const r = p.radius||50;
        g.beginFill(p.color || 0x2ecc71); g.drawCircle(r,r,r); g.endFill();
        disp = g;
      } else if(data.type==='text'){
        disp = new PIXI.Text(p.text||'文本', { fontFamily: p.fontFamily||'Arial', fontSize: p.fontSize||24, fill: p.color||0xffffff, align: p.align||'left' });
      } else if(data.type==='container'){
        disp = new PIXI.Container();
      } else {
        disp = new PIXI.Container();
      }
      disp.x = p.x||100; disp.y = p.y||100;
      disp.alpha = (p.alpha!==undefined)?p.alpha:1;
      disp.rotation = ((p.rotation||0) * Math.PI/180);
      if(disp.scale && (p.scaleX!==undefined || p.scaleY!==undefined)) disp.scale.set(p.scaleX||1,p.scaleY||1);
      return { id:data.id, type:data.type, properties:p, parentId:data.parentId||null, displayObject:disp };
    }
    (scene.objects||[]).forEach(o=>{ const obj = makeObj(o); gameObjects.push(obj); world.addChild(obj.displayObject); });
    // 父子
    (scene.objects||[]).forEach(o=>{
      if(!o.parentId) return;
      const child = gameObjects.find(x=>x.id===o.id);
      const parent = gameObjects.find(x=>x.id===o.parentId);
      if(child && parent && parent.type==='container'){
        if(child.displayObject.parent) child.displayObject.parent.removeChild(child.displayObject);
        parent.displayObject.addChild(child.displayObject);
        child.displayObject.x = child.properties.x ?? 0;
        child.displayObject.y = child.properties.y ?? 0;
      }
    });

    // ====== 动画（帧动画）=====
    const animMap = new Map();
    const animList = (scene.animations && scene.animations.animations) || [];
    animList.forEach(a=>{
      const frames = (a.frames||[]).map(n=>textures.get(n)).filter(Boolean);
      if(frames.length) animMap.set(a.name, frames);
    });
    gameObjects.forEach(obj=>{
      if(obj.type==='sprite' && obj.properties.animationName && animMap.get(obj.properties.animationName)){
        const frames = animMap.get(obj.properties.animationName);
        const as = new PIXI.AnimatedSprite(frames);
        as.animationSpeed = obj.properties.animSpeed || 0.1;
        as.loop = true;
        as.x = obj.displayObject.x; as.y = obj.displayObject.y;
        as.width = obj.properties.width || as.width;
        as.height = obj.properties.height || as.height;
        const parent = obj.displayObject.parent; const idx = parent.getChildIndex(obj.displayObject);
        parent.removeChild(obj.displayObject); parent.addChildAt(as, idx);
        obj.displayObject = as; as.play();
      }
    });

    // ====== 行为系统（条件/动作）=====
    const behaviors = ((scene.behaviors||{}).behaviors)||[];
    function compare(actual, op, expected){
      switch(op){
        case '>': return actual>expected;
        case '<': return actual<expected;
        case '>=': return actual>=expected;
        case '<=': return actual<=expected;
        case '==': return Math.abs(actual-expected)<0.01;
        case '!=': return Math.abs(actual-expected)>=0.01;
        default: return true;
      }
    }
    function isMouseOverObject(go){
      const mp = input.getMousePosition();
      const b = go.displayObject.getBounds();
      return mp.x>=b.x && mp.x<=b.x+b.width && mp.y>=b.y && mp.y<=b.y+b.height;
    }
    function pairKey(id1,id2){ return id1<id2 ? id1+'|'+id2 : id2+'|'+id1; }
    var collisionPairEnd = new Set();
    function checkAABB(a,b){
      const x1=a.displayObject.x, y1=a.displayObject.y, w1=a.properties.width||50, h1=a.properties.height||50;
      const x2=b.displayObject.x, y2=b.displayObject.y, w2=b.properties.width||50, h2=b.properties.height||50;
      return x1 < x2+w2 && x1+w1 > x2 && y1 < y2+h2 && y1+h1 > y2;
    }
    function checkConditions(go, conds, collisionBaseline){
      if(!conds||!conds.length) return true;
      return conds.every(c=>{
        const obj=go.displayObject;
        switch(c.type){
          case 'positionX': return compare(obj.x, c.operator, c.value);
          case 'positionY': return compare(obj.y, c.operator, c.value);
          case 'alpha': return compare(obj.alpha, c.operator, c.value);
          case 'rotation': return compare(obj.rotation*180/Math.PI, c.operator, c.value);
          case 'keyPressed': return input.isKeyDown(c.key);
          case 'keyJustPressed': return input.isKeyPressed(c.key);
          case 'keyReleased': return input.isKeyReleased(c.key);
          case 'mouseClicked': return input.isMousePressed(0);
          case 'mouseDown': return input.isMouseDown(0);
          case 'mouseReleased': return input.isMouseReleased(0);
          case 'mouseHover': return isMouseOverObject(go);
          case 'mouseX': return compare(input.getMousePosition().x, c.operator, c.value);
          case 'mouseY': return compare(input.getMousePosition().y, c.operator, c.value);
          case 'collision': {
            const arr = gameObjects.filter(o=>o.properties.tag===c.tag && o.id!==go.id);
            return arr.some(o=>checkAABB(go,o));
          }
          case 'collisionEnter': {
            const arr = gameObjects.filter(o=>o.properties.tag===c.tag && o.id!==go.id);
            return arr.some(o=>checkAABB(go,o) && !collisionBaseline.has(pairKey(go.id,o.id)));
          }
          default: return true;
        }
      });
    }
    function execAction(go, a){
      const obj=go.displayObject, p=go.properties, ps=a.params||{};
      switch(a.type){
        case 'move': obj.x += ps.deltaX||0; obj.y += ps.deltaY||0; p.x=obj.x; p.y=obj.y; break;
        case 'setPosition': obj.x = (ps.x!==undefined)?ps.x:obj.x; obj.y = (ps.y!==undefined)?ps.y:obj.y; p.x=obj.x; p.y=obj.y; break;
        case 'rotate': obj.rotation += (ps.angle||0) * Math.PI/180; p.rotation = obj.rotation*180/Math.PI; break;
        case 'fadeIn': obj.alpha = Math.min(1, obj.alpha+0.02); p.alpha=obj.alpha; break;
        case 'fadeOut': obj.alpha = Math.max(0, obj.alpha-0.02); p.alpha=obj.alpha; break;
        case 'playAnimation': if(obj.play) obj.play(); break;
        case 'stopAnimation': if(obj.stop) obj.stop(); break;
        case 'gotoFrame': if(obj.gotoAndStop) obj.gotoAndStop(ps.frame||0); break;
        case 'playSound': playSound(ps.name, ps.volume??1, !!ps.loop, ps.playbackRate??1); break;
        case 'playMusic': playMusic(ps.name, ps.volume??0.7, ps.loop!==undefined?!!ps.loop:true); break;
        case 'stopMusic': stopMusic(); break;
      }
    }
    function execBehavior(b, collisionBaseline){
      if(!b.enabled) return;
      const go = gameObjects.find(o=>o.id===b.objectId);
      if(!go) return;
      const baseline = collisionBaseline || new Set();
      if(!checkConditions(go, b.conditions, baseline)) return;
      (b.actions||[]).forEach(a=>execAction(go,a));
      (b.subEvents||[]).forEach(id=>{
        const sb = behaviors.find(x=>x.id===id);
        if(sb) execBehavior(sb, baseline);
      });
    }

    // start 事件
    behaviors.filter(b=>b.eventType==='start' && b.enabled).forEach(b=>execBehavior(b, new Set()));

    const cam = scene.camera || {};
    function stepCamera(){
      if(!cam.enabled || !cam.followTargetId) return;
      const go = gameObjects.find(o=>o.id===cam.followTargetId);
      if(!go) return;
      const p = new PIXI.Point();
      go.displayObject.getGlobalPosition(p);
      const sw = app.screen.width, sh = app.screen.height;
      const dx = sw/2 - p.x, dy = sh/2 - p.y;
      const sm = (cam.smoothing !== undefined && cam.smoothing !== null) ? cam.smoothing : 0.12;
      const dt = app.ticker.deltaTime / 60;
      const k = 1 - Math.pow(1 - Math.min(1, sm), dt * 60);
      world.x += dx * k;
      world.y += dy * k;
      if(cam.bounds && cam.bounds.width > 0 && cam.bounds.height > 0){
        const b = cam.bounds;
        let minX = sw - (b.x + b.width), maxX = -b.x;
        if(minX > maxX){ const t=(minX+maxX)/2; minX=maxX=t; }
        let minY = sh - (b.y + b.height), maxY = -b.y;
        if(minY > maxY){ const t=(minY+maxY)/2; minY=maxY=t; }
        world.x = Math.max(minX, Math.min(maxX, world.x));
        world.y = Math.max(minY, Math.min(maxY, world.y));
      }
    }

    // update 循环（collisionEnter 与编辑器逻辑一致：对比上一帧碰撞对）
    app.ticker.add(()=>{
      const collisionBaseline = new Set(collisionPairEnd);
      behaviors.filter(b=>b.eventType==='update' && b.enabled).forEach(b=>execBehavior(b, collisionBaseline));
      collisionPairEnd = new Set();
      for (var ii=0; ii<gameObjects.length; ii++) {
        for (var jj=ii+1; jj<gameObjects.length; jj++) {
          if (checkAABB(gameObjects[ii], gameObjects[jj])) {
            collisionPairEnd.add(pairKey(gameObjects[ii].id, gameObjects[jj].id));
          }
        }
      }
      input.update();
      stepCamera();
    });
  })();
  </script>
</body>
</html>`;
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
            if (typeof this.syncProjectCameraForms === 'function') {
                this.syncProjectCameraForms();
            }
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
            // Esc: 运行态一键停止回编辑态
            if (e.key === 'Escape') {
                if (this.engine.isRunning) {
                    e.preventDefault();
                    this.engine.stop();
                    this.updateStatus('游戏已停止');
                    this.updateSceneObjectList();
                    this.setRunningMode(false);
                }
                return;
            }

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

    startRuntimeInspector() {
        if (this._runtimeInspectTimer) return;
        this._runtimeInspectTimer = setInterval(() => {
            if (!this.engine.isRunning) return;
            const obj = this.engine.selectedObject;
            if (!obj) return;
            // 轻量刷新：只更新可见输入的值（不重建DOM）
            const p = obj.properties;
            const setVal = (id, v) => {
                const el = document.getElementById(id);
                if (el) el.value = v;
            };
            setVal('prop-x', Math.round(p.x));
            setVal('prop-y', Math.round(p.y));
            setVal('prop-alpha', p.alpha);
            setVal('prop-rotation', p.rotation || 0);
        }, 120);
    }

    stopRuntimeInspector() {
        if (this._runtimeInspectTimer) {
            clearInterval(this._runtimeInspectTimer);
            this._runtimeInspectTimer = null;
        }
    }
}

