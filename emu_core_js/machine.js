class Machine {
    constructor() {

        // 初始化各个组件

        this.cpu = new CPU()
        this.ppu = new PPU()
        this.cpumem = new CPUMemory()
        this.ppumem = new PPUMemory()

        this.cpu.machine = this
        this.ppu.machine = this
        this.cpumem.machine = this
        this.ppumem.machine = this

        this.ppumem.ppu = this.ppu
        this.ppu.mem = this.ppumem
        this.cpu.mem = this.cpumem

        this.apu = new APU(this)
        this.joy1 = new Joystick()
        // 暂不使用2P手柄

        this.framecount = 1
    }

    // 执行一帧
    // 一帧的定义为，从PPU的Vblank开始，到下一个Vblank之前结束
    runframe() {
        while (this.cpu.cycleCount < this.cpu.targetCount) {

            // 在合适的时机触发渲染
            if ((!(this.ppu._inRenderingProcess)) && (this.cpu.cycleCount > this.ppu._NMI_CYCLE)) {
                this.ppu.render()
            }

            this.cpu.runStep()
        }

        // 当一帧结束时的动作
        this.apu.play()
        this.ppu.startVblank()
        this.framecount++
        this.cpu.cycleCount = 0
    }

    // 单步执行，调试用
    runstep() {
        if ((!(this.ppu._inRenderingProcess)) && (this.cpu.cycleCount > this.ppu._NMI_CYCLE)) {
            this.ppu.render()
        }
        this.cpu.runStep()
        if (this.cpu.cycleCount >= this.cpu.targetCount) {
            this.apu.play()
            this.ppu.startVblank()
            this.cpu.cycleCount = 0
            this.framecount++
        }
    }

    // 载入rom
    loadrom(rom) {
        this.ines = new INES(rom)
        this.mapper = Mapper.newMapper(this, this.ines.getMapperNo())
        this.mapper.InitWithPowerOnOrReset()
        this.framecount = 1
        this.init()
    }

    // 绑定接收拖拽进来的ROM文件的DOM
    
    init() {
        this.cpu.setRESET()
        this.ppu.ppuInit(this.ines.getMirroring())
        this.apu.resetPulseDuty()

        // 交替填充内存为0x00和0xFF，方便在DEBUG时观察
        let mem = this.cpu.mem
        for (var i = 0; i < 0x800; i++) {
            mem._address[i] = ((i & 7) < 4) ? 0 : 0xFF
        }
    }
}