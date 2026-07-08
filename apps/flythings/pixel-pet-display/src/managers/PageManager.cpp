#include <managers/PageManager.h>
#include <memory>
#include <algorithm>
#include "base/log.h"

static const size_t INVALID_PAGE_INDEX = static_cast<size_t>(-1);

PageManager::PageManager() : mCurrentPageIndex(INVALID_PAGE_INDEX) {
}

PageManager::~PageManager() {

}

void PageManager::registerPage(std::unique_ptr<PageBase> page) {
    std::unique_lock<std::mutex> lock(mMutex);

    if (!page) {
        LOGE_TRACE("PageManager: Cannot register null page");
        return;
    }

    auto it = std::find_if(mPages.begin(), mPages.end(),
        [&page](const std::unique_ptr<PageBase>& p) {
            return p->getName() == page->getName();
        });

    if (it != mPages.end()) {
        size_t index = std::distance(mPages.begin(), it);

        if (index == mCurrentPageIndex) {
            mPages[index]->onExit();
        }

        LOGD_TRACE("PageManager: Replacing page '%s'", page->getName().c_str());
        *it = std::move(page);

        mCurrentPageIndex = index;
        mPages[mCurrentPageIndex]->onEnter();
    } else {
        mPages.emplace_back(std::move(page));
        LOGD_TRACE("PageManager: Registered page '%s'", mPages.back()->getName().c_str());
    }
}

void PageManager::unregisterPage(const std::string name) {
    std::unique_lock<std::mutex> lock(mMutex);

    auto it = std::find_if(mPages.begin(), mPages.end(),
        [&name](const std::unique_ptr<PageBase>& p) {
            return p->getName() == name;
        });

    if (it != mPages.end()) {
        size_t index = std::distance(mPages.begin(), it);

        if (index == mCurrentPageIndex) {
            mPages[index]->onExit();
            mCurrentPageIndex = INVALID_PAGE_INDEX;
        }
        LOGD_TRACE("PageManager: Unregistered page '%s'", name.c_str());
        mPages.erase(it);

        if (index < mCurrentPageIndex) {
            mCurrentPageIndex--;
        }
    } else {
        LOGW_TRACE("PageManager: Page '%s' not found", name.c_str());
    }
}

void PageManager::navigateTo(const std::string& name) {
    std::unique_lock<std::mutex> lock(mMutex);

    size_t targetIndex = INVALID_PAGE_INDEX;
    for (size_t i = 0; i < mPages.size(); ++i) {
        if (mPages[i]->getName() == name) {
            targetIndex = i;
            break;
        }
    }

    if (targetIndex == INVALID_PAGE_INDEX) {
        LOGE_TRACE("PageManager: Page '%s' not found", name.c_str());
        return;
    }

    if (mCurrentPageIndex == targetIndex) {
        mPages[mCurrentPageIndex]->onEnter();
        mPages[mCurrentPageIndex]->draw();
        return;
    }

    if (mCurrentPageIndex != INVALID_PAGE_INDEX) {
        mPages[mCurrentPageIndex]->onExit();
    }

    mCurrentPageIndex = targetIndex;

    mPages[mCurrentPageIndex]->onEnter();

    mPages[mCurrentPageIndex]->draw();

    LOGD_TRACE("PageManager: Navigated to page '%s'", name.c_str());
}

void PageManager::drawCurrentPage() {
    std::unique_lock<std::mutex> lock(mMutex);

    if (mCurrentPageIndex == INVALID_PAGE_INDEX || mCurrentPageIndex >= mPages.size()) {
        return;
    }

    mPages[mCurrentPageIndex]->draw();
}

bool PageManager::onKeyEvent(int keyCode, int keyStatus) {
    std::unique_lock<std::mutex> lock(mMutex);

    if (mCurrentPageIndex == INVALID_PAGE_INDEX || mCurrentPageIndex >= mPages.size()) {
        return false;
    }

    return mPages[mCurrentPageIndex]->onKeyEvent(keyCode, keyStatus);
}

PageBase* PageManager::getPage(const std::string& name) {
    std::unique_lock<std::mutex> lock(mMutex);
    for (auto& p : mPages) {
        if (p->getName() == name) {
            return p.get();
        }
    }
    return nullptr;
}
