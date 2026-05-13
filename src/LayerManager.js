/**
 * 图层管理器（最小可用版）
 * - 维护 layer 列表（顺序/可见/锁定）
 * - 对象通过 properties.layerId 归属图层
 * - 同父节点内渲染顺序：图层顺序 → properties.z（越大越靠前）→ 对象 id
 * - 依赖各父容器 sortableChildren=true（assignZOrder 会开启）
 */
export class LayerManager {
    constructor(engine) {
        this.engine = engine;
        this.layers = [];
        this.activeLayerId = null;
        this._initDefault();
    }

    _initDefault() {
        const id = 'layer_default';
        this.layers = [{
            id,
            name: 'Layer 1',
            visible: true,
            locked: false,
            fixed: false
        }];
        this.activeLayerId = id;
    }

    getLayers() {
        return this.layers;
    }

    getLayer(id) {
        return this.layers.find(l => l.id === id) || null;
    }

    addLayer(name = 'New Layer') {
        const id = `layer_${Date.now()}_${Math.random()}`;
        this.layers.push({ id, name, visible: true, locked: false, fixed: false });
        this.activeLayerId = id;
        this.applyToAllObjects();
        return id;
    }

    removeLayer(id) {
        if (this.layers.length <= 1) return false;
        const idx = this.layers.findIndex(l => l.id === id);
        if (idx < 0) return false;
        const fallback = this.layers.find(l => l.id !== id)?.id;
        this.layers.splice(idx, 1);
        if (this.activeLayerId === id) this.activeLayerId = fallback;

        // 将对象迁移到 fallback
        this.engine.gameObjects.forEach(obj => {
            if (obj.properties.layerId === id) obj.properties.layerId = fallback;
        });
        this.applyToAllObjects();
        return true;
    }

    renameLayer(id, name) {
        const layer = this.getLayer(id);
        if (!layer) return false;
        layer.name = name;
        return true;
    }

    setActiveLayer(id) {
        if (!this.getLayer(id)) return false;
        this.activeLayerId = id;
        return true;
    }

    toggleVisible(id) {
        const layer = this.getLayer(id);
        if (!layer) return false;
        layer.visible = !layer.visible;
        this.applyToAllObjects();
        return true;
    }

    toggleLocked(id) {
        const layer = this.getLayer(id);
        if (!layer) return false;
        layer.locked = !layer.locked;
        this.applyToAllObjects();
        return true;
    }

    toggleFixed(id) {
        const layer = this.getLayer(id);
        if (!layer) return false;
        layer.fixed = !layer.fixed;
        this.applyToAllObjects();
        return true;
    }

    moveLayer(id, dir) {
        const idx = this.layers.findIndex(l => l.id === id);
        if (idx < 0) return false;
        const j = idx + dir;
        if (j < 0 || j >= this.layers.length) return false;
        const tmp = this.layers[idx];
        this.layers[idx] = this.layers[j];
        this.layers[j] = tmp;
        this.applyToAllObjects();
        return true;
    }

    assignObjectsToLayer(objects, layerId) {
        if (!this.getLayer(layerId)) return false;
        const arr = Array.isArray(objects) ? objects : [objects];
        arr.forEach(obj => { obj.properties.layerId = layerId; });
        this.applyToAllObjects();
        return true;
    }

    /**
     * 按「图层 → Z 轴 → id」设置同父节点下的 zIndex，并 sortChildren。
     * @param {{ layers?: Array<{ id: string }> }} layersData 与 export().layers 同结构
     */
    static assignZOrder(gameObjects, layersData) {
        const layers = layersData?.layers?.length ? layersData.layers : [{ id: 'layer_default' }];
        const layerOrder = new Map(layers.map((l, i) => [l.id, i]));

        const byParent = new Map();
        for (const obj of gameObjects) {
            if (!obj.displayObject) continue;
            const par = obj.displayObject.parent;
            if (!byParent.has(par)) byParent.set(par, []);
            byParent.get(par).push(obj);
        }

        const cmp = (a, b) => {
            let lidA = a.properties.layerId || 'layer_default';
            let lidB = b.properties.layerId || 'layer_default';
            if (!layerOrder.has(lidA)) lidA = 'layer_default';
            if (!layerOrder.has(lidB)) lidB = 'layer_default';
            const oa = layerOrder.get(lidA) ?? 0;
            const ob = layerOrder.get(lidB) ?? 0;
            if (oa !== ob) return oa - ob;
            const za = Number.isFinite(Number(a.properties.z)) ? Number(a.properties.z) : 0;
            const zb = Number.isFinite(Number(b.properties.z)) ? Number(b.properties.z) : 0;
            if (za !== zb) return za - zb;
            return String(a.id).localeCompare(String(b.id));
        };

        for (const [, group] of byParent) {
            group.sort(cmp);
            group.forEach((obj, i) => {
                obj.displayObject.zIndex = i;
            });
            const parent = group[0]?.displayObject?.parent;
            if (parent) {
                parent.sortableChildren = true;
                if (parent.sortChildren) parent.sortChildren();
            }
        }
    }

    applyToAllObjects() {
        const layerOrder = new Map(this.layers.map((l, i) => [l.id, i]));

        this.engine.gameObjects.forEach((obj) => {
            const lid = obj.properties.layerId || 'layer_default';
            if (!layerOrder.has(lid)) obj.properties.layerId = 'layer_default';
        });

        this.engine.gameObjects.forEach((obj) => {
            if (obj.parentId || !obj.displayObject) return;
            const layer = this.getLayer(obj.properties.layerId || 'layer_default');
            const target = layer?.fixed && this.engine.isRunning && this.engine.getScreenContainer
                ? this.engine.getScreenContainer()
                : this.engine.getWorldContainer();
            if (target && obj.displayObject.parent !== target) {
                target.addChild(obj.displayObject);
            }
        });

        LayerManager.assignZOrder(this.engine.gameObjects, { layers: this.layers });

        this.engine.gameObjects.forEach((obj) => {
            const lid = obj.properties.layerId || 'layer_default';
            const layer = this.getLayer(lid);
            if (layer) {
                obj.displayObject.visible = layer.visible !== false && !obj.properties.hidden;
                if (layer.locked) {
                    obj.displayObject.eventMode = 'none';
                } else if (!this.engine.isRunning) {
                    obj.displayObject.eventMode = obj.properties.locked ? 'none' : 'static';
                }
            }
        });
    }

    export() {
        return {
            layers: this.layers,
            activeLayerId: this.activeLayerId
        };
    }

    import(data) {
        if (!data || !Array.isArray(data.layers) || data.layers.length === 0) {
            this._initDefault();
            return;
        }
        this.layers = data.layers.map(l => ({
            id: l.id,
            name: l.name || 'Layer',
            visible: l.visible !== false,
            locked: !!l.locked,
            fixed: !!l.fixed
        }));
        this.activeLayerId = data.activeLayerId && this.getLayer(data.activeLayerId)
            ? data.activeLayerId
            : this.layers[0].id;
        this.applyToAllObjects();
    }
}

