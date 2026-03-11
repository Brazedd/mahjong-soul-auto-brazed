#!/usr/bin/env python3
"""Generate simple PNG icons for the extension."""
import struct, zlib, os

def create_png(size, color=(233, 69, 96)):
    """Create a minimal PNG with a solid colored tile icon."""
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    # Draw a simple mahjong tile shape
    pixels = []
    r, g, b = color
    dark_r, dark_g, dark_b = int(r*0.6), int(g*0.6), int(b*0.6)
    bg = (26, 26, 46)

    for y in range(size):
        row = []
        for x in range(size):
            # Border
            margin = max(1, size // 8)
            if (margin <= x < size - margin) and (margin <= y < size - margin):
                # Inner tile
                inner_margin = margin + max(1, size // 12)
                if (inner_margin <= x < size - inner_margin) and (inner_margin <= y < size - inner_margin):
                    row.extend([r, g, b, 255])
                else:
                    row.extend([dark_r, dark_g, dark_b, 255])
            else:
                row.extend([bg[0], bg[1], bg[2], 255])
        pixels.append(row)

    raw = b''
    for row in pixels:
        raw += b'\x00' + bytes(row)

    compressed = zlib.compress(raw, 9)

    png = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png += make_chunk(b'IHDR', ihdr_data)
    png += make_chunk(b'IDAT', compressed)
    png += make_chunk(b'IEND', b'')
    return png

os.makedirs('icons', exist_ok=True)
for sz in [16, 48, 128]:
    with open(f'icons/icon{sz}.png', 'wb') as f:
        f.write(create_png(sz))
    print(f'Created icons/icon{sz}.png')
