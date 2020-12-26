// CPU 2A03

class CPU {
    constructor() {

        // 掩码
        this._highbit = 0x80        // 最高位掩码
        this._nexthbit = 0x40;      // 次高位掩码

        // CPU的周期状态
        this.cycleCount = 0         // 当前周期计数
        this.targetCount = 29780    // nes每一帧画面的cpu时钟数

        // 优先级 RESET>NMI>IRQ
        this._interrupts = false    // 总体状态，标明是否有中断发出
        this.IRQ = false            // IRQ中断
        this.NMI = false            // NMI不可屏蔽中断
        this.RESET = false          // 复位中断


        // CPU的 P 寄存器的每一位
        // nv-bdizc
        this._FLAG_C = 0
        this._FLAG_Z = 0
        this._FLAG_I = 0
        this._FLAG_D = 0
        this._FLAG_B = 0
        this._FLAG_U = 0
        this._FLAG_V = 0
        this._FLAG_N = 0

        // 寄存器
        this.PC = 0
        this.A = 0
        this.X = 0
        this.Y = 0
        this.S = 0xFD //开机默认$FD

        // 使用的内存实例
        this.mem = null

        // CPU的指令表
        this.opcodeTable = [
            // proc, length, cycles, addrProc
            // 指令，长度，周期，寻址方式

            // 暂不处理非法指令，跳转指令寻址不使用单独函数
            // 名称带*的伪非法指令

            // 该指令表可通过excel文件间接生成
            [this._I_BRK, 2, 7, this._addrImm],     //	00	BRK
            [this._I_ORA, 2, 6, this.addrDPIndX],   //	01	ORA
            [this._I_ILL, 1, 2, null],              //  02  HLT*
            [this._I_ILL, 2, 8, this.addrDPIndX],	//	03	ASO*
            [this._I_ILL, 2, 3, this._addrDP],	    //	04	SKB*
            [this._I_ORA, 2, 3, this._addrDP],	    //	05	ORA
            [this._I_ASL, 2, 5, this._addrDP],	    //	06	ASL
            [this._I_ILL, 2, 5, this._addrDP],	    //	07	ASO*
            [this._I_PHP, 1, 3, null],	            //	08	PHP
            [this._I_ORA, 2, 2, this._addrImm],	    //	09	ORA
            [this._I_ASL, 1, 2, this._addrRegA],	//	0A	ASL
            [this._I_ILL, 2, 2, this._addrImm],	    //	0B	ANC*
            [this._I_ILL, 3, 4, this._addrAbs],	    //	0C	SKW*
            [this._I_ORA, 3, 4, this._addrAbs],	    //	0D	ORA
            [this._I_ASL, 3, 6, this._addrAbs],	    //	0E	ASL
            [this._I_ILL, 3, 6, this._addrAbs],	    //	0F	ASO*

            // ------------
            [this._I_BPL, 2, 2, null],	            //	10	BPL
            [this._I_ORA, 2, 5, this._addrDPIndY],	//	11	ORA
            [this._I_ILL, 1, 2, null],	            //	12	HLT*
            [this._I_ILL, 2, 8, this._addrDPIndY],	//	13	ASO*
            [this._I_ILL, 2, 4, this._addrDPX],	    //	14	SKB*
            [this._I_ORA, 2, 4, this._addrDPX],     //	15	ORA
            [this._I_ASL, 2, 6, this._addrDPX],	    //	16	ASL
            [this._I_ILL, 2, 6, this._addrDPX],  	//	17	ASO*
            [this._I_CLC, 1, 2, null],	            //	18	CLC
            [this._I_ORA, 3, 4, this._addrAbsY],	//	19	ORA
            [this._I_ILL, 1, 2, null],	            //	1A	NOP*
            [this._I_ILL, 3, 7, this._addrAbsY], 	//	1B	ASO*
            [this._I_ILL, 3, 4, this._addrAbsX], 	//	1C	SKW*
            [this._I_ORA, 3, 4, this._addrAbsX],	//	1D	ORA
            [this._I_ASL, 3, 7, this._addrAbsX],	//	1E	ASL
            [this._I_ILL, 3, 7, this._addrAbsX], 	//	1F	ASO*

            // ------------

            // ！注意，20 JSR传进去的虽然是地址，但是不取指，直接传给PC
            // 跳转用，理论上这里是ABS寻址，但用法是Imm，故改为Imm

            [this._I_JSR, 3, 6, this._addrImm],	    //	20	JSR 
            [this._I_AND, 2, 6, this.addrDPIndX],	//	21	AND
            [this._I_ILL, 1, 2, null],	            //	22	HLT*
            [this._I_ILL, 2, 8, this.addrDPIndX],	//	23	RLA*
            [this._I_BIT, 2, 3, this._addrDP],	    //	24	BIT
            [this._I_AND, 2, 3, this._addrDP],	    //	25	AND
            [this._I_ROL, 2, 5, this._addrDP],	    //	26	ROL
            [this._I_ILL, 2, 5, this._addrDP],	    //	27	RLA*
            [this._I_PLP, 1, 4, null],	            //	28	PLP
            [this._I_AND, 2, 2, this._addrImm],	    //	29	AND
            [this._I_ROL, 1, 2, this._addrRegA],	//	2A	ROL
            [this._I_ILL, 2, 2, this._addrImm],	    //	2B	ANC*
            [this._I_BIT, 3, 4, this._addrAbs],	    //	2C	BIT
            [this._I_AND, 3, 4, this._addrAbs],	    //	2D	AND
            [this._I_ROL, 3, 6, this._addrAbs],	    //	2E	ROL
            [this._I_ILL, 3, 6, this._addrAbs],	    //	2F	RLA*

            // ------------
            [this._I_BMI, 2, 2, null],	            //	30	BMI
            [this._I_AND, 2, 5, this._addrDPIndY],	//	31	AND
            [this._I_ILL, 1, 2, null],	            //	32	HLT*
            [this._I_ILL, 2, 8, this._addrDPIndY],	//	33	RLA*
            [this._I_ILL, 2, 4, this._addrDPX],	    //	34	SKB*
            [this._I_AND, 2, 4, this._addrDPX],	    //	35	AND
            [this._I_ROL, 2, 6, this._addrDPX],	    //	36	ROL
            [this._I_ILL, 2, 6, this._addrDPX],	    //	37	RLA*
            [this._I_SEC, 1, 2, null],	            //	38	SEC
            [this._I_AND, 3, 4, this._addrAbsY],	//	39	AND
            [this._I_ILL, 1, 2, null],	            //	3A	NOP*
            [this._I_ILL, 3, 7, this._addrAbsY],	//	3B	RLA*
            [this._I_ILL, 3, 4, this._addrAbsX],	//	3C	SKW*
            [this._I_AND, 3, 4, this._addrAbsX],	//	3D	AND
            [this._I_ROL, 3, 7, this._addrAbsX],	//	3E	ROL
            [this._I_ILL, 3, 7, this._addrAbsX],	//	3F	RLA*

            // ------------
            [this._I_RTI, 1, 6, null],	            //	40	RTI
            [this._I_EOR, 2, 6, this.addrDPIndX],	//	41	EOR
            [this._I_ILL, 1, 2, null],	            //	42	HLT*
            [this._I_ILL, 2, 8, this.addrDPIndX],	//	43	LSE*
            [this._I_ILL, 2, 3, this._addrDP],	    //	44	SKB*
            [this._I_EOR, 2, 3, this._addrDP],	    //	45	EOR
            [this._I_LSR, 2, 5, this._addrDP],	    //	46	LSR
            [this._I_ILL, 2, 5, this._addrDP],	    //	47	LSE*
            [this._I_PHA, 1, 3, null],	            //	48	PHA
            [this._I_EOR, 2, 2, this._addrImm],	    //	49	EOR
            [this._I_LSR, 1, 2, this._addrRegA],	//	4A	LSR
            [this._I_ILL, 2, 2, this._addrImm],	    //	4B	ALR*

            // 注意，此处JMP为接收地址，理论为Abs寻址，但是实际把数直接给PC
            // 故当立即数处理

            [this._I_JMP, 3, 3, this._addrImm],	    //	4C	JMP
            [this._I_EOR, 3, 4, this._addrAbs],	    //	4D	EOR
            [this._I_LSR, 3, 6, this._addrAbs],	    //	4E	LSR
            [this._I_ILL, 3, 6, this._addrAbs],	    //	4F	LSE*

            // ------------
            [this._I_BVC, 2, 2, null],	            //	50	BVC
            [this._I_EOR, 2, 5, this._addrDPIndY],	//	51	EOR
            [this._I_ILL, 1, 2, null],	            //	52	HLT*
            [this._I_ILL, 2, 8, this._addrDPIndY],	//	53	LSE*
            [this._I_ILL, 2, 4, this._addrDPX],  	//	54	SKB*
            [this._I_EOR, 2, 4, this._addrDPX],	    //	55	EOR
            [this._I_LSR, 2, 6, this._addrDPX],	    //	56	LSR
            [this._I_ILL, 2, 6, this._addrDPX],	    //	57	LSE*
            [this._I_CLI, 1, 2, null],	            //	58	CLI
            [this._I_EOR, 3, 4, this._addrAbsY],	//	59	EOR
            [this._I_ILL, 1, 2, null],	            //	5A	NOP*
            [this._I_ILL, 3, 7, this._addrAbsY],	//	5B	LSE*
            [this._I_ILL, 3, 4, this._addrAbsX],	//	5C	SKW*
            [this._I_EOR, 3, 4, this._addrAbsX],	//	5D	EOR
            [this._I_LSR, 3, 7, this._addrAbsX],	//	5E	LSR
            [this._I_ILL, 3, 7, this._addrAbsX],	//	5F	LSE*

            // ------------
            [this._I_RTS, 1, 6, null],	            //	60	RTS
            [this._I_ADC, 2, 6, this.addrDPIndX],	//	61	ADC
            [this._I_ILL, 1, 2, null],	            //	62	HLT*
            [this._I_ILL, 2, 8, this.addrDPIndX],	//	63	RRA*
            [this._I_ILL, 2, 3, this._addrDP],	    //	64	SKB*
            [this._I_ADC, 2, 3, this._addrDP],	    //	65	ADC
            [this._I_ROR, 2, 5, this._addrDP],	    //	66	ROR
            [this._I_ILL, 2, 5, this._addrDP],	    //	67	RRA*
            [this._I_PLA, 1, 4, null],	            //	68	PLA
            [this._I_ADC, 2, 2, this._addrImm],	    //	69	ADC
            [this._I_ROR, 1, 2, this._addrRegA],	//	6A	ROR
            [this._I_ILL, 2, 2, this._addrImm],	    //	6B	ARR*
            [this._I_JMP, 3, 5, this._addrJmpInd],	//	6C	JMP
            [this._I_ADC, 3, 4, this._addrAbs],	    //	6D	ADC
            [this._I_ROR, 3, 6, this._addrAbs],	    //	6E	ROR
            [this._I_ILL, 3, 6, this._addrAbs],	    //	6F	RRA*

            // ------------
            [this._I_BVS, 2, 2, null],	            //	70	BVS
            [this._I_ADC, 2, 5, this._addrDPIndY],	//	71	ADC
            [this._I_ILL, 1, 2, null],	            //	72	HLT*
            [this._I_ILL, 2, 8, this._addrDPIndY],	//	73	RRA*
            [this._I_ILL, 2, 4, this._addrDPX],	    //	74	SKB*
            [this._I_ADC, 2, 4, this._addrDPX],  	//	75	ADC
            [this._I_ROR, 2, 6, this._addrDPX],	    //	76	ROR
            [this._I_ILL, 2, 6, this._addrDPX],	    //	77	RRA*
            [this._I_SEI, 1, 2, null],	            //	78	SEI
            [this._I_ADC, 3, 4, this._addrAbsY],	//	79	ADC
            [this._I_ILL, 1, 2, null],	            //	7A	NOP*
            [this._I_ILL, 3, 7, this._addrAbsY],	//	7B	RRA*
            [this._I_ILL, 3, 4, this._addrAbsX],	//	7C	SKW*
            [this._I_ADC, 3, 4, this._addrAbsX],	//	7D	ADC
            [this._I_ROR, 3, 7, this._addrAbsX],	//	7E	ROR
            [this._I_ILL, 3, 7, this._addrAbsX],	//	7F	RRA*

            // ------------
            [this._I_ILL, 2, 2, this._addrImm],	    //	80	SKB*
            [this._I_STA, 2, 6, this.addrDPIndX],	//	81	STA
            [this._I_ILL, 2, 2, this._addrImm],	    //	82	SKB*
            [this._I_ILL, 2, 6, this.addrDPIndX],	//	83	SAX*
            [this._I_STY, 2, 3, this._addrDP],	    //	84	STY
            [this._I_STA, 2, 3, this._addrDP],	    //	85	STA
            [this._I_STX, 2, 3, this._addrDP],	    //	86	STX
            [this._I_ILL, 2, 3, this._addrDP],	    //	87	SAX*
            [this._I_DEY, 1, 2, null],	            //	88	DEY
            [this._I_ILL, 2, 2, this._addrImm],	    //	89	SKB*
            [this._I_TXA, 1, 2, null],	            //	8A	TXA
            [this._I_ILL, 2, 2, this._addrImm],	    //	8B	ANE*
            [this._I_STY, 3, 4, this._addrAbs],	    //	8C	STY
            [this._I_STA, 3, 4, this._addrAbs],	    //	8D	STA
            [this._I_STX, 3, 4, this._addrAbs],	    //	8E	STX
            [this._I_ILL, 3, 4, this._addrAbs],	    //	8F	SAX*

            // ------------
            [this._I_BCC, 2, 2, null],	            //	90	BCC
            [this._I_STA, 2, 6, this._addrDPIndY],	//	91	STA
            [this._I_ILL, 1, 2, null],	            //	92	HLT*
            [this._I_ILL, 2, 6, this._addrDPIndY],	//	93	SHA*
            [this._I_STY, 2, 4, this._addrDPX],	    //	94	STY
            [this._I_STA, 2, 4, this._addrDPX],	    //	95	STA
            [this._I_STX, 2, 4, this._addrDPY],	    //	96	STX
            [this._I_ILL, 2, 4, this._addrDPY],	    //	97	SAX*
            [this._I_TYA, 1, 2, null],	            //	98	TYA
            [this._I_STA, 3, 5, this._addrAbsY],	//	99	STA
            [this._I_TXS, 1, 2, null],	            //	9A	TXS
            [this._I_ILL, 3, 5, this._addrAbsY],	//	9B	SHS*
            [this._I_ILL, 3, 5, this._addrAbsX],	//	9C	SHY*
            [this._I_STA, 3, 5, this._addrAbsX],	//	9D	STA
            [this._I_ILL, 3, 5, this._addrAbsY],	//	9E	SHX*
            [this._I_ILL, 3, 5, this._addrAbsY],	//	9F	SHA*

            // ------------
            [this._I_LDY, 2, 2, this._addrImm],	    //	A0	LDY
            [this._I_LDA, 2, 6, this.addrDPIndX],	//	A1	LDA
            [this._I_LDX, 2, 2, this._addrImm],	    //	A2	LDX
            [this._I_ILL, 2, 6, this.addrDPIndX],	//	A3	LAX*
            [this._I_LDY, 2, 3, this._addrDP],	    //	A4	LDY
            [this._I_LDA, 2, 3, this._addrDP],	    //	A5	LDA
            [this._I_LDX, 2, 3, this._addrDP],	    //	A6	LDX
            [this._I_ILL, 2, 3, this._addrDP],	    //	A7	LAX*
            [this._I_TAY, 1, 2, null],	            //	A8	TAY
            [this._I_LDA, 2, 2, this._addrImm],	    //	A9	LDA
            [this._I_TAX, 1, 2, null],	            //	AA	TAX
            [this._I_ILL, 2, 2, this._addrImm],	    //	AB	ANX*
            [this._I_LDY, 3, 4, this._addrAbs],	    //	AC	LDY
            [this._I_LDA, 3, 4, this._addrAbs],	    //	AD	LDA
            [this._I_LDX, 3, 4, this._addrAbs],	    //	AE	LDX
            [this._I_ILL, 3, 4, this._addrAbs],	    //	AF	LAX*

            // ------------
            [this._I_BCS, 2, 2, null],	            //	B0	BCS
            [this._I_LDA, 2, 5, this._addrDPIndY],	//	B1	LDA
            [this._I_ILL, 1, 2, null],	            //	B2	HLT*
            [this._I_ILL, 2, 5, this._addrDPIndY],	//	B3	LAX*
            [this._I_LDY, 2, 4, this._addrDPX],	    //	B4	LDY
            [this._I_LDA, 2, 4, this._addrDPX],	    //	B5	LDA
            [this._I_LDX, 2, 4, this._addrDPY],	    //	B6	LDX
            [this._I_ILL, 2, 4, this._addrDPY],	    //	B7	LAX*
            [this._I_CLV, 1, 2, null],	            //	B8	CLV
            [this._I_LDA, 3, 4, this._addrAbsY],	//	B9	LDA
            [this._I_TSX, 1, 2, null],	            //	BA	TSX
            [this._I_ILL, 3, 4, this._addrAbsY],	//	BB	LAS*
            [this._I_LDY, 3, 4, this._addrAbsX],	//	BC	LDY
            [this._I_LDA, 3, 4, this._addrAbsX],	//	BD	LDA
            [this._I_LDX, 3, 4, this._addrAbsY],	//	BE	LDX
            [this._I_ILL, 3, 4, this._addrAbsY],	//	BF	LAX*

            // ------------
            [this._I_CPY, 2, 2, this._addrImm],	    //	C0	CPY
            [this._I_CMP, 2, 6, this.addrDPIndX],	//	C1	CMP
            [this._I_ILL, 2, 2, this._addrImm],	    //	C2	SKB*
            [this._I_ILL, 2, 8, this.addrDPIndX],	//	C3	DCM*
            [this._I_CPY, 2, 3, this._addrDP],	    //	C4	CPY
            [this._I_CMP, 2, 3, this._addrDP],	    //	C5	CMP
            [this._I_DEC, 2, 5, this._addrDP],	    //	C6	DEC
            [this._I_ILL, 2, 5, this._addrDP],	    //	C7	DCM*
            [this._I_INY, 1, 2, null],	            //	C8	INY
            [this._I_CMP, 2, 2, this._addrImm],	    //	C9	CMP
            [this._I_DEX, 1, 2, null],	            //	CA	DEX
            [this._I_ILL, 2, 2, this._addrImm],	    //	CB	SBX*
            [this._I_CPY, 3, 4, this._addrAbs],	    //	CC	CPY
            [this._I_CMP, 3, 4, this._addrAbs],	    //	CD	CMP
            [this._I_DEC, 3, 6, this._addrAbs],	    //	CE	DEC
            [this._I_ILL, 3, 6, this._addrAbs],	    //	CF	DCM*

            // ------------
            [this._I_BNE, 2, 2, null],	            //	D0	BNE
            [this._I_CMP, 2, 5, this._addrDPIndY],	//	D1	CMP
            [this._I_ILL, 1, 2, null],	            //	D2	HLT*
            [this._I_ILL, 2, 8, this._addrDPIndY],	//	D3	DCM*
            [this._I_ILL, 2, 4, this._addrDPX],	    //	D4	SKB*
            [this._I_CMP, 2, 4, this._addrDPX],	    //	D5	CMP
            [this._I_DEC, 2, 6, this._addrDPX],	    //	D6	DEC
            [this._I_ILL, 2, 6, this._addrDPX],	    //	D7	DCM*
            [this._I_CLD, 1, 2, null],	            //	D8	CLD
            [this._I_CMP, 3, 4, this._addrAbsY],	//	D9	CMP
            [this._I_ILL, 1, 2, null],	            //	DA	NOP*
            [this._I_ILL, 3, 7, this._addrAbsY],	//	DB	DCM*
            [this._I_ILL, 3, 4, this._addrAbsX],	//	DC	SKW*
            [this._I_CMP, 3, 4, this._addrAbsX],	//	DD	CMP
            [this._I_DEC, 3, 7, this._addrAbsX],	//	DE	DEC
            [this._I_ILL, 3, 7, this._addrAbsX],	//	DF	DCM*

            // ------------
            [this._I_CPX, 2, 2, this._addrImm],	    //	E0	CPX
            [this._I_SBC, 2, 6, this.addrDPIndX],	//	E1	SBC
            [this._I_ILL, 2, 2, this._addrImm],	    //	E2	SKB*
            [this._I_ILL, 2, 8, this.addrDPIndX],	//	E3	INS*
            [this._I_CPX, 2, 3, this._addrDP],	    //	E4	CPX
            [this._I_SBC, 2, 3, this._addrDP],	    //	E5	SBC
            [this._I_INC, 2, 5, this._addrDP],	    //	E6	INC
            [this._I_ILL, 2, 5, this._addrDP],	    //	E7	INS*
            [this._I_INX, 1, 2, null],	            //	E8	INX
            [this._I_SBC, 2, 2, this._addrImm],	    //	E9	SBC
            [this._I_NOP, 1, 2, null],	            //	EA	NOP
            [this._I_ILL, 2, 2, this._addrImm],	    //	EB	SBC*
            [this._I_CPX, 3, 4, this._addrAbs],	    //	EC	CPX
            [this._I_SBC, 3, 4, this._addrAbs],	    //	ED	SBC
            [this._I_INC, 3, 6, this._addrAbs],	    //	EE	INC
            [this._I_ILL, 3, 6, this._addrAbs],	    //	EF	INS*

            // ------------
            [this._I_BEQ, 2, 2, null],	            //	F0	BEQ
            [this._I_SBC, 2, 5, this._addrDPIndY],	//	F1	SBC
            [this._I_ILL, 1, 2, null],	            //	F2	HLT*
            [this._I_ILL, 2, 8, this._addrDPIndY],	//	F3	INS*
            [this._I_ILL, 2, 4, this._addrDPX],	    //	F4	SKB*
            [this._I_SBC, 2, 4, this._addrDPX],	    //	F5	SBC
            [this._I_INC, 2, 6, this._addrDPX],	    //	F6	INC
            [this._I_ILL, 2, 6, this._addrDPX],	    //	F7	INS*
            [this._I_SED, 1, 2, null],	            //	F8	SED
            [this._I_SBC, 3, 4, this._addrAbsY],	//	F9	SBC
            [this._I_ILL, 1, 2, null],	            //	FA	NOP*
            [this._I_ILL, 3, 7, this._addrAbsY],	//	FB	INS*
            [this._I_ILL, 3, 4, this._addrAbsX],	//	FC	SKW*
            [this._I_SBC, 3, 4, this._addrAbsX],	//	FD	SBC
            [this._I_INC, 3, 7, this._addrAbsX],	//	FE	INC
            [this._I_ILL, 3, 7, this._addrAbsX],	//	FF	INS*
        ]
    }

