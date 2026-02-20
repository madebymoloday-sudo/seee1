# -*- coding: utf-8 -*-
"""Расчёт уровня и формирование 12 пунктов по ответам."""
from __future__ import annotations

import re
from spec_loader import LEVEL_QUESTION_IDS, load_spec, get_sphere_name


DIFFICULT_KEYWORDS = ("затрудняюсь", "затрудняюсь ответить", "не знаю", "хз")
DIFFICULT_SCORE = 3


def parse_scale_value(text: str) -> int | None:
    """Из текста ответа извлекает число 1–10 или распознаёт «затрудняюсь» → 3."""
    if not text or not isinstance(text, str):
        return None
    t = text.strip().lower()
    for kw in DIFFICULT_KEYWORDS:
        if kw in t:
            return DIFFICULT_SCORE
    # Ищем число 1–10
    numbers = re.findall(r"\b([1-9]|10)\b", t)
    if numbers:
        return min(10, max(1, int(numbers[0])))
    return None


def calculate_level(answers: dict[str, str | int]) -> int:
    """Уровень 1–100: среднее по 12 сферам (первый вопрос каждой) * 10."""
    scores: list[float] = []
    for qid in LEVEL_QUESTION_IDS:
        raw = answers.get(qid)
        if raw is None:
            scores.append(DIFFICULT_SCORE)
            continue
        if isinstance(raw, int):
            s = max(1, min(10, raw))
        else:
            s = parse_scale_value(str(raw))
            if s is None:
                s = DIFFICULT_SCORE
        scores.append(float(s))
    if not scores:
        return 1
    avg = sum(scores) / len(scores)
    level = round(avg * 10)
    return max(1, min(100, level))


def build_12_points(answers: dict[str, str | int]) -> list[dict]:
    """Строит 12 пунктов для вывода: сфера, тема, убеждения, тезис.
    Без LLM: на основе сфер и ответов (низкие баллы, текстовые ответы).
    """
    spec = load_spec()
    sphere_order = [s["id"] for s in spec["spheres"]]
    points = []
    for i, sphere_id in enumerate(sphere_order):
        qid = LEVEL_QUESTION_IDS[i]
        name = get_sphere_name(spec, sphere_id)
        raw = answers.get(qid)
        score = None
        if raw is not None:
            if isinstance(raw, int):
                score = raw
            else:
                score = parse_scale_value(str(raw))
        if score is None:
            score = DIFFICULT_SCORE
        # Тезис по умолчанию
        if score <= 4:
            belief = "Ограничивающие убеждения в этой сфере мешают движению вперёд."
            thesis = f"Разобрать, что именно в теме «{name}» держит тебя на месте, и освободиться от этих установок."
        else:
            belief = "Есть зона роста — можно усилить опору и ясность."
            thesis = f"Укрепить сферу «{name}» и закрепить уже достигнутое."
        points.append({
            "sphere_id": sphere_id,
            "sphere_name": name,
            "score": score,
            "topic": name,
            "beliefs": belief,
            "thesis": thesis,
        })
    return points


def format_level_and_12_points(level: int, points: list[dict]) -> str:
    """Одно сообщение: уровень + 12 пунктов."""
    lines = [f"Твой уровень сейчас: {level} из 100.", ""]
    next_level = min(100, level + 1)
    lines.append(f"Вот 12 пунктов, чтобы подняться на уровень {next_level}. По каждому направлению — что разобрать, от каких убеждений освободиться и тезис под разбор.")
    lines.append("")
    for i, p in enumerate(points, 1):
        lines.append(f"{i}. **{p['sphere_name']}**")
        lines.append(f"   Убеждения: {p['beliefs']}")
        lines.append(f"   Тезис: {p['thesis']}")
        lines.append("")
    return "\n".join(lines).strip()
