/*
 * KeyManager.cpp
 *
 *  Created on: 2022�?�?9�?
 *      Author: guoxs
 */
#ifndef MANAGERS_KEYMANAGER_H_
#define MANAGERS_KEYMANAGER_H_

#include <stdint.h>

// 按键事件类型
enum EKeyCode {
	E_KEYCODE_CLOCKWISE,        // 顺时�?
	E_KEYCODE_ANTI_CLOCKWISE,   // 逆时�?
	E_KEYCODE_KNOB_BUTTON = 0x67,   // 旋钮按键
	E_KEYCODE_LEFT_BUTTON = 0x6C,   // 左键
	E_KEYCODE_MIDDLE_BUTTON = 0x69, // 中键
	E_KEYCODE_RIGHT_BUTTON = 0x6A,  // 右键
};

// 按键事件回调类型
typedef void (*on_key_event_cb)(int keyCode, int keyStatus);

class KeyManager {
public:
	static KeyManager& getInstance();

	bool start();

	void stop();

	void addKeyEventCallback(on_key_event_cb cb);

	void removeKeyEventCallback(on_key_event_cb cb);

private:
	struct Impl;
	class EventThread;
	KeyManager();
	virtual ~KeyManager();

	bool eventThreadLoop();

	void notifyKeyEvent(int keyCode, int keyStatus);

	KeyManager(const KeyManager&) = delete;
	KeyManager& operator=(const KeyManager&) = delete;

	Impl* m_impl;
};

#endif
