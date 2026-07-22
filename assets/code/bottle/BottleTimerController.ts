import { Label } from 'cc';
import { GameMode, gameState } from '../core/global_data';
import { Timer, formatTime } from '../core/Timer';

/**
 * 瓶子游戏计时控制器 —— 桥接层
 *
 * 委托通用 Timer 处理计时逻辑，自身负责：
 *  - Label 绑定与刷新
 *  - 根据 GameMode 决定正计时/倒计时
 */
export class BottleTimerController {
    private _label: Label | null = null;
    private _timer: Timer | null = null;
    private _onTimeout: (() => void) | null = null;

    // ==================== 配置 ====================

    bindLabel(label: Label | null): void {
        this._label = label;
    }

    onTimeout(cb: (() => void) | null): void {
        this._onTimeout = cb;
    }

    /** 初始化：闯关模式倒计时，否则正计时从 0 开始 */
    init(startSeconds: number): void {
        const mode = gameState.mode;
        if (mode === GameMode.LevelClear && startSeconds > 0) {
            this._timer = new Timer({
                mode: 'down',
                seconds: startSeconds,
                onTimeout: () => this._onTimeout?.(),
            });
        } else {
            this._timer = new Timer({ mode: 'up', seconds: 0 });
        }
        this._refresh();
    }

    // ==================== 控制 ====================

    pause(): void { this._timer?.pause(); }
    resume(): void { this._timer?.resume(); }
    get isPaused(): boolean { return this._timer?.isPaused ?? true; }

    reset(seconds: number): void {
        if (gameState.mode === GameMode.LevelClear) {
            this._timer = new Timer({
                mode: 'down', seconds,
                onTimeout: () => this._onTimeout?.(),
            });
        } else {
            this._timer?.reset(seconds);
        }
        this._refresh();
    }

    // ==================== 驱动 ====================

    tick(): void {
        this._timer?.tick();
        this._refresh();
    }

    // ==================== 内部 ====================

    private _refresh(): void {
        if (this._label && this._timer) {
            this._label.string = formatTime(this._timer.seconds);
        }
    }
}
