import { Node, UITransform, Vec3, Rect } from 'cc';

// ========== 随机选取工具 ==========

export class RandomPicker {
    /** 从列表中随机取出一个元素并从原列表中移除 */
    static pickOne<T>(list: T[]): T | null {
        if (list.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * list.length);
        return list.splice(randomIndex, 1)[0];
    }

    /** 随机获取列表中所有元素，返回随机顺序的新列表（不修改原列表） */
    static pickAll<T>(list: T[]): T[] {
        const copyList = [...list];
        const result: T[] = [];
        while (copyList.length > 0) {
            const item = this.pickOne(copyList);
            if (item) result.push(item);
        }
        return result;
    }
}

// ========== 碰撞检测工具 ==========

/** 计算节点在世界坐标系中的矩形区域（左下角为原点） */
export function getWorldRect(node: Node): Rect {
    const uiTrans = node.getComponent(UITransform);
    if (!uiTrans) return new Rect(0, 0, 0, 0);

    const worldPos = new Vec3();
    node.getWorldPosition(worldPos);

    const anchorX = uiTrans.anchorX;
    const anchorY = uiTrans.anchorY;
    const offsetX = -anchorX * uiTrans.width;
    const offsetY = -anchorY * uiTrans.height;

    return new Rect(
        worldPos.x + offsetX,
        worldPos.y + offsetY,
        uiTrans.width,
        uiTrans.height
    );
}

/** 计算两个矩形的交集 */
export function getRectIntersection(rectA: Rect, rectB: Rect): Rect | null {
    const left = Math.max(rectA.x, rectB.x);
    const bottom = Math.max(rectA.y, rectB.y);
    const right = Math.min(rectA.x + rectA.width, rectB.x + rectB.width);
    const top = Math.min(rectA.y + rectA.height, rectB.y + rectB.height);

    if (left >= right || bottom >= top) return null;
    return new Rect(left, bottom, right - left, top - bottom);
}

/** 判断两个节点的重叠面积是否大于给定阈值 */
export function isOverlapGreaterThan(node1: Node, node2: Node, threshold: number): boolean {
    if (!node1 || !node2) return false;

    const rectA = getWorldRect(node1);
    const rectB = getWorldRect(node2);
    const intersection = getRectIntersection(rectA, rectB);

    if (!intersection) return false;
    return intersection.width * intersection.height > threshold;
}

/** 时间格式化：秒 → mm:ss */
export function formatTime(seconds: number): string {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${pad(mins)}:${pad(secs)}`;
}
