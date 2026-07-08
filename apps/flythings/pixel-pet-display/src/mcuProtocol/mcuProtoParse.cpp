#include <mcuProtocol/mcuProtoParse.h>
#include "base/base.h"
#define MAX_DATA_LEN 256
namespace PixelMcuProto {

McuParse::~McuParse() {

}

void McuParse::registerRecvMsgCb(const MessageHandler& handler) {
	onReceiveMessage(handler);
}

int McuParse::queryMicValue() {
	base::ByteArray data = {0xFF, 0x55, 0x01, 0x00};
	short checkSum = calcChecksum(data.toString().c_str(), data.length());
	data.append( checkSum >> 8 );
	data.append( (char)checkSum );
	try {
		MyResponse response = request(data);
		int micValue = (response.data[0] << 8) | response.data[1];
		return micValue;
	}catch(base::Exception& e) {
		LOGE_TRACE("request faile!\n");
		PRINT_EXCEPTION(e);
	}
	return -1;
}

int McuParse::queryUsbState() {
	base::ByteArray data = {0xFF, 0x55, 0x02, 0x00};
	short checkSum = calcChecksum(data.toString().c_str(), data.length());
	data.append( checkSum >> 8 );
	data.append( (char)checkSum );
	try {
		MyResponse response = request(data);
		int UsbState = response.data[0];
		return UsbState;
	}catch(base::Exception& e) {
		LOGE_TRACE("request faile!\n");
		PRINT_EXCEPTION(e);
	}
	return -1;
}

std::pair<int, int> McuParse::queyrBatteryPower() {
	base::ByteArray data = {0xFF, 0x55, 0x03, 0x00};
	short checkSum = calcChecksum(data.toString().c_str(), data.length());
	data.append( checkSum >> 8 );
	data.append( (char)checkSum );
	try {
		MyResponse response = request(data);
		std::pair<int, int>BatteryState = {response.data[0], (response.data[1] << 8) | response.data[2]};
		return BatteryState;
	}catch(base::Exception& e) {
		LOGE_TRACE("request faile!\n");
		PRINT_EXCEPTION(e);
	}
	return {-1, -1};
}

void McuParse::setAutoMicReport(bool sw) {
	base::ByteArray data = {0xFF, 0x55, 0x04, 0x01};
	data.append(sw ? 1 : 0);
	short checkSum = calcChecksum(data.toString().c_str(), data.length());
	data.append( checkSum >> 8 );
	data.append( (char)checkSum );
	try {
		request(data);
	}catch(base::Exception& e) {
		LOGE_TRACE("request faile!\n");
		PRINT_EXCEPTION(e);
	}
}

void McuParse::powerOff() {
	base::ByteArray data = {0xFF, 0x55, 0x10, 0x00};
	short checkSum = calcChecksum(data.toString().c_str(), data.length());
	data.append( checkSum >> 8 );
	data.append( (char)checkSum );
	try {
		request(data);
	}catch(base::Exception& e) {
		LOGE_TRACE("request faile!\n");
		PRINT_EXCEPTION(e);
	}
}

int McuParse::queryMcuVersion(std::string& mcuVer) {
	base::ByteArray data = {0xFF, 0x55, 0x11, 0x00};
	short checkSum = calcChecksum(data.toString().c_str(), data.length());
	data.append( checkSum >> 8 );
	data.append( (char)checkSum );
	try {
		MyResponse response = request(data);
		mcuVer = response.data.toString();
		LOGI_TRACE("mcuVer : [%s]", mcuVer.c_str());
		return 0;
	}catch(base::Exception& e) {
		LOGE_TRACE("request faile!\n");
		PRINT_EXCEPTION(e);
	}
	return -1;
}

unsigned short McuParse::calcChecksum(const char* data, int len) {
	unsigned short v = 0;
	for (int i = 0; i < len; ++i) {
		v = v + data[i];
	}
	return v;
}

int McuParse::parse(const char* stream, int length, MyResponse* response) {
	return mcuParse(stream, length, response);
}

int McuParse::mcuParse(const char* stream, int length, MyResponse* response) {
	int minLen = 2 + 1 + 1 + 2;

	if(length < minLen) {
		return 0;
	}
	if( (stream[0] != 0xFF) || (stream[1] != 0x55) ) {
		return -1;
	}
	char cmd = stream[2];
	char dataLen = stream[3];
	if(dataLen > 32) {
		LOGE_TRACE("dataLen is invail = %d", dataLen);
		return -1;
	}
	const int framLen = dataLen + minLen;
	if(length < framLen) {
		return 0;
	}

	unsigned short checkSum = (stream[framLen - 2] << 8) | (stream[framLen - 1]);

	unsigned short calcSum = calcChecksum(stream, framLen - 2);

	if(checkSum != calcSum) {
		LOGE_TRACE("checksum not match, calculate is %#x, but received %#x\n", calcSum, checkSum);
		return -1;
	}
	response->cmd = cmd;
	response->data.clear();
	response->data.append(stream + 4, dataLen);
	return framLen;
}
bool McuParse::match(const base::ByteArray& send_data, base::ByteArray& recv_data) {

	if(send_data[2] == 0x01 || send_data[2] == 0x02
	|| send_data[2] == 0x03 || send_data[2] == 0x11)
	{
		if(recv_data[2] != send_data[2]) {
			return false;
		}
		return true;
	}

	if(recv_data.size() < 6) {
		return false;
	}
	if(recv_data[0] != 0xFF || recv_data[1] != 0x55 ||
	   recv_data[2] != 0xFE || recv_data[3] != 0x00 ||
	   recv_data[4] != 0x02 || recv_data[5] != 0x52)
	{
		return false;
	}
	return true;
}

} /* namespace KeyProto */
