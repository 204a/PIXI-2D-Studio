/**
 * GDevelop风格事件编辑器
 */

export class EventEditorUI {
    constructor(engine, editorUI) {
        this.engine = engine;
        this.editorUI = editorUI;
        this.currentObject = null;
        this.events = []; // 事件列表（包含条件和动作）
        this.init();
    }
    
    init() {
        this.createEventPanel();
    }
    
    createEventPanel() {
        const propertiesPanel = document.querySelector('.properties-panel');
        const eventPanel = document.createElement('div');
        eventPanel.id = 'event-panel';
        eventPanel.style.cssText = 'margin-top: 20px; padding-top: 20px; border-top: 1px solid #444; display: none;';
        
        eventPanel.innerHTML = `
            <h2 style="font-size: 16px; margin-bottom: 15px; font-weight: 600;">⚡ 事件</h2>
            <div id="events-container"></div>
            <button id="btn-add-event" style="width: 100%; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                ➕ 添加事件
            </button>
        `;
        
        propertiesPanel.appendChild(eventPanel);
        
        document.getElementById('btn-add-event').addEventListener('click', () => {
            if (this.currentObject) this.addNewEvent();
        });
    }
    
    updateEventsList(obj) {
        if (!obj) {
            this.currentObject = null;
            document.getElementById('events-container').innerHTML = '<p style="color: #666; padding: 10px 0; font-size: 13px;">选择对象后可添加事件</p>';
            return;
        }
        
        this.currentObject = obj;
        const behaviors = this.engine.behaviorSystem.getObjectBehaviors(obj.id);
        
        // 只获取顶层事件（没有parentId的）
        const topLevelBehaviors = behaviors.filter(b => !b.parentId);
        
        this.events = topLevelBehaviors.map(b => this.buildEventTree(b, behaviors));
        
        this.renderEvents();
    }
    
    /**
     * 构建事件树（包括子事件）
     */
    buildEventTree(behavior, allBehaviors) {
        const event = {
            id: behavior.id,
            type: behavior.eventType,
            conditions: behavior.conditions || [],
            actions: behavior.actions || [],
            subEvents: []
        };
        
        // 递归加载子事件
        if (behavior.subEvents && behavior.subEvents.length > 0) {
            event.subEvents = behavior.subEvents.map(subId => {
                const subBehavior = allBehaviors.find(b => b.id === subId);
                return subBehavior ? this.buildEventTree(subBehavior, allBehaviors) : null;
            }).filter(e => e !== null);
        }
        
        return event;
    }
    
    renderEvents() {
        const container = document.getElementById('events-container');
        
        if (this.events.length === 0) {
            container.innerHTML = '<p style="color: #666; padding: 10px 0; font-size: 13px;">暂无事件</p>';
            return;
        }
        
        let html = '';
        this.events.forEach((evt, idx) => {
            html += this.renderEvent(evt, idx, 0);
        });
        
        container.innerHTML = html;
        this.bindEventActions();
    }
    
