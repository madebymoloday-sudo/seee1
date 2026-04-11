import type { SessionResponseDto } from "@/api/schemas";
import { useSessionsControllerCreateSession } from "@/api/seee.swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import apiAgent from "@/lib/api";
import { parseImportantOptions } from "@/lib/sessionUtils";
import {
  assignPendingSessionReward,
  awardCoinsForAnswer,
  awardDailyStreakForProgress,
  claimPendingSessionReward,
  clearDraftSessionReward,
  formatStreakLabel,
  loadDraftSessionReward,
  recordDailyPracticeLineCompletion,
} from "@/lib/gamification";
import { ChevronDown } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import chatStyles from "./ChatWindow.module.css";
import MessageInput from "./MessageInput";
import styles from "./StepDialogWindow.module.css";

type Subject = "situation" | "thought";

type ReturnPoint = {
  coreStep: number;
  solveStep: number;
  subject: Subject;
  thoughtScopeId?: string;
};

type View =
  | {
      kind: "intro";
      title: string;
      category: "Освобождение" | "Улучшение +1" | "отложено на разбор";
    }
  | { kind: "core"; step: number; subject: Subject }
  | { kind: "solve"; step: number }
  | { kind: "deepPick"; fromImportant: string }
  | { kind: "addToList" };

type DialogStateV1 = {
  v: 1;
  subject: Subject;
  coreStep: number; // 1..10
  solveStep: number; // 1..7
  importantText: string; // ответ шага 4 последнего прохода core
  situationText: string; // исходная ситуация (или заголовок мысль-сессии)
};

type DialogStateV2 = Omit<DialogStateV1, "v"> & {
  v: 2;
  answers: Record<string, string>;
  deepPickReturn?: ReturnPoint;
  ideasPickReturn?: ReturnPoint;
};

type DialogStateV3 = Omit<DialogStateV2, "v"> & {
  v: 3;
  thoughtScopes: Record<string, Record<string, string>>;
  activeThoughtScopeId?: string;
  stageGuidance: Record<string, StageGuidanceState>;
};

type DialogState = DialogStateV3;
type TransitionPhase = "idle" | "exiting" | "entering";

type StageGuidanceState = {
  preface?: string;
  clarificationLead?: string;
  clarificationPrompt?: string;
  reviewLead?: string;
  reviewPrompt?: string;
  clarificationCount: number;
  initialAttempt?: string;
  clarificationAnswers: string[];
};

type StageAssistDecision = "advance" | "clarify";

type StageAssistRequest = {
  subject: Subject;
  step: number;
  answer: string;
  stageAnswer?: string;
  clarificationAnswers?: string[];
  clarificationCount?: number;
  answers?: Record<string, string>;
  situationText?: string;
  importantText?: string;
  skipRequested?: boolean;
};

type StageAssistResponse = {
  decision: StageAssistDecision;
  normalizedAnswer: string;
  reaction: string;
  followUpQuestion?: string;
};

const STORAGE_KEY_PREFIX = "seee_step_dialog_state:";
const SESSION_KIND_PREFIX = "seee_session_kind:";
const SESSION_NOTES_PREFIX = "seee_session_notes:";
const DRAFT_TO_EXPLORE_CATEGORY_PREFIX = "seee_draft_to_explore_category:";

function createThoughtScopeId(): string {
  return `thought-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDailyLineCompletionId(sessionId: string, state: DialogState): string {
  if (state.subject === "thought") {
    return `${sessionId}:thought:${state.activeThoughtScopeId || "default"}`;
  }
  return `${sessionId}:situation`;
}

function migrateToV3(state: DialogStateV2): DialogStateV3 {
  const answers = { ...(state.answers || {}) };
  const thoughtEntries = Object.entries(answers).filter(([key]) =>
    key.startsWith("core:thought:"),
  );
  const rootAnswers = Object.fromEntries(
    Object.entries(answers).filter(
      ([key]) => !key.startsWith("core:thought:"),
    ),
  );

  let activeThoughtScopeId: string | undefined;
  const thoughtScopes: Record<string, Record<string, string>> = {};

  if (state.subject === "thought" || thoughtEntries.length > 0) {
    activeThoughtScopeId = "legacy-thought";
    thoughtScopes[activeThoughtScopeId] = Object.fromEntries(thoughtEntries);
    if (
      state.subject === "thought" &&
      !thoughtScopes[activeThoughtScopeId]["core:thought:3"] &&
      state.situationText?.trim()
    ) {
      thoughtScopes[activeThoughtScopeId]["core:thought:3"] =
        state.situationText.trim();
    }
  }

  return normalizeStateV3({
    ...state,
    v: 3,
    answers: rootAnswers,
    thoughtScopes,
    activeThoughtScopeId,
    stageGuidance: {},
  });
}

function normalizeStateV3(state: DialogStateV3): DialogStateV3 {
  const dash = "—";
  const answers = { ...(state.answers || {}) };
  const thoughtScopes = { ...(state.thoughtScopes || {}) };
  const stageGuidance = { ...(state.stageGuidance || {}) };

  if (
    (!answers["core:situation:1"] ||
      answers["core:situation:1"].trim() === dash) &&
    state.subject !== "thought" &&
    state.situationText?.trim() &&
    state.situationText.trim() !== dash
  ) {
    answers["core:situation:1"] = state.situationText.trim();
  }

  if (
    (!answers["core:situation:4"] ||
      answers["core:situation:4"].trim() === dash) &&
    state.subject !== "thought" &&
    state.importantText?.trim() &&
    state.importantText.trim() !== dash
  ) {
    answers["core:situation:4"] = state.importantText.trim();
  }

  if (state.activeThoughtScopeId) {
    const activeScope = {
      ...(thoughtScopes[state.activeThoughtScopeId] || {}),
    };
    if (
      (!activeScope["core:thought:3"] ||
        activeScope["core:thought:3"].trim() === dash) &&
      state.subject === "thought" &&
      state.situationText?.trim() &&
      state.situationText.trim() !== dash
    ) {
      activeScope["core:thought:3"] = state.situationText.trim();
    }
    thoughtScopes[state.activeThoughtScopeId] = activeScope;
  }

  return {
    ...state,
    answers,
    thoughtScopes,
    stageGuidance,
  };
}

function getStageGuidance(
  state: DialogState,
  key: string,
): StageGuidanceState {
  const guidance = state.stageGuidance[key];
  if (!guidance) {
    return {
      clarificationCount: 0,
      clarificationAnswers: [],
    };
  }

  return {
    clarificationCount: guidance.clarificationCount || 0,
    clarificationAnswers: guidance.clarificationAnswers || [],
    preface: guidance.preface,
    clarificationLead: guidance.clarificationLead,
    clarificationPrompt: guidance.clarificationPrompt,
    reviewLead: guidance.reviewLead,
    reviewPrompt: guidance.reviewPrompt,
    initialAttempt: guidance.initialAttempt,
  };
}

function setStageGuidance(
  state: DialogState,
  key: string,
  patch: Partial<StageGuidanceState>,
): Record<string, StageGuidanceState> {
  return {
    ...(state.stageGuidance || {}),
    [key]: {
      ...getStageGuidance(state, key),
      ...patch,
    },
  };
}

function clearStageClarification(guidance: StageGuidanceState): StageGuidanceState {
  return {
    ...guidance,
    clarificationLead: undefined,
    clarificationPrompt: undefined,
    clarificationCount: 0,
    initialAttempt: undefined,
    clarificationAnswers: [],
  };
}

function getActiveThoughtAnswers(state: DialogState): Record<string, string> {
  if (!state.activeThoughtScopeId) return {};
  return state.thoughtScopes[state.activeThoughtScopeId] || {};
}

function getCurrentAnswers(state: DialogState): Record<string, string> {
  return {
    ...(state.answers || {}),
    ...getActiveThoughtAnswers(state),
  };
}

function getAnswerValue(state: DialogState, key: string): string | undefined {
  if (key.startsWith("core:thought:")) {
    return getActiveThoughtAnswers(state)[key];
  }
  return state.answers[key];
}

function setAnswerValue(
  state: DialogState,
  key: string,
  value: string,
): Pick<DialogState, "answers" | "thoughtScopes"> {
  if (key.startsWith("core:thought:")) {
    const scopeId = state.activeThoughtScopeId || createThoughtScopeId();
    const currentScope = {
      ...(state.thoughtScopes[scopeId] || {}),
      [key]: value,
    };
    return {
      answers: state.answers,
      thoughtScopes: {
        ...state.thoughtScopes,
        [scopeId]: currentScope,
      },
    };
  }

  return {
    answers: {
      ...(state.answers || {}),
      [key]: value,
    },
    thoughtScopes: state.thoughtScopes,
  };
}

function buildToExploreIntroText(
  title: string,
  category: "Освобождение" | "Улучшение +1" | "отложено на разбор",
): string {
  const topic = (title || "эту тему").trim();
  if (category === "Освобождение") {
    return `Тема этой сессии: «${topic}».

Иногда такие идеи незаметно усиливают тревогу, напряжение и внутренний контроль. В этом разборе мы спокойно посмотрим, откуда появилась эта установка, как она влияет на вас в реальной жизни и что можно изменить, чтобы стало легче.

Поделитесь ситуациями, где эта тема проявляется сильнее всего. Пойдём шаг за шагом и разберём это вместе.`;
  }

  if (category === "отложено на разбор") {
    return `Тема этой сессии: «${topic}».

Эта мысль была отложена на разбор. В этой сессии вы сможете спокойно пройти шаги и разобраться, как она влияет на вас и что с ней делать дальше.

Опишите ситуацию, где эта мысль проявляется сильнее всего, и начнём разбор.`;
  }

  return `Тема этой сессии: «${topic}».

Эта карточка про развитие внутренней опоры и усиление полезных установок. В разборе мы найдём, какие ситуации уже помогают вам расти, что именно работает для вас и как превратить это в устойчивый личный путь.

Опишите ситуации, связанные с этой темой, и начнём собирать вашу карту развития шаг за шагом.`;
}

function loadState(sessionId: string): DialogState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed: any = JSON.parse(raw);

    if (parsed?.v === 3) {
      if (
        typeof parsed.coreStep !== "number" ||
        typeof parsed.solveStep !== "number"
      ) {
        return null;
      }
      return normalizeStateV3({
        ...parsed,
        thoughtScopes: parsed.thoughtScopes || {},
        answers: parsed.answers || {},
        stageGuidance: parsed.stageGuidance || {},
      } as DialogStateV3);
    }

    // v2 — восстанавливаем answers из importantText/situationText если они пустые или "—"
    if (parsed?.v === 2) {
      if (
        typeof parsed.coreStep !== "number" ||
        typeof parsed.solveStep !== "number"
      )
        return null;
      const state = parsed as DialogStateV2;
      const answers = { ...(state.answers || {}) };
      const subj = state.subject || "situation";
      const key1 = subj === "situation" ? "core:situation:1" : "core:thought:2";
      const key4 = subj === "situation" ? "core:situation:4" : "core:thought:4";
      const dash = "—";
      if (
        (!answers[key1] || answers[key1].trim() === dash) &&
        state.situationText?.trim() &&
        state.situationText.trim() !== dash
      ) {
        answers[key1] = state.situationText.trim();
      }
      if (
        (!answers[key4] || answers[key4].trim() === dash) &&
        state.importantText?.trim() &&
        state.importantText.trim() !== dash
      ) {
        answers[key4] = state.importantText.trim();
      }
      return migrateToV3({ ...state, answers });
    }

    // v1 -> v2 migration — сохраняем situationText и importantText в answers
    if (parsed?.v === 1) {
      if (
        typeof parsed.coreStep !== "number" ||
        typeof parsed.solveStep !== "number"
      )
        return null;
      const v1 = parsed as DialogStateV1;
      const answers: Record<string, string> = {};
      if (v1.situationText?.trim()) {
        answers[
          v1.subject === "situation" ? "core:situation:1" : "core:thought:2"
        ] = v1.situationText.trim();
      }
      if (v1.importantText?.trim()) {
        answers[
          v1.subject === "situation" ? "core:situation:4" : "core:thought:4"
        ] = v1.importantText.trim();
      }
      const migrated: DialogStateV2 = {
        ...v1,
        v: 2,
        answers,
      };
      return migrateToV3(migrated);
    }

    return null;
  } catch {
    return null;
  }
}

function saveState(sessionId: string, state: DialogState) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${sessionId}`,
      JSON.stringify(state),
    );
  } catch {
    // ignore
  }
}

