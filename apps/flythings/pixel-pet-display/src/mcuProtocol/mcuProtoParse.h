#ifndef KEYPROTOPARSE_H_
#define KEYPROTOPARSE_H_
#include <transfer/serial_transfer.h>
#include <atomic>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>

namespace PixelMcuProto {

struct MyResponse {
	unsigned int cmd;
	base::ByteArray data;
};

class McuParse : public transfer::SerialTransfer<MyResponse> {
public:
	using transfer::SerialTransfer<MyResponse>::SerialTransfer;
	virtual ~McuParse();
	void registerRecvMsgCb(const MessageHandler& handler);
	void setLogLv(const android_LogPriority& lv) {
		setLogLevel(lv);
	}

	int queryMicValue();

	int queryUsbState();

	std::pair<int, int> queyrBatteryPower();

	void setAutoMicReport(bool sw);

	void powerOff();

	int queryMcuVersion(std::string& mcuVer);

protected:
	virtual bool match(const base::ByteArray& send_data, base::ByteArray& recv_data);

private:
	inline unsigned short calcChecksum(const char* data, int len);
	virtual int parse(const char* stream, int length, MyResponse* response);

	int mcuParse(const char* stream, int length, MyResponse* response);
};


} /* namespace KeyProto */

#endif
