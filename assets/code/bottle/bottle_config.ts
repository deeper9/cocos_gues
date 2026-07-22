/**
 * game_config.ts —— 游戏全局配置（纯数据，不依赖 Cocos 组件）
 *
 * 用途：所有游戏共享的关卡配置、常量等
 */

// ========== 猜瓶子关卡配置 ==========

/** 每关的瓶子数量 */
export const BOTTLE_LEVELS: Record<number, number> = {
    1: 5,
    2: 6,
    3: 7,
    4: 8,
    5: 9,
    6: 10,
};

/** 每关倒计时（秒），0 表示不限时 */
export const BOTTLE_LEVEL_TIMERS: Record<number, number> = {
    1: 120,
    2: 150,
    3: 180,
    4: 200,
    5: 240,
    6: 300,
};

/** 默认瓶子数（经典/挑战模式） */
export const DEFAULT_BOTTLE_COUNT = 7;
