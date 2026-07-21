import { _decorator, Button, Component, director, EventHandler, Input, input, Node } from 'cc';
const { ccclass, property } = _decorator;


@ccclass('startgame')
export class startgame extends Component {

    @property(Button)
    start_game: Button = null

    protected onLoad(): void {
        input.on(Input.EventType.MOUSE_DOWN, this.touch_start, this)
    }

    protected onDestroy(): void {
        input.off(Input.EventType.MOUSE_DOWN, this.touch_start, this)
    }
    start() {
    
    }

    update(deltaTime: number) {
        
    }

    
    touch_start() {
        
    }
    callback(event: Event, customEventData: string){
        director.loadScene("Bottle")
    }
}


