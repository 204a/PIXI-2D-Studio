import { defineConfig } from 'vite';
import { resolve } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function standaloneRuntimeBuildPlugin() {
  let building = null;

  return {
    name: 'sge-standalone-runtime-build',
    configureServer(server) {
      server.middlewares.use('/__sge_build_standalone', async (_req, res) => {
        try {
          if (!building) {
            building = execFileAsync('npm', ['run', 'build:standalone'], {
              cwd: process.cwd()
            }).finally(() => {
              building = null;
            });
          }

          await building;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            ok: false,
            message: error?.stderr || error?.message || String(error)
          }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [standaloneRuntimeBuildPlugin()],
  server: {
    port: 3000,
    open: true,
    // 禁用缓存，强制每次都重新加载
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    /** 生产构建关闭 sourcemap，减小 dist 体积 */
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html')
      }
    }
  }
});