    // *******************************************
    // 
    // P寄存器访问
    // 因为对单个位的访问频率远大于对整个P寄存器的访问频率
    // 故把P寄存器各个位拆散，以提高性能
    // 
    // *******************************************

    _getP() {
        let t = 0
        t |= (this._FLAG_C ? 1 : 0)
        t |= (this._FLAG_Z ? 1 : 0) << 1
        t |= (this._FLAG_I ? 1 : 0) << 2
        t |= (this._FLAG_D ? 1 : 0) << 3
        t |= (this._FLAG_B ? 1 : 0) << 4
        t |= (this._FLAG_U ? 1 : 0) << 5
        t |= (this._FLAG_V ? 1 : 0) << 6
        t |= (this._FLAG_N ? 1 : 0) << 7
        return t & 0xFF
    }

    _setP(byte) {
        byte = byte & 0xFF
        this._FLAG_C = byte & 1
        this._FLAG_Z = (byte >> 1) & 1
        this._FLAG_I = (byte >> 2) & 1
        this._FLAG_D = (byte >> 3) & 1
        this._FLAG_B = (byte >> 4) & 1
        this._FLAG_U = (byte >> 5) & 1
        this._FLAG_V = (byte >> 6) & 1
        this._FLAG_N = (byte >> 7) & 1
    }

