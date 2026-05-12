/**
 * 独立 HTML 导出用入口：打包为单文件 IIFE，嵌入 game.html 后离线可运行。
 */
import { RuntimePlayer } from './runtime/RuntimePlayer.js';

window.__SGE_RUN__ = async function runStandalone(sceneData) {
    const player = new RuntimePlayer('root');
    await player.start(sceneData);
};
