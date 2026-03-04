# -*- coding: utf-8 -*-
"""
Telegram-бот теста уровня развития личности (Seee).
Спецификация: telegram_test_prompt.json
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from spec_loader import load_spec, get_questions_by_step, get_sphere_name, LEVEL_QUESTION_IDS
from state import get_user_state, reset_user_state, UserState, FINAL_STEP
from level import parse_scale_value, calculate_level, build_12_points, format_level_and_12_points
from image_gen import create_level_image

# --- Конфиг ---
SPEC = load_spec()
QUESTIONS_BY_STEP = get_questions_by_step(SPEC)
SUBSCRIPTION_LINK = os.environ.get("SUBSCRIPTION_LINK", "https://seee.app")
LOGO_PATH = Path(os.environ.get("LOGO_PATH", ""))


def get_intro_text() -> str:
    return SPEC["intro"]["text"]


def send_result_sequence(
    user_id: int,
    state: UserState,
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
):
    """Отправляет уровень, 12 пунктов, продающее сообщение, картинку, карточки."""
    level = calculate_level(state.answers)
    points = build_12_points(state.answers)
    level_message = format_level_and_12_points(level, points)
    sales_template = SPEC["sales_message"]["template"]
    sales_text = sales_template.replace("{subscription_link}", SUBSCRIPTION_LINK)
    cards_linked = SPEC["cards_logic"]["if_app_linked"]["message"]
    cards_not_linked = SPEC["cards_logic"]["if_no_subscription_or_not_linked"]["message"]
    # По умолчанию считаем, что не привязан (можно потом проверять API Seee)
    cards_message = cards_not_linked

    async def _send():
        await context.bot.send_message(
            chat_id=chat_id,
            text=level_message,
            parse_mode="Markdown",
        )
        await context.bot.send_message(chat_id=chat_id, text=sales_text)
        img_buffer = create_level_image(level, LOGO_PATH if LOGO_PATH else None)
        await context.bot.send_photo(chat_id=chat_id, photo=img_buffer)
        await context.bot.send_message(chat_id=chat_id, text=cards_message)

    return _send


def validate_scale_answer(text: str) -> int | None:
    """Проверяет ответ на scale_1_10: число 1–10 или «затрудняюсь». Возвращает int или None."""
    v = parse_scale_value(text)
    if v is not None:
        return v
    return None


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    reset_user_state(user_id)
    state = get_user_state(user_id)
    state.step = 0
    intro = get_intro_text()
    await update.message.reply_text(intro)
    # Первый вопрос отправим после ответа пользователя (в handle_message при step=0)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    state = get_user_state(user_id)
    text = (update.message.text or "").strip()
    chat_id = update.effective_chat.id

    # Только текст
    if not text:
        await update.message.reply_text("Напиши текстом, пожалуйста.")
        return

    # После интро (step 0) — пользователь ответил «поехали» или что угодно → переходим к вопросу 1
    if state.step == 0:
        q = QUESTIONS_BY_STEP.get(1)
        if q:
            await update.message.reply_text(q["text"])
            state.step = 1
        return

    # В процессе теста (1..48)
    current = state.current_question_step()
    if current is None:
        if state.is_finished():
            await update.message.reply_text(
                "Ты уже прошёл тест. Напиши /start, чтобы пройти заново."
            )
        return

    q = QUESTIONS_BY_STEP.get(current)
    if not q:
        return

    qid = q["id"]
    qtype = q.get("type", "text_free")

    if qtype == "scale_1_10":
        score = validate_scale_answer(text)
        if score is None:
            await update.message.reply_text(
                "Напиши число от 1 до 10 или «затрудняюсь ответить»."
            )
            return
        state.record_answer(qid, score)
    else:
        state.record_answer(qid, text)

    # Следующий шаг
    next_step = current + 1
    state.step = next_step

    if next_step > 48:
        # Конец теста — показываем результат
        state.step = FINAL_STEP
        send_result = send_result_sequence(user_id, state, context, chat_id)
        await send_result()
        return

    next_q = QUESTIONS_BY_STEP.get(next_step)
    if next_q:
        await update.message.reply_text(next_q["text"])


def main() -> None:
    token = os.environ.get("BOT_TOKEN")
    if not token:
        raise SystemExit("Задай BOT_TOKEN в окружении или в .env")
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
