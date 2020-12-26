// *******************************************
// 
// 手柄，只实现了1P
// 
// *******************************************
class Joystick {
    constructor(keyMap) {
        // 0 - A
        // 1 - B
        // 2 - Select
        // 3 - Start
        // 4 - Up
        // 5 - Down
        // 6 - Left
        // 7 - Right

        this._keyStatus = [0, 0, 0, 0, 0, 0, 0, 0]

        this._buffer = 0    // 机器读取手柄时，会把该时刻按键放缓冲区
        this._count = 0     // 当前读到第几个

        // 实际键盘按键与游戏按键的映射
        // 结构如 []
        // this._keyMap = [90, 88, 50, 49, 38, 40, 37, 39]
        // 默认键位 z x 1 2 上 下 左 右
        this._keyMap = keyMap || [90, 88, 50, 49, 38, 40, 37, 39]
        this.bindListener()
    }

    // 获取当前键位设置
    getCurrentMap() {
        return this._keyMap
    }

    // 设置当前键位
    setCurrentMap(map) {
        this._keyMap = map
    }

    // 绑定处理事件
    bindListener() {
        let keyHandler = (event) => {
            let keyCode = null
            let e = event || window.event || arguments.callee.caller.arguments[0]
            if (e) {
                keyCode = e.keyCode
                for (var i = 0; i < 8; i++) {
                    if (keyCode == this._keyMap[i]) {
                        this._keyStatus[i] = (e.type == "keydown" ? 1 : 0)
                    }
                }
            }
        }
        document.onkeydown = keyHandler
        document.onkeyup = keyHandler
    }

    // 把当前按键状态保存到内部buffer，等待读取
    _setBuffer() {
        this._buffer = this._keyStatus.slice()
        this._count = 0
    }

    // CPU发出写入信号时进行的动作
    write(value) {

        // CPU发出的写入，低位为1 和 低位为0时 实机处理应该是不一样的
        // 但是简单起见，都直接重设缓冲区
        this._setBuffer()
    }

    // CPU发出读取时的动作
    read() {
        let v = 0
        if (this._count < 8) {
            v = this._buffer[this._count]
            this._count++
        } else {
            v = 1
        }
        return v
    }
}