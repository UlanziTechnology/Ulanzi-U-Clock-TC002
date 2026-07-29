#include "McuManager.h"

static void mcuEventCb(const PixelMcuProto::MyResponse& response) {
	try {
		switch (response.cmd) {
			case 0x01://mic
//				LOGI_TRACE("setMicValue = %d", (response.data[0] << 8) | response.data[1]);
				McuManager::getInstance().setMicValue((response.data[0] << 8) | response.data[1]);
				break;
			case 0x02://usbstate
//				LOGI_TRACE("setUsbState = %d", response.data[0]);
				McuManager::getInstance().setUsbState((response.data[0]));
				break;
			case 0x03://Battary
				{
					std::pair<int, int> BatteryState = {response.data[0], (response.data[1] << 8) | response.data[2]};
					McuManager::getInstance().setBatteryState(BatteryState);
				}
				break;
			default:
				break;
		}
	}catch(base::Exception& e) {
		LOGE_TRACE("%s", e.what());
	}

}

void McuManager::initialize(PixelMcuProto::McuParse* mcu) {
    std::lock_guard<std::mutex> lock(mMutex);
    mMcu = mcu;
//    LOGI_TRACE("McuManager: Initialized with MCU instance %p", mcu);
//    mMcu->setLogLv(android_LogPriority::ANDROID_LOG_DEBUG);
    mMcu->registerRecvMsgCb(mcuEventCb);
    mMcu->setRetryCount(3);
}

void McuManager::setMicValue(int value) {
	std::lock_guard<std::mutex> lock(mMutex);
	mMicValue = value;
}

int McuManager::queryMicValue() {
    std::lock_guard<std::mutex> lock(mMutex);

    if (!mMcu) {
        LOGE_TRACE("McuManager: MCU not initialized, cannot query mic value");
        return -1;
    }

    if(mMicValue == -1) {
	mMicValue = mMcu->queryMicValue();
    }

    return mMicValue;
}

void McuManager::setUsbState(int state) {
	std::lock_guard<std::mutex> lock(mMutex);
	mUsbState = state;
}

int McuManager::queryUsbState() {
    std::lock_guard<std::mutex> lock(mMutex);

    if (!mMcu) {
        LOGE_TRACE("McuManager: MCU not initialized, cannot query USB state");
        return -1;
    }

    if(mUsbState == -1) {
	mUsbState = mMcu->queryUsbState();
    }
    return mUsbState;
}

void McuManager::setBatteryState(const std::pair<int, int>& state) {
	std::lock_guard<std::mutex> lock(mMutex);
	mBatterState = state;
}

std::pair<int, int> McuManager::queryBatteryPower() {
    std::lock_guard<std::mutex> lock(mMutex);

    if (!mMcu) {
        LOGE_TRACE("McuManager: MCU not initialized, cannot query battery power");
        return std::make_pair(0, 0);
    }

    if(mBatterState.first == -1 || mBatterState.second == -1) {
	mBatterState = mMcu->queyrBatteryPower();
    }
    return mBatterState;
}

void McuManager::setAutoMicReport(bool sw) {
	std::lock_guard<std::mutex> lock(mMutex);

	if (!mMcu) {
		LOGE_TRACE("McuManager: MCU not initialized, cannot setAutoMicReport");
		return;
	}

	mMcu->setAutoMicReport(sw);
}

void McuManager::powerOff() {
    std::lock_guard<std::mutex> lock(mMutex);

    if (!mMcu) {
        LOGE_TRACE("McuManager: MCU not initialized, cannot power off");
        return;
    }

    mMcu->powerOff();
    LOGI_TRACE("McuManager: Power off command sent");
}

int McuManager::queryMcuVersion(std::string& mcuVer) {
    std::lock_guard<std::mutex> lock(mMutex);

    if (!mMcu) {
        LOGE_TRACE("McuManager: MCU not initialized, cannot query version");
        return -1;
    }

    return mMcu->queryMcuVersion(mcuVer);
}
