# -*- coding: utf-8 -*-
"""Состояние пользователей: шаг теста и ответы."""
from __future__ import annotations

from dataclasses import dataclass, field

# step 0 = не начат (показываем интро и ждём ответа, потом step 1)
# step 1..48 = номер текущего вопроса (после ответа на step N переходим на N+1)
# step 49 = тест завершён, показываем результат
FINAL_STEP = 49


@dataclass
class UserState:
    step: int = 0  # 0 = после старта, 1..48 = вопрос, 49 = конец
    answers: dict[str, str | int] = field(default_factory=dict)  # q1..q48 -> значение

    def current_question_step(self) -> int | None:
        if 1 <= self.step <= 48:
            return self.step
        return None

    def is_finished(self) -> bool:
        return self.step >= FINAL_STEP

    def record_answer(self, question_id: str, value: str | int) -> None:
        self.answers[question_id] = value

    def get_answer(self, question_id: str) -> str | int | None:
        return self.answers.get(question_id)


# In-memory хранилище (для продакшена лучше Redis/БД)
_users: dict[int, UserState] = {}


def get_user_state(user_id: int) -> UserState:
    if user_id not in _users:
        _users[user_id] = UserState()
    return _users[user_id]


def reset_user_state(user_id: int) -> None:
    _users[user_id] = UserState()
