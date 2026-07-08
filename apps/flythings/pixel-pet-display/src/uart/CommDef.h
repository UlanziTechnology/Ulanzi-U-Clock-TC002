/*
 * CommDef.h
 *
 *  Created on: 2016-2-15
 */

#ifndef _UART_COMMDEF_H_
#define _UART_COMMDEF_H_

#include <stdint.h>

#ifndef BYTE
typedef unsigned char	BYTE;
#endif
#ifndef UINT
typedef unsigned int	UINT;
#endif
#ifndef UINT16
typedef unsigned short  UINT16;
#endif

#ifndef MAKEWORD
#define MAKEWORD(low, high)		(((BYTE)(low)) | (((BYTE)(high)) << 8))
#endif

#ifndef LOBYTE
#define LOBYTE(l)           ((BYTE)(l))
#endif

#ifndef HIBYTE
#define HIBYTE(l)           ((BYTE)(l >> 8))
#endif

#ifndef TABLESIZE
#define TABLESIZE(table)    (sizeof(table)/sizeof(table[0]))
#endif


// 需要打印协议数据时，打开以下�?
//When you need to print the protocol data, open the following macro
//#define DEBUG_PRO_DATA

// 支持checksum校验，打开以下�?
//Support checksum verification, open the following macro
//#define PRO_SUPPORT_CHECK_SUM


// SynchFrame CmdID  DataLen Data CheckSum (可�?
// SynchFrame CmdID DataLen Data CheckSum (optional)
/*     2Byte  2Byte   1Byte	N Byte  1Byte */
// Minimum length with CheckSum: 2 + 2 + 1 + 1 = 6
// 有CheckSum情况下最小长�? 2 + 2 + 1 + 1 = 6
// Minimum length without CheckSum: 2 + 2 + 1 = 5
// 无CheckSum情况下最小长�? 2 + 2 + 1 = 5

#ifdef PRO_SUPPORT_CHECK_SUM
#define DATA_PACKAGE_MIN_LEN		6
#else
#define DATA_PACKAGE_MIN_LEN		5
#endif

// 同步帧头
// Sync frame header
#define CMD_HEAD1	0xFF
#define CMD_HEAD2	0x55

#endif /* _UART_COMMDEF_H_ */
