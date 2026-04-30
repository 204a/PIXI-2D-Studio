/**
 * 多场景槽位：仅在编辑器内切换；导出 JSON 带 savedScenes + activeSceneId
 */
export class SceneManager {
    constructor(engine) {
        this.engine = engine;
        this.activeSceneId = 'main';
        this.scenes = new Map([['main', { name: '主场景', data: null }]]);
    }

    list() {
        return Array.from(this.scenes.entries()).map(([id, v]) => ({ id, name: v.name }));
    }

    async switchTo(sceneId) {
        if (!this.scenes.has(sceneId) || sceneId === this.activeSceneId) return;

        const cur = this.engine.exportSceneCore();
        const curSlot = this.scenes.get(this.activeSceneId);
        if (curSlot) {
            curSlot.data = JSON.parse(JSON.stringify(cur));
        }

        this.activeSceneId = sceneId;
        const next = this.scenes.get(sceneId);
        const payload = next.data || this.engine.getEmptySceneData();
        await this.engine.importScenePayload(payload);
    }

    async addScene(name) {
        const cur = this.engine.exportSceneCore();
        const curSlot = this.scenes.get(this.activeSceneId);
        if (curSlot) {
            curSlot.data = JSON.parse(JSON.stringify(cur));
        }

        const id = `scene_${Date.now()}`;
        this.scenes.set(id, { name: name || '新场景', data: null });
        this.activeSceneId = id;
        await this.engine.importScenePayload(this.engine.getEmptySceneData());
        return id;
    }

    renameScene(id, name) {
        const s = this.scenes.get(id);
        if (s) s.name = name;
    }

    async removeScene(id) {
        if (id === 'main' || this.scenes.size <= 1) return false;
        if (this.activeSceneId === id) {
            const other = Array.from(this.scenes.keys()).find((k) => k !== id);
            if (other) await this.switchTo(other);
        }
        this.scenes.delete(id);
        return true;
    }

    /**
     * 嵌入导出：每个槽位一份完整场景数据
     */
    buildSavedScenesForExport() {
        const activeCore = this.engine.exportSceneCore();
        const activeSlot = this.scenes.get(this.activeSceneId);
        if (activeSlot) {
            activeSlot.data = JSON.parse(JSON.stringify(activeCore));
        }

        return Array.from(this.scenes.entries()).map(([id, v]) => ({
            id,
            name: v.name,
            data: v.data ? JSON.parse(JSON.stringify(v.data)) : this.engine.getEmptySceneData()
        }));
    }

    importFromFile(savedScenes, activeId) {
        this.scenes.clear();
        if (!savedScenes || !Array.isArray(savedScenes) || savedScenes.length === 0) {
            this.scenes.set('main', { name: '主场景', data: null });
            this.activeSceneId = 'main';
            return;
        }
        savedScenes.forEach((s) => {
            if (s && s.id) {
                this.scenes.set(s.id, { name: s.name || s.id, data: s.data || null });
            }
        });
        if (!this.scenes.has(activeId)) {
            activeId = savedScenes[0].id;
        }
        this.activeSceneId = activeId;
    }
}
