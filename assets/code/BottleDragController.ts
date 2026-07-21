import {
    Node, UITransform, Vec2, Vec3, EventTouch, tween,
} from 'cc';
import { BottleData, ContainerData } from './bottle_types';
import { isOverlapGreaterThan } from './bottle_utils';

// ========== 常量 ==========
const SCALE_NORMAL = new Vec3(1, 1, 1);
const SCALE_HIGHLIGHT = new Vec3(1.15, 1.15, 1);
const OFF_SCREEN = new Vec3(-1000, -1000, 0);
/** 拖拽悬停时被置换瓶子的上浮高度（视觉提示"将被交换"） */
const LIFT_HINT = 30;

/** 拖拽控制器对外回调 */
export interface DragCallbacks {
    /** 瓶子被放入容器时触发 */
    onBottlePlaced: () => void;
}

/**
 * 瓶子拖拽控制器 —— 纯逻辑类，不依赖 @ccclass
 * 负责：拖拽跟随、碰撞检测、放置判定、交换动画
 */
export class BottleDragController {
    // --- 注入依赖 ---
    private _bottles: BottleData[];
    private _containers: ContainerData[];
    private _globalEventTarget: Node;
    private _callbacks: DragCallbacks;

    // --- 内部状态 ---
    private _dragBottle: BottleData | null = null;
    private _isDragging = false;
    private _dragOffset = new Vec2(0, 0);
    /** 上次 _onDragMove 检测到的悬停容器（松开时直接复用，更可靠） */
    private _lastHovered: ContainerData | null = null;
    /** 外部锁定（洗牌期间禁止拖拽） */
    locked = false;

    constructor(
        bottles: BottleData[],
        containers: ContainerData[],
        eventTarget: Node,
        callbacks: DragCallbacks,
    ) {
        this._bottles = bottles;
        this._containers = containers;
        this._globalEventTarget = eventTarget;
        this._callbacks = callbacks;
    }

    // ==================== 生命周期 ====================

    /** 注册瓶子节点上的触摸事件（由外部在 init 时调用） */
    registerBottleEvents(): void {
        for (const bottle of this._bottles) {
            bottle.node.on(Node.EventType.TOUCH_START, this._onDragStart, this);
        }
    }

    /** 注册容器节点上的点击事件 */
    registerContainerEvents(onTap: (container: ContainerData) => void): void {
        for (const container of this._containers) {
            container.ctr.on(Node.EventType.TOUCH_END, () => onTap(container), this);
        }
    }

    /** 清理全局事件 */
    destroy(): void {
        this._unbindGlobalEvents();
        for (const bottle of this._bottles) {
            bottle.node.off(Node.EventType.TOUCH_START, this._onDragStart, this);
        }
        for (const container of this._containers) {
            container.ctr.off(Node.EventType.TOUCH_END);
        }
    }

    // ==================== 拖拽事件 ====================

