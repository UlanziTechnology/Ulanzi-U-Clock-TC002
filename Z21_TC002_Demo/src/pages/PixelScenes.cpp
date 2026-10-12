#include "pages/PetPage.h"
#include "pages/FirePage.h"
#include "utils/Surface.h"
#include "managers/KeyManager.h"
#include "base/base.h"

#include "pages/pixel_art_frames.inc"

static const Color COLOR_BLACK(0, 0, 0);

static void blitIndexed(Surface& surface, const uint8_t* frame, const uint8_t palette[][3]) {
	for (int i = 0; i < kMatrixW * kMatrixH; ++i) {
		const uint8_t* c = palette[frame[i]];
		surface.setPixel(i % kMatrixW, i / kMatrixW, Color(c[0], c[1], c[2]));
	}
}

static const uint8_t* petFrame(int mode, int frame) {
	if (mode == 1) {
		return kPetWalk[frame % kPetWalkCount];
	}
	if (mode == 2) {
		return kPetRun[frame % kPetRunCount];
	}
	return kPetIdle[frame % kPetIdleCount];
}

static int petFrameCount(int mode) {
	if (mode == 1) {
		return kPetWalkCount;
	}
	if (mode == 2) {
		return kPetRunCount;
	}
	return kPetIdleCount;
}

PetPage::PetPage()
	: PageBase("PetPage"), mMode(0), mFrame(0), mTick(0) {
}

PetPage::~PetPage() {
}

void PetPage::onEnter() {
	mFrame = 0;
	mTick = 0;
}

void PetPage::onExit() {
}

bool PetPage::onKeyEvent(int keyCode, int keyStatus) {
	if (keyStatus != 1) {
		return true;
	}
	if (keyCode != E_KEYCODE_LEFT_BUTTON && keyCode != E_KEYCODE_RIGHT_BUTTON) {
		return true;
	}
	if (keyCode == E_KEYCODE_LEFT_BUTTON) {
		mMode = (mMode + 2) % 3;
	} else {
		mMode = (mMode + 1) % 3;
	}
	mFrame = 0;
	mTick = 0;
	paint();
	return false;
}

void PetPage::draw() {
	mTick++;
	const int period = (mMode == 0) ? 22 : (mMode == 1) ? 3 : 2;
	if (mTick >= period) {
		mTick = 0;
		mFrame = (mFrame + 1) % petFrameCount(mMode);
	}
	paint();
}

void PetPage::paint() {
	Surface surface(kMatrixW, kMatrixH, COLOR_BLACK);
	blitIndexed(surface, petFrame(mMode, mFrame), kPetPalette);
	std::vector<uint8_t> data;
	surface.extractRGB(data);
	sendLedData(data);
}

FirePage::FirePage()
	: PageBase("FirePage"), mFrame(0), mTick(0) {
}

FirePage::~FirePage() {
}

void FirePage::onEnter() {
	mFrame = 0;
	mTick = 0;
}

void FirePage::onExit() {
}

void FirePage::draw() {
	mTick++;
	if (mTick >= 2) {
		mTick = 0;
		mFrame = (mFrame + 1) % kFireCount;
	}
	paint();
}

void FirePage::paint() {
	Surface surface(kMatrixW, kMatrixH, COLOR_BLACK);
	blitIndexed(surface, kFireFrames[mFrame], kFirePalette);
	std::vector<uint8_t> data;
	surface.extractRGB(data);
	sendLedData(data);
}
