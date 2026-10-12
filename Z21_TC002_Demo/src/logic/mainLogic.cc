#include "uart/ProtocolSender.h"
#include "base/base.h"
#include "base/json_object.h"
#include <base/wifi.h>
#include "utils/SpiHelper.h"
#include "utils/GpioHelper.h"
#include "managers/KeyManager.h"
#include "managers/PageManager.h"
#include "managers/McuManager.h"
#include "pages/RgbTestPage.h"
#include "pages/BtnTestPage.h"
#include "pages/AudioTestPage.h"
#include "pages/WifiTestPage.h"
#include "pages/PetPage.h"
#include "pages/FirePage.h"
#include "pages/PixelArtPage.h"
#include "ble/bluetooth_service.h"
#include "net/NetManager.h"
#include <thread>
#include <os/SystemProperties.h>
#define WIFIMANAGER NETMANAGER->getWifiManager()
#define CONFIG_PATH "/mnt/usb1/test.cfg"
namespace {

bool sPixelVisible = false;

void keyEventCb(int keyCode, int keyStatus) {
	if (!PageManager::getInstance().onKeyEvent(keyCode, keyStatus)) {
		return;
	}
	if (keyCode == E_KEYCODE_CLOCKWISE) {
		if (pixelArtPage() == "PetPage") {
			pixelArtPage() = "FirePage";
			PageManager::getInstance().navigateTo("FirePage");
		} else {
			EASYUICONTEXT->openActivity("btnTestActivity", nullptr);
		}
	} else if (keyCode == E_KEYCODE_ANTI_CLOCKWISE) {
		if (pixelArtPage() == "FirePage") {
			pixelArtPage() = "PetPage";
			PageManager::getInstance().navigateTo("PetPage");
		} else {
			EASYUICONTEXT->openActivity("audioTestActivity", nullptr);
		}
	}
}

void loadConfigAndStart() {
	if (!base::wifiOnAndWait(10)) {
		LOGE_TRACE("mainLogic: WiFi failed to start");
	}
	std::string ssid, pwd, bleName;
	bool needConnect = false;

	if (base::exists(CONFIG_PATH)) {
		try {
			base::JSONObject config = base::JSONObject::parseFromFile(CONFIG_PATH);
			ssid = config.getString("ssid", "");
			pwd = config.getString("pwd", "");
			needConnect = config.getBool("isConnect", false);
			bleName = config.getString("ble", "");
			LOGI_TRACE("mainLogic: config ssid=%s connect=%d ble=%s",
				ssid.c_str(), needConnect, bleName.c_str());
		} catch (...) {
			LOGE_TRACE("mainLogic: failed to parse %s", CONFIG_PATH);
		}
	} else {
		LOGW_TRACE("mainLogic: config not found: %s", CONFIG_PATH);
	}
	if (bleName.empty()) {
		std::string mac = base::wifiMacAddress();
		if (mac.size() >= 4) {
			bleName = "Ulanzi TC002 " + mac.substr(mac.size() - 4);
		} else {
			bleName = "Ulanzi TC002";
		}
	}
	BluetoothParams bleParams;
	bleParams.name = bleName;
	BluetoothService::instance().start(bleParams);
	auto* page = static_cast<WifiTestPage*>(
		PageManager::getInstance().getPage("WifiTestPage"));
	if (page) {
		page->setWifiParams(ssid, pwd, needConnect);
	}
}

}

#define TIMER_PIXEL 1
#define TIMER_PIXEL_MS 40

static S_ACTIVITY_TIMEER REGISTER_ACTIVITY_TIMER_TAB[] = {
	{TIMER_PIXEL, TIMER_PIXEL_MS},
};

/**
 * 当界面构造时触发
 */
static void onUI_init(){
	//防砖属性
	SystemProperties::setString("sys.zkapp.state", "running");
	//初始化串口
	McuManager::getInstance().initialize(new PixelMcuProto::McuParse("/dev/ttyS1", 1500000));

	//每次开机必须先请求一下版本,才可以显示画面
	std::string mcuVer;
	McuManager::getInstance().queryMcuVersion(mcuVer);
	LOGI_TRACE("mcuVer : [%s]", mcuVer.c_str());

	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(new BtnTestPage()));
	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(new RgbTestPage()));
	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(new AudioTestPage()));
	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(new WifiTestPage()));
	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(new PetPage()));
	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(new FirePage()));

	KeyManager::getInstance().start();
    loadConfigAndStart();
    EASYUICONTEXT->openActivity("btnTestActivity", nullptr);
}

/**
 * 当切换到该界面时触发
 */
static void onUI_intent(const Intent *intentPtr) {
    if (intentPtr != NULL) {
        //TODO
    }
}

/*
 * 当界面显示时触发
 */
static void onUI_show() {
	if (!pixelArtActive()) {
		return;
	}
	KeyManager::getInstance().addKeyEventCallback(keyEventCb);
	sPixelVisible = true;
	PageManager::getInstance().navigateTo(pixelArtPage());
}

/*
 * 当界面隐藏时触发
 */
static void onUI_hide() {
	sPixelVisible = false;
	pixelArtActive() = false;
	KeyManager::getInstance().removeKeyEventCallback(keyEventCb);
}

/*
 * 当界面完全退出时触发
 */
static void onUI_quit() {
	sPixelVisible = false;
	pixelArtActive() = false;
	KeyManager::getInstance().removeKeyEventCallback(keyEventCb);
}

/**
 * 串口数据回调接口
 */
static void onProtocolDataUpdate(const SProtocolData &data) {

}

/**
 * 定时器触发函数
 * 不建议在此函数中写耗时操作，否则将影响UI刷新
 * 参数： id
 *         当前所触发定时器的id，与注册时的id相同
 * 返回值: true
 *             继续运行当前定时器
 *         false
 *             停止运行当前定时器
 */
static bool onUI_Timer(int id){
	switch (id) {
		case TIMER_PIXEL:
			if (sPixelVisible) {
				PageManager::getInstance().drawCurrentPage();
			}
			break;
		default:
			break;
	}
    return true;
}

/**
 * 有新的触摸事件时触发
 * 参数：ev
 *         新的触摸事件
 * 返回值：true
 *            表示该触摸事件在此被拦截，系统不再将此触摸事件传递到控件上
 *         false
 *            触摸事件将继续传递到控件上
 */
static bool onmainActivityTouchEvent(const MotionEvent &ev) {
    switch (ev.mActionStatus) {
		case MotionEvent::E_ACTION_DOWN://触摸按下
			//LOGD("时刻 = %ld 坐标  x = %d, y = %d", ev.mEventTime, ev.mX, ev.mY);
			break;
		case MotionEvent::E_ACTION_MOVE://触摸滑动
			break;
		case MotionEvent::E_ACTION_UP:  //触摸抬起
			break;
		default:
			break;
	}
	return false;
}
