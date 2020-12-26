// *******************************************
// 
// 使用 WebAudio API的波形生成功能，模拟了两个方波通道，以及一个三角波通道
// 噪声通道和DMC通道没有进行模拟
// 
// *******************************************

class APU {
    constructor(machine) {
        this.machine = machine

        // Frame Counter状态 驱动APU进行动作的模式
        // http://wiki.nesdev.com/w/index.php/APU_Frame_Counter

        this._stepCycle = 3728 * 2              // 每进行一步的CPU周期
        this._cycleCountdown = this._stepCycle
        this._sequencerMode = 0                 // 0: 4步模式 1:5步模式
        this._currentStep = 1                   // 当前步数 1-4 或 1-5
        this._IRQInhibit = 1
        this._FRAME_INTERRUPT = 0               // 只有4个CPU周期该位会被置1，暂时忽略该位处理

        // APU和CPU不完全同步。在某些型号的任天堂街机上，2A03被用作音效处理，并可以在没有PPU的情况下作为时间同步用。


        // 内部状态
        this._DMC_CHANNEL_ENABLE = 0
        this._NOISE_CHANNEL_ENABLE = 0
        this._TRIANGLE_CHANNEL_ENABLE = 0
        this._PULSE_CHANNEL2_ENABLE = 0
        this._PULSE_CHANNEL1_ENABLE = 0

        this._DMC_INTERRUPT = 0
        this._FRAME_INTERRUPT = 0

        this._LENGTH_COUNTER_TABLE = [10, 254, 20, 2, 40, 4, 80,
            6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18,
            48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30]


        // 波形通道
        this._PULSE_CHANNEL1 = new PulseChannel()
        this._PULSE_CHANNEL1._isPusle1 = 1          // 该设置影响sweep

        this._PULSE_CHANNEL2 = new PulseChannel()

        this._TRIANGLE_CHANNEL = new TriangleChannel()

        // TODO
        // this._NOISE_CHANEL = new NoiseWave()
        // this._DMC_CHANNEL = new DMCWave()
    }

    // *******************************************
    // APU 控制
    // *******************************************
    write4015(value) {
        // TODO
        // this._DMC_CHANNEL_ENABLE = (value >> 4) & 1
        // this._NOISE_CHANNEL_ENABLE = (value >> 3) & 1

        this._TRIANGLE_CHANNEL._setActive((value >> 2) & 1)
        this._PULSE_CHANNEL2._setActive((value >> 1) & 1)
        this._PULSE_CHANNEL1._setActive(value & 1)
    }

    read4015() {

        // TODO
        // let v = (this._DMC_INTERRUPT << 7) | (this._FRAME_INTERRUPT << 6) |
        //     (this._DMC_CHANEL_ENABLE << 4) | ((this._NOISE_CHANEL.getCounter() ? 1 : 0) << 3) |
        let v =
            ((this._TRIANGLE_CHANNEL.getCounter() ? 1 : 0) << 2) |
            ((this._PULSE_CHANNEL2.getCounter() ? 1 : 0) << 1) |
            ((this._PULSE_CHANNEL1.getCounter() ? 1 : 0))

        return v
    }

    write4017(value) {
        this._sequencerMode = (value >> 7) & 0x1
        this._IRQInhibit = (value >> 6) & 0x1

        if (this._sequencerMode == 1) {

            // 原文 If the mode flag is set, then both "quarter frame" and "half frame" signals are also generated.

            this._PULSE_CHANNEL1._envelopeAction()
            this._PULSE_CHANNEL2._envelopeAction()
            this._TRIANGLE_CHANNEL._linearCounterAction()

            this._PULSE_CHANNEL1._lengthCounterAction()
            this._PULSE_CHANNEL2._lengthCounterAction()
            this._TRIANGLE_CHANNEL._lengthCounterAction()

            this._PULSE_CHANNEL1._sweepAction()
            this._PULSE_CHANNEL2._sweepAction()
        }
    }


    // *******************************************
    // 
    // $4000-$4003  PulseChannel1
    // 方波1控制
    // 
    // *******************************************

