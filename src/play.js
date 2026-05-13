import { RuntimePlayer } from './runtime/RuntimePlayer.js';

const STORAGE_KEY = 'sge.playableScene.v1';

function goBack() {
  // 优先回到打开游玩页的原编辑器标签，避免重新加载一个空编辑器。
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.focus();
      window.close();
      return;
    } catch {}
  }

  // Cursor 内置预览等环境可能隔离 opener：回到编辑器后用刚才的游玩快照恢复场景。
  window.location.href = '/?restorePlayable=1';
}

function showEmpty(msg) {
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="empty">
      <div class="card">
        <div style="font-weight:600;margin-bottom:6px;">没有可运行的场景数据</div>
        <div style="color:#aaa;margin-bottom:10px;">${msg}</div>
        <div>请在编辑器里点击 <code>🎮 游玩</code> 生成预览。</div>
      </div>
    </div>
  `;
}

document.getElementById('btn-back')?.addEventListener('click', goBack);
document.getElementById('btn-reload')?.addEventListener('click', () => window.location.reload());

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') goBack();
});

let sceneData = null;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  sceneData = raw ? JSON.parse(raw) : null;
} catch (e) {
  sceneData = null;
}

async function loadSceneFallback() {
  // 静态托管：与 play.html 同目录放置 scene.json
  try {
    const res = await fetch('/scene.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

(async () => {
  if (!sceneData) {
    sceneData = await loadSceneFallback();
  }

  if (!sceneData) {
    showEmpty('未找到场景：请在编辑器点击「🎮 游玩」，或与 play.html 同目录放置导出的 scene.json。');
    return;
  }

  const player = new RuntimePlayer('root');
  player.start(sceneData).catch((err) => {
    console.error(err);
    showEmpty('启动失败：' + (err.message || String(err)));
  });
})();

