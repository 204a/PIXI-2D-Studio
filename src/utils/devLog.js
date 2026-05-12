/**
 * 仅在开发模式输出日志；生产构建（vite build）下为空操作，避免控制台噪音。
 */
export function devLog(...args) {
    if (import.meta.env.DEV) {
        console.log(...args);
    }
}