    write4000(value) {
        let duty = (value >> 6) & 0x3
        let counterHalt = (value >> 5) & 0x1
        let constantVolume = (value >> 4) & 0x1
        let volume = value & 0xF

        this._PULSE_CHANNEL1._DUTY = duty
        this._PULSE_CHANNEL1._LENGTH_COUNTER_HALT = counterHalt
        this._PULSE_CHANNEL1._VOLUME = volume
        this._PULSE_CHANNEL1._envelope = volume
        this._PULSE_CHANNEL1._CONSTANT_VOLUME = constantVolume
    }

    write4001(value) {
        let sweepEnable = (value >> 7) & 0x1
        let sweepPeriod = (value >> 4) & 0x7
        let negate = (value >> 3) & 0x1
        let shift = value & 0x7

        this._PULSE_CHANNEL1._SWEEP_ENABLE = sweepEnable
        this._PULSE_CHANNEL1._SWEEP_PERIOD = sweepPeriod
        this._PULSE_CHANNEL1._SWEEP_NEGATE = negate
        this._PULSE_CHANNEL1._SWEEP_SHIFT = shift

    }

    write4002(value) {
        this._PULSE_CHANNEL1._TIMER_LOW = value
    }

    write4003(value) {
        let lengthCounterIdx = (value >> 3) & 0x1F
        let timerHigh = value & 0x7
        this._PULSE_CHANNEL1._LENGTH_COUNTER = this._LENGTH_COUNTER_TABLE[lengthCounterIdx]
        this._PULSE_CHANNEL1._TIMER_HIGH = timerHigh

        // 写该地址会重置包络
        this._PULSE_CHANNEL1._envelope = 15
    }


    // *******************************************
    // 
    // $4004-$4007  PulseChannel2
    // 方波2控制
    // 
    // *******************************************

    write4004(value) {
        let duty = (value >> 6) & 0x3
        let counterHalt = (value >> 5) & 0x1
        let constantVolume = (value >> 4) & 0x1
        let volume = value & 0xF

        this._PULSE_CHANNEL2._DUTY = duty
        this._PULSE_CHANNEL2._LENGTH_COUNTER_HALT = counterHalt
        this._PULSE_CHANNEL2._VOLUME = volume
        this._PULSE_CHANNEL2._envelope = volume
        this._PULSE_CHANNEL2._CONSTANT_VOLUME = constantVolume
    }
    write4005(value) {
        let sweepEnable = (value >> 7) & 0x1
        let sweepPeriod = (value >> 4) & 0x7
        let negate = (value >> 3) & 0x1
        let shift = value & 0x7

        this._PULSE_CHANNEL2._SWEEP_ENABLE = sweepEnable
        this._PULSE_CHANNEL2._SWEEP_PERIOD = sweepPeriod
        this._PULSE_CHANNEL2._SWEEP_NEGATE = negate
        this._PULSE_CHANNEL2._SWEEP_SHIFT = shift
    }
    write4006(value) {
        this._PULSE_CHANNEL2._TIMER_LOW = value
    }
    write4007(value) {
        let lengthCounterIdx = (value >> 3) & 0x1F
        let timerHigh = value & 0x7
        this._PULSE_CHANNEL2._LENGTH_COUNTER = this._LENGTH_COUNTER_TABLE[lengthCounterIdx]
        this._PULSE_CHANNEL2._TIMER_HIGH = timerHigh

        // 写该地址会重置包络
        this._PULSE_CHANNEL2._envelope = 15
    }


    // *******************************************
    // 
    // $4008-$400b  PulseChannel2
    // 三角波控制
    // 
    // *******************************************

    write4008(value) {
        let c = (value >> 7) & 0x1
        let linearCounter = value & 0x7F
        this._TRIANGLE_CHANNEL._LENGTH_COUNTER_HALT = c
        this._TRIANGLE_CHANNEL._LINEAR_COUNTER = linearCounter

        // 写该地址会重置linearCounterSetFlag
        this._TRIANGLE_CHANNEL._linearCounterSetFlag = 1
    }

