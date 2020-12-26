// *******************************************
// 
// 处理拖放ROM文件到窗口中的事件
// 
// *******************************************

class DragDrop {
    constructor(machine, el, callback) {
        this.machine = machine
        this.el = el
        this.init()
        this.callback = callback
    }

    init(){
        var self = this
        self.el.ondragover = function (e) {
            e.preventDefault()  // 阻止默认事件
        }

        self.el.ondrop = function (e) {
            e.preventDefault()                  // 阻止默认事件
            var f = e.dataTransfer.files[0]     // 获取file
            var file = new FileReader()         //新建FileReader  用来读取文件
            
            //文件读取完成后
            file.onload = function (e) {
                var rom =  new Uint8Array(file.result)
                self.machine.loadrom(rom)
                self.callback()
            }
            file.readAsArrayBuffer(f);          // 将f当做数组buffer处理
        }
    }
}