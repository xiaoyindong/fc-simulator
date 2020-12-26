// *******************************************
// 
// Mapper类
// 
// *******************************************

// mapper在CPU Memory里面调用如下
// let skipDefault = this._mapperAction(addr, value, true)
// 返回值是是否跳过默认动作。如果是对rom区域执行写操作来触发mapper的动作，应该返回1
// 如果是对卡带上的RAM进行操作，可以返回0，由CPUmemory的内存区域来保存结果
// 当然此时也可以返回1，由mapper自己来管理卡带ram

// 定一个mapper基类

class Mapper {
    constructor(machine) {
        this.machine = machine
        if (this.machine.ines.getChrSize() == 0) {

            // 没有CHRROM，意味着卡带使用CHRRAM。
            // 代表游戏魂斗罗 , mapper1的洛克人2也是这样
            // 如果hasCHRRAM不为真，则ppumem不会执行对图案表的写入操作

            this.machine.ppumem._hasCHRRAM = true
        } else {
            this.machine.ppumem._hasCHRRAM = false
        }

        // 清零mapperAction，防止热重载时，旧的mapperAction还在起作用
        this.machine.ppumem._mapperAction = null
    }

    // 静态方法，根据mapperNo自动选择并生成对应的mapper实例
    static newMapper(machine, mapperNo) {

        let mappers = [Mapper000, Mapper001, Mapper002, Mapper003]
        if (!mappers[mapperNo]) {
            alert('当前游戏的Mapper:' + mapperNo + '此模拟器尚未支持，无法进行正常游戏')
            return null
        }
        else {
            return new mappers[mapperNo](machine)
        }
    }

    // 替换cpumem中的PRGROM块，通常是16K大小
    _replacePRGROM(prgBankNo, destAddr) {
        let mem = this.machine.cpumem
        let gameRom = this.machine.ines
        let prg = gameRom.getPrg(prgBankNo)
        mem.loadInto(prg, 0, destAddr, prg.length)
    }

    // 替换显存中的CHRROM块，通常8K大小
    _replaceCHRROM(chrBankNo, destAddr) {
        let mem = this.machine.ppumem
        let gameRom = this.machine.ines
        let chr = gameRom.getChr(chrBankNo)
        mem.loadInto(chr, 0, destAddr, chr.length)
    }

    // 以4K为单位替换CHRROM
    _replace4KBCHRROM(chr4KBankNo, destAddr) {
        let mem = this.machine.ppumem
        let gameRom = this.machine.ines
        let chr_8k = gameRom.getChr((chr4KBankNo >> 1))
        let upper = chr4KBankNo % 2 == 0
        let startoffset = 0
        if (!upper) {
            startoffset = 0x1000
        }
        // console.log('4KCHR', chr4KBankNo >> 1, upper)
        // console.log(chr_8k)
        mem.loadInto(chr_8k, startoffset, destAddr, 0x1000)
    }

    // 通常的上电动作
    InitWithPowerOnOrReset() {
        this._replacePRGROM(0, 0x8000)
        this._replacePRGROM(this.machine.ines.getPrgSize() - 1, 0xC000)
        if (this.machine.ines.getChrSize() > 0) {
            this._replaceCHRROM(0, 0)
        }
    }

    // 返回MapperAction的function
    getMapperAction(addr, value, isWrite) {
        // skipDefault 默认是true 
        return function () {
            return true
        }
    }
}



class Mapper000 extends Mapper {
    // http://wiki.nesdev.com/w/index.php/NROM
    // mapper0就是最基本的mapper，什么都不用做

    constructor(machine) {
        super(machine)
        this.mapperNumber = 0
    }
}


class Mapper001 extends Mapper {

    // http://wiki.nesdev.com/w/index.php/MMC1
    // 使用MMC1芯片的卡带
    // 未完美实现
    // 不处理该mapper的变体，不处理大于8K RAM切换问题