    write400a(value) {
        this._TRIANGLE_CHANNEL._TIMER_LOW = value
    }
    write400b(value) {
        let lengthCounterIdx = (value >> 3) & 0x1F
        let timerHigh = value & 0x7
        this._TRIANGLE_CHANNEL._LENGTH_COUNTER = this._LENGTH_COUNTER_TABLE[lengthCounterIdx]
        this._TRIANGLE_CHANNEL._TIMER_HIGH = timerHigh
        // 写该地址会重置linearCounterSetFlag
        this._TRIANGLE_CHANNEL._linearCounterSetFlag = 1
    }



    // *******************************************
    // 
    // APU时序动作 
    // 
    // *******************************************

    // 该步骤由CPU在执行的时候调用
    tick(cycle) {
        this._cycleCountdown -= cycle
        if (this._cycleCountdown < 0) {
            this._cycleCountdown += this._stepCycle
            this.frameCounterAction()
        }
    }

    triggerIRQ() {
        if (!(this._IRQInhibit)) {
            this.machine.cpu.setIRQ()
        }
    }

    frameCounterAction() {
        let currentStep = this._currentStep
        if (currentStep != 5) {
            this._PULSE_CHANNEL1._envelopeAction()
            this._PULSE_CHANNEL2._envelopeAction()
            this._TRIANGLE_CHANNEL._linearCounterAction()
        }
        if ((currentStep & 0x1) == 0) {
            this._PULSE_CHANNEL1._lengthCounterAction()
            this._PULSE_CHANNEL2._lengthCounterAction()
            this._TRIANGLE_CHANNEL._lengthCounterAction()
            this._PULSE_CHANNEL1._sweepAction()
            this._PULSE_CHANNEL2._sweepAction()
        }
        if (currentStep == 4) {
            this.triggerIRQ()
        }
        if ((currentStep == 5 && this._sequencerMode == 0) || currentStep == 6) {
            this._currentStep = 1
        } else {
            this._currentStep++
        }
    }

    // 对外动作

    // 因为新版的chrome浏览器的安全策略，发声必须由用户动作来激活
    // 所有这里留了start()这个方法，供外部调用
    start() {
        this._PULSE_CHANNEL1.startAudioContext()
        this._PULSE_CHANNEL2.startAudioContext()
        this._TRIANGLE_CHANNEL.startAudioContext()
    }

    play() {
        this._PULSE_CHANNEL1.play()
        this._PULSE_CHANNEL2.play()
        this._TRIANGLE_CHANNEL.play()
    }

    suspend(){
        this._PULSE_CHANNEL1.suspend()
        this._PULSE_CHANNEL2.suspend()
        this._TRIANGLE_CHANNEL.suspend()
    }

    resume(){
        this._PULSE_CHANNEL1.resume()
        this._PULSE_CHANNEL2.resume()
        this._TRIANGLE_CHANNEL.resume()
    }

    // 重置方波占空比
    resetPulseDuty() {
        this._PULSE_CHANNEL1._DUTY = 0
        this._PULSE_CHANNEL2._DUTY = 0
        this._PULSE_CHANNEL1._CURRENT_DUTY = -1
        this._PULSE_CHANNEL2._CURRENT_DUTY = -1
    }
}


//单独定义波形和通道


// *******************************************
// 
// 方波通道
// 
// *******************************************