    // 向外输出CPU各个寄存器的状态和当前周期

    showStates() {
        return {
            'A': this.A,
            'X': this.X,
            'Y': this.Y,
            'SP': this.S,
            'PC': this.PC,
            'P': this._getP(),
            'cycle': this.cycleCount
        }
    }

    // *******************************************
    // 
    // 堆栈访问 , P指针默认指向当前最低位有数据单元
    // 
    // *******************************************

    // 压入双字节
    _stackPushWord(dword) {
        this._stackPushByte((dword >> 8) & 0xFF)
        this._stackPushByte(dword & 0xFF)
    }
    // 压入单字节
    _stackPushByte(byte) {
        this.mem.writeStack(this.S, byte)
        this.S = (this.S - 1) & 0xFF
    }
    // 弹出双字节
    _stackPopWord() {
        let low = this._stackPopByte()
        let high = this._stackPopByte() << 8
        return low + high
    }
    // 弹出单字节
    _stackPopByte() {
        this.S = (this.S + 1) & 0xFF
        let v = this.mem.readStack(this.S)
        return v
    }

    // *******************************************
    // 
    // CPU的寻址函数
    // 参数为统一的：地址，数据，是否写入
    // 
    // *******************************************

    // 寄存器A
    _addrRegA(abs, value, isWrite) {
        if (isWrite) {
            this.A = value
        } else {
            return this.A
        }
    }

