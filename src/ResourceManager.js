import * as PIXI from 'pixi.js';

/**
 * 资源管理器
 */

export class ResourceManager {
    constructor() {
        this.textures = new Map();
        this.loadedImages = new Map();
        /** @type {Map<string, string>} 名称 -> dataURL 或 URL */
        this.audioClips = new Map();
        /** @type {Map<string, string>} 字体显示名 -> CSS font-family 字符串（已加载） */
        this.fonts = new Map();
    }
    
    /**
     * 从URL加载图片
     */
    async loadImageFromURL(url, name) {
        try {
            // 如果是Data URL，使用BaseTexture.from
            if (url.startsWith('data:')) {
                const texture = PIXI.Texture.from(url);
                this.textures.set(name, texture);
                this.loadedImages.set(name, url);
                return texture;
            }
            
            // 普通URL使用Assets加载
            const texture = await PIXI.Assets.load(url);
            this.textures.set(name, texture);
            this.loadedImages.set(name, url);
            return texture;
        } catch (error) {
            console.error('加载图片失败:', error);
            return null;
        }
    }
    
    /**
     * 从文件加载图片
     */
    async loadImageFromFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const url = e.target.result;
                const name = file.name;
                const texture = await this.loadImageFromURL(url, name);
                resolve({ name, texture, url });
            };
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * 获取纹理
     */
    getTexture(name) {
        return this.textures.get(name);
    }
    
    /**
     * 获取所有资源
     */
    getAllResources() {
        return Array.from(this.loadedImages.entries()).map(([name, url]) => ({
            name,
            url,
            texture: this.textures.get(name)
        }));
    }

    /**
     * 注册或加载音频（dataURL / http URL）
     */
    loadAudioFromURL(url, name) {
        this.audioClips.set(name, url);
        return url;
    }

    /**
     * 从本地文件读取为 dataURL 并注册
     */
    async loadAudioFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const url = reader.result;
                const name = file.name;
                this.audioClips.set(name, url);
                resolve({ name, url });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    getAudioUrl(name) {
        return this.audioClips.get(name);
    }

    getAllAudioResources() {
        return Array.from(this.audioClips.entries()).map(([name, url]) => ({ name, url }));
    }

    removeAudio(name) {
        this.audioClips.delete(name);
    }
    
    /**
     * 删除资源
     */
    removeResource(name) {
        const texture = this.textures.get(name);
        if (texture) {
            texture.destroy(true);
        }
        this.textures.delete(name);
        this.loadedImages.delete(name);
    }
    
    /**
     * 清空所有资源
     */
    clearAll() {
        this.textures.forEach(texture => texture.destroy(true));
        this.textures.clear();
        this.loadedImages.clear();
        this.audioClips.clear();
        this.fonts.clear();
    }

    /**
     * 加载本地字体文件（ttf/otf/woff），注册为可用 fontFamily
     */
    async loadFontFromFile(file) {
        const base = file.name.replace(/\.[^.]+$/, '');
        const family = `SGEFont_${base.replace(/\W/g, '_')}_${Date.now().toString(36)}`;
        const buf = await file.arrayBuffer();
        const face = new FontFace(family, buf);
        await face.load();
        document.fonts.add(face);
        this.fonts.set(file.name, family);
        return { name: file.name, family };
    }

    getFontFamily(fileName) {
        return this.fonts.get(fileName);
    }

    listFonts() {
        return Array.from(this.fonts.entries()).map(([name, family]) => ({ name, family }));
    }
}

