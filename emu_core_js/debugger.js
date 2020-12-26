// *******************************************
// 
// 调试用的debugger
// 主要作用是显示内存区域，以及下断点
// 
// *******************************************

class Debugger {
    constructor() {
        this._hexString = "0123456789ABCDEF"

        this.cpuStatusElement = null    // 更新CPU信息的DOM，后期指定
        this.cpu = null

        this.breakPointsElement = null  // 断点列表的DOM，后期指定

        // 要监控的列表
        this.watchList = []             // [{source,startOffset,lines,newlineSymbol,DomElement,DomAttr}]
        this.breakPoints = []           // [ [是否启用,PC地址], [], []]

        // 是否开启断点
        this.breakPointsActive = false
    }

    // 过滤16进制地址 , 保证地址合法
    filterHexAddr(addr) {
        let s = String(addr)
        if (s.indexOf('0x') == -1) {
            s = '0x' + s
        }
        if (isNaN(Number(s))) {
            return NaN
        } else {
            return Number(s)
        }
    }

    // *******************************************
    // 
    // 断点功能
    // 
    // *******************************************

    // 添加断点
    addBreakPoint(addr) {
        let addrToPush = this.filterHexAddr(addr)
        if (isNaN(addrToPush)) {
            return
        }
        // 如果地址已存在，不重复添加
        for (var i = 0, len = this.breakPoints.length; i < len; i++) {
            if (addrToPush == this.breakPoints[i][1]) {
                return
            }
        }
        this.breakPoints.push([true, addrToPush])
    }

    // 刷新断点显示
    refreshBreakPoints() {
        let el = this.breakPointsElement
        let bps = this.breakPoints
        let html = ''
        var bpenable = null
        for (var i = 0, len = bps.length; i < len; i++) {
            if (this.breakPointsActive && bps[i][0]) {
                bpenable = ' enable'
            } else {
                bpenable = ''
            }
            html += `<span class="bp ${bpenable}">0x${bps[i][1].toString(16)}</span>`
        }
        el.innerHTML = html
    }

    // 切换断点状态
    toggleBP(addr) {
        let v = Number(addr)
        if (isNaN(v)) {
            return
        }
        let bps = this.breakPoints
        for (var i = 0, len = bps.length; i < len; i++) {
            if (bps[i][1] == v) {
                bps[i][0] = !(bps[i][0])
            }
        }
    }

    // 可以使用浏览器自带的debugger，通过在这里打断点实现捕获
    _breakPointCatcher() {
        // 只是简单return一下，可以在调试器给这句打断点
        return
    }

    // 断点捕获
    watchBP(pc) {
        if (this.breakPointsActive) {
            var bps = this.breakPoints
            for (var i = 0, len = bps.length; i < len; i++) {
                if (bps[i][0] && bps[i][1] == pc) {
                    this._breakPointCatcher()
                    return true
                }
            }
        }
        return false
    }

    // 清除所有断点
    clearBreakPoints() {
        this.breakPoints = []
    }

    // 启用断点功能
    enableBreakPoint() {
        this.breakPointsActive = true
    }


    // *******************************************
    // 
    // CPU状态监控
    // 
    // *******************************************

    // 刷新CPU状态
    refreshCPUInfo() {
        if (this.cpuStatusElement) {
            this.cpuStatusElement.innerHTML = this.show(this.cpu)
        }
    }
    // 生成CPU状态HTML
    show(cpu) {
        let s = this.cpu.showStates()
        let p = s.P.toString(2)
        let ppuaddr = cpu.machine.ppu._PPUADDR.toString(16)
        let framecount = cpu.machine.framecount
        while (p.length < 8) {
            p = '0' + p
        }
        let html = `<p> A=0x${s.A.toString(16)} X=0x${s.X.toString(16)} Y=0x${s.Y.toString(16)} &nbsp;&nbsp;\
                     SP=0x${s.SP.toString(16)} PC=0x${s.PC.toString(16)} &nbsp;&nbsp; cycle:${s.cycle}\
                      &nbsp;&nbsp;frame:${framecount}\
                    &nbsp;&nbsp;ppuaddr:$${ppuaddr}<br>NV-BDIZC<br>${p} </p>`
        return html
    }

    // *******************************************
    // 
    // 内存监控
    // 
    // *******************************************

    // 字节转16进制字符
    _byteToHex(byte) {
        let s = this._hexString
        let low = byte & 0xF
        let high = (byte >> 4) & 0xF
        return s[high] + s[low]
    }

    // 得到一行16个16进制数据
    _make16ByteLine(address, source) {
        address = Math.floor(address / 16) * 16
        let addrHigh = (address >> 8) & 0xFF
        let addrLow = address & 0xFF
        let lineString = '$' + this._byteToHex(addrHigh) + this._byteToHex(addrLow) + ':'
        if ('read' in source) {
            for (let i = 0; i < 16; i++) {
                lineString += this._byteToHex(source.read(address + i)) + ' '
            }
        } else {
            for (let i = 0; i < 16; i++) {
                lineString += this._byteToHex(source[address + i]) + ' '
            }
        }
        return lineString
    }

    // 把监控区域转换成字符串
    _watchAreaToString(startOffset, source, lines, newlineSymbol) {
        newlineSymbol = newlineSymbol || '\n'
        let s = ''
        for (let i = 0; i < lines; i++) {
            s += this._make16ByteLine(startOffset + (i * 16), source)
            s += newlineSymbol
        }
        return s
    }

    // 添加一个要观察的区域
    addWatch(source, startOffset, lines, newlineSymbol, DomElement, DomAttr) {
        let id = Math.round(new Date().getTime() / 1000);
        let o = {
            id: id,
            source: source,
            startOffset: startOffset,
            lines: lines,
            newlineSymbol: newlineSymbol,
            DomElement: DomElement,
            DomAttr: DomAttr
        }
        this.watchList.push(o)
    }

    // 向页面中添加一个新DOM
    newWatchDom(father, source, startOffset, lines, newlineSymbol) {
        let el = document.createElement('div')
        el.setAttribute('class', 'data')
        father = father || document.querySelector('body')
        father.appendChild(el)
        this.addWatch(source, startOffset, lines, newlineSymbol, el, 'innerText')
    }

    // 删除一个Watch
    deleteWatch(id) {
        this.watchList = this.watchList.filter(function (x) {
            return x['id'] != id
        })
    }

    // 刷新全部监控区域
    refreshWatches() {
        for (let i = 0, len = this.watchList.length; i < len; i++) {
            let o = this.watchList[i]
            o.DomElement[o.DomAttr] = this._watchAreaToString(o.startOffset, o.source, o.lines, o.newlineSymbol)
            o.DomElement.dataset['id'] = o.id
        }
    }
}