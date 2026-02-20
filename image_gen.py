# -*- coding: utf-8 -*-
"""Генерация квадратной картинки с уровнем для сторис."""
from pathlib import Path
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont

SIZE = 1080
BG_COLOR = (18, 18, 22)
TEXT_COLOR = (255, 255, 255)
ACCENT_COLOR = (120, 200, 180)


def get_font(size: int):
    """Пробуем системные шрифты с поддержкой кириллицы."""
    for name in ("Arial", "Helvetica", "DejaVuSans", "LiberationSans-Regular", "sans-serif"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def create_level_image(level: int, logo_path: Path | None = None) -> BytesIO:
    """Создаёт изображение 1080x1080: фон, опционально логотип, текст «Твой уровень: N»."""
    img = Image.new("RGB", (SIZE, SIZE), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Логотип сверху (если есть)
    y_offset = 80
    if logo_path and logo_path.exists():
        try:
            logo = Image.open(logo_path).convert("RGBA")
            logo.thumbnail((320, 320))
            x = (SIZE - logo.width) // 2
            img.paste(logo, (x, 40), logo)
            y_offset = 40 + logo.height + 40
        except Exception:
            pass

    # Текст уровня
    title = "Твой уровень"
    value = f"{level} / 100"
    font_title = get_font(52)
    font_value = get_font(120)
    # Центрируем
    b1 = draw.textbbox((0, 0), title, font=font_title)
    w1 = b1[2] - b1[0]
    b2 = draw.textbbox((0, 0), value, font=font_value)
    w2 = b2[2] - b2[0]
    draw.text(((SIZE - w1) // 2, y_offset), title, fill=TEXT_COLOR, font=font_title)
    draw.text(((SIZE - w2) // 2, y_offset + 70), value, fill=ACCENT_COLOR, font=font_value)

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf
