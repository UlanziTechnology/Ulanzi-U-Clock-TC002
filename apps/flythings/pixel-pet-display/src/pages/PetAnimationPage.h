#ifndef PAGES_PETANIMATIONPAGE_H_
#define PAGES_PETANIMATIONPAGE_H_

#include "pages/PageBase.h"
#include "utils/Surface.h"
#include "assets/PetAnimationFrames.h"

class PetAnimationPage : public PageBase {
public:
	PetAnimationPage(const std::string& pageName,
		const PetAnimationAssets::PetAnimationSet& petSet);
	virtual ~PetAnimationPage();

	virtual void draw() override;
	virtual void onEnter() override;
	virtual void onExit() override;
	virtual bool onKeyEvent(int keyCode, int keyStatus) override;

	void tick();
	int getTickIntervalMs() const;

	enum Action {
		ACTION_AUTO,
		ACTION_IDLE,
		ACTION_WALK,
		ACTION_HAPPY,
		ACTION_EAT,
		ACTION_SLEEP
	};

private:
	const PetAnimationAssets::PetAnimationSet& mPetSet;
	const PetAnimationAssets::Animation* mAnimation;
	Action mAction;
	int mFrameIndex;
	long long mRightButtonDownMs;
	bool mRightButtonPressed;

	void selectAction(Action action);
	const PetAnimationAssets::Animation* animationForAction(Action action) const;
	void drawFrame(Surface& surface, const PetAnimationAssets::Frame& frame);
};

#endif /* PAGES_PETANIMATIONPAGE_H_ */
