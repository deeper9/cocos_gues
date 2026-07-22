import { Node, Vec3, tween } from 'cc';
import { BottleData } from './bottle_types';

/** 洗牌动画回调 */
export interface ShuffleCallbacks {
    /** 全部轮次完成后触发 */
    onShuffleDone: () => void;
}

/** 洗牌单轮分阶段回调 */
export interface RoundCallbacks {
    /** 聚拢完成，即将散开 */
    onSpread: () => void;
}

/**
 * 洗牌动画器 —— 纯逻辑类
 *
 * 流程（每轮）：
 *   phase=Gather  瓶子向中心聚拢 (0.25s, quadIn)
 *   phase=Spread  随机打乱 worldPosition 后散开到新位置 (0.35s, quadOut)
 * 重复 3 轮。
 */
export class BottleShuffleAnimator {
    private _bottles: BottleData[];
    private _callbacks: ShuffleCallbacks;
    private _roundCallbacks: RoundCallbacks;
    private _round = 0;
    private readonly _totalRounds: number;
    private _centerX: number;
    private _spreadY: number;

    constructor(
        bottles: BottleData[],
        callbacks: ShuffleCallbacks,
        roundCallbacks: RoundCallbacks,
        rounds: number = 3,
    ) {
        this._bottles = bottles;
        this._callbacks = callbacks;
        this._roundCallbacks = roundCallbacks;
        this._totalRounds = rounds;
        // 中心 X 取所有瓶子 X 坐标平均值
        this._centerX = bottles.reduce((s, b) => s + b.worldPosition.x, 0) / bottles.length;
        this._spreadY = bottles[0]?.worldPosition.y ?? 650;
    }

    /** 启动洗牌 */
    start(): void {
        this._round = 0;
        this._runRound();
    }

    // ==================== 内部 ====================

    private _runRound(): void {
        if (this._round >= this._totalRounds) {
            this._callbacks.onShuffleDone();
            return;
        }
        this._round++;
        this._gather();
    }

    /** 聚拢 → 所有瓶子飞到中心 */
    private _gather(): void {
        const center = new Vec3(this._centerX, this._spreadY, 0);
        let done = 0;
        const total = this._bottles.length;

        for (const b of this._bottles) {
            tween(b.node)
                .to(0.25, { worldPosition: center }, { easing: 'quadIn' })
                .call(() => {
                    if (++done >= total) this._spread();
                })
                .start();
        }
    }

    /** 散开 → 随机打乱位置后飞到新位置 */
    private _spread(): void {
        // Fisher-Yates 随机打乱位置
        const positions = this._bottles.map(b =>
            new Vec3(b.worldPosition.x, b.worldPosition.y, 0),
        );
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        // 分配新位置并散开
        let done = 0;
        const total = this._bottles.length;
        for (let i = 0; i < this._bottles.length; i++) {
            const b = this._bottles[i];
            const target = positions[i];
            b.worldPosition = target;
            tween(b.node)
                .to(0.35, { worldPosition: new Vec3(target.x, this._spreadY, 0) }, { easing: 'quadOut' })
                .call(() => {
                    if (++done >= total) {
                        this._roundCallbacks.onSpread();
                        this._runRound();
                    }
                })
                .start();
        }
    }
}
