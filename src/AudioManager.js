/**
 * 音频管理：音效（可多实例）、背景音乐（单轨）、音量与淡入淡出
 */

export class AudioManager {
    constructor(engine) {
        this.engine = engine;
        this.masterVolume = 1;
        this.musicVolume = 0.7;
        this.sfxVolume = 1;
        /** @type {HTMLAudioElement|null} */
        this._musicEl = null;
        this._musicFadeToken = 0;
        /** @type {{ audio: HTMLAudioElement, onEnd: () => void }[]} */
        this._activeSounds = [];
    }

    _effectiveMusicVol(base = 1) {
        return Math.max(0, Math.min(1, this.masterVolume * this.musicVolume * base));
    }

    _effectiveSfxVol(base = 1) {
        return Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume * base));
    }

    getUrl(name) {
        return this.engine.resourceManager.getAudioUrl(name);
    }

    /**
     * 播放音效（可同时多个）
     * @param {string} name 资源名（与上传文件名一致）
     * @param {{ volume?: number, loop?: boolean, playbackRate?: number }} params
     */
    playSound(name, params = {}) {
        const url = this.getUrl(name);
        if (!url) {
            console.warn('[AudioManager] 未找到音频:', name);
            return;
        }
        const audio = new Audio(url);
        const vol = params.volume !== undefined ? params.volume : 1;
        audio.volume = this._effectiveSfxVol(vol);
        audio.loop = !!params.loop;
        audio.playbackRate = params.playbackRate !== undefined ? params.playbackRate : 1;

        const onEnd = () => this._removeSound(audio);
        audio.addEventListener('ended', onEnd);

        this._activeSounds.push({ audio, onEnd });
        audio.play().catch((e) => console.warn('[AudioManager] playSound:', e.message));
    }

    _removeSound(audio) {
        const idx = this._activeSounds.findIndex((x) => x.audio === audio);
        if (idx >= 0) {
            const { onEnd } = this._activeSounds[idx];
            audio.removeEventListener('ended', onEnd);
            this._activeSounds.splice(idx, 1);
        }
    }

    stopAllSounds() {
        this._activeSounds.forEach(({ audio, onEnd }) => {
            audio.removeEventListener('ended', onEnd);
            audio.pause();
            audio.currentTime = 0;
        });
        this._activeSounds = [];
    }

    /**
     * 背景音乐（单轨，新播放会停掉上一首）
     * @param {string} name
     * @param {{ volume?: number, loop?: boolean, fadeIn?: number }} params fadeIn 秒
     */
    playMusic(name, params = {}) {
        const url = this.getUrl(name);
        if (!url) {
            console.warn('[AudioManager] 未找到音乐:', name);
            return;
        }

        this._musicFadeToken += 1;
        const token = this._musicFadeToken;

        if (this._musicEl) {
            this._musicEl.pause();
            this._musicEl = null;
        }

        const audio = new Audio(url);
        audio.loop = params.loop !== undefined ? params.loop : true;
        const targetVol = this._effectiveMusicVol(params.volume !== undefined ? params.volume : 0.7);
        const fadeIn = Math.max(0, params.fadeIn || 0);

        if (fadeIn > 0) {
            audio.volume = 0;
        } else {
            audio.volume = targetVol;
        }
        this._musicEl = audio;
        audio.play().catch((e) => console.warn('[AudioManager] playMusic:', e.message));

        if (fadeIn > 0) {
            const t0 = performance.now();
            const step = (now) => {
                if (token !== this._musicFadeToken || !this._musicEl || this._musicEl !== audio) return;
                const t = Math.min(1, (now - t0) / (fadeIn * 1000));
                audio.volume = targetVol * t;
                if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }
    }

    /**
     * @param {number} fadeOut 秒，0 为立即停止
     */
    stopMusic(fadeOut = 0) {
        this._musicFadeToken += 1;
        const token = this._musicFadeToken;
        const el = this._musicEl;
        if (!el) return;

        if (fadeOut <= 0) {
            el.pause();
            el.currentTime = 0;
            this._musicEl = null;
            return;
        }

        const startVol = el.volume;
        const t0 = performance.now();
        const step = (now) => {
            if (token !== this._musicFadeToken || !this._musicEl || this._musicEl !== el) return;
            const t = Math.min(1, (now - t0) / (fadeOut * 1000));
            el.volume = startVol * (1 - t);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                el.pause();
                el.currentTime = 0;
                if (this._musicEl === el) this._musicEl = null;
            }
        };
        requestAnimationFrame(step);
    }

    pauseMusic() {
        if (this._musicEl) this._musicEl.pause();
    }

    resumeMusic() {
        if (this._musicEl) this._musicEl.play().catch(() => {});
    }

    setMasterVolume(v) {
        this.masterVolume = Math.max(0, Math.min(1, v));
        this._syncMusicVolume();
    }

    setMusicVolume(v) {
        this.musicVolume = Math.max(0, Math.min(1, v));
        this._syncMusicVolume();
    }

    setSfxVolume(v) {
        this.sfxVolume = Math.max(0, Math.min(1, v));
    }

    _syncMusicVolume() {
        if (!this._musicEl) return;
        // 无法还原用户设置的相对音量，仅按当前 effective 重算近似值
        this._musicEl.volume = this._effectiveMusicVol(1);
    }

    /** 停止运行/清空时调用 */
    stopAll() {
        this.stopMusic(0);
        this.stopAllSounds();
    }
}
