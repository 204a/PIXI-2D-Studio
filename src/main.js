/**
 * 简单2D游戏引擎 - 主入口
 * 基于PixiJS的可视化游戏编辑器
 */

import { GameEngine } from './GameEngine.js';
import { EditorUI } from './EditorUI.js';
import { EventEditorUI } from './EventEditorUI.js';
import { devLog } from './utils/devLog.js';

const PLAYABLE_SCENE_STORAGE_KEY = 'sge.playableScene.v1';

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
    devLog('🎮 简单2D游戏引擎启动中...');
    
    try {
        devLog('步骤1: 创建游戏引擎实例');
        // 创建游戏引擎实例
        const engine = new GameEngine('game-canvas');
        
        devLog('步骤2: 等待引擎初始化');
        // 等待引擎初始化完成
        await engine.initPromise;
        
        devLog('步骤3: 创建编辑器UI');
        // 创建编辑器UI实例
        const editorUI = new EditorUI(engine);
        
        devLog('步骤4: 等待UI初始化');
        // 等待UI初始化完成
        await editorUI.initPromise;
        
        devLog('步骤4.5: 创建事件编辑器');
        // 创建事件编辑器
        const eventEditorUI = new EventEditorUI(engine, editorUI);

        let restoredPlayableScene = false;
        if (new URLSearchParams(window.location.search).get('restorePlayable') === '1') {
            try {
                const raw = localStorage.getItem(PLAYABLE_SCENE_STORAGE_KEY);
                if (raw) {
                    await engine.importScene(JSON.parse(raw));
                    editorUI.updateSceneObjectList();
                    editorUI.refreshLayerList();
                    editorUI.refreshAudioList();
                    editorUI.refreshImageResourceList();
                    if (typeof editorUI.syncProjectCameraForms === 'function') {
                        editorUI.syncProjectCameraForms();
                    }
                    editorUI.clearPropertiesPanel();
                    eventEditorUI.updateEventsList(null);
                    editorUI.updateStatus('已从游玩预览恢复场景');
                    restoredPlayableScene = true;
                }
            } catch (e) {
                console.error('恢复游玩场景失败:', e);
                editorUI.updateStatus('恢复游玩场景失败：' + (e.message || String(e)));
            } finally {
                window.history.replaceState({}, '', '/');
            }
        }
        
        devLog('步骤5: 隐藏加载动画');
        // 隐藏加载动画，显示应用
        const loadingOverlay = document.getElementById('loading-overlay');
        const app = document.getElementById('app');
        
        if (loadingOverlay) {
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => {
                loadingOverlay.remove();
            }, 300);
        }
        
        if (app) {
            app.classList.add('loaded');
        }
        
        devLog('步骤6: 更新状态');
        // 显示欢迎信息
        if (!restoredPlayableScene) {
            editorUI.updateStatus('✅ 编辑器就绪 - 从左侧拖拽组件开始创作');
        }
        
        devLog('✅ 游戏引擎初始化完成');
        devLog('💡 提示: 按 G 键显示/隐藏网格');
        devLog('💡 提示: Ctrl+Z 撤销, Ctrl+Shift+Z 重做');
        devLog('💡 提示: Delete 删除选中对象');
        
        // 将引擎实例暴露到全局（方便调试）
        window.gameEngine = engine;
        window.editorUI = editorUI;
        window.eventEditorUI = eventEditorUI;
        
        devLog('🎉 所有初始化完成！');
    } catch (error) {
        console.error('❌ 引擎初始化失败:', error);
        console.error('错误堆栈:', error.stack);
        
        // 显示错误信息
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div class="loading-content">
                    <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                    <div style="font-size: 16px; color: #e74c3c;">初始化失败</div>
                    <div style="font-size: 14px; color: #aaa; margin-top: 10px;">${error.message}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 10px; max-width: 500px; word-break: break-all;">${error.stack}</div>
                </div>
            `;
        }
    }
});

