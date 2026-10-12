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
		EASYUICONTEXT->openActivity("rgbTestActivity", nullptr);
		break;
	case E_KEYCODE_ANTI_CLOCKWISE:
		pixelArtPage() = "FirePage";
		pixelArtActive() = true;
		EASYUICONTEXT->openActivity("mainActivity", nullptr);
		break;
	default:
		break;
	}
}


}

static S_ACTIVITY_TIMEER REGISTER_ACTIVITY_TIMER_TAB[] = {

};

static void onUI_init(){


}

static void onUI_intent(const Intent *intentPtr) {
    if (intentPtr != NULL) {
        //TODO
    }
}


static void onUI_show() {
	KeyManager::getInstance().addKeyEventCallback(keyEventCb);
	PageManager::getInstance().navigateTo("BtnTestPage");
}


static void onUI_hide() {
	KeyManager::getInstance().removeKeyEventCallback(keyEventCb);
}

static void onUI_quit() {
	KeyManager::getInstance().removeKeyEventCallback(keyEventCb);
}

static void onProtocolDataUpdate(const SProtocolData &data) {

}

static bool onUI_Timer(int id){
	switch (id) {

		default:
			break;
	}
    return true;
}

static bool onbtnTestActivityTouchEvent(const MotionEvent &ev) {
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