    renderEvent(evt, idx, level) {
        const indent = level * 20;
        const bgColor = level === 0 ? '#2a2a2a' : '#232323';
        const borderColor = level === 0 ? '#4CAF50' : '#2196F3';
        
        let html = `
            <div class="event-block" data-event-id="${evt.id}" data-index="${idx}" draggable="true" style="
                background: ${bgColor};
                border-left: 3px solid ${borderColor};
                border-radius: 4px;
                padding: 10px;
                margin-left: ${indent}px;
                margin-bottom: 8px;
                cursor: move;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                        <span style="cursor: grab;">⋮⋮</span>
                        ${level > 0 ? '└─ ' : '📌 '}${evt.type === 'start' ? '游戏开始时' : '每帧更新时'}
                    </span>
                    <div style="display: flex; gap: 5px;">
                        ${level < 2 ? `<button class="btn-add-subevent" data-id="${evt.id}" style="padding: 4px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">➕子事件</button>` : ''}
                        <button class="btn-delete-event" data-id="${evt.id}" style="padding: 4px 8px; background: #e74c3c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">删除</button>
                    </div>
                </div>
                
                ${evt.conditions.length > 0 ? `
                    <div style="background: #1e1e1e; padding: 8px; border-radius: 4px; margin-bottom: 6px;">
                        <div style="font-size: 11px; color: #2196F3; margin-bottom: 4px;">🔍 条件:</div>
                        ${evt.conditions.map((c, ci) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #2a2a2a; border-radius: 3px; margin-bottom: 3px; font-size: 12px;">
                                <span>${this.formatCondition(c)}</span>
                                <button class="btn-del-condition" data-event-id="${evt.id}" data-index="${ci}" style="padding: 2px 6px; background: #e74c3c; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">×</button>
                            </div>
                        `).join('')}
                        <button class="btn-add-condition" data-event-id="${evt.id}" style="width: 100%; padding: 6px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; margin-top: 4px;">+ 添加条件</button>
                    </div>
                ` : `
                    <button class="btn-add-condition" data-event-id="${evt.id}" style="width: 100%; padding: 6px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; margin-bottom: 6px;">+ 添加条件</button>
                `}
                
                <div style="background: #1e1e1e; padding: 8px; border-radius: 4px;">
                    <div style="font-size: 11px; color: #4CAF50; margin-bottom: 4px;">⚡ 动作:</div>
                    ${evt.actions.length > 0 ? evt.actions.map((a, ai) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #2a2a2a; border-radius: 3px; margin-bottom: 3px; font-size: 12px;">
                            <span>${this.formatAction(a)}</span>
                            <button class="btn-del-action" data-event-id="${evt.id}" data-index="${ai}" style="padding: 2px 6px; background: #e74c3c; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 10px;">×</button>
                        </div>
                    `).join('') : '<div style="color: #666; font-size: 11px; padding: 4px;">暂无动作</div>'}
                    <button class="btn-add-action" data-event-id="${evt.id}" style="width: 100%; padding: 6px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; margin-top: 4px;">+ 添加动作</button>
                </div>
            </div>
        `;
        
        // 递归渲染子事件
        if (evt.subEvents && evt.subEvents.length > 0) {
            evt.subEvents.forEach((subEvt, subIdx) => {
                html += this.renderEvent(subEvt, subIdx, level + 1);
            });
        }
        
        return html;
    }
    
    bindEventActions() {
        // 拖拽排序
        let draggedEventId = null;
        
        document.querySelectorAll('.event-block').forEach(block => {
            block.addEventListener('dragstart', (e) => {
                draggedEventId = block.dataset.eventId;
                e.dataTransfer.effectAllowed = 'move';
                block.style.opacity = '0.5';
            });
            
            block.addEventListener('dragend', (e) => {
                block.style.opacity = '1';
            });
            
            block.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            block.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetEventId = block.dataset.eventId;
                
                if (draggedEventId && draggedEventId !== targetEventId) {
                    // 交换事件顺序
                    const behaviors = this.engine.behaviorSystem.behaviors.filter(b => b.objectId === this.currentObject.id);
                    const draggedIdx = behaviors.findIndex(b => b.id === draggedEventId);
                    const targetIdx = behaviors.findIndex(b => b.id === targetEventId);
                    
                    if (draggedIdx !== -1 && targetIdx !== -1) {
                        // 重新排序
                        const temp = behaviors[draggedIdx].order;
                        behaviors[draggedIdx].order = behaviors[targetIdx].order;
                        behaviors[targetIdx].order = temp;
                        
                        // 重新排序整个behaviors数组
                        this.engine.behaviorSystem.behaviors.sort((a, b) => a.order - b.order);
                        
                        this.updateEventsList(this.currentObject);
                    }
                }
                
                draggedEventId = null;
            });
        });
        
        // 添加子事件
        document.querySelectorAll('.btn-add-subevent').forEach(btn => {
            btn.addEventListener('click', () => {
                const parentId = btn.dataset.id;
                this.addSubEvent(parentId);
            });
        });
        
        // 删除事件
        document.querySelectorAll('.btn-delete-event').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.engine.behaviorSystem.removeBehavior(id);
                this.updateEventsList(this.currentObject);
            });
        });
        
        // 添加条件
        document.querySelectorAll('.btn-add-condition').forEach(btn => {
            btn.addEventListener('click', () => {
                const eventId = btn.dataset.eventId;
                this.showConditionDialog(eventId);
            });
        });
        
        // 删除条件
        document.querySelectorAll('.btn-del-condition').forEach(btn => {
            btn.addEventListener('click', () => {
                const eventId = btn.dataset.eventId;
                const index = parseInt(btn.dataset.index);
                const behavior = this.engine.behaviorSystem.behaviors.find(b => b.id === eventId);
                if (behavior) {
                    behavior.conditions.splice(index, 1);
                    this.updateEventsList(this.currentObject);
                }
            });
        });
        
        // 添加动作
        document.querySelectorAll('.btn-add-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const eventId = btn.dataset.eventId;
                this.showActionDialog(eventId);
            });
        });
        
        // 删除动作
        document.querySelectorAll('.btn-del-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const eventId = btn.dataset.eventId;
                const index = parseInt(btn.dataset.index);
                const behavior = this.engine.behaviorSystem.behaviors.find(b => b.id === eventId);
                if (behavior) {
                    behavior.actions.splice(index, 1);
                    this.updateEventsList(this.currentObject);
                }
            });
        });
    }
    
    addNewEvent() {
        const dialog = this.createSimpleDialog('选择事件类型', [
            { value: 'start', label: '🎬 游戏开始时' },
            { value: 'update', label: '🔄 每帧更新时' }
        ]);
        
        dialog.onConfirm = (value) => {
            // 获取当前对象的行为数量，用于设置order
            const existingBehaviors = this.engine.behaviorSystem.getObjectBehaviors(this.currentObject.id);
            const order = existingBehaviors.length;
            
            this.engine.behaviorSystem.addBehavior(
                this.currentObject.id,
                value,
                [],
                { conditions: [], order }
            );
            this.updateEventsList(this.currentObject);
        };
    }
    
    /**
     * 添加子事件
     */
    addSubEvent(parentId) {
        const dialog = this.createSimpleDialog('选择子事件类型', [
            { value: 'start', label: '🎬 游戏开始时' },
            { value: 'update', label: '🔄 每帧更新时' }
        ]);
        
        dialog.onConfirm = (value) => {
            // 使用BehaviorSystem的addSubEvent方法
            this.engine.behaviorSystem.addSubEvent(
                parentId,
                this.currentObject.id,
                value,
                [],
                { conditions: [] }
            );
            this.updateEventsList(this.currentObject);
        };
    }
    
    createSimpleDialog(title, options) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        let optionsHtml = options.map(opt => 
            `<button class="dialog-option" data-value="${opt.value}" style="width: 100%; padding: 12px; background: #333; color: white; border: 1px solid #444; border-radius: 4px; cursor: pointer; margin-bottom: 8px; text-align: left;">${opt.label}</button>`
        ).join('');
        
        overlay.innerHTML = `
            <div style="background: #252525; border-radius: 8px; padding: 20px; min-width: 300px;">
                <h3 style="margin: 0 0 15px 0; color: #fff;">${title}</h3>
                ${optionsHtml}
                <button id="dialog-cancel" style="width: 100%; padding: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 5px;">取消</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const result = { onConfirm: null };
        
        overlay.querySelectorAll('.dialog-option').forEach(btn => {
            btn.addEventListener('click', () => {
                if (result.onConfirm) result.onConfirm(btn.dataset.value);
                overlay.remove();
            });
        });
        
        overlay.querySelector('#dialog-cancel').addEventListener('click', () => {
            overlay.remove();
        });
        
        return result;
    }
    
    showConditionDialog(eventId) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        overlay.innerHTML = `
            <div style="background: #252525; border-radius: 8px; padding: 20px; width: 400px;">
                <h3 style="margin: 0 0 15px 0; color: #fff;">添加条件</h3>
                <div style="margin-bottom: 10px;">
                    <label style="color: #aaa; font-size: 13px;">条件类型</label>
                    <select id="cond-type" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                        <optgroup label="对象属性">
                            <option value="positionX">X坐标</option>
                            <option value="positionY">Y坐标</option>
                            <option value="alpha">透明度</option>
                            <option value="rotation">旋转角度</option>
                        </optgroup>
                        <optgroup label="键盘输入">
                            <option value="keyPressed">按键按住</option>
                            <option value="keyJustPressed">按键按下</option>
                            <option value="keyReleased">按键释放</option>
                        </optgroup>
                        <optgroup label="鼠标">
                            <option value="mouseClicked">鼠标点击（瞬间）</option>
                            <option value="mouseDown">鼠标按下（持续）</option>
                            <option value="mouseReleased">鼠标释放</option>
                            <option value="mouseHover">鼠标悬停</option>
                            <option value="mouseX">鼠标X坐标</option>
                            <option value="mouseY">鼠标Y坐标</option>
                        </optgroup>
                        <optgroup label="碰撞">
                            <option value="collision">碰撞检测</option>
                        </optgroup>
                    </select>
                </div>
                <div id="cond-params"></div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="cond-confirm" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">确认</button>
                    <button id="cond-cancel" style="flex: 1; padding: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const updateParams = () => {
            const type = overlay.querySelector('#cond-type').value;
            const paramsDiv = overlay.querySelector('#cond-params');
            
            if (type.startsWith('key')) {
                // 按键条件
                paramsDiv.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">按键</label>
                        <select id="cond-key" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                            <optgroup label="方向键">
                                <option value="ArrowLeft">← 左</option>
                                <option value="ArrowRight">→ 右</option>
                                <option value="ArrowUp">↑ 上</option>
                                <option value="ArrowDown">↓ 下</option>
                            </optgroup>
                            <optgroup label="WASD">
                                <option value="w">W (上)</option>
                                <option value="a">A (左)</option>
                                <option value="s">S (下)</option>
                                <option value="d">D (右)</option>
                            </optgroup>
                            <optgroup label="字母">
                                <option value="q">Q</option>
                                <option value="e">E</option>
                                <option value="r">R</option>
                                <option value="f">F</option>
                            </optgroup>
                            <optgroup label="其他">
                                <option value=" ">空格</option>
                                <option value="Shift">Shift</option>
                                <option value="Control">Ctrl</option>
                            </optgroup>
                        </select>
                    </div>
                `;
            } else if (type.startsWith('mouse')) {
                // 鼠标条件
                if (type === 'mouseClicked' || type === 'mouseDown' || type === 'mouseReleased') {
                    paramsDiv.innerHTML = '<p style="color: #666; font-size: 12px;">检测鼠标左键' + 
                        (type === 'mouseClicked' ? '点击（瞬间）' : type === 'mouseDown' ? '按下（持续）' : '释放') + 
                        '</p>';
                } else if (type === 'mouseHover') {
                    paramsDiv.innerHTML = '<p style="color: #666; font-size: 12px;">检测鼠标是否悬停在此对象上</p>';
                } else {
                    paramsDiv.innerHTML = `
                        <div style="margin-bottom: 10px;">
                            <label style="color: #aaa; font-size: 13px;">运算符</label>
                            <select id="cond-op" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                                <option value=">">大于 (>)</option>
                                <option value="<">小于 (<)</option>
                                <option value=">=">大于等于 (>=)</option>
                                <option value="<=">小于等于 (<=)</option>
                                <option value="==">等于 (==)</option>
                                <option value="!=">不等于 (!=)</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <label style="color: #aaa; font-size: 13px;">比较值</label>
                            <input type="number" id="cond-value" value="100" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                        </div>
                    `;
                }
            } else if (type === 'collision') {
                // 碰撞条件
                paramsDiv.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">碰撞目标标签</label>
                        <input type="text" id="cond-tag" placeholder="如：enemy, platform" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                        <small style="color: #666; font-size: 11px; display: block; margin-top: 3px;">在对象属性中设置标签</small>
                    </div>
                `;
            } else {
                // 属性比较条件
                paramsDiv.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">运算符</label>
                        <select id="cond-op" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                            <option value=">">大于 (>)</option>
                            <option value="<">小于 (<)</option>
                            <option value=">=">大于等于 (>=)</option>
                            <option value="<=">小于等于 (<=)</option>
                            <option value="==">等于 (==)</option>
                            <option value="!=">不等于 (!=)</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">比较值</label>
                        <input type="number" id="cond-value" value="100" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                    </div>
                `;
            }
        };
        
        overlay.querySelector('#cond-type').addEventListener('change', updateParams);
        updateParams();
        
        overlay.querySelector('#cond-confirm').addEventListener('click', () => {
            const behavior = this.engine.behaviorSystem.behaviors.find(b => b.id === eventId);
            if (behavior) {
                const type = overlay.querySelector('#cond-type').value;
                const condition = { type };
                
                if (type.startsWith('key')) {
                    condition.key = overlay.querySelector('#cond-key').value;
                } else if (type === 'collision') {
                    condition.tag = overlay.querySelector('#cond-tag').value;
                } else if (type === 'mouseClicked') {
                    // 无参数
                } else if (type.startsWith('mouse')) {
                    condition.operator = overlay.querySelector('#cond-op').value;
                    condition.value = parseFloat(overlay.querySelector('#cond-value').value) || 0;
                } else {
                    condition.operator = overlay.querySelector('#cond-op').value;
                    condition.value = parseFloat(overlay.querySelector('#cond-value').value) || 0;
                }
                
                behavior.conditions.push(condition);
                this.updateEventsList(this.currentObject);
            }
            overlay.remove();
        });
        
        overlay.querySelector('#cond-cancel').addEventListener('click', () => overlay.remove());
    }
    
    showActionDialog(eventId) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        
        overlay.innerHTML = `
            <div style="background: #252525; border-radius: 8px; padding: 20px; width: 400px; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 15px 0; color: #fff;">添加动作</h3>
                <div style="margin-bottom: 10px;">
                    <label style="color: #aaa; font-size: 13px;">动作类型</label>
                    <select id="action-type" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                        <optgroup label="移动">
                            <option value="move">相对移动</option>
                            <option value="setPosition">设置位置</option>
                            <option value="moveTo">移动到目标</option>
                        </optgroup>
                        <optgroup label="旋转">
                            <option value="rotate">旋转</option>
                            <option value="spin">持续旋转</option>
                        </optgroup>
                        <optgroup label="显示">
                            <option value="fadeIn">淡入</option>
                            <option value="fadeOut">淡出</option>
                        </optgroup>
                        <optgroup label="高级">
                            <option value="bounce">弹跳</option>
                            <option value="oscillate">振荡</option>
                        </optgroup>
                        <optgroup label="动画">
                            <option value="playAnimation">播放动画</option>
                            <option value="stopAnimation">停止动画</option>
                            <option value="gotoFrame">跳转到帧</option>
                        </optgroup>
                        <optgroup label="补间动画">
                            <option value="tweenTo">补间移动</option>
                            <option value="tweenAlpha">补间透明度</option>
                            <option value="tweenScale">补间缩放</option>
                            <option value="tweenRotate">补间旋转</option>
                            <option value="stopTween">停止补间</option>
                        </optgroup>
                        <optgroup label="音频">
                            <option value="playSound">播放音效</option>
                            <option value="playMusic">播放背景音乐</option>
                            <option value="stopMusic">停止背景音乐</option>
                        </optgroup>
                    </select>
                </div>
                <div id="action-params"></div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="action-confirm" style="flex: 1; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">确认</button>
                    <button id="action-cancel" style="flex: 1; padding: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const updateParams = () => {
            const type = overlay.querySelector('#action-type').value;
            const paramsDiv = overlay.querySelector('#action-params');

            if (type === 'playSound' || type === 'playMusic') {
                const audios = this.engine.resourceManager.getAllAudioResources();
                const options = audios.length
                    ? audios.map((a) => `<option value="${this._escapeHtml(a.name)}">${this._escapeHtml(a.name)}</option>`).join('')
                    : '<option value="">(请先在左侧上传音频)</option>';
                const isMusic = type === 'playMusic';
                paramsDiv.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">音频文件</label>
                        <select id="action-audio-name" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">${options}</select>
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">音量 (0–1)</label>
                        <input type="number" id="action-audio-vol" min="0" max="1" step="0.1" value="${isMusic ? '0.7' : '1'}" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="color: #ccc; font-size: 13px;"><input type="checkbox" id="action-audio-loop" ${isMusic ? 'checked' : ''}> 循环播放</label>
                    </div>
                    ${isMusic ? `
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">淡入时间(秒)</label>
                        <input type="number" id="action-audio-fadein" min="0" step="0.1" value="0" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                    </div>` : ''}
                `;
                return;
            }

            if (type === 'stopMusic') {
                paramsDiv.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <label style="color: #aaa; font-size: 13px;">淡出时间(秒)，0 为立即停止</label>
                        <input type="number" id="action-stopmusic-fade" min="0" step="0.1" value="0.5" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                    </div>
                `;
                return;
            }

            const configs = {
                'move': [['deltaX', 'X移动', 5], ['deltaY', 'Y移动', 0]],
                'setPosition': [['x', 'X坐标', 100], ['y', 'Y坐标', 100]],
                'rotate': [['angle', '角度', 10]],
                'spin': [['speed', '速度', 5]],
                'moveTo': [['targetX', '目标X', 200], ['targetY', '目标Y', 200], ['speed', '速度', 2]],
                'bounce': [['minY', '最小Y', 100], ['maxY', '最大Y', 400]],
                'oscillate': [['amplitude', '振幅', 50]],
                'gotoFrame': [['frame', '帧数', 0]],
                'tweenTo': [['x', '目标X', 200], ['y', '目标Y', 200], ['duration', '持续时间(秒)', 1]],
                'tweenAlpha': [['targetAlpha', '目标透明度(0-1)', 0], ['duration', '持续时间(秒)', 1]],
                'tweenScale': [['scaleX', 'X缩放', 2], ['scaleY', 'Y缩放', 2], ['duration', '持续时间(秒)', 1]],
                'tweenRotate': [['angle', '目标角度', 360], ['duration', '持续时间(秒)', 1]]
            };

            const params = configs[type] || [];
            paramsDiv.innerHTML = params.map(([name, label, def]) => `
                <div style="margin-bottom: 10px;">
                    <label style="color: #aaa; font-size: 13px;">${label}</label>
                    <input type="number" name="${name}" value="${def}" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-top: 5px;">
                </div>
            `).join('');
        };
        
        overlay.querySelector('#action-type').addEventListener('change', updateParams);
        updateParams();
        
        overlay.querySelector('#action-confirm').addEventListener('click', () => {
            const behavior = this.engine.behaviorSystem.behaviors.find(b => b.id === eventId);
            if (behavior) {
                const type = overlay.querySelector('#action-type').value;
                let params = {};

                if (type === 'playSound' || type === 'playMusic') {
                    const sel = overlay.querySelector('#action-audio-name');
                    params.name = sel ? sel.value : '';
                    const volEl = overlay.querySelector('#action-audio-vol');
                    params.volume = volEl ? parseFloat(volEl.value) : (type === 'playMusic' ? 0.7 : 1);
                    if (Number.isNaN(params.volume)) params.volume = type === 'playMusic' ? 0.7 : 1;
                    const loopEl = overlay.querySelector('#action-audio-loop');
                    params.loop = loopEl ? loopEl.checked : false;
                    if (type === 'playMusic') {
                        const fi = overlay.querySelector('#action-audio-fadein');
                        params.fadeIn = fi ? parseFloat(fi.value) || 0 : 0;
                    }
                } else if (type === 'stopMusic') {
                    const fo = overlay.querySelector('#action-stopmusic-fade');
                    params.fadeOut = fo ? parseFloat(fo.value) || 0 : 0;
                } else {
                    overlay.querySelectorAll('#action-params input').forEach(input => {
                        params[input.name] = parseFloat(input.value) || 0;
                    });
                }

                behavior.actions.push({ type, params });
                this.updateEventsList(this.currentObject);
            }
            overlay.remove();
        });
        
        overlay.querySelector('#action-cancel').addEventListener('click', () => overlay.remove());
    }
    
    formatCondition(c) {
        const names = {
            'positionX': 'X坐标',
            'positionY': 'Y坐标',
            'alpha': '透明度',
            'rotation': '旋转',
            'keyPressed': '按键按住',
            'keyJustPressed': '按键按下',
            'keyReleased': '按键释放',
            'mouseClicked': '🖱️ 鼠标点击',
            'mouseDown': '🖱️ 鼠标按下',
            'mouseReleased': '🖱️ 鼠标释放',
            'mouseHover': '🖱️ 鼠标悬停',
            'mouseX': '🖱️ 鼠标X',
            'mouseY': '🖱️ 鼠标Y',
            'collision': '💥 碰撞'
        };
        
        if (c.type.startsWith('key')) {
            const keyNames = {
                'ArrowLeft': '←左',
                'ArrowRight': '→右',
                'ArrowUp': '↑上',
                'ArrowDown': '↓下',
                'w': 'W',
                'a': 'A',
                's': 'S',
                'd': 'D',
                ' ': '空格'
            };
            return `⌨️ ${names[c.type]}: ${keyNames[c.key] || c.key}`;
        }
        
        if (c.type === 'collision') {
            return `💥 碰撞: ${c.tag || '任意'}`;
        }
        
        if (c.type === 'mouseClicked' || c.type === 'mouseDown' || c.type === 'mouseReleased' || c.type === 'mouseHover') {
            return names[c.type];
        }
        
        if (c.type.startsWith('mouse')) {
            return `${names[c.type]} ${c.operator} ${c.value}`;
        }
        
        return `${names[c.type] || c.type} ${c.operator} ${c.value}`;
    }
    
    _escapeHtml(s) {
        if (s === undefined || s === null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    formatAction(a) {
        const formats = {
            'move': `移动 (${a.params.deltaX || 0}, ${a.params.deltaY || 0})`,
            'rotate': `旋转 ${a.params.angle || 0}°`,
            'setPosition': `到位置 (${a.params.x}, ${a.params.y})`,
            'fadeIn': '淡入',
            'fadeOut': '淡出',
            'spin': `持续旋转 ${a.params.speed || 5}°`,
            'moveTo': `移动到 (${a.params.targetX}, ${a.params.targetY})`,
            'playAnimation': '▶ 播放动画',
            'stopAnimation': '⏹ 停止动画',
            'gotoFrame': `跳到第${a.params.frame || 0}帧`,
            'tweenTo': `🎭 补间到 (${a.params.x}, ${a.params.y}) ${a.params.duration}s`,
            'tweenAlpha': `🎭 淡入淡出到 ${a.params.targetAlpha} ${a.params.duration}s`,
            'tweenScale': `🎭 缩放到 (${a.params.scaleX}, ${a.params.scaleY}) ${a.params.duration}s`,
            'tweenRotate': `🎭 旋转到 ${a.params.angle}° ${a.params.duration}s`,
            'stopTween': '⏹ 停止补间',
            'playSound': `🔊 音效: ${a.params.name || '?'} (音量${a.params.volume ?? 1})`,
            'playMusic': `🎵 音乐: ${a.params.name || '?'} (音量${a.params.volume ?? 0.7})`,
            'stopMusic': `⏹ 停音乐 (淡出 ${a.params.fadeOut ?? 0}s)`
        };
        return formats[a.type] || a.type;
    }
    
    deleteBehavior(id) {
        this.engine.behaviorSystem.removeBehavior(id);
        this.updateEventsList(this.currentObject);
    }
}
