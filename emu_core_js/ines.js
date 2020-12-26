// *******************************************
// 
// 解析和处理ines格式的游戏rom文件
// 
// *******************************************
class INES {
    constructor(rom) {
        this.rom = rom
        // 每块PRG长度
        this._PRG_LENGTH = 16384

        // 每块CHR长度
        this._CHR_LENGTH = 8192
        this.init()
    }
    init() {

        if (!(this.isInesFile())) {
            alert('不是合法ROM，无法加载')
            return
        }
        if (this.getTvType == 'PAL') {
            alert('该ROM是PAL电视格式，可能会运行不正常')
        }

        this.prgSize = this.getPrgSize()
        this.chrSize = this.getChrSize()
        this._PRGS = new Array(this.prgSize)
        this._CHRS = new Array(this.chrSize)
        let skip = 16
        var rom = this.rom
        if (this.hasTrainer()) {
            skip += 512
        }

        // 生成一个存放着每块PRG的Array
        for (let i = 0, len = this.prgSize; i < len; i++) {
            this._PRGS[i] = new Uint8Array(this._PRG_LENGTH)
            let a = this._PRGS[i]
            for (let j = 0, len = this._PRG_LENGTH; j < len; j++) {
                a[j] = rom[skip + j]
            }
            skip += this._PRG_LENGTH
        }

        // 生成一个存放着每块CHR的Array
        for (let i = 0, len = this.chrSize; i < len; i++) {
            this._CHRS[i] = new Uint8Array(this._CHR_LENGTH)
            let a = this._CHRS[i]
            for (let j = 0, len = this._CHR_LENGTH; j < len; j++) {
                a[j] = rom[skip + j]
            }
            skip += this._CHR_LENGTH
        }
    }

    _getbit(byte, bitNo) {
        return (byte >> bitNo) & 0x01
    }

    // 从文件头判断是否是ROM文件
    isInesFile() {
        // 4E 45 53 1A
        let r = this.rom
        return (r[0] == 0x4E && r[1] == 0x45 && r[2] == 0x53 && r[3] == 0x1A)
    }

    // 获取PRGROM数量
    getPrgSize() {
        return this.rom[4]
    }

    // 获取CHRROM数量
    getChrSize() {
        return this.rom[5]
    }

    // 获取映射方式
    getMirroring() {
        return (this._getbit(this.rom[6], 0)) ? 'v' : 'h'
    }

    // 获取mapper编号
    getMapperNo() {
        let r = this.rom
        return ((r[6] & 0xF0) >> 4) | (r[7] & 0xF0)
    }

    // 获取PRGROM数量
    getPrg(number) {
        return this._PRGS[number]
    }

    // 获取CHRROM数量
    getChr(number) {
        return this._CHRS[number]
    }

    // 是否有卡带内存
    hasPrgRam() {
        return (this._getbit(this.rom[6], 1)) ? true : false
    }

    // trainer 好像是修改器？不太了解 。好像是引导菜单或者作弊菜单之类的
    hasTrainer() {
        return (this._getbit(this.rom[6], 2)) ? true : false
    }

    // 是否忽略默认映射，忽略掉通常可以使用4屏vram
    isIgnoreMirroring() {
        return (this._getbit(this.rom[6], 3)) ? true : false
    }

    // 返回卡带的电视制式
    getTvType() {
        return (this._getbit(this.rom[9], 0)) ? 'PAL' : 'NTSC'
    }
}