#ifndef PAGES_PAGEBASE_H_
#define PAGES_PAGEBASE_H_
#include <string>
#include <managers/KeyManager.h>
#include <vector>
#include <utils/SpiHelper.h>
#include <utils/GpioHelper.h>
#include "system/Mutex.h"
class PageBase {
public:
	PageBase(){};
    PageBase(const std::string &pageName) : mName(pageName){}
    virtual ~PageBase();
    virtual void draw() = 0;
	virtual void onEnter() = 0;
	virtual void onExit() = 0;
	virtual bool onKeyEvent(int keyCode, int keyStatus) { return true; };
	virtual const std::string& getName() const { return mName; }
protected:
    static Mutex mSpiMutex;
    void sendLedData(const std::vector<uint8_t> &rgbData);
private:
    std::string mName;
};

#endif /* PAGES_PAGEBASE_H_ */
