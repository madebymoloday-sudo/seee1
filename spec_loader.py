# -*- coding: utf-8 -*-
"""Загрузка спецификации теста из JSON."""
import json
from pathlib import Path

SPEC_PATH = Path(__file__).parent / "telegram_test_prompt.json"

# ID вопросов, по которым считается уровень (первый вопрос каждой из 12 сфер)
LEVEL_QUESTION_IDS = [
    "q1", "q5", "q9", "q13", "q17", "q21", "q25", "q29", "q33", "q37", "q41", "q45"
]

# Порядок сфер для вывода 12 пунктов
SPHERE_ORDER = [
    "parents", "aggression_realization", "aggression_defense", "relationships",
    "self_esteem", "fears", "self_care", "responsibility_honesty",
    "visibility", "health_physical", "health_mental", "attention"
]


def load_spec(path: Path | None = None) -> dict:
    path = path or SPEC_PATH
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_questions_by_step(spec: dict) -> dict[int, dict]:
    """Вопросы по step (1..48)."""
    return {q["step"]: q for q in spec["questions"]}


def get_question_by_id(spec: dict, qid: str) -> dict | None:
    for q in spec["questions"]:
        if q["id"] == qid:
            return q
    return None


def get_sphere_name(spec: dict, sphere_id: str) -> str:
    for s in spec["spheres"]:
        if s["id"] == sphere_id:
            return s["name"]
    return sphere_id
