# Ulanzi TC002 — HTTP & MQTT Protocol

Ulanzi **TC002** (Pixbar 2nd Gen) is a 52×16 RGB pixel desktop clock with a built-in local web server and MQTT client. This repository documents the device's **HTTP API** and **MQTT topics**, so you can push text, images and drawings onto the display, switch applications, read device state, and integrate it with Home Assistant, Node-RED, or your own scripts.

> Applies to the official factory firmware. The interfaces described here are not guaranteed if a custom firmware is flashed.

## Quick Start

**1. Find the device IP**

Open Ulanzi Studio and check the device page, or look up your router's DHCP client list. The device's local web server runs on `http://<device-ip>`.

**2. Push text over HTTP**

```bash
curl -X POST "http://<device-ip>/api/custom?name=hello" \
  -H "Content-Type: application/json" \
  -d '{"text":[{"content":"HELLO","fontHeight":10,"align":"center","valign":"middle","color":"#FFFFFF"}]}'
```

The device must already be showing the custom app `hello`. To switch to it first:

```bash
curl -X POST "http://<device-ip>/api/switchDiyApp?name=hello"
```

**3. Push the same payload over MQTT**

```bash
mosquitto_pub -h <broker-ip> -t ulanzi_e5f6/custom/hello -m '{"text":[{"content":"HELLO","fontHeight":10,"align":"center","valign":"middle","color":"#FFFFFF"}]}'
```

Replace `ulanzi_e5f6` with the device's actual topic prefix: `mqtt_prefix` + `_` + last two characters of the MAC address. MQTT must be enabled on the device first (see the protocol document, section on MQTT config).

## Full Documentation

Complete API and topic reference, with payload schemas and examples, in bilingual format (English + 中文):

- [`protocol-http-mqtt.md`](protocol-http-mqtt.md)

## At a Glance

| Feature | HTTP | MQTT |
|---|---|---|
| Push custom app content | `POST /api/custom?name=<app>` | `[PREFIX]/custom/<APP_NAME>` |
| List custom apps | `GET /api/customList` | `[PREFIX]/customList` (pushed) |
| Switch custom app | `POST /api/switchDiyApp?name=<app>` | `[PREFIX]/switchDiyApp` |
| System configuration | `POST /setConfig`, `/setMqttConfig`, ... | — |
| Simulate keys / knob | `POST /keyEvent` | — |
| Jump to a built-in app | `POST /switchApp` | — |
| Device info | `GET /getBase` | `[PREFIX]/getBase` (pushed) |
| Status | — | `[PREFIX]/status` (`online` / `offline`) |
| Home Assistant discovery | — | `homeassistant/device/[PREFIX]/config` (opt-in) |

## Limitations

- Text rendering supports **ASCII only** (0x20–0x7E); Chinese and other Unicode are not supported.
- No TTS / audio playback API, no AWTRIX-style notify.
- Physical key / knob events are **not** reported back to MQTT or Home Assistant — the protocol is one-way (host → device).
- The built-in web UI is currently Chinese only; English UI is under evaluation.

## Feedback

Found a bug or have a feature request? Open an issue in this repository, or contact official Ulanzi support.

