/*
 * KeyManager.cpp
 *
 *  Created on: 2022å¹?æœ?9æ—?
 *      Author: guoxs
 */

#include <managers/KeyManager.h>

#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/select.h>
#include <linux/input.h>
#include <unordered_set>

#include "system/Thread.h"
#include "base/log.h"
#include "base/base.h"

namespace {

#define TABLE_SIZE(x)		(sizeof(x)/sizeof(x[0]))

// é¡ºæ—¶é’?
#define CLOCKWISE_START_STATUS         0x8
#define CLOCKWISE_STOP_STATUS          0x1
// é€†æ—¶é’?
#define ANTI_CLOCKWISE_START_STATUS    0xD
#define ANTI_CLOCKWISE_STOP_STATUS     0xB

typedef struct {
	const char *dev;
	int fd;
} event_node_info_t;

event_node_info_t _s_event_node_list[] = {
	{ "/dev/input/event67", -1 },
	{ "/dev/input/event68", -1 }
};

}

class KeyManager::EventThread : public Thread {
public:
	EventThread(KeyManager* manager) : m_manager(manager) {}

protected:
	virtual bool threadLoop() override {
		return m_manager->eventThreadLoop();
	}

private:
	KeyManager* m_manager;
};

struct KeyManager::Impl {
	int m_wakeFds[2];
	uint32_t m_lastEventVal;
	std::unordered_set<on_key_event_cb> m_callbackSet;
	Mutex m_mutex;
	EventThread* m_eventThread;
	bool m_running;

	Impl() : m_lastEventVal(0), m_eventThread(nullptr), m_running(false) {
		m_wakeFds[0] = -1;
		m_wakeFds[1] = -1;
	}
};

KeyManager::KeyManager() : m_impl(new Impl()) {
}

KeyManager::~KeyManager() {
	stop();
	delete m_impl;
}

KeyManager& KeyManager::getInstance() {
	static KeyManager instance;
	return instance;
}

bool KeyManager::start() {
	if (m_impl->m_running) {
		LOGW_TRACE("KeyManager already running");
		return true;
	}

	int cnt = 0;
	for (int i = 0; i < (int) TABLE_SIZE(_s_event_node_list); ++i) {
		int fd = open(_s_event_node_list[i].dev, O_RDONLY);
		if (fd >= 0) {
			_s_event_node_list[i].fd = fd;
			cnt++;
		}
	}

	if (cnt == 0) {
		LOGE_TRACE("No event dev open!\n");
		return false;
	}

	if (pipe(m_impl->m_wakeFds) < 0) {
		LOGE_TRACE("Create pipe error!\n");
		return false;
	}

	m_impl->m_eventThread = new EventThread(this);
	if (!m_impl->m_eventThread->run("key_event")) {
		LOGE_TRACE("Failed to start event thread\n");
		delete m_impl->m_eventThread;
		m_impl->m_eventThread = nullptr;
		return false;
	}

	m_impl->m_running = true;
	return true;
}

void KeyManager::stop() {
	if (!m_impl->m_running) {
		return;
	}

	if (m_impl->m_wakeFds[1] >= 0) {
		LOGI_TRACE("Want to wake up event thread...\n");

		ssize_t nWrite;
		do {
			nWrite = write(m_impl->m_wakeFds[1], "W", 1);
		} while ((nWrite == -1) && (errno == EINTR));

		while (m_impl->m_wakeFds[0] >= 0) {
			usleep(10000);
		}

		close(m_impl->m_wakeFds[1]);
		m_impl->m_wakeFds[1] = -1;
	}

	if (m_impl->m_eventThread) {
		delete m_impl->m_eventThread;
		m_impl->m_eventThread = nullptr;
	}

	for (int i = 0; i < (int) TABLE_SIZE(_s_event_node_list); ++i) {
		if (_s_event_node_list[i].fd >= 0) {
			close(_s_event_node_list[i].fd);
			_s_event_node_list[i].fd = -1;
		}
	}

	m_impl->m_running = false;
}

void KeyManager::addKeyEventCallback(on_key_event_cb cb) {
	Mutex::Autolock _l(m_impl->m_mutex);
	m_impl->m_callbackSet.insert(cb);
}

void KeyManager::removeKeyEventCallback(on_key_event_cb cb) {
	Mutex::Autolock _l(m_impl->m_mutex);
	m_impl->m_callbackSet.erase(cb);
}

bool KeyManager::eventThreadLoop() {
	fd_set fdset;
	FD_ZERO(&fdset);

	FD_SET(m_impl->m_wakeFds[0], &fdset);

	int maxFD = m_impl->m_wakeFds[0];

	for (int i = 0; i < (int) TABLE_SIZE(_s_event_node_list); ++i) {
		if (_s_event_node_list[i].fd >= 0) {
			FD_SET(_s_event_node_list[i].fd, &fdset);
			if (maxFD < _s_event_node_list[i].fd) {
				maxFD = _s_event_node_list[i].fd;
			}
		}
	}

	if (select(maxFD + 1, &fdset, NULL, NULL, NULL) > 0) {
		for (int i = 0; i < (int) TABLE_SIZE(_s_event_node_list); ++i) {
			int fd = _s_event_node_list[i].fd;
			if (fd >= 0) {
				if (FD_ISSET(fd, &fdset)) {
					struct input_event event;
					if (read(fd, &event, sizeof(event)) == sizeof(event)) {
						if (event.type == EV_ABS) {
							switch (event.value) {
							case CLOCKWISE_START_STATUS:
							case ANTI_CLOCKWISE_START_STATUS:
								m_impl->m_lastEventVal = event.value;
								break;

							case CLOCKWISE_STOP_STATUS:
								if (m_impl->m_lastEventVal == CLOCKWISE_START_STATUS) {
									notifyKeyEvent(E_KEYCODE_CLOCKWISE, 0);
								}
								m_impl->m_lastEventVal = event.value;
								break;

							case ANTI_CLOCKWISE_STOP_STATUS:
								if (m_impl->m_lastEventVal == ANTI_CLOCKWISE_START_STATUS) {
									notifyKeyEvent(E_KEYCODE_ANTI_CLOCKWISE, 0);
								}
								m_impl->m_lastEventVal = event.value;
								break;
							}
						}

						if (event.type == EV_KEY) {
							switch (event.code) {
							case E_KEYCODE_KNOB_BUTTON:
							case E_KEYCODE_LEFT_BUTTON:
							case E_KEYCODE_MIDDLE_BUTTON:
							case E_KEYCODE_RIGHT_BUTTON:
								if (event.value == 1) {
									notifyKeyEvent(event.code, 1);
								} else if (event.value == 0) {
									notifyKeyEvent(event.code, 0);
								}
								break;
							default:
								break;
							}
						}
					}
				}
			}
		}

		if (FD_ISSET(m_impl->m_wakeFds[0], &fdset)) {
			LOGI_TRACE("wait_event wake up ...\n");
			close(m_impl->m_wakeFds[0]);
			m_impl->m_wakeFds[0] = -1;
			return false;
		}
	}

	return true;
}

void KeyManager::notifyKeyEvent(int keyCode, int keyStatus) {
	Mutex::Autolock _l(m_impl->m_mutex);
	for (std::unordered_set<on_key_event_cb>::iterator it = m_impl->m_callbackSet.begin();
			it != m_impl->m_callbackSet.end(); ++it) {
		if (*it) {
			(*it)(keyCode, keyStatus);
		}
	}
}