    // 立即数寻址
    _addrImm(abs, value, isWrite) {
        return abs
    }

    // 绝对地址寻址
    _addrAbs(abs, value, isWrite) {
        if (isWrite) {
            this.mem.write(abs, value)
        } else {
            return this.mem.read(abs)
        }
    }

    // 绝对地址加X寄存器偏移量寻址
    _addrAbsX(abs, value, isWrite) {
        let addr = (abs + this.X) & 0xFFFF
        if (isWrite) {
            this.mem.write(addr, value)
        } else {
            return this.mem.read(addr)
        }
    }

    // 绝对地址加Y寄存器偏移量寻址
    _addrAbsY(abs, value, isWrite) {
        let addr = (abs + this.Y) & 0xFFFF
        if (isWrite) {
            this.mem.write(addr, value)
        } else {
            return this.mem.read(addr)
        }
    }

    // JMP指令专用的间接跳转
    _addrJmpInd(addr) {
        let nextAddr = addr + 1
        let lB = get16LowByte(addr)

        // 还原JMP的硬件BUG
        if (lB == 0XFF) {
            nextAddr = makeDword(
                get16HighByte(addr),
                0x00)
        }
        return (makeDword(
            this.mem.read(nextAddr),
            this.mem.read(addr)))
    }

    // CPU的零页寻址
    _addrDP(offset, value, isWrite) {
        if (isWrite) {
            this.mem.write(offset, value)
        } else {
            return this.mem.read(offset)
        }
    }