class PulseChannel {
    constructor() {

        this._isPusle1 = 0
        this._enable = false
        this._Timer = 0
        this._freq = 0
        this._volume = 0
        this._envelope = 0
        this.initAudioContext()

        this._volumeScale = 0.8     // 调整该轨道发声的比例
        // 
        this._cpuFreq = 1789773     // 1.789773MHz
        // REGS
        this._DUTY = 0
        this._CURRENT_DUTY = -1     // 当前占空比

        this._LENGTH_COUNTER_HALT = 0
        this._CONSTANT_VOLUME = 0
        this._VOLUME = 0
        this._SWEEP_ENABLE = 0
        this._SWEEP_PERIOD = 0
        this._SWEEP_CURRENT_COUNT = 0
        this._SWEEP_NEGATE = 0
        this._SWEEP_SHIFT = 0
        this._TIMER_LOW = 0
        this._TIMER_HIGH = 0
        this._LENGTH_COUNTER = 0

        // 方波波形 ，波形生成交给WebAudio处理，不自己手动生成

        // 该波形可以由matlab后者类似软件对波形进行FFT计算得到
        this._waveTableData = [

            {   // 占空比 12.5%
                real: new Float32Array([16, 14.548615, 10.677734, 5.646560, 1, -2.012982, -2.870726, -1.891132, 0, 1.720891, 2.496112, 2.131131, 1, -0.216668, -0.897406, -0.770106, 0, 0.944050, 1.557161, 1.555943, 1, 0.229444, -0.334200, -0.411875, 0, 0.648454, 1.174172, 1.306590, 1, 0.443687, -0.051665, -0.224902, 0, 0.483057, 0.953174, 1.158531, 1, 0.577638, 0.129175, -0.102554, 0, 0.370332, 0.799688, 1.053839, 1, 0.675590, 0.263518, -0.010273, 0, 0.282827, 0.678903, 0.970352, 1, 0.755712, 0.374757, 0.067054, 0, 0.207794, 0.574168, 0.897160, 1, 0.827474, 0.475437, 0.137767, 0, 0.137767, 0.475437, 0.827474, 1, 0.897160, 0.574168, 0.207794, 0, 0.067054, 0.374757, 0.755712, 1, 0.970352, 0.678903, 0.282827, 0, -0.010273, 0.263518, 0.675590, 1, 1.053839, 0.799688, 0.370332, 0, -0.102554, 0.129175, 0.577638, 1, 1.158531, 0.953174, 0.483057, 0, -0.224902, -0.051665, 0.443687, 1, 1.306590, 1.174172, 0.648454, 0, -0.411875, -0.334200, 0.229444, 1, 1.555943, 1.557161, 0.944050, 0, -0.770106, -0.897406, -0.216668, 1, 2.131131, 2.496112, 1.720891, 0, -1.891132, -2.870726, -2.012982, 1, 5.646560, 10.677734, 14.548615]),
                imag: new Float32Array([0, -5.612020, -9.677734, -11.217788, -10.153170, -7.273981, -3.870726, -1.197546, 0, -0.298603, -1.496112, -2.730792, -3.296558, -2.937296, -1.897406, -0.733202, 0, 0.023175, -0.557161, -1.342166, -1.870868, -1.860286, -1.334200, -0.584818, 0, 0.145615, -0.174172, -0.740174, -1.218504, -1.343059, -1.051665, -0.507371, 0, 0.214125, 0.046826, -0.382727, -0.820679, -1.019673, -0.870825, -0.456693, 0, 0.260817, 0.200312, -0.129979, -0.534511, -0.783196, -0.736482, -0.418469, 0, 0.297063, 0.321097, 0.071577, -0.303347, -0.589763, -0.625243, -0.386439, 0, 0.328142, 0.425832, 0.248278, -0.098491, -0.416515, -0.524563, -0.357148, 0, 0.357148, 0.524563, 0.416515, 0.098491, -0.248278, -0.425832, -0.328142, 0, 0.386439, 0.625243, 0.589763, 0.303347, -0.071577, -0.321097, -0.297063, 0, 0.418469, 0.736482, 0.783196, 0.534511, 0.129979, -0.200312, -0.260817, 0, 0.456693, 0.870825, 1.019673, 0.820679, 0.382727, -0.046826, -0.214125, 0, 0.507371, 1.051665, 1.343059, 1.218504, 0.740174, 0.174172, -0.145615, 0, 0.584818, 1.334200, 1.860286, 1.870868, 1.342166, 0.557161, -0.023175, 0, 0.733202, 1.897406, 2.937296, 3.296558, 2.730792, 1.496112, 0.298603, 0, 1.197546, 3.870726, 7.273981, 10.153170, 11.217788, 9.677734, 5.612020])
            },
            {   // 占空比 25%
                real: new Float32Array([32, 20.867742, 1, -6.278335, 0, 4.553893, 1, -2.381571, 0, 2.726601, 1, -1.306768, 0, 2.013522, 1, -0.796201, 0, 1.627982, 1, -0.493329, 0, 1.382623, 1, -0.289586, 0, 1.209945, 1, -0.140691, 0, 1.079639, 1, -0.025166, 0, 0.976040, 1, 0.068697, 0, 0.890204, 1, 0.147860, 0, 0.816622, 1, 0.216753, 0, 0.751679, 1, 0.278365, 0, 0.692871, 1, 0.334822, 0, 0.638369, 1, 0.387721, 0, 0.586758, 1, 0.438331, 0, 0.536882, 1, 0.487726, 0, 0.487726, 1, 0.536882, 0, 0.438331, 1, 0.586758, 0, 0.387721, 1, 0.638369, 0, 0.334822, 1, 0.692871, 0, 0.278365, 1, 0.751679, 0, 0.216753, 1, 0.816622, 0, 0.147860, 1, 0.890204, 0, 0.068697, 1, 0.976040, 0, -0.025166, 1, 1.079639, 0, -0.140691, 1, 1.209945, 0, -0.289586, 1, 1.382623, 0, -0.493329, 1, 1.627982, 0, -0.796201, 1, 2.013522, 0, -1.306768, 1, 2.726601, 0, -2.381571, 1, 4.553893, 0, -6.278335, 1, 20.867742]),
                imag: new Float32Array([0, -19.867742, -20.355468, -7.278335, 0, -3.553893, -6.741452, -3.381571, 0, -1.726601, -3.992224, -2.306768, 0, -1.013522, -2.794813, -1.796201, 0, -0.627982, -2.114322, -1.493329, 0, -0.382623, -1.668399, -1.289586, 0, -0.209945, -1.348344, -1.140691, 0, -0.079639, -1.103330, -1.025166, 0, 0.023960, -0.906347, -0.931303, 0, 0.109796, -0.741651, -0.852140, 0, 0.183378, -0.599377, -0.783247, 0, 0.248321, -0.472965, -0.721635, 0, 0.307129, -0.357806, -0.665178, 0, 0.361631, -0.250487, -0.612279, 0, 0.413242, -0.148336, -0.561669, 0, 0.463118, -0.049127, -0.512274, 0, 0.512274, 0.049127, -0.463118, 0, 0.561669, 0.148336, -0.413242, 0, 0.612279, 0.250487, -0.361631, 0, 0.665178, 0.357806, -0.307129, 0, 0.721635, 0.472965, -0.248321, 0, 0.783247, 0.599377, -0.183378, 0, 0.852140, 0.741651, -0.109796, 0, 0.931303, 0.906347, -0.023960, 0, 1.025166, 1.103330, 0.079639, 0, 1.140691, 1.348344, 0.209945, 0, 1.289586, 1.668399, 0.382623, 0, 1.493329, 2.114322, 0.627982, 0, 1.796201, 2.794813, 1.013522, 0, 2.306768, 3.992224, 1.726601, 0, 3.381571, 6.741452, 3.553893, 0, 7.278335, 20.355468, 19.867742])
            },
            {   // 占空比 50% 虽然自带方波是50%占空比，为了方便统一音量，此处使用自定义的
                real: new Float32Array([64, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]),
                imag: new Float32Array([0, -40.735484, 0, -13.556669, 0, -8.107786, 0, -5.763142, 0, -4.453202, 0, -3.613536, 0, -3.027043, 0, -2.592403, 0, -2.255964, 0, -1.986659, 0, -1.765247, 0, -1.579173, 0, -1.419891, 0, -1.281382, 0, -1.159278, 0, -1.050333, 0, -0.952079, 0, -0.862606, 0, -0.780408, 0, -0.704279, 0, -0.633243, 0, -0.566493, 0, -0.503358, 0, -0.443270, 0, -0.385743, 0, -0.330355, 0, -0.276737, 0, -0.224558, 0, -0.173516, 0, -0.123338, 0, -0.073764, 0, -0.024549, 0, 0.024549, 0, 0.073764, 0, 0.123338, 0, 0.173516, 0, 0.224558, 0, 0.276737, 0, 0.330355, 0, 0.385743, 0, 0.443270, 0, 0.503358, 0, 0.566493, 0, 0.633243, 0, 0.704279, 0, 0.780408, 0, 0.862606, 0, 0.952079, 0, 1.050333, 0, 1.159278, 0, 1.281382, 0, 1.419891, 0, 1.579173, 0, 1.765247, 0, 1.986659, 0, 2.255964, 0, 2.592403, 0, 3.027043, 0, 3.613536, 0, 4.453202, 0, 5.763142, 0, 8.107786, 0, 13.556669, 0, 40.735484])
            },
            {   // 占空比 75%
                real: new Float32Array([96, -19.867742, 1, 7.278335, 0, -3.553893, 1, 3.381571, 0, -1.726601, 1, 2.306768, 0, -1.013522, 1, 1.796201, 0, -0.627982, 1, 1.493329, 0, -0.382623, 1, 1.289586, 0, -0.209945, 1, 1.140691, 0, -0.079639, 1, 1.025166, 0, 0.023960, 1, 0.931303, 0, 0.109796, 1, 0.852140, 0, 0.183378, 1, 0.783247, 0, 0.248321, 1, 0.721635, 0, 0.307129, 1, 0.665178, 0, 0.361631, 1, 0.612279, 0, 0.413242, 1, 0.561669, 0, 0.463118, 1, 0.512274, 0, 0.512274, 1, 0.463118, 0, 0.561669, 1, 0.413242, 0, 0.612279, 1, 0.361631, 0, 0.665178, 1, 0.307129, 0, 0.721635, 1, 0.248321, 0, 0.783247, 1, 0.183378, 0, 0.852140, 1, 0.109796, 0, 0.931303, 1, 0.023960, 0, 1.025166, 1, -0.079639, 0, 1.140691, 1, -0.209945, 0, 1.289586, 1, -0.382623, 0, 1.493329, 1, -0.627982, 0, 1.796201, 1, -1.013522, 0, 2.306768, 1, -1.726601, 0, 3.381571, 1, -3.553893, 0, 7.278335, 1, -19.867742]),
                imag: new Float32Array([0, -20.867742, -20.355468, -6.278335, 0, -4.553893, -6.741452, -2.381571, 0, -2.726601, -3.992224, -1.306768, 0, -2.013522, -2.794813, -0.796201, 0, -1.627982, -2.114322, -0.493329, 0, -1.382623, -1.668399, -0.289586, 0, -1.209945, -1.348344, -0.140691, 0, -1.079639, -1.103330, -0.025166, 0, -0.976040, -0.906347, 0.068697, 0, -0.890204, -0.741651, 0.147860, 0, -0.816622, -0.599377, 0.216753, 0, -0.751679, -0.472965, 0.278365, 0, -0.692871, -0.357806, 0.334822, 0, -0.638369, -0.250487, 0.387721, 0, -0.586758, -0.148336, 0.438331, 0, -0.536882, -0.049127, 0.487726, 0, -0.487726, 0.049127, 0.536882, 0, -0.438331, 0.148336, 0.586758, 0, -0.387721, 0.250487, 0.638369, 0, -0.334822, 0.357806, 0.692871, 0, -0.278365, 0.472965, 0.751679, 0, -0.216753, 0.599377, 0.816622, 0, -0.147860, 0.741651, 0.890204, 0, -0.068697, 0.906347, 0.976040, 0, 0.025166, 1.103330, 1.079639, 0, 0.140691, 1.348344, 1.209945, 0, 0.289586, 1.668399, 1.382623, 0, 0.493329, 2.114322, 1.627982, 0, 0.796201, 2.794813, 2.013522, 0, 1.306768, 3.992224, 2.726601, 0, 2.381571, 6.741452, 4.553893, 0, 6.278335, 20.355468, 20.867742])
            }
        ]

        // 预先生成四种不同占空比的样本
        this._waveTable = [
            this._audioCtx.createPeriodicWave(this._waveTableData[0].real, this._waveTableData[0].imag),
            this._audioCtx.createPeriodicWave(this._waveTableData[1].real, this._waveTableData[1].imag),
            this._audioCtx.createPeriodicWave(this._waveTableData[2].real, this._waveTableData[2].imag),
            this._audioCtx.createPeriodicWave(this._waveTableData[3].real, this._waveTableData[3].imag),
        ]
    }

