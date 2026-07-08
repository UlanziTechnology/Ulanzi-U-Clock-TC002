#ifndef MANAGERS_PAGEMANAGER_H_
#define MANAGERS_PAGEMANAGER_H_
#include "pages/PageBase.h"
#include <vector>
#include <mutex>
#include <memory>
class PageManager {
public:
	static PageManager& getInstance() {
		static PageManager singleton;
		return singleton;
	}
	void registerPage(std::unique_ptr<PageBase> page);
	void unregisterPage(const std::string name);
	void navigateTo(const std::string& name);
	void drawCurrentPage();
	bool onKeyEvent(int keyCode, int keyStatus);
	PageBase* getPage(const std::string& name);
private:
    std::mutex mMutex;
    std::vector<std::unique_ptr<PageBase>> mPages;
    size_t mCurrentPageIndex;  // 当前页面下标，npos 表示无当前页�?
    PageManager();
	virtual ~PageManager();
};

#endif
