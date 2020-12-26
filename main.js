function __main__() {

    // 仿jquery式的选择器缩写
    let $ = function (s) {
        return document.querySelector(s)
    }

    let useRawImage = false
    let running = true
    let ctx_screen = $('.display canvas.screen').getContext('2d')
    let ctx_deb = $('.display canvas.deb').getContext('2d')
    let dragDropEl = $('body')


    // 去除平滑缩放，保留像素感
    let setScreenDeSmooth = function () {
        ctx_screen.mozImageSmoothingEnabled = false;
        ctx_screen.webkitImageSmoothingEnabled = false;
        ctx_screen.msImageSmoothingEnabled = false;
        ctx_screen.imageSmoothingEnabled = false;
        ctx_screen.oImageSmoothingEnabled = false;
    }

    setScreenDeSmooth()

    // 定义machine
    let machine = new Machine()
    machine.loadrom(demoGameRom)


    // debuger初始设置
    let deb = new Debugger()
    deb.cpu = machine.cpu
    deb.cpuStatusElement = $('.cpu-status')
    deb.breakPointsElement = $('.bp .bplist')

    // 把PPU的framebuffer画到CANVAS里面
    let display = function (ctx) {
        if (useRawImage) {
            ctx.putImageData(machine.ppu.getRawImage(), 0, 0)
        } else {
            ctx.drawImage(machine.ppu.getCanvasImage(), 0, 0, 512, 480)
        }
    }

    // 暂停游戏
    let pauseGame = function () {
        if (running) {
            running = false;
            machine.apu.suspend();
        }
        else {
            running = true;
            reqAni();
            machine.apu.resume();
        }
    }

    // 调试 执行到vblank之前
    let debug_1frameframeAction = () => {
        let cpu = machine.cpu
        let target = cpu.targetCount
        while (cpu.cycleCount < target - 5) {
            if (deb.watchBP(cpu.PC)) {
                break
            }
            else { machine.runstep() }
        }
        display(ctx_screen)
        deb.refreshCPUInfo()
        deb.refreshWatches()
    }

    // 调试 执行单步
    let debug_1stepAction = () => {
        machine.runstep()
        display(ctx_screen)
        deb.refreshCPUInfo()
        deb.refreshWatches()
    }

    // 调试 执行100步
    let debug_100stepsAction = () => {
        let cpu = machine.cpu
        for (var i = 0; i < 100; i++) {
            if (deb.watchBP(cpu.PC)) {
                break
            }
            else { machine.runstep() }
        }
        display(ctx_screen)
        deb.refreshCPUInfo()
        deb.refreshWatches()
    }


    // window.requestAnimationFrame
    let reqAni = () => {
        if (running) {
            machine.runframe()
            display(ctx_screen)
            window.requestAnimationFrame(reqAni)
        }
    }

    // 初始化拖拽
    let dragDropCallback = function(){
        // 不管当前模拟是否暂停状态，强制恢复
        running = false
        pauseGame()
    }
    let dragDrop = new DragDrop(machine, dragDropEl,dragDropCallback)


    // 绑定按钮事件
    $('#run-machine').addEventListener('click', function () {
        machine.apu.start()
        window.requestAnimationFrame(reqAni)
    })

    $('#pause').addEventListener('click', function () {
        pauseGame();
    })

    $('#control-type1').addEventListener('click', function () {
        // A B Select Start Up Down Left Right
        // Z X 2 1 arrow
        machine.joy1.setCurrentMap([90, 88, 50, 49, 38, 40, 37, 39])
    })

    $('#control-type2').addEventListener('click', function () {
        // A B Select Start Up Down Left Right
        // K J G H W S A D
        machine.joy1.setCurrentMap([75, 74, 71, 72, 87, 83, 65, 68])
    })

    $('#raw-size').addEventListener('click', function () {
        let canvas = $('.display canvas.screen')
        if (!useRawImage) {
            useRawImage = true
            canvas.height = 240
            canvas.width = 256
            setScreenDeSmooth()
            display(ctx_screen)
        } else {
            useRawImage = false
            canvas.height = 480
            canvas.width = 512
            setScreenDeSmooth()
            display(ctx_screen)
        }
    })

    $('#toggle-debug-panel').addEventListener('click', function () {
        let el = $('.debugger')
        if (!el.style.display || el.style.display == 'none') {
            el.style.display = 'block'
        } else {
            el.style.display = 'none'
        }
    })

    // 绑定DEBUG面板里的按钮事件

    $('#step').addEventListener('click', function () {
        debug_1stepAction()
    })
    $('#step-100').addEventListener('click', function () {
        debug_100stepsAction()
    })
    $('#one-frame').addEventListener('click', function () {
        debug_1frameframeAction()
    })
    $('#dump-full-bg').addEventListener('click', function () {
        let el = $('.display canvas.deb')
        el.style.display = 'inline-block'
        machine.ppu.__debug__dumpFullBgToCanvas(ctx_deb)
    })
    $('#dump-temp-bg').addEventListener('click', function () {
        let el = $('.display canvas.deb')
        el.style.display = 'inline-block'
        machine.ppu.__debug__dumpTempBgBufferToCanvas(ctx_deb)
    })
    $('#hide-debug-canvas').addEventListener('click', function () {
        let el = $('.display canvas.deb')
        el.style.display = 'none'
    })

    // 断点调试等等按钮

    $('#bp-on').addEventListener('click', function () {
        deb.breakPointsActive = this.checked
        deb.refreshBreakPoints()
    })

    $('#add-bp').addEventListener('click', function () {
        let addr = $('#bp-addr').value
        if (addr == '') {
            return
        } else {
            deb.addBreakPoint(addr)
        }
        deb.refreshBreakPoints()
    })
    $('#clear-bp').addEventListener('click', function () {
        deb.clearBreakPoints()
        deb.refreshBreakPoints()
    })

    // 处理点击变色，给断点列表父节点注册事件委托
    $('.bplist').addEventListener('click', function (e) {
        if (e.target.nodeName != "SPAN") {
            return
        }
        let addr = e.target.innerText
        deb.toggleBP(addr)
        deb.refreshBreakPoints()
    })


    // 添加内存监看
    $('#add-watch').addEventListener('click', function () {
        let addr = $('#watch-addr').value
        let lines = $('#watch-lines').value

        let start = deb.filterHexAddr(addr)

        if (!(addr && lines)) {
            return
        } else if (isNaN(start) || isNaN(lines)) {
            return
        } else {
            var li = document.createElement('li')
            li.innerHTML = `<div class="title">\
            <span>起始：$${start.toString(16)}</span> <button>关闭</button>\
        </div>`
            deb.newWatchDom(li, machine.cpumem, start, lines, null)
            $('.watch ul').appendChild(li)
        }
        deb.refreshWatches()
    })

    // 内存监看的关闭按钮
    $('.watch ul').addEventListener('click', function (e) {
        if (e.target.nodeName != "BUTTON") {
            return
        }
        let li = e.target.parentElement.parentElement
        let id = li.querySelector('div.data').dataset['id']
        li.remove()
        deb.deleteWatch(id)
    })
}
__main__()