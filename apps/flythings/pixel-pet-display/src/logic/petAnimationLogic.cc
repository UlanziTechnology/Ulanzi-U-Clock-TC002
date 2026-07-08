#pragma once
#include "managers/KeyManager.h"
#include "managers/PageManager.h"
#include "managers/McuManager.h"
#include "mcuProtocol/mcuProtoParse.h"
#include "pages/PetAnimationPage.h"
#include <memory>
#include <os/SystemProperties.h>

namespace {

#define TIMER_PET_ANIMATION_TICK 1

bool sPetAnimationVisible = false;
const char* PET_PAGE_NAMES[] = {
	"CatPetPage",
	"DogPetPage",
	"RabbitPetPage"
};
const int PET_PAGE_COUNT = sizeof(PET_PAGE_NAMES) / sizeof(PET_PAGE_NAMES[0]);
int sCurrentPetPageIndex = 0;

PetAnimationPage* petAnimationPage() {
	return static_cast<PetAnimationPage*>(
		PageManager::getInstance().getPage(PET_PAGE_NAMES[sCurrentPetPageIndex]));
}

void resetPetAnimationTimer() {
	PetAnimationPage* page = petAnimationPage();
	if (page) {
		mActivityPtr->resetUserTimer(TIMER_PET_ANIMATION_TICK, page->getTickIntervalMs());
	}
}

void keyEventCb(int keyCode, int keyStatus) {
	if(!PageManager::getInstance().onKeyEvent(keyCode, keyStatus)) {
		resetPetAnimationTimer();
		return;
	}
	if (keyStatus != 1 && keyCode != E_KEYCODE_CLOCKWISE && keyCode != E_KEYCODE_ANTI_CLOCKWISE) {
		return;
	}
	switch(keyCode) {
	case E_KEYCODE_CLOCKWISE:
		sCurrentPetPageIndex = (sCurrentPetPageIndex + 1) % PET_PAGE_COUNT;
		PageManager::getInstance().navigateTo(PET_PAGE_NAMES[sCurrentPetPageIndex]);
		resetPetAnimationTimer();
		break;
	case E_KEYCODE_ANTI_CLOCKWISE:
		sCurrentPetPageIndex = (sCurrentPetPageIndex - 1 + PET_PAGE_COUNT) % PET_PAGE_COUNT;
		PageManager::getInstance().navigateTo(PET_PAGE_NAMES[sCurrentPetPageIndex]);
		resetPetAnimationTimer();
		break;
	default:
		break;
	}
}

}

static S_ACTIVITY_TIMEER REGISTER_ACTIVITY_TIMER_TAB[] = {
};

static void onUI_init(){
	static bool initialized = false;
	if (initialized) {
		return;
	}
	initialized = true;

	SystemProperties::setString("sys.zkapp.state", "running");
	McuManager::getInstance().initialize(
		new PixelMcuProto::McuParse("/dev/ttyS1", 1500000));

	std::string mcuVer;
	McuManager::getInstance().queryMcuVersion(mcuVer);
	LOGI_TRACE("PixelPet: mcuVer [%s]", mcuVer.c_str());

	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(
		new PetAnimationPage("CatPetPage", PetAnimationAssets::CAT_SET)));
	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(
		new PetAnimationPage("DogPetPage", PetAnimationAssets::DOG_SET)));
	PageManager::getInstance().registerPage(std::unique_ptr<PageBase>(
		new PetAnimationPage("RabbitPetPage", PetAnimationAssets::RABBIT_SET)));

	KeyManager::getInstance().start();
}

static void onUI_intent(const Intent *intentPtr) {
	if (intentPtr != NULL) {
	}
}

static void onUI_show() {
	sPetAnimationVisible = true;
	KeyManager::getInstance().addKeyEventCallback(keyEventCb);
	PageManager::getInstance().navigateTo(PET_PAGE_NAMES[sCurrentPetPageIndex]);
	mActivityPtr->registerUserTimer(TIMER_PET_ANIMATION_TICK, 200);
	resetPetAnimationTimer();
}

static void onUI_hide() {
	sPetAnimationVisible = false;
	KeyManager::getInstance().removeKeyEventCallback(keyEventCb);
	mActivityPtr->unregisterUserTimer(TIMER_PET_ANIMATION_TICK);
}

static void onUI_quit() {
	sPetAnimationVisible = false;
	KeyManager::getInstance().removeKeyEventCallback(keyEventCb);
	mActivityPtr->unregisterUserTimer(TIMER_PET_ANIMATION_TICK);
}

static void onProtocolDataUpdate(const SProtocolData &data) {
}

static bool onUI_Timer(int id){
	switch (id) {
		case TIMER_PET_ANIMATION_TICK: {
			if (!sPetAnimationVisible) {
				return false;
			}
			PetAnimationPage* page = petAnimationPage();
			if (page) {
				page->tick();
				resetPetAnimationTimer();
			}
			break;
		}
		default:
			break;
	}
	return true;
}

static bool onpetAnimationActivityTouchEvent(const MotionEvent &ev) {
	switch (ev.mActionStatus) {
		case MotionEvent::E_ACTION_DOWN:
			break;
		case MotionEvent::E_ACTION_MOVE:
			break;
		case MotionEvent::E_ACTION_UP:
			break;
		default:
			break;
	}
	return false;
}
