/**
 * 图层管理器（最小可用版）
 * - 维护 layer 列表（顺序/可见/锁定）
 * - 对象通过 properties.layerId 归属图层
 * - 根据图层顺序刷新 displayObject.zIndex（依赖 viewport.sortableChildren=true）
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
            locked: false
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
        this.layers.push({ id, name, visible: true, locked: false });
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

    applyToAllObjects() {
        // zIndex = layerOrder * big + withinLayerIndex
        const layerOrder = new Map(this.layers.map((l, i) => [l.id, i]));
        const perLayerCount = new Map();

        this.engine.gameObjects.forEach(obj => {
            const lid = obj.properties.layerId || 'layer_default';
            if (!layerOrder.has(lid)) obj.properties.layerId = 'layer_default';
        });

        this.engine.gameObjects.forEach(obj => {
            const lid = obj.properties.layerId || 'layer_default';
            const order = layerOrder.get(lid) ?? 0;
            const n = (perLayerCount.get(lid) ?? 0) + 1;
            perLayerCount.set(lid, n);

            obj.displayObject.zIndex = order * 10000 + n;

            const layer = this.getLayer(lid);
            if (layer) {
                // 图层可见性：与对象本身 visible 取与
                obj.displayObject.visible = layer.visible && obj.displayObject.visible !== false;
                // 图层锁定：禁用交互
                if (layer.locked) {
                    obj.displayObject.eventMode = 'none';
                } else if (!this.engine.isRunning) {
                    // 若对象自身锁定，交互仍禁用（由 ContextMenu 控制）
                    obj.displayObject.eventMode = obj.properties.locked ? 'none' : 'static';
                }
            }
        });

        const vp = this.engine.viewportController?.viewport;
        if (vp && vp.sortChildren) vp.sortChildren();
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
            locked: !!l.locked
        }));
        this.activeLayerId = data.activeLayerId && this.getLayer(data.activeLayerId)
            ? data.activeLayerId
            : this.layers[0].id;
        this.applyToAllObjects();
    }
}

