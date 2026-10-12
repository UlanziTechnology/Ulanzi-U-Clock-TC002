#ifndef PAGES_PETPAGE_H_
#define PAGES_PETPAGE_H_

#include "pages/PageBase.h"

class PetPage : public PageBase {
public:
	PetPage();
	virtual ~PetPage();

	virtual void draw() override;
	virtual void onEnter() override;
	virtual void onExit() override;
	virtual bool onKeyEvent(int keyCode, int keyStatus) override;

private:
	int mMode;
	int mFrame;
	int mTick;

	void paint();
};

#endif
