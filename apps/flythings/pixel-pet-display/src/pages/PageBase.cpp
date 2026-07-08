#include "pages/PageBase.h"
#include <base/base.h>
Mutex PageBase::mSpiMutex;

PageBase::~PageBase() {

}

void PageBase::sendLedData(const std::vector<uint8_t>& rgbData) {
    Mutex::Autolock l_(mSpiMutex);
    //SPI初始�?
    static SpiHelper spi(0, SPI_MODE_0, 10 * 1000 * 1000, 8, false);
    //需要发�?4 * 16 * 3字节�?
    uint8_t* copyData = new uint8_t[64 * 16 * 3]();
    for(int y = 0; y < 16; y++) {
        for(int x = 0; x < 52 * 3; x++) {
            copyData[y * 64 * 3 + x] = rgbData[y * 52 * 3 + x];
        }
    }
    const int maxSz = 64 * 16 * 3;
    //发送数据前需拉高GPIO_35一秒使MCU能够稳定检�?
    GpioHelper::output("GPIO_35", 0);
    usleep(1 * 1000);
    if(!spi.write(copyData, maxSz)) {
        LOGE_TRACE("spi write error");
    }
    //发送完成记得要重新拉低
    GpioHelper::output("GPIO_35", 1);
    delete[] copyData;

    //数据不易发送过快，不得低于15ms/帧，否则会发送异�?
    usleep(15 * 1000);
}