    _setActive(v) {
        if (v) {
            this._enable = true
        } else {
            this._enable = false
            this._LENGTH_COUNTER = 0
        }
    }

    _getTimer() {
        this._timer = (this._TIMER_HIGH << 8) + (this._TIMER_LOW)
        return this._timer
    }
    _setTimer(value) {
        this._timer = value
        this._TIMER_HIGH = (value >> 8) & 0x7
        this._TIMER_LOW = value & 0xFF
    }
    _getFreq() {
        this._freq = this._cpuFreq / (16 * (this._getTimer() + 1))
        return this._freq
    }

    //  AudioAPI相关

    initAudioContext() {
        this._audioCtx = new AudioContext()
        this._audioSourceNode = this._audioCtx.createOscillator()
        this._audioGainNode = this._audioCtx.createGain()
        this._audioSourceNode.connect(this._audioGainNode)
        this._audioGainNode.connect(this._audioCtx.destination)
    }
    suspend(){
        this._audioCtx.suspend()
    }
    resume(){
        this._audioCtx.resume()
    }
    startAudioContext() {
        this._audioSourceNode.start()
    }
    setOutputVolume(volume) {
        this._audioGainNode.gain.setValueAtTime(volume * this._volumeScale, this._audioCtx.currentTime)
    }
    setOutputFreq(freq) {
        this._audioSourceNode.frequency.setValueAtTime(freq, this._audioCtx.currentTime)
    }
    setOutputDuty(idx) {
        if (idx == this._CURRENT_DUTY) {
            return
        }
        else {
            this._CURRENT_DUTY = idx
            this._audioSourceNode.setPeriodicWave(this._waveTable[idx])
        }
    }
    mute() {
        this.setOutputVolume(0)
    }
    unmute() {
        this._audioCtx.resume()
    }
    play() {
        if (!(this._enable)) {
            this.mute()
        } else if (this._getTimer() < 8) {
            this.mute()
        } else if (this._LENGTH_COUNTER == 0) {
            this.mute()
        } else {
            let duty = this._DUTY
            let freq = this._getFreq()
            let volume
            if (this._CONSTANT_VOLUME) {
                volume = this._VOLUME
            } else {
                // 此处因为模拟精度问题，每秒钟只刷新60次
                // 而实机每秒刷新240次
                // 包络最低音量为0，此处把包络音量整体提升2
                // 如果不做此处理，某些音效听起来会十分难受，基本没响就没了
                // 例如mario，顶问号出金币的叮一声的音效
                volume = this._envelope + 2
            }
            this.setOutputDuty(duty)
            this.setOutputFreq(freq)
            this.setOutputVolume(volume * 0.06)
        }
    }