    // 零页加X偏移 地址在零页内部回滚
    _addrDPX(offset, value, isWrite) {
        let addr = (offset + this.X) & 0xFF
        if (isWrite) {
            this.mem.write(addr, value)
        } else {
            return this.mem.read(addr)
        }
    }

    // 零页加Y偏移 地址在零页内部回滚
    _addrDPY(offset, value, isWrite) {
        let addr = (offset + this.Y) & 0xFF
        if (isWrite) {
            this.mem.write(addr, value)
        } else {
            return this.mem.read(addr)
        }
    }

    // 零页加X的间接寻址
    addrDPIndX(offset, value, isWrite) {
        let zpl = (offset + this.X) & 0xFF
        let low = this.mem.read(zpl)
        let high = this.mem.read((zpl + 1) & 0xFF)
        let addr = low + (high << 8)
        if (isWrite) {
            this.mem.write(addr, value)
        } else {
            return this.mem.read(addr)
        }
    }

    // 零页加Y的间接寻址，机制与DPIndX有不同，注意区别
    _addrDPIndY(offset, value, isWrite) {
        let addrLow = this.mem.read(offset)
        let addrhigh = this.mem.read((offset + 1) & 0xFF)
        let addr = (makeDword(addrhigh, addrLow) + this.Y) & 0xFFFF
        if (isWrite) {
            this.mem.write(addr, value)
        } else {
            return this.mem.read(addr)
        }
    }

