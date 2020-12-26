// *******************************************
// 
// 辅助函数
// 
// *******************************************

// 取16bit高位
var get16HighByte = function (val) {
    return (val >> 8) & 0xFF
}

// 取16bit低位
var get16LowByte = function (val) {
    return val & 0xFF
}

// 把两个8bit量转换为16bit
var makeDword = function (high, low) {
    // 确保high low 都是8bit
    return ((high & 0xFF) << 8) | (low & 0xFF)
}

//把单字节当做有符号数处理
var asSingedByte = function (val) {
    val = val & 0xff
    if (val >> 7) {
        return -(~val & 0xFF) - 1
    } else {
        return val
    }
}


