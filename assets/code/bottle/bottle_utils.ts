/**
 * bottle_utils.ts —— 猜瓶子专用工具
 */

// ========== 随机选取 ==========

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
