from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
upload = root / 'upload'
icon_source = root / 'source/branding/icon128.png'
icon_blob = '3142245002a3f530ccf9f5885716ffc291e65574'
files = [
    ('store-icon-128.png', (128, 128), 'Existing repo icon'),
    ('01-watch-together-1280x800.png', (1280, 800), '01 / Watch together'),
    ('02-find-your-stream-1280x800.png', (1280, 800), '02 / Find your stream'),
    ('03-floating-chat-1280x800.png', (1280, 800), '03 / Floating chat'),
    ('04-recent-streams-1280x800.png', (1280, 800), '04 / Recent streams'),
    ('05-customize-your-view-1280x800.png', (1280, 800), '05 / Customize your view'),
    ('promo-small-440x280.png', (440, 280), 'Small promo / 440 x 280'),
    ('promo-marquee-1400x560.png', (1400, 560), 'Marquee / 1400 x 560'),
]
icon_data = icon_source.read_bytes()
assert hashlib.sha1(b'blob ' + str(len(icon_data)).encode() + b'\0' + icon_data).hexdigest() == icon_blob
shutil.copyfile(icon_source, upload / 'store-icon-128.png')
manifest = []
for name, dimensions, label in files:
    path = upload / name
    with Image.open(path) as img:
        assert img.size == dimensions, (name, img.size)
        assert img.format == 'PNG', (name, img.format)
        if name != 'store-icon-128.png' and img.mode != 'RGB':
            # Store screenshots and tiles require opaque 24-bit PNGs.
            img.convert('RGB').save(path, optimize=True)
    data = path.read_bytes()
    if name != 'store-icon-128.png':
        assert data[24:26] == bytes([8, 2]), (name, 'Expected 8-bit RGB PNG')
    manifest.append({'file': name, 'width': dimensions[0], 'height': dimensions[1],
                     'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
assert (upload / files[0][0]).read_bytes() == icon_data
with Image.open(upload / files[0][0]) as exported:
    assert exported.mode == 'RGBA' and exported.getextrema()[3][0] == 0
(root / 'manifest.json').write_text(json.dumps({'assets': manifest, 'icon': 'Unmodified transparent repo icon from main; Git blob ' + icon_blob,
    'screenshots': 'Extension interface rendered with illustrative stream and chat'}, indent=2) + '\n')

# Review sheet only. Upload PNGs stay at their full original dimensions.
board = Image.new('RGB', (1400, 1180), '#f0edf5')
draw = ImageDraw.Draw(board)
font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
font = ImageFont.truetype(font_path, 18)
title = ImageFont.truetype(font_path, 30)
small_font = ImageFont.truetype(font_path, 14)
draw.text((32, 25), 'YouTube Player for Twitch', fill='#1b1525', font=title)
draw.text((32, 66), 'Chrome Web Store assets · vrnrn', fill='#715686', font=font)
for i, (name, size, label) in enumerate(files[1:6]):
    col, row = i % 3, i // 3
    x, y = 32 + col * 456, 110 + row * 306
    draw.text((x, y), label + ' / 1280 x 800', fill='#614775', font=font)
    with Image.open(upload / name) as img:
        board.paste(img.convert('RGB').resize((424, 265), Image.Resampling.LANCZOS), (x, y + 27))
# Put the two promos alongside screenshot five, leaving the main five images legible.
x, y = 944, 416
draw.text((x, y), files[6][2], fill='#614775', font=font)
with Image.open(upload / files[6][0]) as img:
    board.paste(img.convert('RGB').resize((424, 270), Image.Resampling.LANCZOS), (x, y + 27))
draw.text((32, 736), 'Marquee promo / 1400 x 560', fill='#614775', font=font)
with Image.open(upload / files[7][0]) as img:
    board.paste(img.convert('RGB').resize((1000, 400), Image.Resampling.LANCZOS), (32, 763))
with Image.open(upload / files[0][0]) as img:
    board.paste(img, (1145, 840), img.getchannel('A'))
draw.text((1100, 997), 'Existing icon · unchanged', fill='#614775', font=font)
draw.text((1148, 1028), '128 x 128', fill='#715686', font=small_font)
board.save(root / 'preview.jpg', quality=94)
with zipfile.ZipFile(root / 'youtube-player-for-twitch-webstore-assets.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(root / 'README.md', 'README.md')
    for name, _, _ in files:
        archive.write(upload / name, name)
print(json.dumps({'validated': len(files), 'iconUnchanged': True, 'zip': str(root / 'youtube-player-for-twitch-webstore-assets.zip'), 'assets': manifest}, indent=2))
