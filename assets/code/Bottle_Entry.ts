import { _decorator, Component, Node, director, Canvas } from 'cc';
import { GameMode, gameState } from './core/global_data';
import { Guess_Bottle } from './bottle/Guess_Bottle';

const { ccclass, property } = _decorator;

/**
 * Bottle_Entry —— 模式选择入口面板
 *
 * 挂载在 Bottle.scene 的 homecanvas 节点上。
 * 用户选择模式后隐藏自身，启动 Guess_Bottle 游戏主逻辑。
 */
@ccclass('Bottle_Entry')
export class Bottle_Entry extends Component {

    // ==================== 编辑器属性 ====================

    @property(Canvas)       GameArea: Canvas = null;        // 游戏区域节点（Guess_Bottle 所在节点）
    @property(Node)       ChallengePanel: Node = null;  // 挑战模式选项面板（可选）
    @property(Node)       LevelClearPanel: Node = null; // 闯关模式选项面板（可选）

    private _gameMain: Guess_Bottle = null;

    // ==================== 生命周期 ====================

    protected onLoad(): void {
        // 从 GameArea 节点上获取 Guess_Bottle 组件
        if (!this.GameArea) {
            console.warn('[Bottle_Entry] GameArea 未绑定！请在编辑器中把 Canvas 节点拖到 GameArea 属性上');
            return;
        }
        this._gameMain = this.GameArea.getComponent(Guess_Bottle);
        if (!this._gameMain) {
            console.warn('[Bottle_Entry] GameArea 上找不到 Guess_Bottle 组件！请确认 Canvas 节点挂载了 Guess_Bottle 脚本');
        }

        // ★ 预初始化：确保 GameArea 的 Canvas 组件在场景加载时完成初始化，
        // 然后暂时隐藏，等待用户选择模式后再显示。
        // 这样可以避免编辑器预览中多 Canvas 切换导致的渲染异常。
        this.GameArea.node.active = false;
    }

    // ==================== 模式选择 ====================

    /** 经典模式 */
    classicMode(): void {
        this._startWithMode(GameMode.Classic);
    }

    /** 闯关模式 */
    levelClearMode(): void {
        this._startWithMode(GameMode.LevelClear);
    }

    /** 挑战模式 */
    challengeMode(): void {
        this._startWithMode(GameMode.Challenge);
    }

    // ==================== 子面板 ====================

    /** 显示挑战模式选项（难度选择等，预留） */
    showChallengePanel(): void {
        if (this.ChallengePanel) {
            this.ChallengePanel.active = true;
        }
    }

    /** 显示闯关模式关卡选择（预留） */
    showLevelClearPanel(): void {
        if (this.LevelClearPanel) {
            this.LevelClearPanel.active = true;
        }
    }

    // ==================== 导航 ====================

    /** 返回主页 */
    backHomePage(): void {
        director.loadScene('homepage');
    }

    // ==================== 内部 ====================

    private _startWithMode(mode: GameMode): void {
        console.log('[Bottle_Entry] 进入模式:', mode, 'GameArea:', !!this.GameArea, 'gameMain:', !!this._gameMain);

        // 1. 写入全局状态
        gameState.enterBottleGame(mode);

        // 2. ★ 先显示游戏区域，再隐藏入口面板
        //    确保始终有一个活跃的 Canvas 组件驱动渲染，
        //    避免编辑器预览中出现"无 Canvas"瞬间导致画面不刷新。
        if (this.GameArea) {
            this.GameArea.node.active = true;
        } else {
            console.error('[Bottle_Entry] GameArea 为空，无法显示游戏界面！');
            return;
        }

        // 3. 隐藏入口面板
        this.node.active = false;

        // 4. 启动游戏
        if (this._gameMain) {
            this._gameMain.startGame();
        } else {
            console.error('[Bottle_Entry] _gameMain 为空，无法启动游戏！');
        }
    }
}


