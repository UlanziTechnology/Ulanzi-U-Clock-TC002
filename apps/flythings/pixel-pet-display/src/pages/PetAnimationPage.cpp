#include "pages/PetAnimationPage.h"
#include "base/base.h"
#include "managers/KeyManager.h"
#include <sys/time.h>

namespace {

#define DISPLAY_WIDTH 52
#define DISPLAY_HEIGHT 16

static const Color COLOR_BLACK(0, 0, 0);
static const long long RIGHT_BUTTON_LONG_PRESS_MS = 800;
static const int ACTION_COUNT = 6;

long long nowMs() {
	struct timeval tv;
	gettimeofday(&tv, nullptr);
	return static_cast<long long>(tv.tv_sec) * 1000 + tv.tv_usec / 1000;
}

} // namespace

PetAnimationPage::PetAnimationPage(const std::string& pageName,
	const PetAnimationAssets::PetAnimationSet& petSet)
	: PageBase(pageName),
	  mPetSet(petSet),
	  mAnimation(animationForAction(ACTION_AUTO)),
	  mAction(ACTION_AUTO),
	  mFrameIndex(0),
	  mRightButtonDownMs(0),
	  mRightButtonPressed(false) {
}

PetAnimationPage::~PetAnimationPage() {
}

void PetAnimationPage::onEnter() {
	LOGD_TRACE("PetAnimationPage: onEnter %s", mPetSet.name);
	selectAction(ACTION_AUTO);
}

void PetAnimationPage::onExit() {
	LOGD_TRACE("PetAnimationPage: onExit %s", mPetSet.name);
}

bool PetAnimationPage::onKeyEvent(int keyCode, int keyStatus) {
	if (keyCode == E_KEYCODE_RIGHT_BUTTON) {
		if (keyStatus == 1) {
			mRightButtonDownMs = nowMs();
			mRightButtonPressed = true;
			return false;
		}
		if (keyStatus == 0 && mRightButtonPressed) {
			long long heldMs = nowMs() - mRightButtonDownMs;
			mRightButtonPressed = false;
			selectAction(heldMs >= RIGHT_BUTTON_LONG_PRESS_MS ? ACTION_SLEEP : ACTION_EAT);
			return false;
		}
		return false;
	}

	if (keyStatus != 1) {
		return true;
	}

	switch (keyCode) {
	case E_KEYCODE_LEFT_BUTTON:
		selectAction(ACTION_WALK);
		return false;
	case E_KEYCODE_MIDDLE_BUTTON:
		selectAction(ACTION_HAPPY);
		return false;
	case E_KEYCODE_KNOB_BUTTON:
		selectAction(ACTION_AUTO);
		return false;
	default:
		return true;
	}
}

void PetAnimationPage::tick() {
	if (!mAnimation || mAnimation->frameCount == 0) {
		return;
	}
	mFrameIndex = (mFrameIndex + 1) % mAnimation->frameCount;
	draw();
}

int PetAnimationPage::getTickIntervalMs() const {
	if (!mAnimation || mAnimation->frameCount == 0) {
		return 200;
	}
	const PetAnimationAssets::Frame& frame = mAnimation->frames[mFrameIndex];
	return frame.durationMs > 0 ? frame.durationMs : 200;
}

void PetAnimationPage::selectAction(Action action) {
	mAction = action;
	mAnimation = animationForAction(action);
	mFrameIndex = 0;
	draw();
}

const PetAnimationAssets::Animation* PetAnimationPage::animationForAction(Action action) const {
	int index = static_cast<int>(action);
	if (index < 0 || index >= ACTION_COUNT || index >= mPetSet.animationCount) {
		index = ACTION_AUTO;
	}
	return mPetSet.animations[index];
}

void PetAnimationPage::draw() {
	Surface surface(DISPLAY_WIDTH, DISPLAY_HEIGHT, COLOR_BLACK);
	if (mAnimation && mAnimation->frameCount > 0) {
		drawFrame(surface, mAnimation->frames[mFrameIndex]);
	}

	std::vector<uint8_t> data;
	surface.extractRGB(data);
	sendLedData(data);
}

void PetAnimationPage::drawFrame(Surface& surface, const PetAnimationAssets::Frame& frame) {
	for (uint16_t i = 0; i < frame.pixelCount; ++i) {
		const PetAnimationAssets::Pixel& pixel = frame.pixels[i];
		surface.setPixel(pixel.x, pixel.y, Color(pixel.r, pixel.g, pixel.b));
	}
}
