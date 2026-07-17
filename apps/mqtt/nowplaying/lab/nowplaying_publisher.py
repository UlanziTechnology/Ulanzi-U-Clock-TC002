#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 cailurus
"""nowplaying — scrolling "TITLE - ARTIST" marquee for a TC002 over MQTT.

The device does NOT scroll text (its Custom-App text element just clips to rect), so a
live marquee can't be done with a static HA blueprint. Instead this bakes the scroll into
a looping GIF and publishes it ONCE per song — the device then loops it forever until the
next song. Publish again whenever the track changes.

Renders: a fixed play/pause icon on the left + the title/artist scrolling to the left in
the remaining width (short titles are shown static/centered, no pointless scroll).

Publish over MQTT (pure stdlib, no deps):
  python3 nowplaying_publisher.py --broker 192.168.1.5 --prefix ulanzi_1bf6 \
      --title "Midnight City" --artist "M83" --state playing
Preview to a GIF instead of publishing (for the preview/ folder or testing):
  python3 nowplaying_publisher.py --title "Midnight City" --artist "M83" --dry demo.gif

Wiring to Home Assistant: define a shell_command that runs this with the media_player
attributes, and an automation that calls it on media_player state/track change. See docs/.
"""
import argparse, socket
from PIL import Image, ImageDraw, ImageFont

W, H = 52, 16
TEXT_X = 9                       # text scrolls in x=9..51; icon sits in x=0..7
ICON_GREEN = (62, 224, 138)


# ---------- rendering ----------
def _ascii_upper(s):
    return "".join(c for c in (s or "").upper() if 0x20 <= ord(c) <= 0x7E)


def _icon(state):
    im = Image.new("RGBA", (8, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if state == "playing":
        d.polygon([(1, 3), (1, 12), (7, 7)], fill=ICON_GREEN)      # play triangle
    else:
        d.rectangle([1, 3, 2, 12], fill=ICON_GREEN)                # pause bars
        d.rectangle([5, 3, 6, 12], fill=ICON_GREEN)
    return im


def _text_mask(text):
    """Render text to a crisp 1px mask (thresholded default bitmap font) — plain, legible."""
    font = ImageFont.load_default()
    tw = max(1, int(font.getlength(text)))
    m = Image.new("L", (tw, H), 0)
    ImageDraw.Draw(m).text((0, 3), text, fill=255, font=font)
    return m.point(lambda p: 255 if p > 110 else 0), tw


def _compose(icon, mask, positions, color):
    """Black 52x16 frame: text mask pasted at each x in positions (clipped to x>=TEXT_X),
    colorized, with the icon on top-left."""
    layer = Image.new("L", (W, H), 0)
    for x in positions:
        layer.paste(mask, (x, 0))
    lp = layer.load()
    for x in range(TEXT_X):                       # keep text from running under the icon
        for y in range(H):
            lp[x, y] = 0
    img = Image.new("RGB", (W, H), (0, 0, 0))
    ip, mp = img.load(), layer.load()
    for y in range(H):
        for x in range(W):
            if mp[x, y] > 127:
                ip[x, y] = color
    img.paste(icon.convert("RGB"), (0, 0), icon)
    pal = Image.new("P", (1, 1))
    flat = [0, 0, 0] + list(color) + list(ICON_GREEN)
    pal.putpalette(flat + [0] * (768 - len(flat)))
    return img.quantize(palette=pal, dither=Image.NONE)


def render_gif(title, artist, state, color, out):
    text = _ascii_upper(f"{title} - {artist}" if artist else title) or "MUSIC"
    col = tuple(int(color.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    icon = _icon(state)
    mask, tw = _text_mask(text)
    avail = W - TEXT_X
    if tw <= avail:                               # fits -> static, centered, single frame
        frame = _compose(icon, mask, [TEXT_X + (avail - tw) // 2], col)
        frames, dur = [frame], 3000
    else:                                         # scroll -> seamless loop
        gap, step = 12, 2                          # 2px steps, but slow frames -> gentle scroll (~10px/s)
        period = tw + gap
        frames = [_compose(icon, mask, [TEXT_X - off, TEXT_X - off + period], col)
                  for off in range(0, period, step)]
        dur = 200
    frames[0].save(out, save_all=True, append_images=frames[1:], loop=0, duration=dur, disposal=2)
    with open(out, "rb") as f:
        return f.read()


# ---------- minimal MQTT publish (stdlib) ----------
def _remlen(n):
    o = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        o.append(b | (0x80 if n else 0))
        if not n:
            return bytes(o)


def _s(x):
    b = x.encode("utf-8")
    return len(b).to_bytes(2, "big") + b


def mqtt_publish(host, port, topic, payload, user=None, password=None):
    flags = 0x02
    if user is not None:
        flags |= 0x80
    if password is not None:
        flags |= 0x40
    vh = b"\x00\x04MQTT\x04" + bytes([flags]) + (0).to_bytes(2, "big")
    pl = _s("tc002-nowplaying")
    if user is not None:
        pl += _s(user)
    if password is not None:
        pl += _s(password)
    conn = b"\x10" + _remlen(len(vh + pl)) + vh + pl
    body = _s(topic) + payload.encode("utf-8")
    pub = bytes([0x30 | 0x01]) + _remlen(len(body)) + body     # retain=1 so device restores on reconnect
    s = socket.create_connection((host, port), timeout=5)
    try:
        s.sendall(conn)
        s.recv(4)                                 # CONNACK
        s.sendall(pub)
    finally:
        s.close()


# ---------- CLI ----------
def main():
    import base64, json, os, tempfile
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--artist", default="")
    ap.add_argument("--state", default="playing", choices=["playing", "paused"])
    ap.add_argument("--color", default="#FFFFFF")
    ap.add_argument("--duration", type=int, default=3600)
    ap.add_argument("--broker", default="")
    ap.add_argument("--port", type=int, default=1883)
    ap.add_argument("--prefix", default="ulanzi_1bf6")
    ap.add_argument("--app", default="nowplaying")
    ap.add_argument("--user", default=None)
    ap.add_argument("--password", default=None)
    ap.add_argument("--http", default="", help="preview: POST the frame to this device IP over HTTP (no broker needed)")
    ap.add_argument("--dry", default="", help="write the GIF to this path instead of publishing")
    a = ap.parse_args()

    out = a.dry or os.path.join(tempfile.gettempdir(), "tc002_nowplaying.gif")
    raw = render_gif(a.title, a.artist, a.state, a.color, out)
    if a.dry:
        print(f"wrote {a.dry} ({len(raw)} bytes)")
        return
    frame = {"duration": a.duration, "text": [],
             "image": [{"data": "data:image/gif;base64," + base64.b64encode(raw).decode(), "position": [0, 0]}],
             "draw": []}
    payload = json.dumps(frame)
    if a.http:                                    # local preview over HTTP (same endpoint the web app uses)
        import urllib.request
        req = urllib.request.Request(f"http://{a.http}/api/custom?name={a.app}", data=payload.encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            r.read()
        print(f"pushed over HTTP -> {a.app} on {a.http} ({len(raw)} byte gif) — look at the clock")
        return
    if not a.broker:
        print("need --broker to publish over MQTT, or --http <ip> to preview, or --dry <path> to just render")
        return
    mqtt_publish(a.broker, a.port, f"{a.prefix}/custom/{a.app}", payload, a.user, a.password)
    print(f"published -> {a.prefix}/custom/{a.app} ({len(raw)} byte gif)")


if __name__ == "__main__":
    main()