    // 时序相关
    _sweepAction() {
        if (!(this._SWEEP_ENABLE)) return

        if (this._SWEEP_CURRENT_COUNT != 0) {
            this._SWEEP_CURRENT_COUNT--
        } else {
            this._SWEEP_CURRENT_COUNT = this._SWEEP_PERIOD
            let sign = this._SWEEP_NEGATE ? -1 : 1
            let changeAmount = (this._getTimer() >> this._SWEEP_SHIFT) * sign
            if (changeAmount < 0) {
                changeAmount -= this._isPusle1
            }
            this._setTimer((this._getTimer() + changeAmount) & 0x07FF)
        }
    }
    _lengthCounterAction() {
        if (this._LENGTH_COUNTER > 0 && !(this._LENGTH_COUNTER_HALT)) {
            this._LENGTH_COUNTER--
        }
    }
    _envelopeAction() {
        if (this._envelope == 0 && this._LENGTH_COUNTER_HALT) {
            this._envelope = 15
        } else {
            if (this._envelope > 0) {
                this._envelope--
            }
        }
    }
}

// *******************************************
// 
// 三角波通道
// 
// *******************************************
class TriangleChannel {
    constructor() {
        // http://wiki.nesdev.com/w/index.php/APU_Triangle

        this._enable = false
        this._timer = 0
        this._freq = 0
        this.initAudioContext()

        this._volumeScale = 0.12 // 调整该轨道发声的比例
        // 
        this._cpuFreq = 1789773  // 1.789773MHz
        // REGS
        this._LENGTH_COUNTER_HALT = 0
        this._TIMER_LOW = 0
        this._TIMER_HIGH = 0
        this._LENGTH_COUNTER = 0
        this._LINEAR_COUNTER = 0

        this._linearCounterSetFlag = 0
        this._currentLinearCounter = 0
    }

