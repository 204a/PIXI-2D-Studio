import { RuntimePlayer } from './runtime/RuntimePlayer.js';

const STORAGE_KEY = 'sge.playableScene.v1';

function goBack() {
  // 返回编辑器首页
  window.location.href = '/';
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
  // 发布模式：同目录提供 scene.json
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
    showEmpty('未找到场景：请在编辑器点击「🎮 游玩」或在发布目录放置 scene.json。');
    return;
  }

  const player = new RuntimePlayer('root');
  player.start(sceneData).catch((err) => {
    console.error(err);
    showEmpty('启动失败：' + (err.message || String(err)));
  });
})();

