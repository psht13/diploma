from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs" / "codex" / "diagram_assets"
CANVAS_SIZE = (2400, 1500)
TITLE = "Магістерська курсова робота: архітектура АІНС для діалогового агента-репетитора"

FONT_REGULAR_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
]
FONT_BOLD_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]

COLORS = {
    "ink": "#24364b",
    "muted": "#66788f",
    "line": "#5c6f82",
    "accent": "#d8e7f5",
    "accent_line": "#9fb8cf",
    "blue_fill": "#e7f0fb",
    "blue_line": "#4f7fb7",
    "teal_fill": "#e7f7f5",
    "teal_line": "#3e9788",
    "rose_fill": "#fdeef1",
    "rose_line": "#c46e88",
    "gold_fill": "#fdf4de",
    "gold_line": "#c79936",
    "slate_fill": "#f3f6f8",
    "slate_line": "#8795a3",
    "violet_fill": "#f1edfb",
    "violet_line": "#7d69b6",
    "mint_fill": "#edf8e7",
    "mint_line": "#78a043",
    "white": "#ffffff",
}


def load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = FONT_BOLD_CANDIDATES if bold else FONT_REGULAR_CANDIDATES
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def make_canvas(title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", CANVAS_SIZE, COLORS["white"])
    draw = ImageDraw.Draw(image)
    title_font = load_font(50, bold=True)
    subtitle_font = load_font(24)

    draw.rounded_rectangle((60, 48, 2340, 168), radius=32, fill=COLORS["accent"], outline=COLORS["accent_line"], width=2)
    draw.text((96, 68), title, fill=COLORS["ink"], font=title_font)
    draw.text((96, 126), subtitle, fill=COLORS["muted"], font=subtitle_font)
    return image, draw


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw_line in text.split("\n"):
        words = raw_line.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if text_width(draw, candidate, font) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def draw_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    title: str,
    body: str,
    *,
    fill: str,
    outline: str,
    title_font: ImageFont.ImageFont,
    body_font: ImageFont.ImageFont,
    title_fill: str | None = None,
    align: str = "center",
) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=24, fill=fill, outline=outline, width=4)
    title_fill = title_fill or COLORS["ink"]
    body_fill = COLORS["ink"]

    current_y = y1 + 24
    if title:
        title_lines = wrap_text(draw, title, title_font, x2 - x1 - 48)
        for line in title_lines:
            line_width = text_width(draw, line, title_font)
            text_x = x1 + 24 if align == "left" else x1 + (x2 - x1 - line_width) / 2
            draw.text((text_x, current_y), line, fill=title_fill, font=title_font)
            current_y += 38
        current_y += 8

    body_lines = wrap_text(draw, body, body_font, x2 - x1 - 56) if body else []
    line_height = 30
    total_height = line_height * len(body_lines)
    if not title:
        current_y = y1 + (y2 - y1 - total_height) / 2
    for line in body_lines:
        line_width = text_width(draw, line, body_font)
        text_x = x1 + 28 if align == "left" else x1 + (x2 - x1 - line_width) / 2
        draw.text((text_x, current_y), line, fill=body_fill, font=body_font)
        current_y += line_height


def draw_polyline_arrow(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[int, int]],
    *,
    color: str = COLORS["line"],
    width: int = 6,
) -> None:
    draw.line(points, fill=color, width=width)
    (x1, y1), (x2, y2) = points[-2], points[-1]
    angle = math.atan2(y2 - y1, x2 - x1)
    head = 18
    wing = math.pi / 7
    left = (x2 - head * math.cos(angle - wing), y2 - head * math.sin(angle - wing))
    right = (x2 - head * math.cos(angle + wing), y2 - head * math.sin(angle + wing))
    draw.polygon([(x2, y2), left, right], fill=color)


