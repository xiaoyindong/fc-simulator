双击main.html文件打开，拖拽Super Mario Bros. (World).nes进入即可开始游戏。

支持nes后缀游戏，可以自行在网上下载，仅支持Mapper0，Mapper1，Mapper2，Mapper3类型。

# nes-emulator
A toy NES / FC emulatior written in JS

使用部分es6语法，无额外依赖

非高精度模拟。声音部分使用WebAudio API实现

APU没有实现噪声通道和DMC通道，DMC对应的IRQ没有实现

带有简单的调试功能


目前支持的Mapper:

Mapper0

Mapper1 (不支持部分变体)

Mapper2

Mapper3

推荐使用Chrome系浏览器
模拟效率高于jsnes

在ThinkPad X200s 酷睿SL9400双核 @1.6G DEEPIN 15.10 Chrome 73下可以流程运行