    constructor(machine) {
        super(machine)
        this.mapperNumber = 1

        // 记录当前各BANK的标号
        this._currentPRGBank_8000 = -1
        this._currentPRGBank_C000 = -1
        this._currentCHR_Bank_0000 = -1
        this._currentCHR_Bank_1000 = -1

        // mapper内部寄存器存的BANK编号数据
        this._currentCHRBANK0REG = 0
        this._currentCHRBANK1REG = 0
        this._currentPRGBankREG = 0

        // 串行访问计数
        this._loadCount = 0

        // 串行buffer
        this._buffer = 0

        // 当前mapper状态
        this._currentMirroring = -1
        this._currentPRGROM_bank_mode = 3
        this._currentCHRROM_bank_mode = 0

        // 内部的control寄存器
        // bit4-bit0 CPPMM
        // MM: Mirroring 
        // PP: PRG ROM bank mode
        // C : CHR ROM bank mode 
        this._controlREG = 0

        // 如果卡带没有CHRROM，屏蔽掉自己的_changeCHR
        if (this.machine.ppumem._hasCHRRAM) {
            this._changeCHR = function () { }
        }

        this.machine.cpumem._mapperAction = this.getMapperAction()
    }
    getMapperAction(addr, value, isWrite) {
        let self = this
        return function (addr, value, isWrite) {

            if (addr >= 0x6000 && addr <= 0x7FFF) {
                // RAM区域，直接使用cpumem的空间
                return false
            } else {
                if (value & 0x80) { //最高位为1时
                    self._buffer = 0
                    self._loadCount = 0
                    self._currentPRGROM_bank_mode = 3
                    self._changePRG()
                } else {
                    // 最先移入的数据在最低位
                    self._buffer |= ((value & 0x1) << self._loadCount)
                    self._loadCount++

                    if (self._loadCount == 5) {
                        self._routeREG(addr)
                        self._loadCount = 0
                        self._buffer = 0
                    }
                }
            }
            // skipDefault 默认是true 
            return true
        }
    }

    // 根据访问地址来决定修改哪块区域
    _routeREG(addr) {
        if (addr < 0x8000) {
            return
        } else if (addr < 0xA000) {
            this._modifyControl()
        } else if (addr < 0xC000) {
            this._modifyCHRBank0()
        } else if (addr < 0xE000) {
            this._modifyCHRBank1()
        } else if (addr < 0x10000) {
            this._modifyPRGBank()
        }
    }

    // 改变当前内存里的PRG BANK
    _changePRG() {
        let prgBankMode = this._currentPRGROM_bank_mode

        if (prgBankMode == 0 || prgBankMode == 1) {

            // 0, 1: switch 32 KB at $8000, ignoring low bit of bank number;

            let bankNo = (this._currentPRGBankREG) & 0xFE   //去掉最低位
            if (bankNo != this._currentPRGBank_8000) {
                this._replacePRGROM(bankNo, 0x8000)
                this._currentPRGBank_8000 = bankNo
            }
            if (bankNo + 1 != this._currentPRGBank_C000) {
                this._replacePRGROM(bankNo + 1, 0xC000)
                this._currentPRGBank_C000 = bankNo + 1
            }
        } else if (prgBankMode == 2) {

            // 2: fix first bank at $8000 and switch 16 KB bank at $C000;

            let bankNo = this._currentPRGBankREG
            if (this._currentPRGBank_8000 != 0) {
                this._replacePRGROM(0, 0x8000)
                this._currentPRGBank_8000 = 0
            }
            if (this._currentPRGBank_C000 != bankNo) {
                this._replacePRGROM(bankNo, 0xC000)
                this._currentPRGBank_C000 = bankNo
            }
        } else if (prgBankMode == 3) {

            // 3: fix last bank at $C000 and switch 16 KB bank at $8000

            let bankNo = this._currentPRGBankREG
            let lastNo = this.machine.ines.getPrgSize() - 1
            if (this._currentPRGBank_8000 != bankNo) {
                this._replacePRGROM(bankNo, 0x8000)
                this._currentPRGBank_8000 = bankNo
            }
            if (this._currentPRGBank_C000 != lastNo) {
                this._replacePRGROM(lastNo, 0xC000)
                this._currentPRGBank_C000 = lastNo
            }
        }
    }