def draw_arrow_label(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
) -> None:
    lines = wrap_text(draw, text, font, 250)
    widths = [text_width(draw, line, font) for line in lines] or [0]
    width = max(widths) + 28
    height = len(lines) * 26 + 18
    x = center[0] - width / 2
    y = center[1] - height / 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=18, fill=COLORS["white"], outline=COLORS["accent_line"], width=2)
    line_y = y + 9
    for line in lines:
        draw.text((center[0] - text_width(draw, line, font) / 2, line_y), line, fill=COLORS["ink"], font=font)
        line_y += 26


def render_component_diagram(path: Path) -> None:
    image, draw = make_canvas(
        "Компонентна архітектура АІНС",
        "Концептуальні й реалізовані модулі для сценарію вивчення базового JavaScript",
    )
    title_font = load_font(28, bold=True)
    body_font = load_font(23)
    small_font = load_font(21)

    boxes = {
        "student": ((100, 520, 320, 650), "Студент", "", COLORS["gold_fill"], COLORS["gold_line"]),
        "ui": ((420, 465, 760, 705), "Інтерфейс користувача", "Робоче навчальне\nсередовище", COLORS["blue_fill"], COLORS["blue_line"]),
        "memory": ((920, 240, 1260, 430), "Пам'ять сесії", "Стан студента, історія спроб,\nпоточна вправа", COLORS["mint_fill"], COLORS["mint_line"]),
        "policy": ((1450, 240, 1810, 430), "Педагогічна політика", "Вибір педагогічної дії\nта рівня підказки", COLORS["rose_fill"], COLORS["rose_line"]),
        "generator": ((920, 560, 1260, 730), "Генератор вправ", "Генерація вправи\nабо резервний сценарій", COLORS["violet_fill"], COLORS["violet_line"]),
        "feedback": ((1450, 560, 1810, 730), "Модуль фідбеку", "Адаптивний фідбек\nабо резервне пояснення", COLORS["violet_fill"], COLORS["violet_line"]),
        "runner": ((920, 860, 1260, 1030), "Запуск тестів", "Підготовка тестів\nі результату запуску", COLORS["rose_fill"], COLORS["rose_line"]),
        "worker": ((1450, 860, 1810, 1030), "Web Worker", "Ізольоване виконання\nкоду студента", COLORS["rose_fill"], COLORS["rose_line"]),
        "llm": ((1970, 495, 2290, 705), "Локальна LLM", "Ollama / llama3.1:8b", COLORS["teal_fill"], COLORS["teal_line"]),
        "future": ((880, 1170, 1850, 1360), "Концептуальне розширення повної АІНС", "пам'ять знань, пам'ять узагальнень,\nпрофільна / векторна пам'ять", COLORS["slate_fill"], COLORS["slate_line"]),
    }

    for box, title, body, fill, outline in boxes.values():
        draw_box(draw, box, title, body, fill=fill, outline=outline, title_font=title_font, body_font=body_font)

    draw_polyline_arrow(draw, [(320, 585), (420, 585)])
    draw_polyline_arrow(draw, [(760, 520), (840, 520), (840, 335), (920, 335)])
    draw_polyline_arrow(draw, [(760, 610), (840, 610), (840, 645), (920, 645)])
    draw_polyline_arrow(draw, [(1260, 335), (1450, 335)])
    draw_polyline_arrow(draw, [(1260, 645), (1450, 645)])
    draw_polyline_arrow(draw, [(760, 680), (840, 680), (840, 945), (920, 945)])
    draw_polyline_arrow(draw, [(1260, 945), (1450, 945)])
    draw_polyline_arrow(draw, [(1810, 645), (1970, 645)])
    draw_polyline_arrow(draw, [(1970, 555), (1890, 555), (1890, 645), (1810, 645)])
    draw_polyline_arrow(draw, [(1810, 945), (1890, 945), (1890, 800), (590, 800), (590, 705)])
    draw_polyline_arrow(draw, [(1080, 1030), (1080, 1170)])
    draw_polyline_arrow(draw, [(1630, 1030), (1630, 1170)])

    draw_arrow_label(draw, (880, 455), "оновлення\nстану", small_font)
    draw_arrow_label(draw, (1355, 335), "вибір дії", small_font)
    draw_arrow_label(draw, (1890, 645), "виклик моделі", small_font)
    draw_arrow_label(draw, (820, 870), "тести", small_font)

    image.save(path)


