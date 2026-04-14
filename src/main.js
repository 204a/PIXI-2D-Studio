/**
 * 简单2D游戏引擎 - 主入口
 * 基于PixiJS的可视化游戏编辑器
 */

import { GameEngine } from './GameEngine.js';
import { EditorUI } from './EditorUI.js';
import { EventEditorUI } from './EventEditorUI.js';

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎮 简单2D游戏引擎启动中...');
    
    try {
        console.log('步骤1: 创建游戏引擎实例');
        // 创建游戏引擎实例
        const engine = new GameEngine('game-canvas');
        
        console.log('步骤2: 等待引擎初始化');
        // 等待引擎初始化完成
        await engine.initPromise;
        
        console.log('步骤3: 创建编辑器UI');
        // 创建编辑器UI实例
        const editorUI = new EditorUI(engine);
        
        console.log('步骤4: 等待UI初始化');
        // 等待UI初始化完成
        await editorUI.initPromise;
        
        console.log('步骤4.5: 创建事件编辑器');
        // 创建事件编辑器
        const eventEditorUI = new EventEditorUI(engine, editorUI);
        
        console.log('步骤5: 隐藏加载动画');
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
        
        console.log('步骤6: 更新状态');
        // 显示欢迎信息
        editorUI.updateStatus('✅ 编辑器就绪 - 从左侧拖拽组件开始创作');
        
        console.log('✅ 游戏引擎初始化完成');
        console.log('💡 提示: 按 G 键显示/隐藏网格');
        console.log('💡 提示: 按 R 键切换变换控件（缩放+旋转 / 仅旋转）');
        console.log('💡 提示: Ctrl+Z 撤销, Ctrl+Shift+Z 重做');
        console.log('💡 提示: Delete 删除选中对象');
        
        // 将引擎实例暴露到全局（方便调试）
        window.gameEngine = engine;
        window.editorUI = editorUI;
        window.eventEditorUI = eventEditorUI;
        
        console.log('🎉 所有初始化完成！');
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