function removeState(sessionId: string) {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
  } catch {
    // ignore
  }
}

function getSessionKind(sessionId: string): "thought" | "default" {
  const v = localStorage.getItem(`${SESSION_KIND_PREFIX}${sessionId}`);
  return v === "thought" ? "thought" : "default";
}

function setSessionKind(sessionId: string, kind: "thought") {
  try {
    localStorage.setItem(`${SESSION_KIND_PREFIX}${sessionId}`, kind);
  } catch {
    // ignore
  }
}

function setSessionNotes(sessionId: string, notes: string) {
  try {
    localStorage.setItem(`${SESSION_NOTES_PREFIX}${sessionId}`, notes);
  } catch {
    // ignore
  }
}

function getSessionNotes(sessionId: string): string | null {
  try {
    return localStorage.getItem(`${SESSION_NOTES_PREFIX}${sessionId}`);
  } catch {
    return null;
  }
}

function removeSessionMeta(sessionId: string) {
  try {
    localStorage.removeItem(`${SESSION_KIND_PREFIX}${sessionId}`);
    localStorage.removeItem(`${SESSION_NOTES_PREFIX}${sessionId}`);
  } catch {
    // ignore
  }
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getUserKey(): string {
  try {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const payload = decodeJwtPayload(token);
      const sub = payload?.sub ?? payload?.id ?? payload?.userId;
      if (sub) return String(sub);
    }
  } catch {
    // ignore
  }
  return "anon";
}

