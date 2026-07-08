/*
 * ProtocolData.h
 *
 *  Created on: Sep 7, 2017
 */

#ifndef _UART_PROTOCOL_DATA_H_
#define _UART_PROTOCOL_DATA_H_

#include <string>
#include "CommDef.h"

/******************** CmdID ***********************/
#define CMDID_POWER							0x0
/**************************************************/

/******************** 错误�?Error code ***********************/
#define ERROR_CODE_CMDID			1
/**************************************************/

typedef struct {
	BYTE power;
} SProtocolData;

#endif /* _UART_PROTOCOL_DATA_H_ */