    // *******************************************
    // 
    // CPU的指令执行部分
    // 
    // *******************************************

    // 执行直到目标周期数
    runTargetCycle() {
        let t = this.targetCount
        this.cycleCount = 0
        while (this.cycleCount < t) {
            this.runStep()
        }
    }

    // CPU单步
    runStep() {

        // 中断优先级， RESET>NMI>IRQ
        if (this._interrupts) {

            this._interrupts = false
            if (this.RESET) {
                this.RESET = false
                this._I_SPECIAL_RESET()
                return
            }
            if (this.NMI) {
                this.NMI = false
                this._I_SPECIAL_NMI()
                return
            }
            if (this.IRQ) {
                this.IRQ = false
                if (!(this._FLAG_I)) {
                    this._I_SPECIAL_IRQ()
                    return
                }
            }
        }
        this.execute.apply(this, this.opcodeTable[this.mem.read(this.PC)])
    }

    // 取指，译码，执行，写回
    execute(proc, length, cycles, addrProc) {

        // 传入的参数：
        // proc —— 指令的动作函数
        // length —— 指令长度
        // cycles —— 指令消耗周期
        // addrProc —— 使用的寻址函数

        let param = null
        if (length == 2) {
            param = this.mem.read(this.PC + 1)
        } else if (length == 3) {
            param = makeDword(this.mem.read(this.PC + 2), this.mem.read(this.PC + 1))
        }

        this.cycleCount += cycles
        this.PC += length

        // 这里需要对APU进行一下tick,把当前指令长度传过去
        // 目的是触发音频更新，APU也可能向CPU发起IRQ中断
        this.machine.apu.tick(length)

        // 传过来的proc会丢失this指向，这里需要使用call来绑定this
        proc.call(this, param, addrProc)

    }


    // *******************************************
    //
    // CPU的指令具体描述
    //
    // *******************************************

    // 就近跳转的指令大部分都有如下结构，单独抽取出来
    _branchNearlabel(value) {
        let offset = asSingedByte(value);
        this.PC = (this.PC + offset) & 0xFFFF
        this.cycleCount += 1    // 通常成功跳转后会多消耗一个周期
    }

    // 非法指令总和，直接无视该指令，通常遇到该指令都说明模拟出现问题，可以直接打出PC和cycle调试
    _I_ILL(param, addrProc) {
        console.log('ILL $PC/cycle/$param', this.PC.toString(16), this.cycleCount, param.toString(16))
    }

    // 其它的函数按opcode出现顺序排列

    // 因为寻址函数传入时会丢失this指向，所以取操作数和写回时，使用addrProc.call

    _I_BRK() {
        this._stackPushWord(this.PC)
        this._stackPushByte(this._getP())
        this._FLAG_I = 1
        this._FLAG_B = 1
        this.PC = makeDword(this.mem.read(0xFFFF), this.mem.read(0xFFFE))
    }

    _I_ORA(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this.A = this.A | value
        this._FLAG_N = this.A & this._highbit
        this._FLAG_Z = !(this.A)
    }

