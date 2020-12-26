class PPU {
    constructor() {

        // *******************************************
        // 
        // PPU状态定义
        // 
        // *******************************************


        this._inRenderingProcess = false    // 当前周期下ppu是否在渲染状态
        this._justPowerUp = true            // 是否刚刚启动
        this._mirrorType = 0                // 0是垂直镜像  1是水平镜像

        // 常用常数

        this._PPUDOTS_PER_CPU = 3           // 每个CPU周期PPU画点数
        this._SP_TRANSPARENT = 0xF0         // 自定义的值，用该值代指精灵透明色
        this._SCANLINE_PIXEL = 341          // 每行扫描像素数
        this._HBLANK_PIXEL = 85             // 行消隐像素数
        this._NMI_CYCLE = 2273              // NMI开始到渲染持续周期
        this._FRAME_CYCLE = 29780           // 每帧CPU周期数
        this._OAMDMA_CYCLE = 513            // 执行OAMDMA消耗周期

        // 与CPU交互的地址所引出的状态
        // $2000 PPUCTRL > write
        // VPHB SINN
        this._NMI_ENABLE = 0            // V
        this._PPU_MASTER = 0            // P  未实现
        this._SPRITE_HEIGHT = 0         // H
        this._BG_TILE_SELECT = 0        // B
        this._SPRITE_TILE_SELECT = 0    // S
        this._INCREMENT_MODE = 0        // I
        this._NAMETABLE_SELECT = 0      // NN

        // $2001 PPUMASK > write
        // BGRs bMmG
        this._COLOR_EMPHASIS = 0        // BGR 未实现
        this._SPRITE_ENABLE = 0         // s
        this._BACKGROUND_ENABLE = 0     // b
        this._SPRITE_LEFT_C_ENABLE = 0  // M
        this._BG_LEFT_C_ENABLE = 0      // m
        this._GREYSCALE = 0             // G 未实现

        // 2002 PPUSTATUS < read
        // 读取该地址会使 $2005 $2006复位
        // VSO- ----
        this._VBLANK = 1                // V
        this._SPRITE_0_HIT = 0          // S
        this._SPRITE_OVERFLOW = 1       // O  未实现

        // $2003 OAMADDR > write
        // aaaaaaaa
        // 操作精灵内存的地址
        this._OAMADDR = 0

        // $2004 OAMDATA <> r/w 最好不要读
        // dddddddd
        // 操作精灵内存的数据
        this._OAMDATA = 0

        // $2005 PPUSCROOL
        // 此处不能简单赋值给两个变量存储背景X，Y偏移量，详情见https://wiki.nesdev.com/w/index.php/PPU_scrolling

        // 渲染过程中（vblank结束后开始输出点之后），CPU读写$2005 PPUSCROLL两次，其Y偏移的改变不会生效。因为写$2005只影响t的值而不影响v
        // (这里参照ppuscrolling中的 t和v。x偏移是t每行末尾复制到v中，y偏移只有在vblank结束，即渲染开始时复制到v中)
        // 而渲染过程中随着行数增加，v会自增。写2006寄存器两次会改变v的值。这时PPUSCROLL_Y 可以反推回去
        // 该状态存储渲染过程中被更改过的Y偏移
        this._PPUSCROLL_YinRendering = 0


        // 此处PPU的v寄存器改变了用法，把其作用抽象成_PPUSCROLL_YinRendering
        // this._PPUSCROLL_REG_v = 0  // 15bit的v寄存器，在nes实机中，该寄存器存储当前正在向屏幕输出的VRAM的地址。

        this._PPUSCROLL_REG_t_H = 0     // 15bit，拆成两个8bit使用
        this._PPUSCROLL_REG_t_L = 0     // t的低位
        this._PPUSCROLL_REG_x = 0       // 3bit x卷轴的最低3位在这里

        //实机内部，PPUSCROLL_INDEX和PPUADDR_INDEX 其实是一个东西
        //故取消使用PPUSCROLL_INDEX

        // this._PPUSCROLL_INDEX = 0    // 决定该次写入是x还是y

        // $2006 PPUADDR
        // 需要写入两次
        // 读写该地址同时会影响PPUSCROLL
        this._PPUADDR = 0
        this._PPUADDR_INDEX = 0         // 决定写入高位还是低位

        // $2007 PPUDATA
        this._PPUDATA = 0               // 只写在这，后面未使用该状态

        // $4014 OAMDMA
        this._OAMDMA = 0                // 要进行DMA的CPU内存高8位，未使用该状态

        // SP0 HIT相关 
        this._SP0hitAfter = 0           // 在多少CPU周期后触发sp0hit


        // 调色盘

        // 调色盘对应的web格式rgb值，正式渲染过程中没有使用，出于方便调试的考虑保留该表
        this._COLOR_TABLE_S = ["#757575", "#271B8F", "#0000AB", "#47009F",
            "#8F0077", "#AB0013", "#A70000", "#7F0B00", "#432F00", "#004700",
            "#005100", "#003F17", "#1B3F5F", "#000000", "#000000", "#000000",
            "#BCBCBC", "#0073EF", "#233BEF", "#8300F3", "#BF00BF", "#E7005B",
            "#DB2B00", "#CB4F0F", "#8B7300", "#009700", "#00AB00", "#00933B",
            "#00838B", "#000000", "#000000", "#000000", "#FFFFFF", "#3FBFFF",
            "#5F97FF", "#A78BFD", "#F77BFF", "#FF77B7", "#FF7763", "#FF9B3B",
            "#F3BF3F", "#83D313", "#4FDF4B", "#58F898", "#00EBDB", "#3C3C3C",
            "#000000", "#000000", "#FFFFFF", "#ABE7FF", "#C7D7FF", "#D7CBFF",
            "#FFC7FF", "#FFC7DB", "#FFBFB3", "#FFDBAB", "#FFE7A3", "#E3FFA3",
            "#ABF3BF", "#B3FFCF", "#9FFFF3", "#A0A0A0", "#000000", "#000000"]

        // 每个颜色占4个字节，分别存RGBA
        this._COLOR_TABLE_RGBA = new Uint8Array([0x75, 0x75, 0x75, 0xFF,
            0x27, 0x1B, 0x8F, 0xFF, 0x00, 0x00, 0xAB, 0xFF, 0x47, 0x00, 0x9F, 0xFF,
            0x8F, 0x00, 0x77, 0xFF, 0xAB, 0x00, 0x13, 0xFF, 0xA7, 0x00, 0x00, 0xFF,
            0x7F, 0x0B, 0x00, 0xFF, 0x43, 0x2F, 0x00, 0xFF, 0x00, 0x47, 0x00, 0xFF,
            0x00, 0x51, 0x00, 0xFF, 0x00, 0x3F, 0x17, 0xFF, 0x1B, 0x3F, 0x5F, 0xFF,
            0x00, 0x00, 0x00, 0xFF, 0x00, 0x00, 0x00, 0xFF, 0x00, 0x00, 0x00, 0xFF,
            0xBC, 0xBC, 0xBC, 0xFF, 0x00, 0x73, 0xEF, 0xFF, 0x23, 0x3B, 0xEF, 0xFF,
            0x83, 0x00, 0xF3, 0xFF, 0xBF, 0x00, 0xBF, 0xFF, 0xE7, 0x00, 0x5B, 0xFF,
            0xDB, 0x2B, 0x00, 0xFF, 0xCB, 0x4F, 0x0F, 0xFF, 0x8B, 0x73, 0x00, 0xFF,
            0x00, 0x97, 0x00, 0xFF, 0x00, 0xAB, 0x00, 0xFF, 0x00, 0x93, 0x3B, 0xFF,
            0x00, 0x83, 0x8B, 0xFF, 0x00, 0x00, 0x00, 0xFF, 0x00, 0x00, 0x00, 0xFF,
            0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x3F, 0xBF, 0xFF, 0xFF,
            0x5F, 0x97, 0xFF, 0xFF, 0xA7, 0x8B, 0xFD, 0xFF, 0xF7, 0x7B, 0xFF, 0xFF,
            0xFF, 0x77, 0xB7, 0xFF, 0xFF, 0x77, 0x63, 0xFF, 0xFF, 0x9B, 0x3B, 0xFF,
            0xF3, 0xBF, 0x3F, 0xFF, 0x83, 0xD3, 0x13, 0xFF, 0x4F, 0xDF, 0x4B, 0xFF,
            0x58, 0xF8, 0x98, 0xFF, 0x00, 0xEB, 0xDB, 0xFF, 0x00, 0x00, 0x00, 0xFF,
            0x3C, 0x3C, 0x3C, 0xFF, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
            0xAB, 0xE7, 0xFF, 0xFF, 0xC7, 0xD7, 0xFF, 0xFF, 0xD7, 0xCB, 0xFF, 0xFF,
            0xFF, 0xC7, 0xFF, 0xFF, 0xFF, 0xC7, 0xDB, 0xFF, 0xFF, 0xBF, 0xB3, 0xFF,
            0xFF, 0xDB, 0xAB, 0xFF, 0xFF, 0xE7, 0xA3, 0xFF, 0xE3, 0xFF, 0xA3, 0xFF,
            0xAB, 0xF3, 0xBF, 0xFF, 0xB3, 0xFF, 0xCF, 0xFF, 0x9F, 0xFF, 0xF3, 0xFF,
            0xA0, 0xA0, 0xA0, 0xFF, 0x00, 0x00, 0x00, 0xFF, 0x00, 0x00, 0x00, 0xFF])

        // 4块背景调色盘
        this._BG_PALETTE = [
            [0, 0, 0, 0],    //Background palette0
            [0, 0, 0, 0],    //Background palette1
            [0, 0, 0, 0],    //Background palette2
            [0, 0, 0, 0]]    //Background palette3

        // 4块精灵调色盘
        // 0xF0是自定义的精灵透明背景色
        this._SP_PALETTE = [
            [0xF0, 0, 0, 0],    //Sprite palette 0
            [0xF0, 0, 0, 0],    //Sprite palette 1
            [0xF0, 0, 0, 0],    //Sprite palette 2
            [0xF0, 0, 0, 0],]   //Sprite palette 3

        //空白的背景和精灵buffer 关背景和关精灵的时候用
        this._EMPTY_SP_BUFFER = new Uint8Array(256 * 240)
        this._EMPTY_BG_BUFFER = new Uint8Array(256 * 240)
        this._fillArray(this._EMPTY_SP_BUFFER, this._SP_TRANSPARENT)
        this._fillArray(this._EMPTY_BG_BUFFER, 0x0F) // 0x0F是纯黑色

        //背景表 NAMETABLE
        this._NAMETABLE_RAW = [
            new Uint8Array(0x400),
            new Uint8Array(0x400),
            new Uint8Array(0x400),
            new Uint8Array(0x400),]

        // 因为有的mapper后期会更改映射方式，所以这里要用NAMETABLE_RAW和NAMETABLE 隔离一下
        // 否则做二次映射会出问题
        this._NAMETABLE = [
            this._NAMETABLE_RAW[0],
            this._NAMETABLE_RAW[1],
            this._NAMETABLE_RAW[2],
            this._NAMETABLE_RAW[3]]


        // 记录当前帧四块背景是否被渲染过
        this._thisFrameNameTableRendered = [0, 0, 0, 0]


        // 精灵信息表 OAM

        this._OAM = new Uint8Array(256)

        // 预先缓存合成所有tile

        this._TILES = [null, null]

        // 帧缓冲区 frameBuffer

        this._tempTile = new Uint8Array(64)                     // 避免反复开内存空间，用一个固定空间存放tile

        this._tempFullBgBuffer = new Uint8Array(512 * 480)      // 4块背景合并，用于做卷轴切割
        this._tempBgBuffer = new Uint8Array(256 * 240)          // 单屏buffer，综合使用

        this._frameBufferSpFront = new Uint8Array(256 * 240)    // 在背景之前的sprite buffer
        this._frameBufferSpBack = new Uint8Array(256 * 240)     // 在背景之后的sprite buffer

        this._frameBuffer = new Uint8Array(256 * 240)           // 保存绘制完的单帧画面

        // sprite Overflow 没有去实现，因为极少极少有游戏使用这个特性。
        // 下面这行可以保留每行的sprite数，不过已弃用
        // this._SpLineCount = new Uint8Array(240)              // 用于统计每行有几个sp


        // 离屏canvas，因为要着色，内部使用一个离屏canvas，渲染完交给外部canvas输出

        // 因为OffscreenCanvas这个类支持的浏览器很少，故弃用
        // this._offscreen = new OffscreenCanvas(256, 240); 

        this._offscreen = document.createElement('canvas');
        this._offscreen.setAttribute('width', 256);
        this._offscreen.setAttribute('height', 240);
        this._offscreenCtx = this._offscreen.getContext('2d')

        // 使用纯canvas做离屏性能太差了，因为主要是画像素，经测试，直接画的话，绝大多数时间都耗在了画图上。这里可以使用ImageData 直接存RGBA
        // ImageDataBitmap只在chrome50以上支持，safari不支持，ios不支持。故在此使用ImageData
        this._offscreenImageData = new ImageData(256, 240)

    }


    // 用给定的值填充一个array
    _fillArray(array, value) {
        for (let i = 0, len = array.length; i < len; i++) {
            array[i] = value
        }
    }


    // *******************************************
    // 
    // NAMETABLE MIRROR 背景表与显存映射
    // 
    // *******************************************

    // 设置映射方式
    _setNametableMirror(mirrorType) {
        switch (mirrorType) {
            case 'h':   // 水平镜像
                this._NAMETABLE[0] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[1] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[2] = this._NAMETABLE_RAW[2]
                this._NAMETABLE[3] = this._NAMETABLE_RAW[2]
                this._mirrorType = 1
                break;
            case 'v':   // 垂直镜像
                this._NAMETABLE[0] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[1] = this._NAMETABLE_RAW[1]
                this._NAMETABLE[2] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[3] = this._NAMETABLE_RAW[1]
                this._mirrorType = 0
                break;
            case 'one':  // 单屏
                this._NAMETABLE[0] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[1] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[2] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[3] = this._NAMETABLE_RAW[0]
                break;
            case 'four': // 四屏
                this._NAMETABLE[0] = this._NAMETABLE_RAW[0]
                this._NAMETABLE[1] = this._NAMETABLE_RAW[1]
                this._NAMETABLE[2] = this._NAMETABLE_RAW[2]
                this._NAMETABLE[3] = this._NAMETABLE_RAW[3]
                break;
            default:
                // 预留的扩展方法，具体映射方式由mapper实现
                // 有些mapper会使用L型映射等特殊方法，该方法由mapper来注册
                this._exSetNameTable(mirrorType)
                break;
        }
    }

    // 保留一个空函数在这里
    _exSetNameTable(mirrorType) {

    }


    // *******************************************
    // 
    // NAMETABLE 背景表处理
    // 
    // *******************************************

    // NAMETABLE ATTRIBUTE 获取该地址Tile所使用的的调色板编号
    _getBgTileAttr(nametable, i) {

        //block size is 4*4 tiles
        //4*4个tile被打包成一个大块，大小为32px * 32px

        let attrtableOffset = 0x03C0        // 在每块背景表上，属性表的偏移量是$03C0
        let attrByteIndex = Math.floor(i / 128) * 8 + Math.floor((i % 32) / 4);
        let attrByte = nametable[attrtableOffset + attrByteIndex];
        let attrValue = (attrByte >> (((Math.floor((i % 128) / 64) << 1) | Math.floor((i % 4) / 2)) * 2)) & 0x3;

        // 返回一个0-3的值，即该Tile所使用的的色板编号
        return attrValue
    }

    // 把一块背景画到背景缓存上
    _drawOneNameTableToTemp(nametable) {

        let buffer = this._tempBgBuffer
        let offset = null
        let tileNo = null
        let patternTableNo = this._BG_TILE_SELECT ? 1 : 0

        // 遍历该背景上的所有tile
        for (var v = 0; v < 30; v++) {
            for (var h = 0; h < 32; h++) {
                offset = v * 32 + h
                tileNo = nametable[offset]
                this._loadTileToTemp(tileNo, patternTableNo)        // 将该tile装载到临时的tile buffer
                this._colorTile(this._tempTile, this._BG_PALETTE, this._getBgTileAttr(nametable, offset))   // 使用指定色板对其着色
                this._drawTileOn(this._tempTile, buffer, offset)    // 将着色后的tile画到背景buffer上
            }
        }
    }

    // 把一块背景画到保存完整四块背景的buffer上
    _drawToFull(offsetX, offsetY, bgBuffer, fullBgBuffer) {
        for (var v = 0; v < 240; v++) {
            for (var h = 0; h < 256; h++) {
                fullBgBuffer[(offsetY + v) * 512 + offsetX + h] = bgBuffer[v * 256 + h]
            }
        }
    }

    // 生成完整 2x2 大背景
    _drawAllNameTable() {

        // 如果背景没有启用，不画
        if (!(this._BACKGROUND_ENABLE)) {
            return
        }

        // 当显存里的图案表脏位被设置时，说明PPU里预缓存的tile表需要刷新

        if (this.mem.patternTable0Dirty || this.mem.patternTable1Dirty) {
            this._makeTileTable(0)
            this._makeTileTable(1)
            this.mem.patternTable0Dirty = false
            this.mem.patternTable1Dirty = false

            // 该帧的背景需要被刷新
            this._thisFrameNameTableRendered[0] = false
            this._thisFrameNameTableRendered[1] = false
            this._thisFrameNameTableRendered[2] = false
            this._thisFrameNameTableRendered[3] = false
        }

        // 此处无需精确计算，只要scrollX或者scrollY不为0，说明有卷轴，需要画对应的上下或者左右背景
        let scrollX = this._getPPUScrollX() + (this._NAMETABLE_SELECT & 0x1)
        let scrollY = this._PPUSCROLL_YinRendering + (this._NAMETABLE_SELECT >> 1)


        // 四块背景的排列方式
        // *-----------*
        // |  1  |  2  |
        // |-----+-----|
        // |  3  |  4  |
        // *-----------*

        // 在渲染期间无法直接修改NAMETABLE数据，如果该块背景该帧被画过，那么没必要重新画一遍。
        // this._thisFrameNameTableRendered 就是记录背景有没有被渲染过的。
        // 但有一种例外情况，就是渲染过程中图案表发生变化，这种情况需要重新渲染
        // 该功能通常由mapper来实现，实例就是雪人兄弟的开头标题画面，触发了sp0hit后，通过操作mapper改写了当前的图案表
        // 如果不刷新背景，渲染会出现乱块

        if (!(this._thisFrameNameTableRendered[0])) {               // 如果此块背景在此帧没有被画过，那么把它画到大背景上
            this._drawOneNameTableToTemp(this._NAMETABLE[0])
            this._drawToFull(0, 0, this._tempBgBuffer, this._tempFullBgBuffer)
            this._thisFrameNameTableRendered[0] = true
        }

        if (!(this._thisFrameNameTableRendered[1]) && scrollX) {    // 如果背景偏移x有数据，那么绘制第二块
            this._drawOneNameTableToTemp(this._NAMETABLE[1])
            this._drawToFull(256, 0, this._tempBgBuffer, this._tempFullBgBuffer)
            this._thisFrameNameTableRendered[1] = true
        }

        if (!(this._thisFrameNameTableRendered[2]) && scrollY) {    // 如果背景偏移Y不为0，那么绘制第三块
            this._drawOneNameTableToTemp(this._NAMETABLE[2])
            this._drawToFull(0, 240, this._tempBgBuffer, this._tempFullBgBuffer)
            this._thisFrameNameTableRendered[2] = true
        }

        if (!(this._thisFrameNameTableRendered[3]) && scrollX && scrollY) {  // 如果背景X,Y偏移都不为0，那么绘制第四块
            this._drawOneNameTableToTemp(this._NAMETABLE[3])
            this._drawToFull(256, 240, this._tempBgBuffer, this._tempFullBgBuffer)
            this._thisFrameNameTableRendered[3] = true
        }
    }

    // 从2x2的大背景上，根据偏移切下一块1x1的区域，放到tempBgBuffer里
    _clipScrollToTempBg() {

        let scrollX = this._getPPUScrollX() + (this._NAMETABLE_SELECT & 1) * 256
        let scrollY = (this._PPUSCROLL_YinRendering + (this._NAMETABLE_SELECT >> 1) * 240 + 480) % 480

        let source = this._tempFullBgBuffer
        let dest = this._tempBgBuffer
        for (var v = 0; v < 240; v++) {
            for (var h = 0; h < 256; h++) {
                dest[v * 256 + h] = source[((v + scrollY) % 480) * 512 + (h + scrollX) % 512]
            }
        }

        // $2001 PPUMASK 有一个状态位控制最左边一列8像素宽度是否渲染
        // 如果为0，给它重新填充背景色回去
        let bgColor = this._BG_PALETTE[0][0]
        if (!(this._BG_LEFT_C_ENABLE)) {
            for (var v = 0; v < 240; v++) {
                for (var h = 0; h < 8; h++) {
                    dest[v * 256 + h] = bgColor
                }
            }
        }
    }

    //  =======测试用画图，把2x2的大背景画出去===========
    __debug__dumpFullBgToCanvas(ctx) {
        let ct = this._COLOR_TABLE_S
        let source = this._tempFullBgBuffer

        let updatePixel = function (addr, i) {
            ctx.fillStyle = ct[i]
            var y = addr >> 9;
            var x = addr & 0x1FF;
            ctx.fillRect(x, y, 1, 1);
        }

        for (var i = 0, len = source.length; i < len; i++) {
            updatePixel(i, (source[i]) & 0x7F)
        }

    }

    //  =======测试用画图，把当前tempBgBuffer画出去===========
    __debug__dumpTempBgBufferToCanvas(ctx) {
        let ct = this._COLOR_TABLE_S
        let source = this._tempBgBuffer

        let updatePixel = function (addr, i) {
            ctx.fillStyle = ct[i]
            var y = addr >> 8;
            var x = addr & 0xFF;
            ctx.fillRect(x * 2, y * 2, 2, 2);
        }

        for (var i = 0, len = source.length; i < len; i++) {
            updatePixel(i, (source[i]) & 0x7F)
        }
    }


    // 把当前frameBuffer中的数据转换成图像数据
    _drawToImage() {
        let ct = this._COLOR_TABLE_RGBA
        let source = this._frameBuffer
        let dest = this._offscreenImageData.data
        var colorIdx
        for (var i = 0, len = source.length; i < len; i++) {
            colorIdx = source[i] & 0x7F  //因为背景色最高位被置1，过滤掉
            dest[i * 4] = ct[colorIdx * 4]
            dest[i * 4 + 1] = ct[colorIdx * 4 + 1]
            dest[i * 4 + 2] = ct[colorIdx * 4 + 2]
            dest[i * 4 + 3] = ct[colorIdx * 4 + 3]
        }
    }


    // *******************************************
    // 
    // tile 图案块相关处理
    // 
    // *******************************************


    // 把tile画到目标buffer上
    _drawTileOn(tile, bg, index) {
        let positionY = (index >> 5) << 3   // 相当于除32取整再乘8
        let positionX = (index & 0x1F) << 3   // 相当于对32余再乘8
        let offset = 256 * positionY + positionX
        for (var v = 0; v < 8; v++) {
            for (var h = 0; h < 8; h++) {
                bg[offset + h] = tile[v * 8 + h]
            }
            offset += 256
        }
    }

    // 用卡带的图案表区域生成tile缓存
    _makeTileTable(idx) {

        this._TILES[idx] = new Array(256)
        let tNo = idx
        for (var i = 0; i < 0x1000; i += 0x10) {

            this._makeTileToTemp(i + (tNo ? 0x1000 : 0), this.mem)
            this._TILES[tNo][i >> 4] = new Uint8Array(64)
            let t = this._TILES[tNo][i >> 4]

            for (var j = 0; j < 64; j++) {
                t[j] = this._tempTile[j]
            }
        }
    }

    //把指定地址的tile计算并存入tempTile
    _makeTileToTemp(address, mem) {
        let tile = this._tempTile  // a 8*8 tile
        for (var row = 0; row < 8; row++) {

            // 此处不能使用mem.read，因为直接读取会使用一个ppumem里面的1byte buffer
            // 直接使用read会使tile最上面一行出错
            let byte1 = mem._access(address + row)
            let byte2 = mem._access(address + row + 8)
            for (var col = 0; col < 8; col++) {
                tile[row * 8 + col] = ((byte1 >> (7 - col)) & 0x01) + (((byte2 >> (7 - col)) & 0x01) * 2)
            }
        }
        return tile
    }

    // 纵向翻转传入tile
    _vFlipTile(tile) {
        let temp = null
        for (var v = 0; v < 4; v++) {
            for (var h = 0; h < 8; h++) {
                temp = tile[v * 8 + h]
                tile[v * 8 + h] = tile[(7 - v) * 8 + h]
                tile[(7 - v) * 8 + h] = temp
            }
        }
    }

    // 横向翻转传入tile
    _hFlipTile(tile) {
        let temp = null
        for (var v = 0; v < 8; v++) {
            for (var h = 0; h < 4; h++) {
                temp = tile[v * 8 + h]
                tile[v * 8 + h] = tile[v * 8 + 7 - h]
                tile[v * 8 + 7 - h] = temp
            }
        }
    }

    // 对传入tile按指定色板上色
    _colorTile(tile, palette, idx) {
        let p = palette[idx]
        for (var i = 0; i < 64; i++) {
            tile[i] = p[tile[i]]
        }
    }

    //把Tile装载到tempTile中
    _loadTileToTemp(number, patternTableNo) {
        let t = this._TILES[patternTableNo][number]
        for (var i = 0; i < 64; i++) {
            this._tempTile[i] = t[i]
        }
    }

    // *******************************************
    // 
    // sprite 精灵相关
    // 
    // *******************************************

    // 画一个sprite
    _drawOneSprite(addr) {
        let size8x16 = this._SPRITE_HEIGHT  //0: 8x8  1: 8x16
        let oam = this._OAM
        let positionX = oam[addr + 3]
        let positionY = oam[addr] + 1       // 固有问题，每个tile的y会有1个scanline的延迟
        let tileNo = oam[addr + 1]
        let paltteNo = oam[addr + 2] & 0x3
        let behindBg = (oam[addr + 2] >> 5) & 0x01
        let flipH = (oam[addr + 2] >> 6) & 0x01
        let flipV = (oam[addr + 2] >> 7) & 0x01

        let patternTableNo = this._SPRITE_TILE_SELECT // 使用哪个表的图案

        if (size8x16) {
            patternTableNo = tileNo & 0x01
            tileNo = tileNo & 0xFE
        }

        let buffer = this._frameBufferSpFront
        let palette = this._SP_PALETTE

        if (behindBg) {
            buffer = this._frameBufferSpBack
        }

        // 如果精灵使用8x16的长条模式，那么其垂直翻转需要颠倒两个图块的上下顺序
        if (size8x16) {
            if (flipV) {
                this.putTileOnSpriteBuffer(positionX, positionY, tileNo + 1,
                    patternTableNo, paltteNo, buffer, flipV, flipH, palette)
                this.putTileOnSpriteBuffer(positionX, positionY + 8, tileNo,
                    patternTableNo, paltteNo, buffer, flipV, flipH, palette)
            } else {
                this.putTileOnSpriteBuffer(positionX, positionY, tileNo,
                    patternTableNo, paltteNo, buffer, flipV, flipH, palette)
                this.putTileOnSpriteBuffer(positionX, positionY + 8, tileNo + 1,
                    patternTableNo, paltteNo, buffer, flipV, flipH, palette)
            }
        }
        else {
            this.putTileOnSpriteBuffer(positionX, positionY, tileNo,
                patternTableNo, paltteNo, buffer, flipV, flipH, palette)
        }
        //
    }

    // 把tile画到sprite buffer上
    putTileOnSpriteBuffer(x, y, tileNo, patternTableNo, paltteNo, buffer, flipV, flipH, palette) {

        // 到屏幕底端边缘就没必要画了
        if (y > 239) return

        // 载入tile，然后上色
        this._loadTileToTemp(tileNo, patternTableNo)
        this._colorTile(this._tempTile, palette, paltteNo)

        if (flipH) {
            this._hFlipTile(this._tempTile)
        }
        if (flipV) {
            this._vFlipTile(this._tempTile)
        }

        //draw
        let idx = null
        for (var v = 0; v < 8; v++) {
            if (y + v > 239) {
                break
            }
            for (var h = 0; h < 8; h++) {
                if (x + h > 255) {
                    break
                }
                idx = (y + v) * 256 + x + h
                if (buffer[idx] == this._SP_TRANSPARENT) {
                    buffer[idx] = this._tempTile[v * 8 + h]
                }
            }
        }
    }

    // 把全部64个sprite画到buffer上
    _drawAllSprite() {

        // 先将两个前后景sprite buffer初始化为透明色
        this._fillArray(this._frameBufferSpBack, this._SP_TRANSPARENT)
        this._fillArray(this._frameBufferSpFront, this._SP_TRANSPARENT)

        // 画总共64个sprite
        if (this._SPRITE_ENABLE) {
            for (var i = 0; i < 256; i += 4) {
                this._drawOneSprite(i)
            }
        }

        let tansparentColor = this._SP_TRANSPARENT
        // 这是$2001 PPUMASK 的一个状态位，如果关闭，那么最左边8像素不显示sprite
        if (!(this._SPRITE_LEFT_C_ENABLE)) {
            for (var v = 0; v < 240; v++) {
                for (var h = 0; h < 8; h++) {
                    this._frameBufferSpBack[v * 256 + h] = tansparentColor
                    this._frameBufferSpFront[v * 256 + h] = tansparentColor
                }
            }
        }

        // 最后执行sp0hit碰撞检测
        this._setSP0Hit()
    }


    // *******************************************
    // 
    // 合并背景和精灵图层
    // 
    // *******************************************

    // 合并tempBG,SpFront,spBack绘制到 this._frameBuffer
    // 因为渲染过程中途可能发生PPUSCROLL，此处startIdx是从哪个扫描点开始更新
    _mergeBgSp(startIdx) {

        // 如果背景和精灵都关了，那么直接涂黑framebuffer
        if (!(this._BACKGROUND_ENABLE || this._SPRITE_ENABLE)) {
            this._fillArray(this._frameBuffer, 0xF0)
            return
        }

        // startIdx默认为0
        if (!startIdx || startIdx < 0) {
            startIdx = 0
        }

        let dest = this._frameBuffer

        // 当精灵或者背景没有开启时，用全黑或者全透明代替
        let bg = this._BACKGROUND_ENABLE ? this._tempBgBuffer : this._EMPTY_BG_BUFFER
        let spft = this._SPRITE_ENABLE ? this._frameBufferSpFront : this._EMPTY_SP_BUFFER
        let spbk = this._SPRITE_ENABLE ? this._frameBufferSpBack : this._EMPTY_SP_BUFFER
        let bgblankColor = this._BG_PALETTE[0][0]

        // 拼合sp前景,bg,sp背景三个图层
        for (var idx = startIdx, len = 256 * 240; idx < len; idx++) {
            if (spft[idx] != this._SP_TRANSPARENT) {
                dest[idx] = spft[idx]
            } else if (spbk[idx] != this._SP_TRANSPARENT) {
                dest[idx] = (bg[idx] == bgblankColor) ? spbk[idx] : bg[idx]
            } else {
                dest[idx] = bg[idx]
            }
        }
    }

    // *******************************************
    // 
    // 时序相关
    // 
    // *******************************************

    // 把当前的扫描点转换成cpu周期，主要给sp0hit使用
    _pixelToCycle(x, y, total) {
        if (typeof (total) !== undefined) {
            y = total >> 8
            x = total & 0xFF
        }
        y += 1 //因为有-1行存在，(有的资料称261行）prerender line 该行在vblank消失之后，但不渲染
        let cycle = Math.floor((y * this._SCANLINE_PIXEL + x) / this._PPUDOTS_PER_CPU)
        cycle += this._NMI_CYCLE
        return cycle
    }

    // 把当前CPU周期转化成对应像素号
    _cycleToPixel(cycle) {
        // 从NMI开始计数
        let y = Math.floor((cycle - this._NMI_CYCLE) * this._PPUDOTS_PER_CPU / this._SCANLINE_PIXEL)
        let x = ((cycle - this._NMI_CYCLE) * this._PPUDOTS_PER_CPU) % this._SCANLINE_PIXEL
        // 因为更新x偏移发生在每行的257像素，所以此时y取整后应该加1，把当前行填满
        // 但是因为-1行的存在，y实际会减1，故此处y不变

        // PPU的v寄存器，更新x偏移发生在每行的第257像素
        // 有些靠屏幕右端的sp0hit发生后立即改写，下一行新修改的偏移并不会生效，需要再跳一行
        // 因为模拟精度的问题，此处使用x>250
        if (x > 250) y++
        return y * 256
    }

    // 计算sp0hit的触发时机
    _setSP0Hit() {
        if (this._SPRITE_ENABLE && this._BACKGROUND_ENABLE) {
            let addr = 0 // sp0在OAM中的地址
            let bgBuffer = this._tempBgBuffer
            let size8x16 = this._SPRITE_HEIGHT  //0: 8x8  1: 8x16
            let oam = this._OAM
            let x = oam[addr + 3]
            let y = oam[addr] + 1
            let tileNo = oam[addr + 1]
            let flipH = (oam[addr + 2] >> 6) & 0x01
            let flipV = (oam[addr + 2] >> 7) & 0x01

            let patternTableNo = this._SPRITE_TILE_SELECT
            if (size8x16) {
                patternTableNo = tileNo & 0x01
                tileNo = (tileNo >> 1) << 1
            }

            this._loadTileToTemp(tileNo, patternTableNo)
            if (flipH) { this._hFlipTile(this._tempTile) }
            if (flipV) { this._vFlipTile(this._tempTile) }
            let sp = this._tempTile
            let idx = null
            let bgColor = this._BG_PALETTE[0][0]

            for (var v = 0; v < 8; v++) {
                if (y + v > 239) { break }

                for (var h = 0; h < 8; h++) {
                    if (x + h > (255 - 1)) { break } //在最右一列255，sp0hit不会触发

                    if (sp[v * 8 + h] == 0) {
                        continue
                    } else {
                        idx = (y + v) * 256 + x + h
                        if (bgBuffer[idx] == bgColor) {
                            continue
                        } else {
                            this._SPRITE_0_HIT = 1
                            this._SP0hitAfter = this._pixelToCycle(null, null, idx)
                            return
                        }
                    }
                }
            }
            this._SPRITE_0_HIT = 0
        } else {
            this._SPRITE_0_HIT = 0
        }
    }

    // *******************************************
    // 
    // 与CPU的交互
    // 
    // *******************************************


    // CPU写$2000 PPUCTRL 的动作
    write2000(value) {
        let oldNameTableSelect = this._NAMETABLE_SELECT
        this._NAMETABLE_SELECT = value & 0x3
        this._INCREMENT_MODE = (value >> 2) & 0x1
        this._SPRITE_TILE_SELECT = (value >> 3) & 0x1
        this._BG_TILE_SELECT = (value >> 4) & 0x1
        this._SPRITE_HEIGHT = (value >> 5) & 0x1
        this._PPU_MASTER = (value >> 6) & 0x1
        this._NMI_ENABLE = (value >> 7) & 0x1
        if (oldNameTableSelect != this._NAMETABLE_SELECT) {
            this._scrollChanged()
        }
    }

    // CPU写$2001 PPUMASK 的动作
    write2001(value) {
        this._GREYSCALE = value & 0x1
        this._BG_LEFT_C_ENABLE = (value >> 1) & 0x1
        this._SPRITE_LEFT_C_ENABLE = (value >> 2) & 0x1
        this._BACKGROUND_ENABLE = (value >> 3) & 0x1
        this._SPRITE_ENABLE = (value >> 4) & 0x1
        this._COLOR_EMPHASIS = (value >> 5) & 0x3
    }

    // CPU读$2002 PPUSTATUS 的动作
    read2002() {
        if (this._justPowerUp) {
            this._justPowerUp = false
            return 0xA0 // 刚上电的时候，2002最高3位为101，这个特性也可以不使用
        }

        let cpu = this.machine.cpu
        let sp0hit = 0
        let vblank = null

        // 只有该帧有SP0hit，且CPU周期数大于触发周期数时，该位才返回1
        if (this._SPRITE_0_HIT == 1 && cpu.cycleCount > this._SP0hitAfter) {
            sp0hit = 1
        }
        vblank = this._VBLANK

        //读取2002会清除vblank状态
        this._VBLANK = 0

        // nes总共只有一两个游戏依赖精灵溢出检测，如bee 52，详见nesdev。
        // 该标志位计算复杂而且硬件实现有bug，几乎无用处。
        // 故简单起见直接置零
        let spriteOverFlow = 0

        // 读PPUSTATUS 会使latch清零
        // 而且$2005 PPUSCROLL 和$2006 PPUADDR共用这同一个latch
        this._PPUADDR_INDEX = 0

        return (0 | (spriteOverFlow << 5) | (sp0hit << 6) | (vblank << 7)) & 0xFF
    }

    // CPU写$2003 OAMADDR 的动作
    write2003(value) {
        this._OAMADDR = value
    }

    // CPU写$2004 OAMDATA 的动作
    write2004(value) {
        this._OAM[this._OAMADDR] = value
        this._OAMADDR = (this._OAMADDR + 1) & 0xFF
    }
    //read2004 在早期FC和一小部分nes上不支持，此处暂空

    // CPU写$2005 PPUSCROLL 的动作
    write2005(value) {
        if (this._PPUADDR_INDEX == 0) {
            this._PPUSCROLL_REG_x = value & 0x7
            this._PPUSCROLL_REG_t_L &= 0xE0                 // 清零低五位
            this._PPUSCROLL_REG_t_L |= (value >> 3) & 0x1F  //取value高5位设置到 t_l低五位
            this._PPUADDR_INDEX = 1
        } else {
            let th = 0
            th |= (value & 0x7) << 4                        //value最低三位取出放到th最高三位
            th |= (value >> 6) & 0x3                        //value最高两位取出给th的最低两位

            // th中间两位无视掉，交给nametableselect处理
            this._PPUSCROLL_REG_t_H = th & 0x7F             // 抹掉最高位
            this._PPUSCROLL_REG_t_L &= 0x1F                 //清零高3位
            this._PPUSCROLL_REG_t_L |= (value << 2) & 0xE0  // 取中间三位给tl高三位

            this._PPUADDR_INDEX = 0

            // 触发卷轴
            this._scrollChanged()
        }
    }

    // CPU写$2006 PPUADDR 的动作
    write2006(value) {
        if (this._PPUADDR_INDEX == 0) {
            this._PPUADDR = value << 8

            // 影响scroll
            this._PPUSCROLL_REG_t_H = value & 0x3F //取低6位
            this._NAMETABLE_SELECT = (value >> 2) & 0x3

            this._PPUADDR_INDEX = 1


        } else {
            this._PPUSCROLL_REG_t_L = value

            this._PPUADDR = this._PPUADDR + value
            this._PPUADDR_INDEX = 0

            // 写第二次时，会影响当前渲染的Y坐标
            let yOffset = this._getPPUScrollY()

            // PPU的v寄存器中，Y偏移会随着渲染行数自增。
            // 那么可以根据时间反推回渲染刚开始时的 PPUSCROLL Y
            this._PPUSCROLL_YinRendering = yOffset - (this._cycleToPixel(this.machine.cpu.cycleCount) >> 8)
            this._scrollChanged()
        }
    }

    _getPPUScrollX() {
        return ((this._PPUSCROLL_REG_t_L << 3) | this._PPUSCROLL_REG_x) & 0xFF
    }

    _getPPUScrollY() {
        let low3bit = (this._PPUSCROLL_REG_t_H >> 4) & 0x7
        let high2bit = (this._PPUSCROLL_REG_t_H & 0x3) << 6
        let mid3bit = (this._PPUSCROLL_REG_t_L >> 2) & 0x38
        let v = (high2bit | mid3bit | low3bit) & 0xFF

        // 注意，Y>239时，不会跑到下一个nametable去，而是会呈现一种 “负值”
        if (v > 239) {
            v = v - 256
        }
        return v
    }


    // CPU读$2007 PPUDATA 的动作
    read2007() {
        let v = this.mem.read(this._PPUADDR)
        if (this._INCREMENT_MODE == 0) {
            this._PPUADDR = (this._PPUADDR + 1) & 0x3FFF
        } else {
            this._PPUADDR = (this._PPUADDR + 32) & 0x3FFF
        }
        return v
    }

    // CPU写$2007 PPUDATA 的动作
    write2007(value) {
        this.mem.write(this._PPUADDR, value)
        if (this._INCREMENT_MODE == 0) {
            this._PPUADDR = (this._PPUADDR + 1) & 0x3FFF
        } else {
            this._PPUADDR = (this._PPUADDR + 32) & 0x3FFF
        }
    }

    // CPU写$4014 OAMDMA 直写时的动作
    // 直接把内存地址的数据拷贝到当前OAM空间
    write4014(value) {
        let cpu = this.machine.cpu
        let cpumem = cpu.mem
        for (var i = 0; i < 256; i++) {
            this._OAM[i] = cpumem.read(value * 256 + i)
        }
        // cpu做dma需要加周期
        cpu.cycleCount += 514
    }

    // *******************************************
    // 
    // PPU的内部动作
    // 
    // *******************************************

    // vblank结束，渲染刚开始时需要处理的事情
    _resetWhenStartRendering() {
        this._inRenderingProcess = true

        // 如果图案表脏了，更新tile缓存
        if (this.mem.patternTable0Dirty) {
            this._makeTileTable(0)
            this.mem.patternTable0Dirty = false
        }
        if (this.mem.patternTable1Dirty) {
            this._makeTileTable(1)
            this.mem.patternTable0Dirty = false
        }

        // 把四个背景表都标记为当前未渲染过
        this._thisFrameNameTableRendered[0] = false
        this._thisFrameNameTableRendered[1] = false
        this._thisFrameNameTableRendered[2] = false
        this._thisFrameNameTableRendered[3] = false

        // 把Y卷轴锁定，渲染过程中修改$2005 PPUSCROLL影响不了Y卷轴
        this._PPUSCROLL_YinRendering = this._getPPUScrollY()

        // 重置三个状态
        this._SPRITE_0_HIT = 0
        this._SP0hitAfter = 0
        this._VBLANK = 0
    }

    // 卷轴发生时，需要重画背景重新合成前景
    _scrollChanged() {

        if (this._inRenderingProcess) {
            let cycle = this.machine.cpu.cycleCount
            this._drawAllNameTable()
            this._clipScrollToTempBg()
            this._mergeBgSp(this._cycleToPixel(cycle))
        }
    }


    // *******************************************
    // 
    // PPU的对外动作
    // 
    // *******************************************

    // 初始化
    ppuInit(mirrorType) {
        this._makeTileTable(0)
        this._makeTileTable(1)
        this._setNametableMirror(mirrorType)
    }

    // 外部调用的渲染命令
    render() {
        this._resetWhenStartRendering()
        this._drawAllNameTable()
        this._clipScrollToTempBg()
        this._drawAllSprite()
        this._mergeBgSp()
    }

    // 返回渲染结果——canvas
    getCanvasImage() {
        this._offscreenCtx.putImageData(this._offscreenImageData, 0, 0)
        return this._offscreen
    }
    // 返回渲染结果——ImageData
    getRawImage() {
        return this._offscreenImageData
    }

    // 开始进入Vblank
    startVblank() {

        // vblank开始时，把frameBuffer画出去
        this._drawToImage()
        this._VBLANK = 1

        // 有的游戏会在初始化时死循环指令 LDA PPUSTATUS BPL XXXX 等待NMI
        // 并且在NMI的handler开始时把A压栈，最后执行完每帧的固定项目后
        // 把A弹回，并根据A的最高位来决定是否跳转
        // 我猜测在实机上这样做的目的是进行CPU与像素同步

        // 所以这里有必要在NMI发生之前跑一个cpu指令
        // 如果不跑，那么死循环的LDA PPUSTATUS永远不可能读到V_blank标志，NMI处理结束后的跳转也不正常 
        // 结果就是初始化失败，会卡在某种状态
        // 测试的例子是炸弹人，如果该处不做处理，开头画面选择模式的小三角出不来，并且卡死在开头
        this.machine.cpu.runStep()

        if (this._NMI_ENABLE) {
            this.machine.cpu.setNMI()
        }
        this._inRenderingProcess = false
    }
}