function removeToExploreTemplate(userKey: string, templateId: string) {
  try {
    const key = `seee_to_explore_templates:${userKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return;
    const next = parsed.filter((x) => String(x?.id ?? "") !== templateId);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function coreQuestion(
  step: number,
  subject: Subject,
  answers?: Record<string, string>,
): string {
  const situation = sanitizeThoughtValue(answers?.["core:situation:1"]);
  const primaryEmotionKey = `core:${subject}:2`;
  const secondaryEmotionKey =
    subject === "thought" ? "core:situation:2" : "core:thought:2";
  const emotion = sanitizeThoughtValue(
    answers?.[primaryEmotionKey] || answers?.[secondaryEmotionKey],
  );
  const primaryThoughtKey = `core:${subject}:3`;
  const secondaryThoughtKey =
    subject === "thought" ? "core:situation:3" : "core:thought:3";
  const thought = sanitizeThoughtValue(
    answers?.[primaryThoughtKey] || answers?.[secondaryThoughtKey],
  );
  const thoughtNominative = thought ? `мысль «${thought}»` : "эта мысль";
  const thoughtAccusative = thought ? `мысль «${thought}»` : "эту мысль";
  const thoughtGenitive = thought ? `мысли «${thought}»` : "этой мысли";
  const primarySourceKey = `core:${subject}:5`;
  const secondarySourceKey =
    subject === "thought" ? "core:situation:5" : "core:thought:5";
  const sourceAnswer = sanitizeSourceAnswer(
    answers?.[primarySourceKey] || answers?.[secondarySourceKey],
  );
  const thing = subject === "thought" ? thoughtNominative : "эта ситуация";
  switch (step) {
    case 1:
      return "Расскажите, какая ситуация вас беспокоит";
    case 2:
      if (subject === "situation" && situation) {
        return `Какую эмоцию у вас вызывает ситуация, в которой ${situation}?`;
      }
      return `Какую эмоцию у вас вызывает ${thing}?`;
    case 3:
      return emotion
        ? `Как вы думаете, какая мысль/идея вызывает эмоцию «${emotion}»?`
        : `Как вы думаете, какая мысль/идея вызывает эту эмоцию?`;
    case 4:
      return thought
        ? `Почему вы думаете, что мысль «${thought}» верна? Перечислите несколько причин.`
        : `Почему вы так думаете? Перечислите несколько причин.`;
    case 5:
      return thought
        ? `Как вам кажется, от кого или откуда к вам пришла мысль «${thought}»?\n\nЭто может быть конкретный человек, семья, сообщество, культура, вы сами или какой-то прошлый опыт.`
        : `Как вам кажется, от кого или откуда к вам пришла эта мысль?\n\nЭто может быть конкретный человек, семья, сообщество, культура, вы сами или какой-то прошлый опыт.`;
    case 6:
      return buildSourceBenefitQuestion(thought, sourceAnswer);
    case 7: {
      if (thought) {
        return `Какие эмоциональные последствия принесла вам мысль «${thought}»?`;
      }
      return `Какие эмоциональные последствия принесла вам мысль?`;
    }
    case 8:
      if (thought) {
        return `Какие практические последствия в вашей жизни принесла мысль: "${thought}"`;
      }
      return `Какие практические последствия в вашей жизни принесла мысль?`;
    case 9:
      return `Какой вывод вы можете сделать по ${thoughtGenitive}? Нужна вам она или нет?`;
    case 10:
      return `Хотите ли вы решить конкретно ${subject === "thought" ? thoughtAccusative : "эту ситуацию"} или готовы разобраться в вопросе глубже?`;
    default:
      return "";
  }
}

function solveQuestion(step: number, important: string): string {
  switch (step) {
    case 1:
      return "К чему вы хотели бы прийти?";
    case 2:
      return "При каких обстоятельствах это возможно?";
    case 3:
      return "Исходя из описанных обстоятельств, что можно придумать?";
    case 4:
      return "Что из этого можно сделать уже сейчас?";
    case 5:
      return "Что ещё нужно для реализации?";
    case 6:
      return "Что сделаешь прямо сейчас?";
    case 7:
      return `Так же, у вас ещё остались важные мысли, которые вы указали в ответе на вопрос: "Почему для вас это важно".\n\nВы написали:\n${important || "—"}\n\nХотели бы вы разобраться с ними сейчас или добавить их в список на поиск выхода в будущем?`;
    default:
      return "";
  }
}

function isTextAnswerView(view: View): boolean {
  if (view.kind === "intro") return false;
  if (view.kind === "addToList") return false;
  if (view.kind === "deepPick") return true;
  if (view.kind === "core") return view.step >= 1 && view.step <= 9;
  if (view.kind === "solve") return view.step >= 1 && view.step <= 6;
  return false;
}

function sanitizeThoughtValue(v?: string): string {
  const s = (v || "").trim();
  if (!s || s === "—") return "";
  return s;
}

function sanitizeSourceAnswer(v?: string): string {
  const raw = sanitizeThoughtValue(v)
    .replace(/\s+/g, " ")
    .split(/\n+/)[0]
    .trim();

  if (!raw) return "";

  const cleaned = raw
    .replace(
      /^(это|скорее всего|наверное|возможно|кажется|мне кажется(?:,?\s*что)?|думаю(?:,?\s*что)?|похоже(?:,?\s*что)?|как будто)\s+/iu,
      "",
    )
    .replace(/^от\s+/iu, "")
    .replace(
      /\b(заложил(?:а|и)?|передал(?:а|и)?|передавал(?:а|и)?|сформировал(?:а|и)?|навязал(?:а|и)?|внушил(?:а|и)?|говорил(?:а|и)?|твердил(?:а|и)?|повторял(?:а|и)?|транслировал(?:а|и)?|закладывал(?:а|и)?|вкладывал(?:а|и)?)\b.*$/iu,
      "",
    )
    .replace(/[.?!,:;]+$/g, "")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length <= 96) return cleaned;
  return `${cleaned.slice(0, 95).trimEnd()}…`;
}

function hasMultipleSources(source: string): boolean {
  return /,/.test(source) || /\s(?:и|или|либо|а также)\s/iu.test(source);
}

function buildSourceBenefitQuestion(thought: string, sourceAnswer?: string): string {
  if (!sourceAnswer) {
    return thought
      ? `Как думаете, с какой выгодой для себя другой человек или система могли передавать вам мысль «${thought}»?`
      : `Как думаете, с какой выгодой для себя другой человек или система могли передавать вам эту мысль?`;
  }

  if (hasMultipleSources(sourceAnswer)) {
    return thought
      ? `Если взять названные вами источники — ${sourceAnswer}, — какую выгоду для себя они могли получать, когда передавали вам мысль «${thought}»?`
      : `Если взять названные вами источники — ${sourceAnswer}, — какую выгоду для себя они могли получать, когда передавали вам эту мысль?`;
  }

  return thought
    ? `Если взять названный вами источник — ${sourceAnswer}, — какую выгоду для себя он мог получать, когда передавал вам мысль «${thought}»?`
    : `Если взять названный вами источник — ${sourceAnswer}, — какую выгоду для себя он мог получать, когда передавал вам эту мысль?`;
}

function summarizeStepAnswer(value?: string): string {
  const text = sanitizeThoughtValue(value)
    .replace(/\s+/g, " ")
    .replace(/[.?!,:;]+$/g, "")
    .trim();

  if (!text) return "";
  if (text.length <= 220) return text;
  return `${text.slice(0, 219).trimEnd()}…`;
}

function buildConclusionSummary(
  subject: Subject,
  answers?: Record<string, string>,
): string {
  const thoughtPrimaryKey = `core:${subject}:3`;
  const thoughtSecondaryKey =
    subject === "thought" ? "core:situation:3" : "core:thought:3";
  const thought = sanitizeThoughtValue(
    answers?.[thoughtPrimaryKey] || answers?.[thoughtSecondaryKey],
  );

  const reasons = summarizeStepAnswer(answers?.[`core:${subject}:4`]);
  const source = sanitizeSourceAnswer(answers?.[`core:${subject}:5`]);
  const benefit = summarizeStepAnswer(answers?.[`core:${subject}:6`]);
  const emotional = summarizeStepAnswer(answers?.[`core:${subject}:7`]);
  const practical = summarizeStepAnswer(answers?.[`core:${subject}:8`]);

  const parts: string[] = [];

  if (thought) {
    parts.push(`Если собрать всё вместе по мысли «${thought}»`);
  } else {
    parts.push("Если собрать всё вместе");
  }

  if (reasons) {
    parts.push(`она держалась на том, что ${reasons}`);
  }
  if (source) {
    parts.push(`во многом её передавал или закреплял ${source}`);
  }
  if (benefit) {
    parts.push(`для источника это могло быть выгодно, потому что ${benefit}`);
  }
  if (emotional) {
    parts.push(`эмоционально это отражалось так: ${emotional}`);
  }
  if (practical) {
    parts.push(`а в жизни это приводило к тому, что ${practical}`);
  }

  if (parts.length === 1) {
    return `${parts[0]}.`;
  }

  return `${parts.join(", ")}.`;
}

function getCurrentThoughtLabel(
  subject: Subject,
  answers?: Record<string, string>,
): string {
  const primaryThoughtKey = `core:${subject}:3`;
  const secondaryThoughtKey =
    subject === "thought" ? "core:situation:3" : "core:thought:3";
  return sanitizeThoughtValue(
    answers?.[primaryThoughtKey] || answers?.[secondaryThoughtKey],
  );
}

function buildConclusionFollowUpQuestion(
  subject: Subject,
  answers?: Record<string, string>,
): string {
  const thought = getCurrentThoughtLabel(subject, answers);
  return thought
    ? `Если сказать совсем прямо: мысль «${thought}» вам сейчас нужна или не нужна? Она помогает вам в жизни или больше мешает?`
    : "Если сказать совсем прямо: эта мысль вам сейчас нужна или не нужна? Она помогает вам в жизни или больше мешает?";
}

function looksLikeThoughtReminderQuestion(answer: string): boolean {
  const normalized = answer.toLowerCase().replace(/ё/g, "е");
  return (
    normalized.includes("какая мысль") ||
    normalized.includes("что за мысль") ||
    normalized.includes("о какой мысли") ||
    normalized.includes("какую мысль") ||
    normalized.includes("что за идея")
  );
}

function looksLikeNonRewardingAnswer(answer: string): boolean {
  const normalized = answer
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:()"«»'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return true;

  const refusalPatterns = [
    /^(не знаю|не знаю как ответить|не понимаю|затрудняюсь|затрудняюсь ответить)$/u,
    /^(сложно ответить|сложно сказать|не могу ответить|не могу сказать)$/u,
    /^(без понятия|не получается ответить|не хочу отвечать|не буду отвечать)$/u,
  ];

  if (refusalPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return (
    /^(?:бла(?:\s+бла){1,}|bla(?:\s+bla){1,}|лалала+|тест|test)$/u.test(
      normalized,
    ) ||
    /^([a-zа-я]{1,4})(?:\s+\1){2,}$/u.test(normalized)
  );
}

const MIN_REASON_FIELDS = 3;
const MAX_REASON_FIELDS = 6;

function splitReasonDrafts(value?: string): string[] {
  const normalized = (value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const parts = normalized
    .split(/\n+|;\s*|•\s*|\u2022\s*|\d+[\)\.]\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [normalized];
}

function buildReasonDrafts(value?: string): string[] {
  const drafts = splitReasonDrafts(value);
  while (drafts.length < MIN_REASON_FIELDS) {
    drafts.push("");
  }
  return drafts.slice(0, MAX_REASON_FIELDS);
}

function joinReasonDrafts(drafts: string[]): string {
  return drafts
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function buildThoughtReminderResponse(
  subject: Subject,
  answers?: Record<string, string>,
): string {
  const thought = getCurrentThoughtLabel(subject, answers);
  return thought
    ? `Мы сейчас разбираем мысль «${thought}».`
    : "Мы сейчас разбираем ту мысль, которую вы сформулировали как идею, запускающую эмоцию.";
}

function getPrompt(
  view: View,
  importantText: string,
  situationText: string,
  answers?: Record<string, string>,
  currentGuidance?: StageGuidanceState,
): string {
  if (view.kind === "intro") {
    return buildToExploreIntroText(view.title, view.category);
  }
  if (view.kind === "core") {
    const baseQuestion = coreQuestion(view.step, view.subject, answers);
    if (currentGuidance?.clarificationPrompt) {
      return [
        currentGuidance.clarificationLead || currentGuidance.preface || "",
        currentGuidance.clarificationPrompt,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    if (currentGuidance?.reviewPrompt) {
      return [
        currentGuidance.reviewLead || currentGuidance.preface || "",
        currentGuidance.reviewPrompt,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    if (view.step === 9) {
      const summary = buildConclusionSummary(view.subject, answers);
      if (summary) {
        return `${summary}\n\n${baseQuestion}`;
      }
    }
    if (currentGuidance?.preface) {
      return `${currentGuidance.preface}\n\n${baseQuestion}`;
    }
    return baseQuestion;
  }
  if (view.kind === "solve") return solveQuestion(view.step, importantText);
  if (view.kind === "deepPick") {
    return `В ответе на вопрос: "Почему для вас это важно" вы написали:\n\n${importantText || view.fromImportant || "—"}\n\nКакую из этих мыслей вы хотели бы разобрать?`;
  }
  if (view.kind === "addToList") {
    return `Добавить мысль в список на будущее.\n\nСюда можно вынести мысль из ответа "Почему для вас это важно":\n${importantText || "—"}`;
  }
  return situationText;
}

function stepKey(view: View): string {
  if (view.kind === "core") return `core:${view.subject}:${view.step}`;
  if (view.kind === "solve") return `solve:${view.step}`;
  if (view.kind === "deepPick") return `deepPick`;
  return "other";
}

function waitForAnswerPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

interface StepDialogWindowProps {
  session: SessionResponseDto;
}

const StepDialogWindow = observer(({ session }: StepDialogWindowProps) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const { trigger: createSession, isMutating } =
    useSessionsControllerCreateSession();
  const isDraftSession = session.id === "new";
  const userKey = useMemo(() => getUserKey(), []);
  const [introStarted, setIntroStarted] = useState(false);

  const draftToExploreIntro = useMemo(() => {
    if (!isDraftSession) return null;
    try {
      const templateId = localStorage
        .getItem(`seee_draft_to_explore_template:${userKey}`)
        ?.trim();
      if (!templateId) return null;

      const title =
        localStorage.getItem(`seee_draft_title:${userKey}`)?.trim() || "";
      const rawCategory = localStorage
        .getItem(`${DRAFT_TO_EXPLORE_CATEGORY_PREFIX}${userKey}`)
        ?.trim();
      const category: "Освобождение" | "Улучшение +1" | "отложено на разбор" =
        rawCategory === "Улучшение +1"
          ? "Улучшение +1"
          : rawCategory?.toLowerCase() === "отложено на разбор"
            ? "отложено на разбор"
            : "Освобождение";
      return { title, category };
    } catch {
      return null;
    }
  }, [isDraftSession, userKey]);

  const [state, setState] = useState<DialogState>(() => {
    const existing = loadState(session.id);
    if (existing) return existing;

    const kind = getSessionKind(session.id);
    const isThought = kind === "thought";
    const situationText = isThought ? session.title || "Новая сессия" : "";
    return {
      v: 3,
      subject: isThought ? "thought" : "situation",
      coreStep: isThought ? 2 : 1,
      solveStep: 1,
      importantText: "",
      situationText,
      answers: {},
      thoughtScopes: isThought
        ? {
            initial: situationText.trim()
              ? { "core:thought:3": situationText.trim() }
              : {},
          }
        : {},
      activeThoughtScopeId: isThought ? "initial" : undefined,
      stageGuidance: {},
    };
  });

  useEffect(() => {
    saveState(session.id, state);
  }, [session.id, state]);

  // Сохраняем при уходе со страницы (закрытие вкладки, навигация), чтобы сессия открывалась на последнем шаге
  useEffect(() => {
    const onBeforeUnload = () => saveState(session.id, state);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [session.id, state]);

  const view: View = useMemo(() => {
    const firstSituationAnswer = (
      state.answers["core:situation:1"] || ""
    ).trim();
    const shouldShowIntro =
      !!draftToExploreIntro &&
      !introStarted &&
      state.subject === "situation" &&
      state.coreStep === 1 &&
      !firstSituationAnswer;
    if (shouldShowIntro) {
      return {
        kind: "intro",
        title: draftToExploreIntro.title,
        category: draftToExploreIntro.category,
      };
    }

    // Модальные режимы
    if (state.coreStep === 0) return { kind: "addToList" };
    if (state.coreStep === 99)
      return { kind: "deepPick", fromImportant: state.importantText };

    // Решение
    if (
      state.subject === "situation" &&
      state.solveStep >= 1 &&
      state.solveStep <= 7 &&
      state.coreStep === 100
    ) {
      return { kind: "solve", step: state.solveStep };
    }

    // Основной цикл
    return { kind: "core", step: state.coreStep, subject: state.subject };
  }, [state, draftToExploreIntro, introStarted]);

  const currentAnswers = useMemo(
    () => getCurrentAnswers(state),
    [state.answers, state.thoughtScopes, state.activeThoughtScopeId],
  );

  const currentImportantText = useMemo(() => {
    if (state.subject === "thought") {
      return getAnswerValue(state, "core:thought:4") || "";
    }
    return state.answers["core:situation:4"] || state.importantText || "";
  }, [
    state.subject,
    state.answers,
    state.importantText,
    state.thoughtScopes,
    state.activeThoughtScopeId,
  ]);

  const currentStepKey = useMemo(() => {
    if (view.kind === "core") return `core:${view.subject}:${view.step}`;
    if (view.kind === "solve") return `solve:${view.step}`;
    if (view.kind === "deepPick") return "deepPick";
    return null;
  }, [view]);

  const currentStageGuidance = useMemo(
    () =>
      currentStepKey ? getStageGuidance(state, currentStepKey) : undefined,
    [currentStepKey, state.stageGuidance],
  );

  const prompt = useMemo(
    () =>
      getPrompt(
        view,
        currentImportantText,
        state.situationText,
        currentAnswers,
        currentStageGuidance,
      ),
    [
      view,
      currentImportantText,
      state.situationText,
      currentAnswers,
      currentStageGuidance,
    ],
  );

  const importantOptions = useMemo(() => {
    if (view.kind !== "deepPick") return [];
    const text = currentImportantText || view.fromImportant;
    return parseImportantOptions(text);
  }, [view, currentImportantText]);

  const [lastUserAnswer, setLastUserAnswer] = useState<string | null>(null);
  const [pendingUserAnswer, setPendingUserAnswer] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAnalyzingAnswer, setIsAnalyzingAnswer] = useState(false);
  const [transitionPhase, setTransitionPhase] =
    useState<TransitionPhase>("idle");
  const [inputText, setInputText] = useState("");
  const [reasonDrafts, setReasonDrafts] = useState<string[]>(() =>
    buildReasonDrafts(""),
  );
  const [isEditing, setIsEditing] = useState(true);
  const [listTitle, setListTitle] = useState("");
  const [listNotes, setListNotes] = useState("");
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isIdeasModalOpen, setIsIdeasModalOpen] = useState(false);
  const [activeIdeaMenu, setActiveIdeaMenu] = useState<string | null>(null);
  const [ideaEditorMode, setIdeaEditorMode] = useState<"edit" | "create" | null>(
    null,
  );
  const [ideaEditorOriginal, setIdeaEditorOriginal] = useState("");
  const [ideaEditorDraft, setIdeaEditorDraft] = useState("");
  const timersRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const ideaEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const forceEditOnStepSyncRef = useRef(false);

  const focusInputWithoutScroll = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  };

  useEffect(() => {
    if (!ideaEditorMode) return;
    const timer = window.setTimeout(() => {
      const el = ideaEditorRef.current;
      if (!el) return;
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
      el.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ideaEditorMode]);

  const canDeepNow = useMemo(() => {
    // button should be available during the session after step 4 is answered at least once
    if (isTransitioning || isAnalyzingAnswer || isListModalOpen) return false;
    if (view.kind === "deepPick") return false;
    return parseImportantOptions(currentImportantText).length > 0;
  }, [
    currentImportantText,
    isAnalyzingAnswer,
    isListModalOpen,
    isTransitioning,
    view.kind,
  ]);

  /** Этап «мысль/идея» — core step 3+, вопрос «Как вы думаете, какая мысль/идея вызывает эту эмоцию?» */
  const isIdeasStep = view.kind === "core" && view.step >= 3;
  const isReasonsStep = view.kind === "core" && view.step === 4;

  const ideasList = useMemo(() => {
    const primaryKey = `core:${state.subject}:3` as const;
    const secondaryKey =
      state.subject === "thought" ? "core:situation:3" : "core:thought:3";
    const answer3 =
      sanitizeThoughtValue(currentAnswers[primaryKey]) ||
      sanitizeThoughtValue(currentAnswers[secondaryKey]);
    const opts = parseImportantOptions(currentImportantText);
    const list: string[] = [];
    if (answer3.trim()) list.push(answer3.trim());
    list.push(...opts);
    return list;
  }, [currentAnswers, currentImportantText, state.subject]);

  const hasClarificationPrompt = !!currentStageGuidance?.clarificationPrompt;
  const savedCurrentAnswer =
    currentStepKey ? (getAnswerValue(state, currentStepKey) || "").trim() : "";

  const canSkip = (() => {
    if (
      isTransitioning ||
      isAnalyzingAnswer ||
      isListModalOpen ||
      isIdeasModalOpen
    ) {
      return false;
    }
    if (!isTextAnswerView(view)) return false;
    if (
      !hasClarificationPrompt &&
      isDraftSession &&
      view.kind === "core" &&
      view.step === 1
    ) {
      return false;
    }
    return true;
  })();

  const skipButtonLabel = hasClarificationPrompt
    ? "Не знаю, как описать"
    : "Пропустить →";

  const showBottomEditorActions =
    isTextAnswerView(view) && view.kind !== "deepPick";
  const showReasonsEditor = isReasonsStep && isEditing;
  const showDefaultBottomEditorActions =
    showBottomEditorActions && !showReasonsEditor;

  const canGoForward =
    !!savedCurrentAnswer &&
    !isEditing &&
    !hasClarificationPrompt &&
    !isTransitioning &&
    !isAnalyzingAnswer &&
    isTextAnswerView(view);

  const goSkip = () => {
    if (!canSkip) return;
    if (hasClarificationPrompt) {
      const baseAnswer =
        currentStageGuidance?.initialAttempt ||
        (currentStepKey ? getAnswerValue(state, currentStepKey) || "" : "");
      onAnswer(baseAnswer || "Не знаю", { skipRequested: true });
      return;
    }
    if (isTextAnswerView(view)) {
      const existingAnswer = (getAnswerValue(state, stepKey(view)) || "").trim();
      if (existingAnswer && existingAnswer !== "—") {
        onAnswer(existingAnswer);
        return;
      }
    }
    onAnswer("—");
  };

  const goForward = () => {
    if (!canGoForward) return;
    onAnswer(savedCurrentAnswer);
  };

  useEffect(() => {
    if (!isListModalOpen && !isIdeasModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsListModalOpen(false);
        setIsIdeasModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isListModalOpen, isIdeasModalOpen]);

  useEffect(() => {
    if (view.kind !== "deepPick") return;
    // На этапе выбора мысли нижний input не нужен:
    // убираем фокус, чтобы не всплывала клавиатура на мобильных.
    const active = document.activeElement as HTMLElement | null;
    active?.blur();
  }, [view.kind]);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, []);

  // Автофокус на поле ввода после смены шага/ветки
  useEffect(() => {
    if (isListModalOpen) return;
    if (isTransitioning || isAnalyzingAnswer) return;
    if (!isTextAnswerView(view)) return;

    const t = window.setTimeout(() => focusInputWithoutScroll(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isListModalOpen,
    isAnalyzingAnswer,
    isTransitioning,
    view.kind,
    view.kind === "core" ? view.step : null,
    view.kind === "solve" ? view.step : null,
    view.kind === "deepPick" ? view.fromImportant : null,
  ]);

  // Sync input with saved answer (review mode on revisit)
  useEffect(() => {
    if (!isTextAnswerView(view)) {
      setInputText("");
      setReasonDrafts(buildReasonDrafts(""));
      setIsEditing(false);
      forceEditOnStepSyncRef.current = false;
      return;
    }
    const key = stepKey(view);
    const saved = getAnswerValue(state, key);
    const forceEdit = forceEditOnStepSyncRef.current;
    forceEditOnStepSyncRef.current = false;
    const clarificationPrompt = getStageGuidance(state, key).clarificationPrompt;
    const isPrefilledThoughtAnswer =
      view.kind === "core" &&
      view.subject === "thought" &&
      view.step === 3 &&
      sanitizeThoughtValue(saved) !== "" &&
      sanitizeThoughtValue(saved) === sanitizeThoughtValue(state.situationText);
    if (saved !== undefined) {
      if (clarificationPrompt) {
        if (isReasonsStep) {
          setInputText(saved);
          setReasonDrafts(buildReasonDrafts(saved));
        } else {
          setInputText("");
          setReasonDrafts(buildReasonDrafts(""));
        }
        setIsEditing(true);
      } else if (isPrefilledThoughtAnswer) {
        setInputText(saved);
        setReasonDrafts(buildReasonDrafts(saved));
        setIsEditing(true);
      } else {
        setInputText(saved);
        setReasonDrafts(buildReasonDrafts(saved));
        setIsEditing(forceEdit ? true : false);
      }
    } else {
      setInputText("");
      setReasonDrafts(buildReasonDrafts(""));
      setIsEditing(true);
    }
  }, [
    state.answers,
    state.thoughtScopes,
    state.activeThoughtScopeId,
    state.stageGuidance,
    view,
  ]);

  const updateReasonDraft = (index: number, value: string) => {
    setReasonDrafts((prev) => {
      const next = [...prev];
      next[index] = value;
      setInputText(joinReasonDrafts(next));
      return next;
    });
  };

  const addReasonDraft = () => {
    setReasonDrafts((prev) => {
      if (prev.length >= MAX_REASON_FIELDS) return prev;
      return [...prev, ""];
    });
  };

  const submitReasonDrafts = () => {
    const answer = joinReasonDrafts(reasonDrafts);
    if (!answer || isAnalyzingAnswer || isTransitioning) return;
    setInputText(answer);
    onAnswer(answer);
  };

  const computeNextState = (answer: string): DialogState | null => {
    const trimmed = answer.trim();
    if (!trimmed) return null;

    // deepPick — сохраняем deepPickReturn для кнопки «Назад»
    if (view.kind === "deepPick") {
      const thoughtScopeId = createThoughtScopeId();
      return {
        ...state,
        subject: "thought",
        situationText: trimmed,
        coreStep: 2,
        activeThoughtScopeId: thoughtScopeId,
        thoughtScopes: {
          ...state.thoughtScopes,
          [thoughtScopeId]: {
            "core:thought:3": trimmed,
          },
        },
      };
    }

    // core 1..9
    if (view.kind === "core") {
      const next = view.step + 1;

      if (view.step === 1) {
        return { ...state, situationText: trimmed, coreStep: next };
      }
      if (view.step === 4) {
        return view.subject === "situation"
          ? { ...state, importantText: trimmed, coreStep: next }
          : { ...state, coreStep: next };
      }

      return { ...state, coreStep: next };
    }

    // solve 1..6
    if (view.kind === "solve") {
      const next = view.step + 1;
      return { ...state, solveStep: next };
    }

    return null;
  };

  const animateStateTransition = (
    displayAnswer: string,
    nextState: DialogState,
    options?: { awardCoins?: boolean },
  ) => {
    const key = currentStepKey;
    setPendingUserAnswer(null);
    setLastUserAnswer(displayAnswer);
    if (
      key &&
      options?.awardCoins !== false &&
      !(isDraftSession && view.kind === "core" && view.step === 1)
    ) {
      const reward = awardCoinsForAnswer(session.id, key, 3);
      if (reward.awarded) {
        toast.success(`+${reward.delta} монеты`, { position: "top-center" });
      }
    }
    if (
      !isDraftSession &&
      view.kind === "core" &&
      view.step === 9 &&
      nextState.coreStep === 10
    ) {
      const recommendedReward = claimPendingSessionReward(session.id);
      if (recommendedReward.awarded) {
        toast.success(`+${recommendedReward.delta} монет за рекомендованную карточку`, {
          position: "top-center",
        });
      }
    }
    setIsTransitioning(true);
    setTransitionPhase("idle");

    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];

    timersRef.current.push(
      window.setTimeout(() => {
        setTransitionPhase("exiting");
      }, 90),
      window.setTimeout(() => {
        setState(nextState);
        setLastUserAnswer(null);
        setTransitionPhase("entering");
      }, 450),
      window.setTimeout(() => {
        setTransitionPhase("idle");
        setIsTransitioning(false);
      }, 860),
    );
  };

  const finalizeDraftSession = async (
    displayAnswer: string,
    nextState: DialogState,
    answerKey: string,
    options?: { awardCoins?: boolean },
  ) => {
    setPendingUserAnswer(null);
    setLastUserAnswer(displayAnswer);
    setIsTransitioning(true);
    setTransitionPhase("idle");

    try {
      const draftTitle = localStorage.getItem(`seee_draft_title:${userKey}`)?.trim();
      const templateId = localStorage
        .getItem(`seee_draft_to_explore_template:${userKey}`)
        ?.trim();
      const draftTemplateReward = loadDraftSessionReward(userKey);

      const title = (
        draftTitle && draftTitle.length > 0 ? draftTitle : displayAnswer
      ).slice(0, 80);
      const newSession = await createSession({ title });
      if (!newSession?.id) {
        toast.error("Не удалось создать сессию");
        setIsTransitioning(false);
        setTransitionPhase("idle");
        return;
      }

      saveState(newSession.id, nextState);
      if (options?.awardCoins !== false) {
        const reward = awardCoinsForAnswer(newSession.id, answerKey, 3);
        if (reward.awarded) {
          toast.success(`+${reward.delta} монеты`, { position: "top-center" });
        }
      }
      if (
        draftTemplateReward &&
        (!draftTemplateReward.templateId ||
          !templateId ||
          draftTemplateReward.templateId === templateId)
      ) {
        assignPendingSessionReward(newSession.id, draftTemplateReward);
      }

      const kind = getSessionKind(session.id);
      if (kind === "thought") {
        setSessionKind(newSession.id, "thought");
      }
      const notes = getSessionNotes(session.id);
      if (notes && notes.trim()) {
        setSessionNotes(newSession.id, notes.trim());
      }

      removeState(session.id);
      removeSessionMeta(session.id);

      if (templateId) {
        removeToExploreTemplate(userKey, templateId);
      }
      try {
        localStorage.removeItem(`seee_draft_title:${userKey}`);
        localStorage.removeItem(`seee_draft_to_explore_template:${userKey}`);
        localStorage.removeItem(`${DRAFT_TO_EXPLORE_CATEGORY_PREFIX}${userKey}`);
        clearDraftSessionReward(userKey);
      } catch {
        // ignore
      }

      navigate(`/sessions/${newSession.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Не удалось создать сессию");
      setIsTransitioning(false);
      setTransitionPhase("idle");
    }
  };

  const requestStageAssist = async (
    answer: string,
    options?: { skipRequested?: boolean },
  ): Promise<StageAssistResponse | null> => {
    if (view.kind !== "core" || view.step < 1 || view.step > 9) {
      return null;
    }

    const key = stepKey(view);
    const guidance = getStageGuidance(state, key);
    const currentSavedAnswer = (getAnswerValue(state, key) || "").trim();
    const payload: StageAssistRequest = {
      subject: view.subject,
      step: view.step,
      answer,
      stageAnswer:
        guidance.clarificationCount > 0
          ? guidance.initialAttempt || currentSavedAnswer || undefined
          : undefined,
      clarificationAnswers: guidance.clarificationAnswers,
      clarificationCount: guidance.clarificationCount,
      answers: currentAnswers,
      situationText: state.situationText,
      importantText: currentImportantText,
      skipRequested: options?.skipRequested,
    };

    return apiAgent.post<StageAssistRequest, StageAssistResponse>(
      "/psychologist/stage-assist",
      payload,
    );
  };

  const onAnswer = async (
    answer: string,
    options?: { skipRequested?: boolean },
  ) => {
    if (isTransitioning || isAnalyzingAnswer) return;
    const trimmed = answer.trim();
    if (!trimmed) return;

    const key = stepKey(view);
    const shouldAnalyzeStage =
      view.kind === "core" &&
      view.step >= 1 &&
      view.step <= 9 &&
      trimmed !== "—";
    setPendingUserAnswer(trimmed);

    try {
      await waitForAnswerPaint();
      setIsAnalyzingAnswer(true);
      let shouldAwardCoins =
        !options?.skipRequested && !looksLikeNonRewardingAnswer(trimmed);

      let nextState = computeNextState(trimmed);
      let nextStateWithAnswer: DialogState | null = nextState
        ? normalizeStateV3({
            ...(nextState as DialogState),
            v: 3,
            ...setAnswerValue(state, key, trimmed),
            stageGuidance: state.stageGuidance,
          })
        : null;

      if (shouldAnalyzeStage) {
        const currentGuidance = getStageGuidance(state, key);

        if (
          view.kind === "core" &&
          view.step === 9 &&
          looksLikeThoughtReminderQuestion(trimmed)
        ) {
          const clarifyState = normalizeStateV3({
            ...state,
            stageGuidance: setStageGuidance(state, key, {
              ...currentGuidance,
              clarificationLead: buildThoughtReminderResponse(
                view.subject,
                currentAnswers,
              ),
              clarificationPrompt: buildConclusionFollowUpQuestion(
                view.subject,
                currentAnswers,
              ),
            }),
          });

          animateStateTransition(trimmed, clarifyState, { awardCoins: false });
          return;
        }

        const assist = await requestStageAssist(trimmed, options);
        if (assist) {
          const normalized = (assist.normalizedAnswer || trimmed).trim() || trimmed;
          const answerToPersist = trimmed;
          shouldAwardCoins =
            shouldAwardCoins && !looksLikeNonRewardingAnswer(normalized);

          if (
            assist.decision === "clarify" &&
            assist.followUpQuestion &&
            !options?.skipRequested &&
            currentGuidance.clarificationCount < 2
          ) {
            const shouldStoreAsClarification =
              currentGuidance.clarificationCount > 0;
            const clarificationAnswers = shouldStoreAsClarification
              ? [...currentGuidance.clarificationAnswers, trimmed]
              : currentGuidance.clarificationAnswers;
            const followUpQuestion =
              view.step === 9
                ? buildConclusionFollowUpQuestion(view.subject, currentAnswers)
                : assist.followUpQuestion;
            const guidancePatch: Partial<StageGuidanceState> = {
              clarificationLead: assist.reaction,
              clarificationPrompt: followUpQuestion,
              clarificationCount: Math.min(
                2,
                currentGuidance.clarificationCount + 1,
              ),
              clarificationAnswers,
              initialAttempt: currentGuidance.initialAttempt || trimmed,
            };
            const clarifyAnswerUpdate = setAnswerValue(state, key, trimmed);
            const clarifyState = normalizeStateV3({
              ...state,
              answers: clarifyAnswerUpdate.answers,
              thoughtScopes: clarifyAnswerUpdate.thoughtScopes,
              stageGuidance: setStageGuidance(state, key, guidancePatch),
            });

            animateStateTransition(trimmed, clarifyState, { awardCoins: false });
            return;
          }

          nextState = computeNextState(answerToPersist);
          if (!nextState) return;

          const nextKey =
            view.kind === "core" ? `core:${view.subject}:${view.step + 1}` : null;
          const answeredState = setAnswerValue(state, key, answerToPersist);
          const settledGuidance = getStageGuidance(state, key);
          const hadClarificationReview =
            settledGuidance.clarificationCount > 0 &&
            !!settledGuidance.clarificationPrompt;
          const clearedGuidance = clearStageClarification(settledGuidance);
          let stageGuidance = setStageGuidance(state, key, {
            ...clearedGuidance,
            reviewLead: hadClarificationReview
              ? settledGuidance.clarificationLead || settledGuidance.preface
              : undefined,
            reviewPrompt: hadClarificationReview
              ? settledGuidance.clarificationPrompt
              : undefined,
          });

          if (nextKey) {
            stageGuidance = {
              ...stageGuidance,
              [nextKey]: {
                ...getStageGuidance(
                  { ...state, stageGuidance } as DialogState,
                  nextKey,
                ),
                preface: assist.reaction,
                clarificationLead: undefined,
                clarificationPrompt: undefined,
                clarificationCount: 0,
                initialAttempt: undefined,
                clarificationAnswers: [],
              },
            };
          }

          nextStateWithAnswer = normalizeStateV3({
            ...(nextState as DialogState),
            v: 3,
            answers: answeredState.answers,
            thoughtScopes: answeredState.thoughtScopes,
            stageGuidance,
          });
        }
      }

      if (!nextStateWithAnswer) {
        setPendingUserAnswer(null);
        return;
      }

      if (isDraftSession && view.kind === "core" && view.step === 1) {
        await finalizeDraftSession(trimmed, nextStateWithAnswer, key, {
          awardCoins: shouldAwardCoins,
        });
        return;
      }

      animateStateTransition(trimmed, nextStateWithAnswer, {
        awardCoins: shouldAwardCoins,
      });
    } catch (error) {
      setPendingUserAnswer(null);
      console.error(error);
      toast.error("Не удалось обработать ответ");
    } finally {
      setIsAnalyzingAnswer(false);
    }
  };

  const goDeepPick = () => {
    const progress = recordDailyPracticeLineCompletion(
      buildDailyLineCompletionId(session.id, state),
      auth.user?.dailyPracticeMinutes ?? null,
    );
    if (progress.goalCompletedNow) {
      const streakReward = awardDailyStreakForProgress(10);
      if (streakReward.awarded) {
        toast.success(
          `+${streakReward.delta} монет • серия ${formatStreakLabel(streakReward.streak)}`,
          { position: "top-center" },
        );
      }
    }
    setState((s) => ({
      ...s,
      importantText:
        s.subject === "thought"
          ? getAnswerValue(s, "core:thought:4") || ""
          : s.answers["core:situation:4"] || s.importantText || "",
      deepPickReturn: {
        coreStep: s.coreStep,
        solveStep: s.solveStep,
        subject: s.subject,
        thoughtScopeId: s.activeThoughtScopeId,
      },
      coreStep: 99, // pseudo-step for deepPick
    }));
  };

  const goSolve = () => {
    const progress = recordDailyPracticeLineCompletion(
      buildDailyLineCompletionId(session.id, state),
      auth.user?.dailyPracticeMinutes ?? null,
    );
    if (progress.goalCompletedNow) {
      const streakReward = awardDailyStreakForProgress(10);
      if (streakReward.awarded) {
        toast.success(
          `+${streakReward.delta} монет • серия ${formatStreakLabel(streakReward.streak)}`,
          { position: "top-center" },
        );
      }
    }
    setState((s) => ({
      ...s,
      coreStep: 100,
      solveStep: 1,
      subject: "situation",
      activeThoughtScopeId: undefined,
    }));
  };

  const openAddToList = () => {
    setIsListModalOpen(true);
    setListTitle("");
    setListNotes("");
  };

  const selectIdeaFromModal = (idea: string) => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    const thoughtScopeId = createThoughtScopeId();
    setIsIdeasModalOpen(false);
    setState((s) => ({
      ...s,
      subject: "thought",
      situationText: trimmed,
      coreStep: 2,
      activeThoughtScopeId: thoughtScopeId,
      thoughtScopes: {
        ...s.thoughtScopes,
        [thoughtScopeId]: {
          "core:thought:3": trimmed,
        },
      },
      ideasPickReturn: {
        coreStep: s.coreStep,
        solveStep: s.solveStep,
        subject: s.subject,
        thoughtScopeId: s.activeThoughtScopeId,
      },
    }));
    setInputText("");
    setLastUserAnswer(null);
    setIsEditing(true);
  };

  const submitAddToList = async () => {
    const title = listTitle.trim();
    if (!title) {
      toast.error("Введите название мысли");
      return;
    }

    try {
      const newSession = await createSession({ title });
      if (!newSession?.id) {
        toast.error("Не удалось создать сессию");
        return;
      }

      setSessionKind(newSession.id, "thought");
      if (listNotes.trim()) {
        setSessionNotes(newSession.id, listNotes.trim());
      }

      toast.success("Мысль добавлена в список сессий");
      setIsListModalOpen(false);
      navigate("/sessions/list");
    } catch (e) {
      console.error(e);
      toast.error("Не удалось добавить мысль");
    }
  };

  const updateImportantIdeas = (ideas: string[]) => {
    const nextText = ideas.join("\n");
    const answerKey =
      state.subject === "thought" ? "core:thought:4" : "core:situation:4";
    const scopedAnswerUpdate = setAnswerValue(state, answerKey, nextText);
    setState((s) => ({
      ...s,
      importantText: s.subject === "situation" ? nextText : s.importantText,
      answers: scopedAnswerUpdate.answers,
      thoughtScopes: scopedAnswerUpdate.thoughtScopes,
    }));
  };

  const closeIdeaEditor = () => {
    setIdeaEditorMode(null);
    setIdeaEditorOriginal("");
    setIdeaEditorDraft("");
  };

  const handleEditIdea = (idea: string) => {
    setActiveIdeaMenu(null);
    setIdeaEditorMode("edit");
    setIdeaEditorOriginal(idea);
    setIdeaEditorDraft(idea);
  };

  const handleDeleteIdea = (idea: string) => {
    setActiveIdeaMenu(null);
    const updated = importantOptions.filter((x) => x !== idea);
    updateImportantIdeas(updated);
  };

  const handleAppendIdea = () => {
    setActiveIdeaMenu(null);
    setIdeaEditorMode("create");
    setIdeaEditorOriginal("");
    setIdeaEditorDraft("");
  };

  const submitIdeaEditor = () => {
    const next = ideaEditorDraft.trim();
    if (!next) return;
    const updated =
      ideaEditorMode === "edit"
        ? importantOptions.map((x) => (x === ideaEditorOriginal ? next : x))
        : [...importantOptions, next];
    updateImportantIdeas(updated);
    closeIdeaEditor();
  };

  const showCoreChoice = view.kind === "core" && view.step === 10;
  const showSolveChoice = view.kind === "solve" && view.step === 7;

  const canGoBack = (() => {
    if (isTransitioning || isAnalyzingAnswer || isListModalOpen) return false;
    if (view.kind === "deepPick") return true;
    if (view.kind === "solve") return true;
    if (view.kind === "core") {
      if (
        currentStageGuidance?.clarificationPrompt ||
        currentStageGuidance?.reviewPrompt
      ) {
        return true;
      }
      const min = view.subject === "thought" ? 2 : 1;
      if (view.step > min) return true;
      // из списка идей или deepPick — можно вернуться к списку
      if (
        view.step === 2 &&
        view.subject === "thought" &&
        (state.deepPickReturn || state.ideasPickReturn)
      )
        return true;
      return false;
    }
    return false;
  })();

  const goBack = () => {
    if (!canGoBack) return;
    const answerToSave = inputText.trim() || savedCurrentAnswer;
    forceEditOnStepSyncRef.current = true;

    const applyBackState = (s: DialogState): Partial<DialogState> => {
      if (
        view.kind !== "deepPick" &&
        currentStageGuidance &&
        (currentStageGuidance.clarificationPrompt ||
          currentStageGuidance.reviewPrompt)
      ) {
        return {
          stageGuidance: setStageGuidance(s, stepKey(view), {
            ...clearStageClarification(currentStageGuidance),
            preface: undefined,
            reviewLead: undefined,
            reviewPrompt: undefined,
          }),
        };
      }
      if (view.kind === "deepPick") {
        if (s.deepPickReturn) {
          return {
            coreStep: s.deepPickReturn.coreStep,
            solveStep: s.deepPickReturn.solveStep,
            subject: s.deepPickReturn.subject,
            activeThoughtScopeId: s.deepPickReturn.thoughtScopeId,
            deepPickReturn: undefined,
          };
        }
        return {
          coreStep: 10,
          deepPickReturn: undefined,
          activeThoughtScopeId: undefined,
        };
      }
      if (view.kind === "solve") {
        if (s.solveStep > 1) return { solveStep: s.solveStep - 1 };
        return {
          coreStep: 10,
          solveStep: 1,
          subject: "situation",
          activeThoughtScopeId: undefined,
        };
      }
      if (view.kind === "core") {
        if (
          view.step === 2 &&
          view.subject === "thought" &&
          s.ideasPickReturn
        ) {
          return {
            coreStep: s.ideasPickReturn.coreStep,
            solveStep: s.ideasPickReturn.solveStep,
            subject: s.ideasPickReturn.subject,
            activeThoughtScopeId: s.ideasPickReturn.thoughtScopeId,
            ideasPickReturn: undefined,
          };
        }
        if (view.step === 2 && view.subject === "thought" && s.deepPickReturn) {
          return {
            coreStep: 99,
            deepPickReturn: s.deepPickReturn,
            activeThoughtScopeId: s.deepPickReturn.thoughtScopeId,
          };
        }
        const min = view.subject === "thought" ? 2 : 1;
        return { coreStep: Math.max(min, s.coreStep - 1) };
      }
      return {};
    };

    const hadIdeasPickReturn =
      view.kind === "core" &&
      view.step === 2 &&
      view.subject === "thought" &&
      !!state.ideasPickReturn;

    const backUpdate = applyBackState(state);
    const backAnswerUpdate = answerToSave
      ? setAnswerValue(state, stepKey(view), answerToSave)
      : { answers: state.answers, thoughtScopes: state.thoughtScopes };
    const nextState: DialogState = {
      ...state,
      ...backUpdate,
      answers: backAnswerUpdate.answers,
      thoughtScopes: backAnswerUpdate.thoughtScopes,
    };

    setState(nextState);
    saveState(session.id, nextState);

    setLastUserAnswer(null);
    setInputText("");

    if (hadIdeasPickReturn) {
      setIsIdeasModalOpen(true);
    }
  };

  return (
    <div
      className={`${chatStyles.chatWindow} ${styles.dialogWindow}`}
      data-chat-root="true"
    >
      <div
        className={`${chatStyles.messagesContainer} ${styles.messagesStage}`}
        data-chat-scroll-container="true"
      >
        <div
          className={`${chatStyles.messageWrapper} ${chatStyles.visible} ${
            transitionPhase === "exiting" ? styles.slideExitLeft : ""
          } ${transitionPhase === "entering" ? styles.slideEnterFromRight : ""}`}
          data-chat-current-question="true"
        >
          <div
            className={`${chatStyles.message} ${chatStyles.assistantMessage}`}
          >
            <p className={chatStyles.messageContent}>{prompt}</p>
            {(canGoBack || isIdeasStep || canSkip || canDeepNow) && (
              <div className={styles.systemActionsRow}>
                <div className={styles.actionsLeft}>
                  {canGoBack && (
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={!canGoBack || isTransitioning || isAnalyzingAnswer}
                      className={styles.backButton}
                      aria-label="Назад"
                      title="Назад"
                    >
                      ← Назад
                    </button>
                  )}
                </div>
                <div className={styles.actionsCenter}>
                  {isIdeasStep && !canDeepNow && (
                    <button
                      type="button"
                      onClick={() => setIsIdeasModalOpen(true)}
                      disabled={isTransitioning}
                      className={styles.actionButton}
                      aria-label="Список идей"
                      title="Список идей"
                    >
                      ↓ Идеи
                    </button>
                  )}
                  {canDeepNow && isEditing && (
                    <button
                      type="button"
                      onClick={goDeepPick}
                      disabled={
                        isTransitioning || isAnalyzingAnswer || isListModalOpen
                      }
                      className={styles.actionButton}
                      aria-label="Идеи"
                      title='Показать идеи из ответа "Почему это важно"'
                    >
                      <ChevronDown className={styles.actionIcon} />
                      Идеи
                    </button>
                  )}
                </div>
                <div className={styles.actionsRight}>
                  {canGoForward ? (
                    <button
                      type="button"
                      onClick={goForward}
                      disabled={!canGoForward}
                      className={styles.skipButton}
                      aria-label="Дальше"
                      title="Дальше"
                    >
                      Дальше →
                    </button>
                  ) : canSkip ? (
                    <button
                      type="button"
                      onClick={goSkip}
                      disabled={!canSkip || isTransitioning}
                      className={styles.skipButton}
                      aria-label="Пропустить"
                      title="Пропустить"
                    >
                      {skipButtonLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {pendingUserAnswer && !lastUserAnswer && (
          <div
            className={`${chatStyles.messageWrapper} ${chatStyles.visible}`}
          >
            <div
              className={`${chatStyles.message} ${chatStyles.userMessage} ${styles.centeredUserBubble}`}
            >
              <p className={chatStyles.messageContent}>{pendingUserAnswer}</p>
            </div>
          </div>
        )}

        {lastUserAnswer && (
          <div
            className={`${chatStyles.messageWrapper} ${chatStyles.visible} ${
              transitionPhase === "exiting" ? styles.slideExitLeft : ""
            }`}
          >
            <div
              className={`${chatStyles.message} ${chatStyles.userMessage} ${styles.centeredUserBubble}`}
            >
              <p className={chatStyles.messageContent}>{lastUserAnswer}</p>
            </div>
          </div>
        )}

        {/* Сохранённый ответ при возврате в сессию — показываем как отправленное сообщение, не в поле ввода */}
        {(() => {
          if (!isTextAnswerView(view) || lastUserAnswer)
            return null;
          const shouldShowSavedBubble =
            !isEditing || !!currentStageGuidance?.clarificationPrompt;
          if (!shouldShowSavedBubble) return null;
          const key = stepKey(view);
          const saved = getAnswerValue(state, key);
          if (!saved || !saved.trim()) return null;
          return (
            <div
              className={`${chatStyles.messageWrapper} ${chatStyles.visible}`}
            >
              <div
                className={`${chatStyles.message} ${chatStyles.userMessage} ${styles.centeredUserBubble}`}
              >
                <p className={chatStyles.messageContent}>{saved}</p>
              </div>
            </div>
          );
        })()}

        {(state.situationText || view.kind === "core") &&
          view.kind === "core" &&
          view.step === 1 && (
            <p className={styles.helperText}>
              Напишите ответ ниже. После каждого ответа вы увидите следующий
              вопрос.
            </p>
          )}

        {showReasonsEditor && (
          <div className={styles.reasonsEditor}>
            <p className={styles.reasonsHint}>
              Каждую причину можно будет потом рассматривать как отдельную
              линию разбора.
            </p>
            <div className={styles.reasonsGrid}>
              {reasonDrafts.map((reason, index) => (
                <div key={`reason-${index}`} className={styles.reasonCard}>
                  <span className={styles.reasonLabel}>
                    Причина {index + 1}
                  </span>
                  <Textarea
                    value={reason}
                    onChange={(e) => updateReasonDraft(index, e.target.value)}
                    placeholder="Коротко сформулируйте причину"
                    rows={3}
                    className={styles.reasonTextarea}
                  />
                </div>
              ))}
            </div>
            <div className={styles.reasonsActions}>
              {reasonDrafts.length < MAX_REASON_FIELDS && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addReasonDraft}
                  className={chatStyles.glassButton}
                >
                  Добавить ещё причину
                </Button>
              )}
              <Button
                type="button"
                onClick={submitReasonDrafts}
                disabled={!joinReasonDrafts(reasonDrafts) || isAnalyzingAnswer}
                className={chatStyles.glassButton}
              >
                Дальше
              </Button>
            </div>
          </div>
        )}

        {view.kind === "deepPick" && importantOptions.length > 0 && (
          <div className={styles.deepIdeasList}>
            {importantOptions.map((opt) => (
              <div key={opt} className={styles.deepIdeaItem}>
                <button
                  type="button"
                  className={`${styles.choiceButton} ${chatStyles.glassButton} ${styles.deepIdeaButton}`}
                  onClick={() =>
                    setActiveIdeaMenu((prev) => (prev === opt ? null : opt))
                  }
                  disabled={isTransitioning}
                >
                  {opt}
                </button>

                {activeIdeaMenu === opt && (
                  <div className={styles.deepIdeaMenu}>
                    <button
                      type="button"
                      className={styles.deepIdeaMenuItem}
                      onClick={() => {
                        setActiveIdeaMenu(null);
                        onAnswer(opt);
                      }}
                    >
                      Выбрать эту мысль на разбор
                    </button>
                    <button
                      type="button"
                      className={styles.deepIdeaMenuItem}
                      onClick={() => handleEditIdea(opt)}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className={styles.deepIdeaMenuItem}
                      onClick={() => handleDeleteIdea(opt)}
                    >
                      Удалить
                    </button>
                    <button
                      type="button"
                      className={styles.deepIdeaMenuItem}
                      onClick={handleAppendIdea}
                    >
                      Добавить ещё одну мысль
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showCoreChoice && (
          <div className={styles.choiceRow}>
            <Button
              className={`${styles.choiceButton} ${chatStyles.glassButton}`}
              onClick={goSolve}
            >
              Решить ситуацию
            </Button>
            <Button
              className={`${styles.choiceButton} ${chatStyles.glassButton}`}
              variant="outline"
              onClick={goDeepPick}
            >
              Разобраться глубже
            </Button>
          </div>
        )}

        {view.kind === "intro" && (
          <div className={styles.choiceRow}>
            <Button
              className={`${styles.choiceButton} ${chatStyles.glassButton}`}
              onClick={() => setIntroStarted(true)}
            >
              Начать разбор
            </Button>
          </div>
        )}

        {showSolveChoice && (
          <div className={styles.choiceRow}>
            <Button
              className={`${styles.choiceButton} ${chatStyles.glassButton}`}
              variant="outline"
              onClick={goDeepPick}
            >
              Разобраться глубже
            </Button>
            <Button
              className={`${styles.choiceButton} ${chatStyles.glassButton}`}
              onClick={openAddToList}
            >
              Добавить в список
            </Button>
          </div>
        )}
      </div>

      {/* Нижняя панель: кнопки и ввод (как в ChatWindow — composerDock). */}
      {showDefaultBottomEditorActions && (
        <div className={`${chatStyles.composerDock} ${styles.bottomDock}`}>
          {!isEditing && (
            <div className="flex justify-center gap-2 flex-wrap px-4 pt-3 pb-1">
              {!isEditing && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(true);
                      window.setTimeout(() => focusInputWithoutScroll(), 0);
                    }}
                    className={chatStyles.glassButton}
                  >
                    Отредактировать
                  </Button>
                  <Button
                    onClick={() => {
                      onAnswer(inputText);
                      window.setTimeout(() => focusInputWithoutScroll(), 150);
                    }}
                    disabled={!inputText.trim() || isAnalyzingAnswer}
                    className={chatStyles.glassButton}
                  >
                    Дальше
                  </Button>
                </>
              )}
              {canDeepNow && !isEditing && (
                <Button
                  type="button"
                  onClick={openAddToList}
                  disabled={
                    isTransitioning || isAnalyzingAnswer || isListModalOpen
                  }
                  className={chatStyles.glassButton}
                  aria-label="Добавить мысль в Нейросписок"
                  title="Добавить мысль в Нейросписок"
                >
                  Добавить мысль в Нейросписок
                </Button>
              )}
            </div>
          )}
          <div className={styles.inputAlignWrapper}>
            <MessageInput
              ref={inputRef}
              onSend={(v) => {
                if (!isEditing) return;
                onAnswer(v);
                window.setTimeout(() => focusInputWithoutScroll(), 150);
              }}
              disabled={isMutating || isAnalyzingAnswer}
              readOnly={
                isMutating ||
                isAnalyzingAnswer ||
                isTransitioning ||
                !isEditing
              }
              placeholder={
                !isEditing ? "Ваш ответ сохранён" : "Введите ответ..."
              }
              autoFocus
              value={isEditing ? inputText : ""}
              onValueChange={setInputText}
            />
          </div>
        </div>
      )}

      {ideaEditorMode && (
        <div
          className={styles.modalOverlay}
          onClick={closeIdeaEditor}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {ideaEditorMode === "edit"
                ? "Редактировать мысль"
                : "Добавить мысль"}
            </h3>
            <div className={styles.modalBody}>
              <Textarea
                ref={ideaEditorRef}
                value={ideaEditorDraft}
                onChange={(e) => setIdeaEditorDraft(e.target.value)}
                placeholder="Введите мысль"
                rows={4}
              />
              <p className={styles.modalHint}>
                {ideaEditorMode === "edit"
                  ? "Текст выделяется целиком, чтобы его можно было сразу заменить."
                  : "Добавленная мысль появится в этом списке и станет доступна для разбора."}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <Button
                variant="outline"
                onClick={closeIdeaEditor}
                className={chatStyles.glassButton}
              >
                Отмена
              </Button>
              <Button
                onClick={submitIdeaEditor}
                disabled={!ideaEditorDraft.trim()}
                className={chatStyles.glassButton}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка «Список идей» — кликабельные идеи, выбор запускает этапы по этой идее */}
      {isIdeasModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsIdeasModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Идеи</h3>
            <div className={styles.modalBody}>
              {ideasList.length === 0 ? (
                <p className={styles.modalHint}>Пока нет идей</p>
              ) : (
                <div className={styles.ideasListButtons}>
                  {ideasList.map((idea, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className={`${styles.choiceButton} ${chatStyles.glassButton}`}
                      onClick={() => selectIdeaFromModal(idea)}
                    >
                      {idea}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <Button
                variant="outline"
                onClick={() => setIsIdeasModalOpen(false)}
                className={chatStyles.glassButton}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка 'Добавить в список' */}
      {isListModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsListModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Добавить мысль в список</h3>
            <div className={styles.modalBody}>
              <Input
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="А) Как называется мысль?"
              />
              <Textarea
                value={listNotes}
                onChange={(e) => setListNotes(e.target.value)}
                placeholder="Б) Примечания"
                rows={4}
              />
              <p className={styles.modalHint}>
                Эта мысль на разбор появится у вас в списке сессий.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <Button
                variant="outline"
                onClick={() => setIsListModalOpen(false)}
                className={chatStyles.glassButton}
              >
                Отмена
              </Button>
              <Button
                onClick={submitAddToList}
                disabled={isMutating}
                className={chatStyles.glassButton}
              >
                Отправить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default StepDialogWindow;
