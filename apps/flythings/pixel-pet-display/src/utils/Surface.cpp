/*
 * Surface.cpp
 */

#include "Surface.h"
#include <cstring>
#include <algorithm>

Surface::Surface()
    : mWidth(52)
    , mHeight(16)
    , mData(nullptr) {

    int size = mWidth * mHeight * 3;  // RGBA
    mData = new uint8_t[size];
    memset(mData, 0, size);
}

Surface::Surface(int width, int height)
    : mWidth(width)
    , mHeight(height)
    , mData(nullptr) {

    int size = mWidth * mHeight * 3;
    mData = new uint8_t[size];
    memset(mData, 0, size);
}

Surface::Surface(int width, int height, const Color& bgColor)
    : mWidth(width)
    , mHeight(height)
    , mData(nullptr) {

    int size = mWidth * mHeight * 3;
    mData = new uint8_t[size];

    // 填充背景�?
    for (int i = 0; i < mWidth * mHeight; i++) {
        mData[i * 3 + 0] = bgColor.r;
        mData[i * 3 + 1] = bgColor.g;
        mData[i * 3 + 2] = bgColor.b;
    }
}

Surface::~Surface() {
    if (mData) {
        delete[] mData;
        mData = nullptr;
    }
}

void Surface::setPixel(int x, int y, const Color& color) {
    if (x < 0 || x >= mWidth || y < 0 || y >= mHeight) {
        return;  // 越界检�?
    }

    int index = (y * mWidth + x) * 3;
    mData[index + 0] = color.r;
    mData[index + 1] = color.g;
    mData[index + 2] = color.b;
}

void Surface::clear() {
    memset(mData, 0, mWidth * mHeight * 3);
}

void Surface::clear(const Color& color) {
    fill(color);
}

void Surface::fill(const Color& color) {
    for (int i = 0; i < mWidth * mHeight; i++) {
        mData[i * 4 + 0] = color.r;
        mData[i * 4 + 1] = color.g;
        mData[i * 4 + 2] = color.b;
    }
}

void Surface::extractRGB(std::vector<uint8_t>& outData) const {
    // 预分配空�? width * height * 3
    outData.resize(mWidth * mHeight * 3);

    int outIndex = 0;
    for (int i = 0; i < mWidth * mHeight; i++) {
        outData[outIndex++] = mData[i * 3 + 0];  // R
        outData[outIndex++] = mData[i * 3 + 1];  // G
        outData[outIndex++] = mData[i * 3 + 2];  // B
    }
}
