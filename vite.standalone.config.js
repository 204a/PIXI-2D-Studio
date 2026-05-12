import { defineConfig } from 'vite';
import { resolve } from 'path';

/** 输出到 public/，供编辑器导出 HTML 时 fetch 嵌入（离线分享单文件 game.html） */
export default defineConfig({
    publicDir: false,
    build: {
        lib: {
            entry: resolve(__dirname, 'src/standalone-entry.js'),
            name: 'SGEStandalone',
            formats: ['iife'],
            fileName: () => 'sge-standalone.js'
        },
        outDir: 'public',
        emptyOutDir: false,
        sourcemap: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                extend: true,
                banner: '/* simple-game-engine standalone runtime — bundled by vite */'
            }
        }
    }
});