    private _onDragStart(event: EventTouch): void {
        if (this.locked) return;

        for (const bottle of this._bottles) {
            if (bottle.node === event.currentTarget) {
                this._dragBottle = bottle;
                break;
            }
        }
        if (!this._dragBottle) return;

        this._isDragging = true;
        this._lastHovered = null;

        // 选中放大提示
        this._dragBottle.node.setScale(SCALE_HIGHLIGHT);

        this._dragBottle.node.setSiblingIndex(999);

        // 记录触摸偏移
        const uiLoc = event.getUILocation();
        const localPos = this._dragBottle.node
            .getComponent(UITransform)!
            .convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0));
        this._dragOffset.set(localPos.x, localPos.y);

        this._globalEventTarget.on(Node.EventType.TOUCH_MOVE, this._onDragMove, this);
        this._globalEventTarget.on(Node.EventType.TOUCH_END, this._onDragEnd, this);
        this._globalEventTarget.on(Node.EventType.TOUCH_CANCEL, this._onDragEnd, this);
    }

    private _onDragMove(event: EventTouch): void {
        if (!this._isDragging || !this._dragBottle) return;

        const uiLoc = event.getUILocation();
        const parent = this._dragBottle.node.parent!;
        const parentUI = parent.getComponent(UITransform)!;
        const localPos = parentUI.convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0));
        this._dragBottle.node.setPosition(localPos.x - this._dragOffset.x, localPos.y - this._dragOffset.y);

        const target = this._findHoveredContainer();
        this._lastHovered = target;

        // 更新所有容器的视觉状态
        for (const container of this._containers) {
            if (container === target) {
                // 拖拽瓶子的半透明副本显示在目标容器上
                const cPos = container.cctr.getWorldPosition();
                this._dragBottle.opacityNode.setWorldPosition(cPos);
                // 目标容器有瓶子 → 上浮提示将被交换
                if (container.curBottle && container.curBottle !== this._dragBottle) {
                    container.curBottle.node.setWorldPosition(cPos.x, cPos.y + LIFT_HINT, 0);
                } else if (!container.curBottle) {
                    // 空容器：检查起始区是否有瓶子占据此坐标
                    const blocker = this._findStartBottleAt(cPos);
                    if (blocker && blocker !== this._dragBottle) {
                        blocker.node.setWorldPosition(cPos.x, cPos.y + LIFT_HINT, 0);
                    }
                }
            } else if (container.curBottle === this._dragBottle) {
                this._dragBottle.opacityNode.setWorldPosition(OFF_SCREEN);
            } else if (container.curBottle) {
                container.curBottle.node.setWorldPosition(container.curBottle.container!.cctr.getWorldPosition());
            }
        }

        // 拖离后：让先前被上浮的起始区瓶子回归原位
        for (const b of this._bottles) {
            if (b.container || b === this._dragBottle) continue;
            const isBlocked = target && this._findStartBottleAt(target.cctr.getWorldPosition()) === b;
            if (!isBlocked) {
                b.node.setWorldPosition(b.worldPosition.x, b.worldPosition.y, 0);
            }
        }
    }

    private _onDragEnd(_event: EventTouch): void {
        if (!this._isDragging || !this._dragBottle) {
            this._isDragging = false;
            this._unbindGlobalEvents();
            return;
        }

        this._isDragging = false;
        const target = this._lastHovered;

        if (target) {
            this._handlePlacement(target);
        } else {
            this._returnToOrigin();
        }

        this._unbindGlobalEvents();
        this._dragBottle = null;
    }

    private _unbindGlobalEvents(): void {
        this._globalEventTarget.off(Node.EventType.TOUCH_MOVE, this._onDragMove, this);
        this._globalEventTarget.off(Node.EventType.TOUCH_END, this._onDragEnd, this);
        this._globalEventTarget.off(Node.EventType.TOUCH_CANCEL, this._onDragEnd, this);
    }

    // ==================== 放置逻辑 ====================

    private _handlePlacement(target: ContainerData): void {
        const bottle = this._dragBottle!;

        // 空容器 → 检查起始区是否有瓶子占据此位置
        if (!target.curBottle) {
            const blocker = this._findStartBottleAt(target.cctr.getWorldPosition());
            if (blocker && blocker !== bottle) {
                this._swapStartBottleInto(target, blocker);
            } else {
                this._placeInto(target);
            }
            return;
        }

        // 同一容器 → 归位到容器中心
        if (target.curBottle === bottle) {
            const pos = target.cctr.getWorldPosition();
            tween(bottle.node)
                .to(0.15, { worldPosition: pos, scale: SCALE_NORMAL })
                .call(() => bottle.opacityNode.setWorldPosition(OFF_SCREEN))
                .start();
            return;
        }

        // 交换
        if (!bottle.container) {
            this._swapFromStart(target);
        } else {
            this._swapBoth(target);
        }

        this._callbacks.onBottlePlaced();
    }

    /** 放入空容器 */
    private _placeInto(container: ContainerData): void {
        const bottle = this._dragBottle!;
        if (bottle.container) bottle.container.curBottle = null;

        const pos = container.cctr.getWorldPosition();
        bottle.node.setWorldPosition(pos);
        bottle.worldPosition = pos;
        bottle.container = container;
        container.curBottle = bottle;
        bottle.node.setScale(SCALE_NORMAL);
        bottle.opacityNode.setWorldPosition(OFF_SCREEN);

        this._callbacks.onBottlePlaced();
    }

    /** 起始区瓶子与容器瓶子交换 */
    private _swapFromStart(target: ContainerData): void {
        const bottle = this._dragBottle!;
        const displaced = target.curBottle!;

        // 先保存旧位置，再覆盖 bottle.worldPosition
        const oldPos = new Vec3(bottle.worldPosition.x, bottle.worldPosition.y, 0);

        bottle.worldPosition = target.cctr.getWorldPosition();
        bottle.node.setWorldPosition(bottle.worldPosition);
        bottle.container = target;
        target.curBottle = bottle;
        bottle.node.setScale(SCALE_NORMAL);
        bottle.opacityNode.setWorldPosition(OFF_SCREEN);

        // 被置换瓶子抛物线飞到旧位置
        const startPos = displaced.node.getWorldPosition();
        tween(displaced.node)
            .to(0.4, {}, {
                onUpdate: (_target: Node, ratio: number) => {
                    const x = startPos.x + (oldPos.x - startPos.x) * ratio;
                    const y = startPos.y + (-180 * (ratio * ratio - ratio));
                    displaced.node.setWorldPosition(x, y, 0);
                },
            })
            .call(() => {
                displaced.node.setWorldPosition(oldPos);
                displaced.container = null;
                displaced.worldPosition = oldPos;
                displaced.opacityNode.setWorldPosition(OFF_SCREEN);
            })
            .start();
    }

    /** 两个容器中的瓶子互换（抛物线动画） */
    private _swapBoth(target: ContainerData): void {
        const bottle = this._dragBottle!;
        const oldContainer = bottle.container!;
        const displaced = target.curBottle!;

        displaced.container = oldContainer;
        displaced.worldPosition = bottle.worldPosition;
        const startPos = displaced.node.getWorldPosition();
        const endPos = bottle.worldPosition;

        tween(displaced.node)
            .to(0.5, {}, {
                onUpdate: (_target: Node, ratio: number) => {
                    const x = startPos.x + (endPos.x - startPos.x) * ratio;
                    const y = startPos.y + (-200 * (ratio * ratio - ratio));
                    displaced.node.setWorldPosition(x, y, 0);
                },
            })
            .call(() => {
                displaced.node.setWorldPosition(endPos);
                displaced.node.setSiblingIndex(888);
                oldContainer.curBottle = displaced;
                // 置换完成后，两个瓶子都在容器上，透明度副本均隐藏
                displaced.opacityNode.setWorldPosition(OFF_SCREEN);
            })
            .start();

        bottle.container = target;
        bottle.worldPosition = target.cctr.getWorldPosition();
        bottle.node.setWorldPosition(bottle.worldPosition);
        target.curBottle = bottle;
        bottle.node.setScale(SCALE_NORMAL);
        bottle.opacityNode.setWorldPosition(OFF_SCREEN);
    }

    /** 未放入容器 → 回归原位 */
    private _returnToOrigin(): void {
        const bottle = this._dragBottle!;

        tween(bottle.node)
            .to(0.2, { worldPosition: bottle.worldPosition, scale: SCALE_NORMAL })
            .call(() => bottle.opacityNode.setWorldPosition(OFF_SCREEN))
            .start();
    }

    // ==================== 碰撞检测 ====================

    /** 找出起始区（container === null）中位于指定坐标的瓶子 */
    private _findStartBottleAt(pos: Vec3): BottleData | null {
        const EPS = 2; // 浮点容差
        for (const b of this._bottles) {
            if (b.container) continue;
            const bp = b.worldPosition;
            if (Math.abs(bp.x - pos.x) < EPS && Math.abs(bp.y - pos.y) < EPS) {
                return b;
            }
        }
        return null;
    }

    /** 拖拽瓶子放入空容器，并把占据该位置起始区瓶子挤到 dragBottle 旧位置 */
    private _swapStartBottleInto(target: ContainerData, blocker: BottleData): void {
        const bottle = this._dragBottle!;
        const oldPos = new Vec3(bottle.worldPosition.x, bottle.worldPosition.y, 0);

        // 清理旧容器
        if (bottle.container) bottle.container.curBottle = null;

        // 拖拽瓶子放入目标
        const targetPos = target.cctr.getWorldPosition();
        bottle.worldPosition = targetPos;
        bottle.node.setWorldPosition(targetPos);
        bottle.container = target;
        target.curBottle = bottle;
        bottle.node.setScale(SCALE_NORMAL);
        bottle.opacityNode.setWorldPosition(OFF_SCREEN);

        // 起始区瓶子抛物线飞到旧位置
        const startPos = blocker.node.getWorldPosition();
        tween(blocker.node)
            .to(0.4, {}, {
                onUpdate: (_target: Node, ratio: number) => {
                    const x = startPos.x + (oldPos.x - startPos.x) * ratio;
                    const y = startPos.y + (-180 * (ratio * ratio - ratio));
                    blocker.node.setWorldPosition(x, y, 0);
                },
            })
            .call(() => {
                blocker.node.setWorldPosition(oldPos);
                blocker.worldPosition = oldPos;
                blocker.opacityNode.setWorldPosition(OFF_SCREEN);
            })
            .start();

        this._callbacks.onBottlePlaced();
    }

    private _getThreshold(): number {
        if (!this._dragBottle) return 0;
        const size = this._dragBottle.node.getComponent(UITransform)!.contentSize;
        return size.width * size.height / 2;
    }

    private _findHoveredContainer(): ContainerData | null {
        for (const container of this._containers) {
            if (isOverlapGreaterThan(container.cctr, this._dragBottle!.node, this._getThreshold())) {
                return container;
            }
        }
        return null;
    }
}
