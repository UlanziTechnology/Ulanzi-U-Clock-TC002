#ifndef CORE_SURFACE_H_
#define CORE_SURFACE_H_

#include <vector>
#include <iostream>

struct Color {
	typedef unsigned char byte;

	byte r = 0;
	byte g = 0;
	byte b = 0;

	Color() {}

	Color(byte red, byte green, byte blue)
		: r(red), g(green), b(blue) {}

	Color(uint32_t rgb)
		: r((rgb >> 16) & 0xFF), g((rgb >> 8) & 0xFF), b(rgb & 0xFF) {}

	uint32_t toRGB888() const {
		return (r << 16) | (g << 8) | b;
	}

	static Color fromRGB888(uint32_t rgb) {
		return Color((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
	}
};

class Surface {
public:

    Surface();
    Surface(int width, int height);
    Surface(int width, int height, const Color& bgColor);
    virtual ~Surface();

    Surface(const Surface&) = delete;
    Surface& operator=(const Surface&) = delete;

    int getWidth() const { return mWidth; }
    int getHeight() const { return mHeight; }

    void setPixel(int x, int y, const Color& color);
    Color getPixel(int x, int y) const;

    void clear();
    void clear(const Color& color);
    void fill(const Color& color);

    void extractRGB(std::vector<uint8_t>& outData) const;

    const uint8_t* getData() const { return mData; }

private:
    int mWidth;
    int mHeight;
    uint8_t* mData;
};


#endif
