import { Label } from 'cc';
import { GameMode, gameState } from './global_data';
import { formatTime } from './bottle_utils';

/**
 * 计时器控制器 —— 纯逻辑类
 * 负责：计时/倒计时、暂停/恢复、超时回调
 * 由外部组件通过 schedule 驱动 _tick()
 */
export class BottleTimerController {
    private _label: Label | null = null;
    private _elapsed = 0;
    private _isPaused = false;
    private _onTimeout: (() => void) | null = null;

    // ==================== 配置 ====================

    /** 绑定显示 Label，可选 */
    bindLabel(label: Label | null): void {
        this._label = label;
    }

    /** 超时回调（闯关模式倒计时归零时触发） */
    onTimeout(cb: (() => void) | null): void {
        this._onTimeout = cb;
    }

    /** 初始化：闯关模式需要初始倒计时值 */
    init(startSeconds: number): void {
        this._elapsed = startSeconds;
        this._refresh();
    }

    // ==================== 控制 ====================

    pause(): void { this._isPaused = true; }
    resume(): void { this._isPaused = false; }
    get isPaused(): boolean { return this._isPaused; }

    /** 重置计时（复活时调用） */
    reset(seconds: number): void {
        this._elapsed = seconds;
        this._refresh();
    }

    // ==================== 驱动 ====================

    /** 每秒调用一次（由组件 schedule 驱动） */
    tick(): void {
        if (this._isPaused) return;

        const mode = gameState.mode;

        // 闯关模式：倒计时归零 → 超时
        if (mode === GameMode.LevelClear && this._elapsed <= 0 && this._onTimeout) {
            this._onTimeout();
            return;
        }

        this._elapsed += (mode === GameMode.LevelClear) ? -1 : 1;
        this._refresh();
    }

    // ==================== 内部 ====================

    private _refresh(): void {
        if (this._label) this._label.string = formatTime(this._elapsed);
    }
}