    _I_ASL(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this._FLAG_C = (value & this._highbit)
        value = (value << 1) & 0xFF
        this._FLAG_N = (value & this._highbit)
        this._FLAG_Z = !value
        addrProc.call(this, param, value, true) // 写回结果
    }

    _I_PHP(param, addrProc) {
        this._stackPushByte(this._getP() | 0x10)
    }

    _I_BPL(param, addrProc) {
        //nFlag不为零则跳转
        if (!(this._FLAG_N)) {
            this._branchNearlabel(param)
        }
    }

    _I_CLC(param, addrProc) {
        this._FLAG_C = 0
        return true
    }

    _I_JSR(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this._stackPushWord(this.PC - 1)
        this.PC = value
    }

    _I_AND(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this.A = this.A & value
        this._FLAG_N = (this.A & this._highbit)
        this._FLAG_Z = !(this.A)
    }

    _I_BIT(param, addrProc) {

        // 特别注意！
        // NESDEV上面一份6502的资料说，最后设置FLAG N V时使用result参与计算
        // 实际上这里应该是使用直接从内存中拿到的 value

        let value = addrProc.call(this, param, null, false)
        let result = this.A & value
        this._FLAG_Z = !result
        this._FLAG_N = value & this._highbit
        this._FLAG_V = value & this._nexthbit
    }

    _I_ROL(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        let c = this._FLAG_C

        this._FLAG_C = value & this._highbit
        value = (value << 1) & 0xFF
        if (c) {
            value = (value + 1) & 0xFF
        }
        addrProc.call(this, param, value, true) //写回value

        this._FLAG_N = value & this._highbit
        this._FLAG_Z = !value
    }

    _I_PLP(param, addrProc) {
        this._setP((this._getP() & 0x30) | (this._stackPopByte() & 0xCF))
    }

    _I_BMI(param, addrProc) {
        if (this._FLAG_N) {
            this._branchNearlabel(param)
        }
    }

    _I_SEC(param, addrProc) {
        this._FLAG_C = 1
    }

    _I_RTI(param, addrProc) {
        this._setP((this._getP() & 0x30) | (this._stackPopByte() & 0xCF))
        this.PC = this._stackPopWord();
    }

    _I_EOR(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this.A = this.A ^ value
        this._FLAG_N = this.A & this._highbit
        this._FLAG_Z = !(this.A)
    }

    _I_LSR(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this._FLAG_C = value & 0x01
        value = value >> 1
        this._FLAG_N = 0
        this._FLAG_Z = !value
        addrProc.call(this, param, value, true) //写回value
    }

    _I_PHA(param, addrProc) {
        this._stackPushByte(this.A)
    }

    _I_JMP(param, addrProc) {

        // 如果跳到自己的位置，那么说明是自旋，不必再去访问内存
        // 实测，不画图的情况下，跑650帧只省了几个ms……
        this.PC -= 3
        if (param == this.PC) {
            return
        }

        let value = addrProc.call(this, param, null, false)
        this.PC = value
    }

    _I_BVC(param, addrProc) {
        if (!(this._FLAG_V)) {
            this._branchNearlabel(param)
        }
    }

    _I_CLI(param, addrProc) {
        this._FLAG_I = 0
    }

    _I_RTS(param, addrProc) {
        this.PC = (this._stackPopWord() + 1) & 0xFFFF
    }

    _I_ADC(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        let result = this.A + value + (this._FLAG_C ? 1 : 0)
        this._FLAG_N = result & this._highbit
        let v = (~(this.A ^ value) & (this.A ^ result)) & this._highbit
        this._FLAG_V = v
        this._FLAG_C = (result > 0xFF)
        this.A = result & 0xFF
        this._FLAG_Z = !(this.A)
    }

    _I_ROR(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        if (this._FLAG_C) {
            this._FLAG_C = value & 1
            value = (value >> 1) + this._highbit
        } else {
            this._FLAG_C = value & 1
            value = value >> 1
        }
        this._FLAG_N = this._FLAG_C
        this._FLAG_Z = !value
        addrProc.call(this, param, value, true) //写回value
    }

    _I_PLA(param, addrProc) {
        this.A = this._stackPopByte()
        this._FLAG_N = this.A & this._highbit
        this._FLAG_Z = !(this.A)
    }

    _I_BVS(param, addrProc) {
        if (this._FLAG_V) {
            this._branchNearlabel(param)
        }
    }

    _I_SEI(param, addrProc) {
        this._FLAG_I = 1
    }

    _I_STA(param, addrProc) {
        let value = this.A
        addrProc.call(this, param, value, true) //写回value
    }

    _I_STY(param, addrProc) {
        let value = this.Y
        addrProc.call(this, param, value, true) //写回value
    }

    _I_STX(param, addrProc) {
        let value = this.X
        addrProc.call(this, param, value, true) //写回value
    }

    _I_DEY(param, addrProc) {
        this.Y = (this.Y - 1) & 0xFF
        this._FLAG_N = this.Y & this._highbit
        this._FLAG_Z = !(this.Y)
    }

    _I_TXA(param, addrProc) {
        this.A = this.X
        this._FLAG_N = this.X & this._highbit
        this._FLAG_Z = !(this.X)
    }

    _I_BCC(param, addrProc) {
        if (!(this._FLAG_C)) {
            this._branchNearlabel(param)
        }
    }

