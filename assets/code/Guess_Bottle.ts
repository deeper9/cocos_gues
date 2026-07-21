import {
    _decorator, Component, Node, instantiate,
    UITransform, Vec3, director, Input, Label, EventTouch, UIOpacity, RichText,
} from 'cc';
import { GameMode, gameState } from './global_data';
import { BottleData, ContainerData } from './bottle_types';
import { RandomPicker } from './bottle_utils';
import { BottleDragController } from './BottleDragController';
import { BottleTimerController } from './BottleTimerController';
import { BottleShuffleAnimator } from './BottleShuffleAnimator';
import { BOTTLE_LEVELS, BOTTLE_LEVEL_TIMERS, DEFAULT_BOTTLE_COUNT } from './game_config';

const { ccclass, property } = _decorator;

// ========== 常量 ==========
const BOTTLE_SPACING = 15;
const TIP_HIDE_DELAY = 3;
const SCALE_NORMAL = new Vec3(1, 1, 1);
const OFF_SCREEN = new Vec3(-1000, -1000, 0);

/**
 * Guess_Bottle —— 游戏主组件（纯编排层）
 *
 * 职责：持有数据、连接编辑器属性、委托子控制器执行逻辑。
 * 不包含算法细节——拖拽 → DragController，计时 → TimerController，动画 → EntranceAnimator
 */
@ccclass('Guess_Bottle')
export class Guess_Bottle extends Component {

    // ==================== 编辑器属性 ====================

    @property(Node)       Bg_Node: Node = null;
    @property(RichText)   Check_Tip_Label: RichText = null;
    @property(Node)       Tip_Label_Node: Node = null;
    @property(Label)      Timer_Label: Label = null;
    @property(RichText)   Steps_Label: RichText = null;
    @property({ type: [Node] }) Bottle_Nodes: Node[] = [];
    @property(Node)       Container_Nodes: Node = null;
    @property(Node)       Bottle_Container: Node = null;
    @property(Node)       Setting_page: Node = null;
    @property(Node)       Setting_Page_Mask: Node = null;
    @property(RichText)   Init_Container_Text: RichText = null;
    @property(Node)       Resurect_Tips: Node = null;
    @property(RichText)   Mode_Title: RichText = null;
    @property(Node)       Preview_Panel: Node = null;
    @property(Node)       Next_Level_Panel: Node = null;
    @property(RichText)   Level_Title: RichText = null;
    @property(Node)       Step_Node: Node = null;
    @property              Level_Timer: number = 0;

    // ==================== 私有状态 ====================

    private _bottles: BottleData[] = [];
    private _containers: ContainerData[] = [];
    private _unplacedCount = 0;
    private _checkCount = 0;

    // --- 子控制器 ---
    private _dragCtrl: BottleDragController = null;
    private _timerCtrl = new BottleTimerController();
    private _shuffleAnim: BottleShuffleAnimator = null;

    // --- 锁定（洗牌期间禁止拖拽） ---
    private _locked = false;

    // --- 预览 ---
    private _previewTarget: Node = null;

    // ==================== 生命周期 ====================

    protected onLoad(): void {
        this._canvas = director.getScene()?.getChildByName('Canvas') ?? this.node;

        // 默认模式
        if (gameState.mode === GameMode.None) {
            gameState.enterBottleGame(GameMode.Classic);
        }

        // 1. 构建数据模型
        this._buildBottles();
        this._buildContainers();
        this._unplacedCount = this._bottles.length;
        this._refreshInitBtn();

        // 2. 拖拽控制器（先创建，洗牌结束后注册事件）
        this._dragCtrl = new BottleDragController(
            this._bottles, this._containers, this._canvas,
            { onBottlePlaced: () => { this._unplacedCount--; this._refreshInitBtn(); } },
        );

        // 3. 洗牌动画 → 完成后启用拖拽 + 计时
        this._locked = true;
        this._dragCtrl.locked = true;
        this._shuffleAnim = new BottleShuffleAnimator(
            this._bottles,
            { onShuffleDone: () => this._onShuffleDone() },
            { onSpread: () => { /* 每轮散开时不做额外操作 */ } },
        );
        this._shuffleAnim.start();

        // 4. UI
        this._initModeUI();
        this.Setting_Page_Mask?.on(Input.EventType.TOUCH_START, this._onMaskClick, this);
    }