    _setActive(v) {
        if (v) {
            this._enable = true
        } else {
            this._enable = false
            this._linearCounterSetFlag = 1
            this._LENGTH_COUNTER = 0
        }
    }
    _getTimer() {
        this._timer = (this._TIMER_HIGH << 8) + (this._TIMER_LOW)
        return this._timer
    }
    _setTimer(value) {
        this._timer = value
        this._TIMER_HIGH = (value >> 8) & 0x7
        this._TIMER_LOW = value & 0xFF
    }
    _getFreq() {
        this._freq = this._cpuFreq / (32 * (this._getTimer() + 1))
        return this._freq
    }

    // AudioAPI相关

    initAudioContext() {
        this._audioCtx = new AudioContext()
        this._audioSourceNode = this._audioCtx.createOscillator()
        this._audioGainNode = this._audioCtx.createGain()
        this._audioSourceNode.connect(this._audioGainNode)
        this._audioGainNode.connect(this._audioCtx.destination)
        this._audioSourceNode.type = 'triangle'
    }
    suspend(){
        this._audioCtx.suspend()
    }
    resume(){
        this._audioCtx.resume()
    }
    startAudioContext() {
        this._audioSourceNode.start()
    }
    setOutputVolume(volume) {
        // console.log(volume)
        this._audioGainNode.gain.setValueAtTime(volume * this._volumeScale, this._audioCtx.currentTime)
    }
    setOutputFreq(freq) {
        this._audioSourceNode.frequency.setValueAtTime(freq, this._audioCtx.currentTime)
    }
    mute() {
        this.setOutputVolume(0)
    }
    play() {
        if (!(this._enable)) {
            this.mute()
        } else if (this._getTimer() < 4) {
            //这里没有硬性要求，但是<4的话频率会到18kHz以上。原版NES的DAC有个14kHz的低通滤波，所以这里频率放高没有意义
            this.mute()
        } else if (this._LENGTH_COUNTER == 0) {
            this.mute()
        } else if (this._LENGTH_COUNTER_HALT && this._currentLinearCounter == 0) {
            this.mute()
        } else {
            let freq = this._getFreq()
            this.setOutputFreq(freq)
            this.setOutputVolume(1) //三角波固定音量
        }
    }

    // 时序相关

    _lengthCounterAction() {
        if (this._LENGTH_COUNTER > 0 && !(this._LENGTH_COUNTER_HALT)) {
            this._LENGTH_COUNTER--
        }
    }
    _linearCounterAction() {
        if (!(this._LENGTH_COUNTER)) return

        if (!(this._LENGTH_COUNTER_HALT)) {
            // LENGTH COUNTER HALT 和 linear Control Flag是一个位
            // 当该位为0时，计时使用 length Counter ，该位为1时，计时使用linear Counter
            this._linearCounterSetFlag = 1
            return
        }
        if (this._linearCounterSetFlag) {
            this._currentLinearCounter = this._LINEAR_COUNTER
            this._linearCounterSetFlag = 0
            return
        } else {
            if (this._currentLinearCounter > 0) {
                this._currentLinearCounter--
            }
        }
    }
}