    _I_TYA(param, addrProc) {
        this.A = this.Y
        this._FLAG_N = this.Y & this._highbit
        this._FLAG_Z = !(this.Y)
    }

    _I_TXS(param, addrProc) {
        this.S = this.X
    }

    _I_LDY(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this.Y = value
        this._FLAG_N = value & this._highbit
        this._FLAG_Z = !value
    }

    _I_LDA(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this.A = value
        this._FLAG_N = value & this._highbit
        this._FLAG_Z = !value
    }

    _I_LDX(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        this.X = value
        this._FLAG_N = value & this._highbit
        this._FLAG_Z = !value
    }

    _I_TAY(param, addrProc) {
        this.Y = this.A
        this._FLAG_N = this.A & this._highbit
        this._FLAG_Z = !(this.A)
    }

    _I_TAX(param, addrProc) {
        this.X = this.A
        this._FLAG_N = this.A & this._highbit
        this._FLAG_Z = !(this.A)
    }

    _I_BCS(param, addrProc) {
        if (this._FLAG_C) {
            this._branchNearlabel(param)
        }
    }

    _I_CLV(param, addrProc) {
        this._FLAG_V = 0
    }

    _I_TSX(param, addrProc) {
        this.X = this.S
        this._FLAG_N = this.X & this._highbit
        this._FLAG_Z = !(this.X)
    }

    _I_CPY(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        let y = this.Y
        this._FLAG_N = (y - value) & this._highbit
        this._FLAG_Z = y == value
        this._FLAG_C = y >= value
    }

    _I_CMP(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        let a = this.A
        this._FLAG_N = (a - value) & this._highbit
        this._FLAG_Z = a == value
        this._FLAG_C = a >= value
    }

    _I_DEC(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        value = (value - 1) & 0xFF
        this._FLAG_N = value & this._highbit
        this._FLAG_Z = !value
        addrProc.call(this, param, value, true) //写回value
    }

    _I_INY(param, addrProc) {
        this.Y = (this.Y + 1) & 0xFF
        this._FLAG_N = this.Y & this._highbit
        this._FLAG_Z = !(this.Y)
    }

    _I_DEX(param, addrProc) {
        this.X = (this.X - 1) & 0xFF
        this._FLAG_N = this.X & this._highbit
        this._FLAG_Z = !(this.X)
    }

    _I_BNE(param, addrProc) {
        if (!(this._FLAG_Z)) {
            this._branchNearlabel(param)
        }
    }

    _I_CLD(param, addrProc) {
        this._FLAG_D = 0
    }

    _I_CPX(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        let x = this.X
        this._FLAG_N = (x - value) & this._highbit
        this._FLAG_Z = x == value
        this._FLAG_C = x >= value
    }

    _I_SBC(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        let result = value
        if (!(this._FLAG_C)) {
            result++
        }

        this._FLAG_C = result <= this.A
        result = (this.A - result) & 0xFF
        let v = ((this.A ^ value) & (this.A ^ result)) & this._highbit
        this._FLAG_V = v
        this._FLAG_N = result & this._highbit
        this._FLAG_Z = !result
        this.A = result & 0xFF
    }

    _I_INC(param, addrProc) {
        let value = addrProc.call(this, param, null, false)
        value = (value + 1) & 0xFF
        this._FLAG_N = value & this._highbit
        this._FLAG_Z = !value
        addrProc.call(this, param, value, true) //写回value
    }

    _I_INX(param, addrProc) {
        this.X = (this.X + 1) & 0xFF
        this._FLAG_N = this.X & this._highbit
        this._FLAG_Z = !(this.X)
    }

    _I_NOP(param, addrProc) {
        // 什么都不做，只消耗字节和周期
    }

    _I_BEQ(param, addrProc) {
        if (this._FLAG_Z) {
            this._branchNearlabel(param)
        }
    }

    _I_SED(param, addrProc) {
        this._FLAG_D = 1
    }

    //中断函数
    _I_SPECIAL_IRQ() {
        this.cycleCount += 7
        this._stackPushWord(this.PC)
        this._stackPushByte(this._getP())
        this._FLAG_I = 1
        this._FLAG_B = 0 //区分IRQ和BRK的标志，IRQ/NMI bFlag为0，BRK为1
        this.PC = makeDword(this.mem.read(0xFFFF), this.mem.read(0xFFFE))
    }
    _I_SPECIAL_RESET() {
        this.cycleCount = 0
        this._setP(0x30)
        this.S = 0xFD
        this.PC = 0x0000
        this._stackPushWord(this.PC)
        this._stackPushByte(this._getP())
        this.PC = makeDword(this.mem.read(0xFFFD), this.mem.read(0xFFFC))
    }
    _I_SPECIAL_NMI() {
        this.cycleCount += 7
        this._stackPushWord(this.PC)
        this._stackPushByte(this._getP())
        this._FLAG_I = 1
        this._FLAG_B = 0 //区分IRQ和BRK的标志，IRQ/NMI bFlag为0，BRK为1
        this.PC = makeDword(this.mem.read(0xFFFB), this.mem.read(0xFFFA))
    }

    // 触发中断
    setNMI() {
        this._interrupts = true
        this.NMI = true
    }
    setIRQ() {
        this._interrupts = true
        this.IRQ = true
    }
    setRESET() {
        this._interrupts = true
        this.RESET = true
    }
}