def render_state_diagram(path: Path) -> None:
    image, draw = make_canvas(
        "Структура стану студента і пам'яті сесії",
        "Мінімальна модель стану студента для репетиторського сценарію",
    )
    title_font = load_font(30, bold=True)
    body_font = load_font(22)

    draw_box(
        draw,
        (120, 240, 1130, 1230),
        "Пам'ять сесії",
        "",
        fill=COLORS["teal_fill"],
        outline=COLORS["teal_line"],
        title_font=title_font,
        body_font=body_font,
        align="left",
    )
    draw_box(
        draw,
        (200, 360, 1040, 860),
        "Стан студента",
        "рівень знань\nісторія помилок\nупевненість\nпоточна тема\nкількість спроб\nостання дія",
        fill=COLORS["white"],
        outline=COLORS["teal_line"],
        title_font=title_font,
        body_font=body_font,
        align="left",
    )
    draw_box(
        draw,
        (200, 930, 1040, 1130),
        "Додаткові поля сесії",
        "вправа, журнал діалогу,\nостанній результат запуску,\nостання сигнатура помилки",
        fill=COLORS["slate_fill"],
        outline=COLORS["slate_line"],
        title_font=load_font(26, bold=True),
        body_font=load_font(20),
        align="left",
    )
    draw_box(
        draw,
        (1380, 360, 2240, 590),
        "Вхідні сигнали",
        "запит студента, результат запуску,\nтема, код, режим взаємодії",
        fill=COLORS["rose_fill"],
        outline=COLORS["rose_line"],
        title_font=title_font,
        body_font=body_font,
        align="left",
    )
    draw_box(
        draw,
        (1380, 760, 2240, 1130),
        "Оновлення стану",
        "збільшення лічильника спроб\n"
        "оновлення рівня впевненості\n"
        "фіксація сигнатури помилки\n"
        "оновлення історії та останньої дії",
        fill=COLORS["violet_fill"],
        outline=COLORS["violet_line"],
        title_font=title_font,
        body_font=load_font(20),
        align="left",
    )

    draw_polyline_arrow(draw, [(1130, 475), (1250, 475), (1250, 475), (1380, 475)])
    draw_polyline_arrow(draw, [(1380, 930), (1250, 930), (1250, 1040), (1130, 1040)])

    image.save(path)