    // 改变当前显存里的CHR BANK
    _changeCHR() {
        let chrBankMode = this._currentCHRROM_bank_mode


        // 如果改变发生在渲染过程中，要使用ppu._scrollChanged()强制重画背景

        if (chrBankMode == 0) {

            // 0: switch 8 KB at a time;

            let bankNo = this._currentCHRBANK0REG & 0xFE    // 去掉最低位

            if (this._currentCHR_Bank_0000 != bankNo) {
                this._replace4KBCHRROM(bankNo, 0x0000)
                this._currentCHR_Bank_0000 = bankNo
                this.machine.ppumem.patternTable0Dirty = true
                this.machine.ppu._scrollChanged()
            }
            if (this._currentCHR_Bank_1000 != bankNo + 1) {
                this._replace4KBCHRROM(bankNo + 1, 0x1000)
                this._currentCHR_Bank_1000 = bankNo + 1
                this.machine.ppumem.patternTable1Dirty = true
                this.machine.ppu._scrollChanged()
            }
        } else {

            // 1: switch two separate 4 KB banks 
            // 把CHRROM当成两个4K处理

            let bankNo0 = this._currentCHRBANK0REG
            let bankNo1 = this._currentCHRBANK1REG

            if (this._currentCHR_Bank_0000 != bankNo0) {
                this._replace4KBCHRROM(bankNo0, 0x0000)
                this._currentCHR_Bank_0000 = bankNo0
                this.machine.ppumem.patternTable0Dirty = true
                this.machine.ppu._scrollChanged()
            }
            if (this._currentCHR_Bank_1000 != bankNo1) {
                this._replace4KBCHRROM(bankNo1, 0x1000)
                this._currentCHR_Bank_1000 = bankNo1
                this.machine.ppumem.patternTable1Dirty = true
                this.machine.ppu._scrollChanged()
            }
        }
    }

    // 控制寄存器被修改
    _modifyControl() {
        let buffer = this._buffer
        let mirroring = buffer & 0x3
        let prgBankMode = (buffer >> 2) & 0x3
        let chrBankMode = (buffer >> 4) & 0x1

        // 处理Mirroring
        if (mirroring != this._currentMirroring) {
            if (mirroring == 0 || mirroring == 1) {
                this.machine.ppu._setNametableMirror('one')
            } else if (mirroring == 2) {
                this.machine.ppu._setNametableMirror('v')
            } else if (mirroring == 3) {
                this.machine.ppu._setNametableMirror('h')
            }
            this._currentMirroring = mirroring
        }

        // 处理 PRG MODE
        if (prgBankMode != this._currentPRGROM_bank_mode) {
            this._currentPRGROM_bank_mode = prgBankMode
            this._changePRG()
        }

        // 处理 CHR MODE
        if (chrBankMode != this._currentCHRROM_bank_mode) {
            this._currentCHRROM_bank_mode = chrBankMode
            // this._changeCHR()
        }
    }

    _modifyCHRBank0() {
        let buffer = this._buffer
        // 因为CHRBANK使用4KB计数，所以需要 * 2
        this._currentCHRBANK0REG = (buffer & 0x1F) % (this.machine.ines.getChrSize() * 2)
        this._changeCHR()
    }

    _modifyCHRBank1() {
        let buffer = this._buffer
        // 因为CHRBANK使用4KB计数，所以需要 * 2
        this._currentCHRBANK1REG = (buffer & 0x1F) % (this.machine.ines.getChrSize() * 2)
        this._changeCHR()
    }

    _modifyPRGBank() {
        let buffer = this._buffer
        this._currentPRGBankREG = (buffer & 0x0F) % this.machine.ines.getPrgSize()
        this._changePRG()
    }

}


class Mapper002 extends Mapper {

    // http://wiki.nesdev.com/w/index.php/UxROM

    constructor(machine) {
        super(machine)
        this.mapperNumber = 2

        this._currentBank = -1

        this.machine.cpumem._mapperAction = this.getMapperAction()
    }
    getMapperAction() {
        let self = this
        return function (addr, value, isWrite) {
            // console.log('mapper2-', addr, value)
            if (addr >= 0x8000 && addr <= 0xFFFF) {
                let prgCount = self.machine.ines.getPrgSize()
                let No = (value & 0xF) % prgCount
                if (No != self._currentBank) {
                    self._replacePRGROM(No, 0x8000)
                    self._currentBank = No
                }
            }
            return true  // 返回1，不修改ROM区
        }
    }
}



class Mapper003 extends Mapper {

    // http://wiki.nesdev.com/w/index.php/INES_Mapper_003
    // 该mapper只能切换CHRROM

    constructor(machine) {
        super(machine)
        this.mapperNumber = 3

        this._currentBank = 0

        this.machine.cpumem._mapperAction = this.getMapperAction()
    }
    getMapperAction() {
        let self = this
        return function (addr, value, isWrite) {

            if (addr >= 0x8000 && addr <= 0xFFFF) {
                let chrCount = self.machine.ines.getChrSize()
                let No = value % chrCount
                if (No != self._currentBank) {
                    self._replaceCHRROM(No, 0)
                    self._currentBank = No

                    // 更新完CHRROM后要把ppumem的对应区域dirty掉
                    this.machine.ppumem.patternTable0Dirty = true
                    this.machine.ppumem.patternTable1Dirty = true
                }
            }
            return true  // 返回1，不修改ROM区
        }
    }
}

