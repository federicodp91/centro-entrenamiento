"""Genera icon-192.png e icon-512.png (mancuerna blanca sobre naranja) sin dependencias."""
import pathlib, struct, zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BG, FG = (255, 90, 31), (255, 255, 255)
# Rectángulos del icon.svg en coordenadas de 512 (x, y, ancho, alto)
RECTS = [(96, 196, 40, 120), (376, 196, 40, 120), (144, 166, 44, 180), (324, 166, 44, 180), (188, 236, 136, 40)]


def png(size):
    k = 512 / size
    rows = []
    for y in range(size):
        row = bytearray(b"\x00")
        for x in range(size):
            sx, sy = (x + 0.5) * k, (y + 0.5) * k
            inside = any(rx <= sx < rx + w and ry <= sy < ry + h for rx, ry, w, h in RECTS)
            row += bytes(FG if inside else BG)
        rows.append(bytes(row))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))


for s in (192, 512):
    (ROOT / f"icon-{s}.png").write_bytes(png(s))
    print(f"icon-{s}.png")
