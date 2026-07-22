import { Node, UITransform, Vec3, tween } from 'cc';
import { BottleData } from './bottle_types';

const SCALE_SMALL = new Vec3(0.6, 0.6, 1);
const ENTRANCE_INTERVAL = 0.15;

/** 入场动画回调 */
export interface EntranceCallbacks {
    /** 每有一个瓶子飞到中央后触发 */
    onBottleArrived: () => void;
}

/**
 * 入场动画器 —— 瓶子从两端交替飞到屏幕中央
 */
export class BottleEntranceAnimator {
    private _bottles: BottleData[];
    private _bgNode: Node;
    private _callbacks: EntranceCallbacks;

    private _done = true;
    private _leftIdx = 0;
    private _rightIdx = 0;
    private _stepCount = 0;
    private _accum = 0;

    constructor(
        bottles: BottleData[],
        bgNode: Node,
        callbacks: EntranceCallbacks,
    ) {
        this._bottles = bottles;
        this._bgNode = bgNode;
        this._callbacks = callbacks;
    }

    /** 启动动画 */
    start(): void {
        this._done = false;
        this._leftIdx = 0;
        this._rightIdx = this._bottles.length - 1;
        this._stepCount = 0;
        this._accum = 0;
    }

    get isDone(): boolean { return this._done; }

    /** 每帧调用 */
    update(dt: number): void {
        if (this._done) return;

        this._accum += dt;
        if (this._accum < ENTRANCE_INTERVAL) return;
        this._accum -= ENTRANCE_INTERVAL;

        if (this._leftIdx > this._rightIdx) {
            this._done = true;
            return;
        }

        if (this._leftIdx === this._rightIdx) {
            this._flyOne(this._leftIdx);
            this._done = true;
            return;
        }

        const fromRight = this._stepCount % 2 !== 0;
        if (fromRight) {
            this._flyOne(this._rightIdx);
            this._rightIdx--;
        } else {
            this._flyOne(this._leftIdx);
            this._leftIdx++;
        }
        this._stepCount++;
    }

    private _flyOne(index: number): void {
        if (index >= this._bottles.length) return;

        const bgWidth = this._bgNode.getComponent(UITransform)!.contentSize.width;
        const bottleWidth = this._bottles[index].node.getComponent(UITransform)!.contentSize.width;
        const targetPos = new Vec3((bgWidth - bottleWidth) / 2, 300, 0);

        tween(this._bottles[index].node)
            .to(0.3, { worldPosition: targetPos, scale: SCALE_SMALL }, { easing: 'quadOut' })
            .call(() => {
                this._bottles[index].worldPosition = targetPos;
                this._bottles[index].node.setSiblingIndex(999);
                this._callbacks.onBottleArrived();
            })
            .start();
    }
}