    private _canvas: Node = null;

    private _onShuffleDone(): void {
        this._locked = false;
        this._dragCtrl.locked = false;
        this._dragCtrl.registerBottleEvents();
        this._dragCtrl.registerContainerEvents(c => this._onPreview(c));

        // 计时器
        this._timerCtrl.bindLabel(this.Timer_Label);
        this._timerCtrl.onTimeout(() => this._showResurrect());
        const configLevel = gameState.level - 4;
        const startSecs = gameState.mode === GameMode.LevelClear
            ? (BOTTLE_LEVEL_TIMERS[configLevel] ?? this.Level_Timer)
            : 0;
        this._timerCtrl.init(startSecs);
        this.schedule(() => this._timerCtrl.tick(), 1);
    }

    protected onDestroy(): void {
        this._dragCtrl?.destroy();
    }

    // ==================== 数据构建 ====================

    private _buildBottles(): void {
        const size = this.Bottle_Nodes[0].getComponent(UITransform).contentSize;
        const level = gameState.level;
        const count = level === -1
            ? this.Bottle_Nodes.length
            : (BOTTLE_LEVELS[level - 4] ?? DEFAULT_BOTTLE_COUNT);

        // 以 Bg_Node 的世界坐标为居中基准
        const bgWorldPos = this.Bg_Node.getWorldPosition();
        const totalW = count * size.width + (count - 1) * BOTTLE_SPACING;
        const startX = bgWorldPos.x - totalW / 2 + size.width / 2;

        for (let i = 0; i < this.Bottle_Nodes.length; i++) {
            const node = this.Bottle_Nodes[i];
            if (gameState.mode === GameMode.LevelClear && level < i) break;

            const opacity = instantiate(node);
            opacity.setParent(this.Container_Nodes.parent);
            opacity.getComponent(UIOpacity).opacity = 128;
            opacity.active = true;

            this._bottles.push({
                isDrag: false, node, opacityNode: opacity, container: null,
                worldPosition: new Vec3(startX + i * (size.width + BOTTLE_SPACING), 650, 0),
            });
            node.setWorldPosition(this._bottles[i].worldPosition);
            opacity.setPosition(OFF_SCREEN);
            node.active = true;
        }
    }

    private _buildContainers(): void {
        const shuffled = [...this._bottles];
        for (let i = 0; i < this._bottles.length; i++) {
            const node = instantiate(this.Container_Nodes);
            const cNode = instantiate(this.Bottle_Container);
            const pos = this._bottles[i].worldPosition;
            node.setParent(this.Container_Nodes.parent);
            cNode.setParent(this.Container_Nodes.parent);

            this._containers.push({
                curBottle: null,
                actualBottle: RandomPicker.pickOne(shuffled)!,
                ctr: node, cctr: cNode,
            });
            node.setWorldPosition(new Vec3(pos.x, pos.y + 150, 0));
            cNode.setWorldPosition(pos);
            cNode.active = true;
            node.active = true;
        }
    }

    // ==================== 模式标题 ====================

    private _initModeUI(): void {
        if (!this.Mode_Title) return;
        const names: Record<number, string> = {
            [GameMode.Classic]: '经典模式',
            [GameMode.LevelClear]: '闯关模式',
            [GameMode.Challenge]: '挑战模式',
        };
        this.Mode_Title.string = names[gameState.mode] ?? '';

        if (gameState.mode === GameMode.Classic && this.Step_Node) {
            this.Step_Node.active = false;
        }
        if (gameState.mode === GameMode.LevelClear && this.Level_Title) {
            this.Level_Title.string = `第 ${gameState.level - 4} 关`;
            this.Level_Title.node.active = true;
        }
    }

    // ==================== 验证 ====================

