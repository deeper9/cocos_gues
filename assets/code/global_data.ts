import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

// ========== 游戏模式枚举 ==========

export enum GameMode {
    None = 0,
    Classic,
    LevelClear,
    Challenge,
}

// ========== 游戏名称枚举 ==========

export enum GameName {
    None = 0,
    GuessBottle,
}

// ========== 运行时状态（纯数据，模块级单例） ==========

class GameState {
    /** 当前游戏 */
    currentGame: GameName = GameName.None;
    /** 游戏模式 */
    mode: GameMode = GameMode.None;
    /** 当前关卡（LevelClear 模式下有效） */
    level: number = 5;

    // ---- 猜瓶子专用 ----

    /** 设置猜瓶子模式 */
    enterBottleGame(mode: GameMode, level?: number): void {
        this.currentGame = GameName.GuessBottle;
        this.mode = mode;
        this.level = (mode === GameMode.LevelClear && level != null) ? level : -1;
    }

    /** 推进下一关 */
    nextBottleLevel(): void {
        this.level++;
    }

    /** 获取当前关卡瓶子数（-1 = 编辑器默认） */
    getBottleCount(): number {
        return this.mode === GameMode.LevelClear ? this.level : -1;
    }

    /** 重置 */
    reset(): void {
        this.mode = GameMode.None;
        this.level = 5;
    }
}

/** 全局游戏状态单例 */
export const gameState = new GameState();

// ========== Cocos 组件桥接（保留 @ccclass 兼容性） ==========

@ccclass('global_data')
export class global_data extends Component {
    setGameMode(mode: GameMode): void {
        gameState.enterBottleGame(mode);
    }
    getGameMode(): GameMode { return gameState.mode; }

    setLevel(level: number): void { gameState.level = level; }
    getLevel(): number { return gameState.level; }
}
