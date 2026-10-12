#pragma once
#include "uart/ProtocolSender.h"
#include "managers/KeyManager.h"
#include "managers/PageManager.h"
#include "pages/PixelArtPage.h"
namespace {
void keyEventCb(int keyCode, int keyStatus) {
	if(!PageManager::getInstance().onKeyEvent(keyCode, keyStatus)) {
		return;
	}
	switch(keyCode) {
	case E_KEYCODE_CLOCKWISE:
		pixelArtPage() = "PetPage";
		pixelArtActive() = true;
		EASYUICONTEXT->openActivity("mainActivity", nullptr);
		break;
	case E_KEYCODE_ANTI_CLOCKWISE:
		EASYUICONTEXT->openActivity("wifiTestActivity", nullptr);
		break;
	default:
		break;
	}
}
#define TIMER_MIC_REFRESH 1
#define TIMER_MIC_REFRESH_TIME 33

}
static S_ACTIVITY_TIMEER REGISTER_ACTIVITY_TIMER_TAB[] = {
	{TIMER_MIC_REFRESH, TIMER_MIC_REFRESH_TIME}
};

/**
 * 当界面构造时触发
 */
static void onUI_init(){

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
	KeyManager::getInstance().addKeyEventCallback(keyEventCb);
	PageManager::getInstance().navigateTo("AudioTestPage");
}

/*
 * 当界面隐藏时触发
 */
static void onUI_hide() {
	KeyManager::getInstance().removeKeyEventCallback(keyEventCb);
}

/*
 * 当界面完全退出时触发
 */
static void onUI_quit() {
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
		case TIMER_MIC_REFRESH:
			PageManager::getInstance().drawCurrentPage();
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
static bool onaudioTestActivityTouchEvent(const MotionEvent &ev) {
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