    checkButtonCallback(): void {
        this._checkCount++;
        if (this.Steps_Label) this.Steps_Label.string = `${this._checkCount}`;

        let correct = 0;
        for (const c of this._containers) {
            if (c.curBottle === c.actualBottle) correct++;
        }

        if (correct === this._bottles.length) {
            if (this.Tip_Label_Node) this.Tip_Label_Node.active = false;
            if (this.Next_Level_Panel) this.Next_Level_Panel.active = true;
            this.unscheduleAllCallbacks();
        } else {
            if (this.Check_Tip_Label) this.Check_Tip_Label.string = `<color=#00ff00>${correct}</color>`;
            if (this.Tip_Label_Node) this.Tip_Label_Node.active = true;
            this.scheduleOnce(() => { if (this.Tip_Label_Node) this.Tip_Label_Node.active = false; }, TIP_HIDE_DELAY);
        }
    }

    // ==================== 预览 ====================

    private _onPreview(container: ContainerData): void {
        this._timerCtrl.pause();
        this._previewTarget = container.ctr;

        const preview = instantiate(container.actualBottle.node);
        preview.setPosition(container.ctr.getPosition());
        preview.setParent(this.Container_Nodes.parent);
        preview.setScale(SCALE_NORMAL);
        preview.active = true;

        if (this.Preview_Panel) this.Preview_Panel.active = true;
        if (this.Setting_Page_Mask) this.Setting_Page_Mask.active = true;
    }

    ensurePreview(): void {
        const container = this._containers.find(c => c.ctr === this._previewTarget);
        if (container) {
            const b = instantiate(container.actualBottle.node);
            b.setPosition(container.ctr.getPosition());
            b.setParent(this.Container_Nodes.parent);
            b.setScale(SCALE_NORMAL);
            b.active = true;
        }
        this._closePreview();
    }

    private _closePreview(): void {
        this._timerCtrl.resume();
        this._previewTarget = null;
        if (this.Preview_Panel) this.Preview_Panel.active = false;
        if (this.Setting_Page_Mask) this.Setting_Page_Mask.active = false;
    }

    // ==================== UI 面板 ====================

    settingButton(): void {
        this._setVisible(this.Setting_page, true);
        this._setVisible(this.Setting_Page_Mask, true);
        this._timerCtrl.pause();
    }

    closeSettingButton(): void {
        this._setVisible(this.Setting_page, false);
        this._setVisible(this.Setting_Page_Mask, false);
        this._timerCtrl.resume();
    }

    private _showResurrect(): void {
        this._timerCtrl.pause();
        this._setVisible(this.Setting_Page_Mask, true);
        this._setVisible(this.Resurect_Tips, true);
    }

    resurect(): void {
        this._setVisible(this.Setting_Page_Mask, false);
        this._setVisible(this.Resurect_Tips, false);
        if (gameState.mode === GameMode.LevelClear) {
            const configLevel = gameState.level - 4;
            this._timerCtrl.reset(BOTTLE_LEVEL_TIMERS[configLevel] ?? this.Level_Timer);
        }
        this._timerCtrl.resume();
    }

    closeResurect(): void { this.restart(); }

    private _onMaskClick(e: EventTouch): void { e.propagationStopped = true; }

    private _refreshInitBtn(): void {
        if (this.Init_Container_Text) {
            this.Init_Container_Text.string = this._unplacedCount > 0 ? '拖放瓶子' : '点我验证';
        }
    }

    private _setVisible(node: Node | null, visible: boolean): void {
        if (node) node.active = visible;
    }

    // ==================== 场景导航 ====================

    restart(): void {
        this.closeSettingButton();
        director.loadScene('Bottle');
    }

    nextLevel(): void {
        gameState.nextBottleLevel();
        this.restart();
    }

    backToHome(): void {
        director.loadScene('homepage');
    }

    // 编辑器按钮兼容别名
    regame(): void { this.restart(); }
    backHomePage(): void { this.backToHome(); }
    nextOne(): void { this.nextLevel(); }
    returnBack(): void { this.backToHome(); }
}
