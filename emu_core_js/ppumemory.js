class PPUMemory {
    constructor() {
        // 显存空间
        this._address = new Uint8Array(0x4000)

        // 读取$0000-$3EFF范围会弹出buffer里面的数值
        // 每次读取会刷新buffer
        this._vramReadBuffer = 0x00

        // 如果此处被动过，说明mapper替换过CHRROM或者CPU写入过CHRRAM
        // 渲染之前需要重新刷新PPU使用的tile table
        this.patternTable0Dirty = false
        this.patternTable1Dirty = false

        this.ppu = null
        this.read = this._mappedAccess
    }

    // 写入
    write(addr, value) {
        this._mappedAccess(addr, value, true)
    }

    // 将一段数据载入显存
    loadInto(source, sourceOffset, targetOffset, len) {
        let target = this._address
        for (let i = 0; i < len; i++) {
            target[targetOffset + i] = source[sourceOffset + i]
        }
    }

    _access(addr, value, isWrite) {
        if (!isWrite) {
            return this._address[addr]
        } else {
            this._address[addr] = value
        }
    }

    // 访问映射
    _mappedAccess(rawAddr, value, isWrite) {
        let realAddr = null
        if (rawAddr < 0x2000) {
            // Pattern table
            // 图案表
            return this._accessPatternTable(rawAddr, value, isWrite)

        } else if (rawAddr < 0x3F00) {
            // Nametable
            // 背景表
            if (rawAddr >= 0x3000) {
                rawAddr -= 0x1000
            }
            realAddr = rawAddr - 0x2000
            return this._accessNameTable(realAddr, value, isWrite)
        } else if (rawAddr < 0x4000) {
            // Palette RAM
            // 调色板
            realAddr = rawAddr & 0x1F
            return this._accessPaletteTable(realAddr, value, isWrite)
        } else {
            return 0
        }
    }

    // 访问 patternTable 图案表
    _accessPatternTable(rawAddr, value, isWrite) {

        // 有的游戏卡带自身不带CHRROM，而是CHRRAM
        // 图案数据CPU写到显存里的
        if (isWrite) {
            if (this._hasCHRRAM) {

                this._access(rawAddr, value, true)

                // 改动数据后设置脏位，这样PPU会在下一次背景渲染开始时重建TILE TABLE
                if (rawAddr < 0x1000) {
                    this.patternTable0Dirty = true
                } else {
                    this.patternTable1Dirty = true
                }
            }

        } else {
            // 读取会弹出readbuffer
            let ret = this._vramReadBuffer
            this._vramReadBuffer = this._access(rawAddr, null, false)
            return ret
        }
    }

    // 访问 nameTable 背景表
    _accessNameTable(realAddr, value, isWrite) {
        let ret = this._vramReadBuffer
        let ntidx = Math.floor(realAddr / 0x400)
        let offset = realAddr % 0x400

        if (isWrite) {
            this.ppu._NAMETABLE[ntidx][offset] = value
        } else {
            this._vramReadBuffer = this.ppu._NAMETABLE[ntidx][offset]
            return ret
        }
    }

    // 访问PaletteTable 调色板
    _accessPaletteTable(realAddr, value, isWrite) {
        // 地址$3F00-$3F1F，realaddr取$00-1F
        // 色板都是四个一组，预处理一下
        let idx = Math.floor(realAddr / 4)
        let offset = realAddr % 4
        let bgp = this.ppu._BG_PALETTE
        let spp = this.ppu._SP_PALETTE

        // 注意，能改动背景色的只有两个地址(不考虑地址循环)
        // 即背景调色板[0][0]和精灵调色板[0][0]
        // 在其他0号位置设置背景色将被忽略

        if (idx < 4) {
            // 前四块是背景色板

            if (isWrite) {
                // 写入
                if (offset == 0) {
                    // 这里有个坑，只有3F00能控制背景色，也就是说这16个字节之中，只有0号控制背景。其它调色板的第一个字节写入无效。
                    if (idx == 0) {
                        value = value | 0x80 //为了针对背景色和其它色重色问题，给它最高位置1，这样方便处理sp0hit
                        bgp[0][0] = value
                        bgp[1][0] = value
                        bgp[2][0] = value
                        bgp[3][0] = value
                    }
                } else {
                    bgp[idx][offset] = value
                }
            } else {
                // 读取
                return bgp[idx][offset]
            }
        } else {
            // 后四块是精灵色板
            idx = idx - 4
            if (isWrite) {
                // 写入
                if (offset == 0) {
                    if (idx == 0) {
                        value = value | 0x80 //为了针对背景色和其它色重色问题，给它最高位置1，这样方便处理sp0hit
                        bgp[0][0] = value
                        bgp[1][0] = value
                        bgp[2][0] = value
                        bgp[3][0] = value
                    }
                    // 除了idx = 4映射背景色板，其它不用改背景色是透明色，不更改
                    return
                } else {
                    spp[idx][offset] = value
                }
            } else {
                // 读取
                if (offset == 0) { return bgp[0][0] }
                else {
                    return spp[idx][offset]
                }
            }
        }
    }
}