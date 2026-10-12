#ifndef PAGES_PIXELARTPAGE_H_
#define PAGES_PIXELARTPAGE_H_

#include <string>

inline std::string& pixelArtPage() {
	static std::string page = "PetPage";
	return page;
}

inline bool& pixelArtActive() {
	static bool active = false;
	return active;
}

#endif
