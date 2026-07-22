import { Node, Vec3 } from 'cc';

/**
 * 瓶子数据模型
 * 封装瓶子的状态：节点引用、位置、所属容器等
 */
export interface BottleData {
    /** 当前是否正在被拖拽 */
    isDrag: boolean;
    /** 瓶子主节点 */
    node: Node;
    /** 半透明叠加节点（拖拽到容器上方时显示预览） */
    opacityNode: Node;
    /** 当前所在的容器（null 表示未被放入容器） */
    container: ContainerData | null;
    /** 世界坐标下的原始位置（拖拽松手后若未放入容器则回到此位置） */
    worldPosition: Vec3;
}

/**
 * 容器数据模型
 * 每个容器有一个正确答案瓶子，玩家需要将对应瓶子拖入
 */
export interface ContainerData {
    /** 当前被放入的瓶子（null 表示空容器） */
    curBottle: BottleData | null;
    /** 正确答案：应该放入此容器的瓶子 */
    actualBottle: BottleData;
    /** 容器底板节点（显示容器图案） */
    ctr: Node;
    /** 碰撞检测区域节点（用于判断瓶子是否在容器上方） */
    cctr: Node;
}