def render_sequence_diagram(path: Path) -> None:
    image, draw = make_canvas(
        "Послідовність сценарію навчальної взаємодії",
        "Від генерації вправи до результату запуску й адаптивного фідбеку",
    )
    header_font = load_font(24, bold=True)
    body_font = load_font(21)

    participants = [
        ("Студент", 220),
        ("Інтерфейс", 560),
        ("Генератор", 900),
        ("Тестування", 1240),
        ("Політика", 1580),
        ("Фідбек", 1920),
    ]
    line_top = 300
    line_bottom = 1330

    for label, x in participants:
        draw.rounded_rectangle((x - 110, 190, x + 110, 270), radius=24, fill=COLORS["blue_fill"], outline=COLORS["blue_line"], width=4)
        draw.text((x - text_width(draw, label, header_font) / 2, 214), label, fill=COLORS["ink"], font=header_font)
        draw.line((x, line_top, x, line_bottom), fill=COLORS["accent_line"], width=4)

    steps = [
        (380, 220, 560, "1. Обрати тему"),
        (470, 560, 900, "2. Запит JSON"),
        (560, 900, 560, "3. Показати вправу"),
        (650, 220, 560, "4. Запустити тести"),
        (740, 560, 1240, "5. Код і тести"),
        (830, 1240, 560, "6. Повернути результат"),
        (920, 560, 1580, "7. Обрати дію"),
        (1010, 560, 1920, "8. Запросити фідбек"),
        (1100, 1920, 560, "9. Повернути фідбек"),
        (1190, 560, 220, "10. Показати підказку"),
    ]

    for y, x1, x2, label in steps:
        draw_polyline_arrow(draw, [(x1, y), (x2, y)])
        draw_arrow_label(draw, ((x1 + x2) // 2, y - 34), label, body_font)

    draw.rounded_rectangle((180, 1270, 2150, 1395), radius=24, fill=COLORS["slate_fill"], outline=COLORS["slate_line"], width=3)
    footer_font = load_font(21)
    legend = "Показано базовий цикл взаємодії студента з мінімальним практичним сценарієм прототипу."
    draw.text((220, 1312), legend, fill=COLORS["muted"], font=footer_font)

    image.save(path)


def render_runtime_diagram(path: Path) -> None:
    image, draw = make_canvas(
        "Схема виконання прототипу",
        "Поділ між браузерним інтерфейсом, локальною LLM, Web Worker і резервним режимом",
    )
    title_font = load_font(30, bold=True)
    body_font = load_font(23)
    note_font = load_font(21)

    boxes = [
        ((140, 520, 620, 760), "Браузерний UI", "Вибір теми, редактор коду,\nжурнал взаємодій", COLORS["blue_fill"], COLORS["blue_line"]),
        ((840, 260, 1370, 500), "Локальна LLM", "Ollama + llama3.1:8b", COLORS["teal_fill"], COLORS["teal_line"]),
        ((840, 800, 1370, 1040), "Web Worker", "Запуск тестів з тайм-аутом\nі перевіркою вхідних даних", COLORS["violet_fill"], COLORS["violet_line"]),
        ((1610, 260, 2240, 540), "Перевірка JSON і повтор", "Перевірка структури,\nрезервний режим,\nнормалізація відповіді", COLORS["gold_fill"], COLORS["gold_line"]),
        ((1610, 780, 2240, 1060), "Коректна обробка помилок", "Стійкі повідомлення про помилки,\nworker.onerror / messageerror", COLORS["rose_fill"], COLORS["rose_line"]),
    ]

    for box, title, body, fill, outline in boxes:
        draw_box(draw, box, title, body, fill=fill, outline=outline, title_font=title_font, body_font=body_font)

    draw_polyline_arrow(draw, [(620, 590), (760, 590), (760, 380), (840, 380)])
    draw_polyline_arrow(draw, [(1370, 380), (1490, 380), (1490, 380), (1610, 380)])
    draw_polyline_arrow(draw, [(620, 680), (760, 680), (760, 920), (840, 920)])
    draw_polyline_arrow(draw, [(1370, 920), (1490, 920), (1490, 920), (1610, 920)])
    draw_polyline_arrow(draw, [(1610, 470), (1490, 470), (1490, 620), (620, 620)])
    draw_polyline_arrow(draw, [(1610, 920), (1490, 920), (1490, 700), (620, 700)])

    notes = [
        "модель синхронізується перед LLM-викликом;",
        "невалідний JSON не руйнує сценарій, а веде до резервного режиму;",
        "виконання у worker має тайм-аут, перевірку вхідних даних і явну обробку помилок.",
    ]
    draw.rounded_rectangle((140, 1160, 2240, 1380), radius=26, fill=COLORS["slate_fill"], outline=COLORS["slate_line"], width=3)
    y = 1210
    for note in notes:
        draw.text((190, y), f"• {note}", fill=COLORS["ink"], font=note_font)
        y += 48

    image.save(path)


def render_all() -> dict[str, Path]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        "image1.png": OUTPUT_DIR / "figure_3_1_component_architecture.png",
        "image2.png": OUTPUT_DIR / "figure_3_2_session_memory.png",
        "image3.png": OUTPUT_DIR / "figure_3_3_sequence.png",
        "image4.png": OUTPUT_DIR / "figure_4_1_runtime.png",
    }
    render_component_diagram(outputs["image1.png"])
    render_state_diagram(outputs["image2.png"])
    render_sequence_diagram(outputs["image3.png"])
    render_runtime_diagram(outputs["image4.png"])
    return outputs


def main() -> None:
    render_all()


if __name__ == "__main__":
    main()
