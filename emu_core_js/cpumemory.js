// CPU地址空间的映射
class CPUMemory {

    constructor() {

        this._address = new Uint8Array(0x10000) // 内存用的地址空间
        this._mapperAction = null               // 由mapper在初始化时注册
        this._stackBase = 0x100                 // 内存中堆栈区的偏移量

        this.read = this._mappedAccess          // read函数跟_mappedAccess函数相同，在此直接绑定
    }

    // 写内存
    write(addr, value) {
        this._mappedAccess(addr, value, true)
    }

    // 读栈
    readStack(addr) {
        return this._access(addr + this._stackBase, false)
    }

    // 写栈
    writeStack(addr, value) {
        this._access(addr + this._stackBase, value, true)
    }

    // 将某Array中的数据读入自己的内存空间中
    loadInto(source, sourceOffset, targetOffset, len) {
        let target = this._address
        for (var i = 0; i < len; i++) {
            target[targetOffset + i] = source[sourceOffset + i]
        }
    }

    // 直接读写内存区域
    _access(addr, value, isWrite) {
        if (!isWrite) {
            return this._address[addr]
        } else {
            this._address[addr] = value
        }
    }

    // 对响应的地址做映射处理后的读写函数
    _mappedAccess(rawAddr, value, isWrite) {
        let realAddr = null

        if (rawAddr < 0x2000) {
            // internal RAM
            // 机身内存，这一段是以0x800为一组循环回滚
            realAddr = rawAddr & 0x7FF
            return this._access(realAddr, value, isWrite)

        } else if (rawAddr < 0x4000) {
            // PPU REGS
            // 访问PPU的寄存器 ， 一共有8个，在0x2000-0x4000之间回滚
            realAddr = rawAddr & 0x7
            return this._accessPPU(realAddr, value, isWrite)

        } else if (rawAddr < 0x4018) {
            // APU and IO registers
            // 4000-4018，APU相关的接口和手柄接口
            // 这里使用rawAddr
            return this._accessAPUandIO(rawAddr, value, isWrite)

        } else if (rawAddr < 0x4020) {
            // CPU Test Mode Use These addresses
            // 暂时忽略
        } else {
            // 0x4020-0xFFFF是卡带的地址空间
            return this._accessCartridge(rawAddr, value, isWrite)
        }
    }

    // 访问PPU
    _accessPPU(realAddr, value, isWrite) {

        // realAddr 在上一步得出，是这8个寄存器的之一

        if (isWrite) {
            //写入

            switch (realAddr) {
                // $2000 
                case 0:
                    this.machine.ppu.write2000(value)
                    break;
                case 1:
                    this.machine.ppu.write2001(value)
                    break;
                case 3:
                    this.machine.ppu.write2003(value)
                    break;
                case 4:
                    this.machine.ppu.write2004(value)
                    break;
                case 5:
                    this.machine.ppu.write2005(value)
                    break;
                case 6:
                    this.machine.ppu.write2006(value)
                    break;
                case 7:
                    this.machine.ppu.write2007(value)
                    break;
                default:
                    break;
            }
        } else {
            // 读取

            switch (realAddr) {
                // $2002
                case 2:
                    return this.machine.ppu.read2002()
                case 7:
                    return this.machine.ppu.read2007()
                default:
                    return
            }
        }

    }

    // 访问APU和IO接口
    _accessAPUandIO(addr, value, isWrite) {

        if (isWrite) {

            // 写入
            switch (addr) {

                // APU 方波1控制寄存器
                case 0x4000:
                    this.machine.apu.write4000(value)
                    break;
                case 0x4001:
                    this.machine.apu.write4001(value)
                    break;
                case 0x4002:
                    this.machine.apu.write4002(value)
                    break;
                case 0x4003:
                    this.machine.apu.write4003(value)
                    break;

                // APU 方波2控制寄存器
                case 0x4004:
                    this.machine.apu.write4004(value)
                    break;
                case 0x4005:
                    this.machine.apu.write4005(value)
                    break;
                case 0x4006:
                    this.machine.apu.write4006(value)
                    break;
                case 0x4007:
                    this.machine.apu.write4007(value)
                    break;

                // APU 三角波控制寄存器
                case 0x4008:
                    this.machine.apu.write4008(value)
                    break;
                case 0x400a:
                    this.machine.apu.write400a(value)
                    break;
                case 0x400b:
                    this.machine.apu.write400b(value)
                    break;

                // 噪声和DMC通道没有做

                // 4014 PPU的OAMDMA地址
                case 0x4014:
                    this.machine.ppu.write4014(value)
                    break;

                // APU 控制寄存器
                case 0x4015:
                    this.machine.apu.write4015(value)
                    break;

                // 0x4016是手柄1P的地址
                case 0x4016:
                    this.machine.joy1.write(value)
                    break;

                // APU 模式选择寄存器和手柄2P的地址
                case 0x4017:

                    // 没有做2P手柄
                    // 如果想添加2P可以在此加一行
                    // this.machine.joy2.write(value)

                    this.machine.apu.write4017(value)
                    break;

                default:
                    break;
            }
        } else {
            // 读取
            switch (addr) {
                case 0x4015:
                    return this.machine.apu.read4015()
                case 0x4016:
                    return this.machine.joy1.read()
                default:
                    return 0
            }
        }
    }

    // 访问卡带的空间
    _accessCartridge(addr, value, isWrite) {
        if (isWrite) {
            // 写入操作

            if (this._mapperAction) {

                // 由mapper在该cpumemory实例里注册一个动作，如果对程序区域进行写操作，先去调用这个动作
                // 该方法由mapper来设置

                // skip Default是表明是否跳过默认动作
                // 如果是读写ram，此处可以返回false，可以继续改写相应地址的值

                let skipDefault = this._mapperAction(addr, value, true)

                if (!skipDefault) {
                    return this._access(addr, value, isWrite)
                }
            }
        } else {
            
            // 读取操作直接返回内存地址空间里的数据
            return this._access(addr, value, false)
        }
    }
}