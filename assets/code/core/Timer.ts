/**
 * Timer —— 通用纯逻辑定时器
 *
 * 不依赖任何 Cocos 组件，整个工程可直接使用。
 * 外部通过 tick() 驱动（通常每秒调用一次）。
 *
 * 使用示例：
 *   const t = new Timer({ mode: 'down', seconds: 120, onTimeout: () => alert('time up') });
 *   schedule(() => t.tick(), 1);  // Cocos 驱动
 *   t.pause(); t.resume(); t.addSeconds(30);
 */

// ========== 时间格式化 ==========

/** 秒数 → MM:SS 字符串 */
export function formatTime(totalSeconds: number): string {
    const clamped = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ========== 类型 ==========

export type TimerMode = 'up' | 'down';

export interface TimerOptions {
    /** 计时方向：'up' 正计时 / 'down' 倒计时，默认 'up' */
    mode?: TimerMode;
    /** 初始秒数，默认 0 */
    seconds?: number;
    /** 倒计时归零时回调（仅 mode='down' 有效） */
    onTimeout?: () => void;
}

// ========== Timer ==========

export class Timer {
    private _seconds: number;
    private _mode: TimerMode;
    private _paused = false;
    private _onTimeout: (() => void) | null = null;
    /** 是否已触发过超时（避免重复回调） */
    private _timeoutFired = false;

    constructor(options: TimerOptions = {}) {
        this._mode = options.mode ?? 'up';
        this._seconds = options.seconds ?? 0;
        this._onTimeout = options.onTimeout ?? null;
    }

    // ---- 属性 ----

    get seconds(): number { return this._seconds; }
    get isPaused(): boolean { return this._paused; }
    /** 倒计时归零时为 true */
    get isDone(): boolean { return this._mode === 'down' && this._seconds <= 0; }

    // ---- 控制 ----

    /** 重新开始 */
    reset(seconds: number, onTimeout?: () => void): void {
        this._seconds = seconds;
        this._paused = false;
        this._timeoutFired = false;
        if (onTimeout !== undefined) this._onTimeout = onTimeout;
    }

    /** 新增 N 秒（倒计时加时间，正计时也支持但语义略奇怪） */
    addSeconds(n: number): void {
        this._seconds += n;
        if (this._seconds > 0) this._timeoutFired = false;
    }

    pause(): void { this._paused = true; }
    resume(): void { this._paused = false; }

    // ---- 驱动 ----

    /** 推进一帧（外部决定调用频率，通常每秒一次） */
    tick(): void {
        if (this._paused) return;

        if (this._mode === 'down') {
            if (this._seconds <= 0) {
                if (!this._timeoutFired && this._onTimeout) {
                    this._timeoutFired = true;
                    this._onTimeout();
                }
                return;
            }
            this._seconds--;
            // 归零时立刻停在 00:00，触发回调
            if (this._seconds <= 0) {
                this._seconds = 0;
                if (this._onTimeout) {
                    this._timeoutFired = true;
                    this._onTimeout();
                }
            }
        } else {
            this._seconds++;
        }
    }
}
