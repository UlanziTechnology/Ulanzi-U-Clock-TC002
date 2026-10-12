#ifndef PAGES_FIREPAGE_H_
#define PAGES_FIREPAGE_H_

#include "pages/PageBase.h"

class FirePage : public PageBase {
public:
	FirePage();
	virtual ~FirePage();

	virtual void draw() override;
	virtual void onEnter() override;
	virtual void onExit() override;

private:
	int mFrame;
	int mTick;

	void paint();
};

#endif
