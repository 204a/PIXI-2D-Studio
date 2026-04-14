/**
 * 对齐管理器 - 对象智能对齐和分布
 */

import * as PIXI from 'pixi.js';

export class AlignmentManager {
    constructor(engine) {
        this.engine = engine;
        this.snapDistance = 5; // 吸附距离（像素）
        this.showGuides = true; // 显示辅助线
        this.guides = []; // 辅助线列表
        this.guideGraphics = null;
        this.snapEnabled = true; // 吸附开关
        
        this.init();
    }
    
    init() {
        // 创建辅助线图形对象
        this.guideGraphics = new PIXI.Graphics();
        this.guideGraphics.zIndex = 10000;
        const container = this.engine.viewportController ? 
            this.engine.viewportController.viewport : this.engine.app.stage;
        container.addChild(this.guideGraphics);
        
        // 监听 Shift 键来临时禁用吸附
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.snapEnabled = false;
                this.clearGuides();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.snapEnabled = true;
            }
        });
    }
    
    /**
     * 对齐选中对象 - 左对齐
     */
    alignLeft(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        // 找到最左边的x坐标
        const minX = Math.min(...objs.map(obj => obj.displayObject.x));
        
        objs.forEach(obj => {
            obj.displayObject.x = minX;
            obj.properties.x = minX;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('左对齐');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 对齐选中对象 - 右对齐
     */
    alignRight(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        // 找到最右边的x坐标
        const maxX = Math.max(...objs.map(obj => {
            const bounds = obj.displayObject.getBounds();
            return bounds.x + bounds.width;
        }));
        
        objs.forEach(obj => {
            const bounds = obj.displayObject.getBounds();
            const newX = obj.displayObject.x + (maxX - (bounds.x + bounds.width));
            obj.displayObject.x = newX;
            obj.properties.x = newX;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('右对齐');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 对齐选中对象 - 顶部对齐
     */
    alignTop(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        // 找到最上面的y坐标
        const minY = Math.min(...objs.map(obj => obj.displayObject.y));
        
        objs.forEach(obj => {
            obj.displayObject.y = minY;
            obj.properties.y = minY;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('顶部对齐');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 对齐选中对象 - 底部对齐
     */
    alignBottom(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        // 找到最下面的y坐标
        const maxY = Math.max(...objs.map(obj => {
            const bounds = obj.displayObject.getBounds();
            return bounds.y + bounds.height;
        }));
        
        objs.forEach(obj => {
            const bounds = obj.displayObject.getBounds();
            const newY = obj.displayObject.y + (maxY - (bounds.y + bounds.height));
            obj.displayObject.y = newY;
            obj.properties.y = newY;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('底部对齐');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 对齐选中对象 - 水平居中对齐
     */
    alignCenterHorizontal(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        // 计算所有对象的水平中心点
        const centers = objs.map(obj => {
            const bounds = obj.displayObject.getBounds();
            return bounds.x + bounds.width / 2;
        });
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        
        objs.forEach(obj => {
            const bounds = obj.displayObject.getBounds();
            const currentCenter = bounds.x + bounds.width / 2;
            const newX = obj.displayObject.x + (avgCenter - currentCenter);
            obj.displayObject.x = newX;
            obj.properties.x = newX;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('水平居中对齐');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 对齐选中对象 - 垂直居中对齐
     */
    alignCenterVertical(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        // 计算所有对象的垂直中心点
        const centers = objs.map(obj => {
            const bounds = obj.displayObject.getBounds();
            return bounds.y + bounds.height / 2;
        });
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        
        objs.forEach(obj => {
            const bounds = obj.displayObject.getBounds();
            const currentCenter = bounds.y + bounds.height / 2;
            const newY = obj.displayObject.y + (avgCenter - currentCenter);
            obj.displayObject.y = newY;
            obj.properties.y = newY;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('垂直居中对齐');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 水平分布对象
     */
    distributeHorizontal(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 3) return;
        
        // 按x坐标排序
        const sorted = [...objs].sort((a, b) => a.displayObject.x - b.displayObject.x);
        
        const firstX = sorted[0].displayObject.x;
        const lastBounds = sorted[sorted.length - 1].displayObject.getBounds();
        const lastX = lastBounds.x + lastBounds.width;
        const totalWidth = lastX - firstX;
        
        // 计算对象总宽度
        const objectsWidth = sorted.reduce((sum, obj) => {
            return sum + obj.displayObject.getBounds().width;
        }, 0);
        
        // 计算间距
        const gap = (totalWidth - objectsWidth) / (sorted.length - 1);
        
        let currentX = firstX;
        sorted.forEach((obj, index) => {
            if (index === 0) {
                currentX += obj.displayObject.getBounds().width;
                return;
            }
            if (index === sorted.length - 1) return;
            
            currentX += gap;
            const bounds = obj.displayObject.getBounds();
            const newX = obj.displayObject.x + (currentX - bounds.x);
            obj.displayObject.x = newX;
            obj.properties.x = newX;
            currentX += bounds.width;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('水平分布');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 垂直分布对象
     */
    distributeVertical(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 3) return;
        
        // 按y坐标排序
        const sorted = [...objs].sort((a, b) => a.displayObject.y - b.displayObject.y);
        
        const firstY = sorted[0].displayObject.y;
        const lastBounds = sorted[sorted.length - 1].displayObject.getBounds();
        const lastY = lastBounds.y + lastBounds.height;
        const totalHeight = lastY - firstY;
        
        // 计算对象总高度
        const objectsHeight = sorted.reduce((sum, obj) => {
            return sum + obj.displayObject.getBounds().height;
        }, 0);
        
        // 计算间距
        const gap = (totalHeight - objectsHeight) / (sorted.length - 1);
        
        let currentY = firstY;
        sorted.forEach((obj, index) => {
            if (index === 0) {
                currentY += obj.displayObject.getBounds().height;
                return;
            }
            if (index === sorted.length - 1) return;
            
            currentY += gap;
            const bounds = obj.displayObject.getBounds();
            const newY = obj.displayObject.y + (currentY - bounds.y);
            obj.displayObject.y = newY;
            obj.properties.y = newY;
            currentY += bounds.height;
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('垂直分布');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 匹配宽度（以第一个选中对象为准）
     */
    matchWidth(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        const targetWidth = objs[0].displayObject.getBounds().width;
        const targetScaleX = objs[0].displayObject.scale.x;
        
        objs.slice(1).forEach(obj => {
            const currentWidth = obj.displayObject.getBounds().width;
            const ratio = targetWidth / currentWidth;
            obj.displayObject.scale.x *= ratio;
            obj.properties.scaleX = obj.displayObject.scale.x;
            
            // 更新宽度属性（如果有）
            if (obj.properties.width !== undefined) {
                obj.properties.width = targetWidth;
            }
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('匹配宽度');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 匹配高度（以第一个选中对象为准）
     */
    matchHeight(objects = null) {
        const objs = objects || this.getSelectedObjects();
        if (objs.length < 2) return;
        
        const targetHeight = objs[0].displayObject.getBounds().height;
        
        objs.slice(1).forEach(obj => {
            const currentHeight = obj.displayObject.getBounds().height;
            const ratio = targetHeight / currentHeight;
            obj.displayObject.scale.y *= ratio;
            obj.properties.scaleY = obj.displayObject.scale.y;
            
            // 更新高度属性（如果有）
            if (obj.properties.height !== undefined) {
                obj.properties.height = targetHeight;
            }
        });
        
        // 更新变换控制器
        if (this.engine.transformControls) {
            this.engine.transformControls.updateTransform();
        }
        
        this.engine.historyManager.saveState('匹配高度');
        this.engine.onSceneChanged?.();
    }
    
    /**
     * 匹配大小（宽度和高度）
     */
    matchSize(objects = null) {
        this.matchWidth(objects);
        this.matchHeight(objects);
        
        // 只保存一次历史（matchWidth 和 matchHeight 已各自保存了）
        // 覆盖最后的历史记录标题
        this.engine.historyManager.saveState('匹配大小');
    }
    
    /**
     * 智能吸附 - 拖动时自动对齐到其他对象
     */
    snapToObjects(movingObject, otherObjects = null) {
        // 如果禁用吸附或按住Shift键，不进行吸附
        if (!this.showGuides || !this.snapEnabled) return null;
        
        const others = otherObjects || this.engine.gameObjects.filter(obj => 
            obj !== movingObject && obj.displayObject.visible
        );
        
        if (others.length === 0) return null;
        
        const movingBounds = movingObject.displayObject.getBounds();
        const movingCenterX = movingBounds.x + movingBounds.width / 2;
        const movingCenterY = movingBounds.y + movingBounds.height / 2;
        
        this.guides = [];
        let snapX = null;
        let snapY = null;
        let minDistX = this.snapDistance;
        let minDistY = this.snapDistance;
        
        // 检查每个其他对象
        for (const other of others) {
            const otherBounds = other.displayObject.getBounds();
            const otherCenterX = otherBounds.x + otherBounds.width / 2;
            const otherCenterY = otherBounds.y + otherBounds.height / 2;
            
            // 检查水平对齐 - 左边对齐
            const leftDiff = Math.abs(movingBounds.x - otherBounds.x);
            if (leftDiff < minDistX && leftDiff > 0.01) {
                minDistX = leftDiff;
                snapX = other.displayObject.x;
                this.guides = this.guides.filter(g => g.type !== 'vertical');
                this.guides.push({ type: 'vertical', x: otherBounds.x });
            }
            
            // 右边对齐
            const rightDiff = Math.abs((movingBounds.x + movingBounds.width) - (otherBounds.x + otherBounds.width));
            if (rightDiff < minDistX && rightDiff > 0.01) {
                minDistX = rightDiff;
                snapX = other.displayObject.x + (otherBounds.width - movingBounds.width);
                this.guides = this.guides.filter(g => g.type !== 'vertical');
                this.guides.push({ type: 'vertical', x: otherBounds.x + otherBounds.width });
            }
            
            // 水平居中对齐
            const centerXDiff = Math.abs(movingCenterX - otherCenterX);
            if (centerXDiff < minDistX && centerXDiff > 0.01) {
                minDistX = centerXDiff;
                const offset = movingObject.displayObject.x - movingBounds.x;
                snapX = otherCenterX - movingBounds.width / 2 + offset;
                this.guides = this.guides.filter(g => g.type !== 'vertical');
                this.guides.push({ type: 'vertical', x: otherCenterX });
            }
            
            // 检查垂直对齐 - 顶部对齐
            const topDiff = Math.abs(movingBounds.y - otherBounds.y);
            if (topDiff < minDistY && topDiff > 0.01) {
                minDistY = topDiff;
                snapY = other.displayObject.y;
                this.guides = this.guides.filter(g => g.type !== 'horizontal');
                this.guides.push({ type: 'horizontal', y: otherBounds.y });
            }
            
            // 底部对齐
            const bottomDiff = Math.abs((movingBounds.y + movingBounds.height) - (otherBounds.y + otherBounds.height));
            if (bottomDiff < minDistY && bottomDiff > 0.01) {
                minDistY = bottomDiff;
                snapY = other.displayObject.y + (otherBounds.height - movingBounds.height);
                this.guides = this.guides.filter(g => g.type !== 'horizontal');
                this.guides.push({ type: 'horizontal', y: otherBounds.y + otherBounds.height });
            }
            
            // 垂直居中对齐
            const centerYDiff = Math.abs(movingCenterY - otherCenterY);
            if (centerYDiff < minDistY && centerYDiff > 0.01) {
                minDistY = centerYDiff;
                const offset = movingObject.displayObject.y - movingBounds.y;
                snapY = otherCenterY - movingBounds.height / 2 + offset;
                this.guides = this.guides.filter(g => g.type !== 'horizontal');
                this.guides.push({ type: 'horizontal', y: otherCenterY });
            }
        }
        
        this.drawGuides();
        
        return { snapX, snapY };
    }
    
    /**
     * 绘制辅助线
     */
    drawGuides() {
        if (!this.guideGraphics) return;
        
        this.guideGraphics.clear();
        
        if (!this.showGuides || this.guides.length === 0) return;
        
        this.guideGraphics.lineStyle(1, 0xFF00FF, 0.8);
        
        const viewport = this.engine.viewportController ? this.engine.viewportController.viewport : null;
        const bounds = viewport ? viewport.getLocalBounds() : this.engine.app.screen;
        
        this.guides.forEach(guide => {
            if (guide.type === 'vertical') {
                this.guideGraphics.moveTo(guide.x, bounds.y);
                this.guideGraphics.lineTo(guide.x, bounds.y + bounds.height);
            } else {
                this.guideGraphics.moveTo(bounds.x, guide.y);
                this.guideGraphics.lineTo(bounds.x + bounds.width, guide.y);
            }
        });
    }
    
    /**
     * 清除辅助线
     */
    clearGuides() {
        this.guides = [];
        if (this.guideGraphics) {
            this.guideGraphics.clear();
        }
    }
    
    /**
     * 获取选中的对象
     */
    getSelectedObjects() {
        if (this.engine.selectionManager && this.engine.selectionManager.selectedObjects.length > 0) {
            return this.engine.selectionManager.selectedObjects;
        }
        if (this.engine.selectedObject) {
            return [this.engine.selectedObject];
        }
        return [];
    }
}
