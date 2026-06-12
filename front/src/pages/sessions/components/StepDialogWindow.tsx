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
  showCoinsRewardNotice,
} from "@/lib/gamification";
import { ChevronDown } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { extractApiMessage, isSeeTokensExpiredError } from "@/lib/subscription";
import chatStyles from "./ChatWindow.module.css";
import FeedbackModal from "./FeedbackModal";
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
  thoughtScopeLinks: Record<string, ThoughtScopeLink>;
};

type DialogState = DialogStateV3;
type TransitionPhase = "idle" | "exiting" | "entering";

type ThoughtScopeLink = {
  parentSubject: Subject;
  parentScopeId?: string;
  parentReason: string;
};

type MindMapNodeAction =
  | {
      type: "root-thought";
      label: string;
      answerKey: "core:situation:3" | "core:thought:3";
      scopeId?: string;
      parentSubject: Subject;
      parentScopeId?: string;
    }
  | {
      type: "reason";
      label: string;
      ownerSubject: Subject;
      ownerScopeId?: string;
      answerKey: "core:situation:4" | "core:thought:4";
      index: number;
      linkedScopeIds: string[];
      parentSubject: Subject;
      parentScopeId?: string;
    };

type MindMapNode = {
  key: string;
  label: string;
  kind: "situation" | "thought" | "idea";
  badge: string;
  action?: MindMapNodeAction;
  children: MindMapNode[];
  active: boolean;
  activePath: boolean;
};

type IdeaEditorTarget =
  | {
      type: "append-reason";
      ownerSubject: Subject;
      ownerScopeId?: string;
      answerKey: "core:situation:4" | "core:thought:4";
    }
  | {
      type: "edit-root-thought";
      answerKey: "core:situation:3" | "core:thought:3";
      scopeId?: string;
    }
  | {
      type: "edit-reason";
      ownerSubject: Subject;
      ownerScopeId?: string;
      answerKey: "core:situation:4" | "core:thought:4";
      index: number;
      linkedScopeIds: string[];
    };

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
    thoughtScopeLinks: {},
  });
}

function normalizeStateV3(state: DialogStateV3): DialogStateV3 {
  const dash = "—";
  const answers = { ...(state.answers || {}) };
  const thoughtScopes = { ...(state.thoughtScopes || {}) };
  const stageGuidance = { ...(state.stageGuidance || {}) };
  const thoughtScopeLinks = { ...(state.thoughtScopeLinks || {}) };

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

    if (!thoughtScopeLinks[state.activeThoughtScopeId]) {
      const currentThought =
        activeScope["core:thought:3"] || state.situationText || "";
      const parentReturn = state.deepPickReturn || state.ideasPickReturn;
      if (currentThought && parentReturn) {
        thoughtScopeLinks[state.activeThoughtScopeId] = {
          parentSubject: parentReturn.subject,
          parentScopeId: parentReturn.thoughtScopeId,
          parentReason: currentThought,
        };
      }
    }
  }

  return {
    ...state,
    answers,
    thoughtScopes,
    stageGuidance,
    thoughtScopeLinks,
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

function getAnswerValue(
  state: DialogState,
  key: string,
  thoughtScopeId?: string,
): string | undefined {
  if (key.startsWith("core:thought:")) {
    const scopeId = thoughtScopeId || state.activeThoughtScopeId;
    if (!scopeId) return undefined;
    return state.thoughtScopes[scopeId]?.[key];
  }
  return state.answers[key];
}

function setAnswerValue(
  state: DialogState,
  key: string,
  value: string,
  thoughtScopeId?: string,
): Pick<DialogState, "answers" | "thoughtScopes"> {
  if (key.startsWith("core:thought:")) {
    const scopeId =
      thoughtScopeId || state.activeThoughtScopeId || createThoughtScopeId();
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

function parseStoredState(parsed: any): DialogState | null {
  if (!parsed) return null;

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
      thoughtScopeLinks: parsed.thoughtScopeLinks || {},
    } as DialogStateV3);
  }

  if (parsed?.v === 2) {
    if (
      typeof parsed.coreStep !== "number" ||
      typeof parsed.solveStep !== "number"
    ) {
      return null;
    }
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

  if (parsed?.v === 1) {
    if (
      typeof parsed.coreStep !== "number" ||
      typeof parsed.solveStep !== "number"
    ) {
      return null;
    }
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
}

function loadState(sessionId: string): DialogState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    if (!raw) return null;
    return parseStoredState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function loadSessionStateFromServer(raw: unknown): DialogState | null {
  return parseStoredState(raw as any);
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
  const thought = getExactThoughtLabel(subject, answers);
  const thoughtNominative = thought ? `мысль «${thought}»` : "эта мысль";
  const thoughtAccusative = thought ? `мысль «${thought}»` : "эту мысль";
  const thoughtGenitive = thought ? `мысли «${thought}»` : "этой мысли";
  const primarySourceKey = `core:${subject}:5`;
  const secondarySourceKey =
    subject === "thought" ? "core:situation:5" : "core:thought:5";
  const sourceAnswer = sanitizeSourceAnswer(
    answers?.[primarySourceKey] || answers?.[secondarySourceKey],
    thought,
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

type SourceCandidateMatch = {
  index: number;
  label: string;
};

const SOURCE_NAME_EXCLUDE = new Set([
  "А",
  "И",
  "Или",
  "Как",
  "Когда",
  "Мысль",
  "От",
  "Потому",
  "Просто",
  "Скорее",
  "Это",
  "Если",
]);

function pushSourceMatch(
  matches: SourceCandidateMatch[],
  index: number,
  label: string,
) {
  const trimmed = label.trim();
  if (!trimmed) return;
  matches.push({ index, label: trimmed });
}

function collectPatternMatches(
  raw: string,
  regex: RegExp,
  label: string,
  matches: SourceCandidateMatch[],
) {
  for (const match of raw.matchAll(regex)) {
    if (typeof match.index !== "number") continue;
    pushSourceMatch(matches, match.index, label);
  }
}

function collectSelfSourceMatches(raw: string, matches: SourceCandidateMatch[]) {
  for (const match of raw.matchAll(/\bя\s+сам(а)?\b/giu)) {
    if (typeof match.index !== "number") continue;
    pushSourceMatch(matches, match.index, match[1] ? "ты сама" : "ты сам");
  }

  for (const match of raw.matchAll(/\bсам(а)?\s+себе\b/giu)) {
    if (typeof match.index !== "number") continue;
    pushSourceMatch(matches, match.index, match[1] ? "ты сама" : "ты сам");
  }
}

function formatSourceCandidates(candidates: string[]): string {
  if (candidates.length <= 1) return candidates[0] || "";
  if (candidates.length === 2) return `${candidates[0]} и ${candidates[1]}`;
  return `${candidates.slice(0, -1).join(", ")} и ${candidates.at(-1)}`;
}

function shouldSkipSourceLabel(nextLabel: string, kept: string[]): boolean {
  const normalizedNext = nextLabel.toLowerCase();
  return kept.some((label) => {
    const normalizedLabel = label.toLowerCase();
    return (
      normalizedLabel === normalizedNext ||
      normalizedLabel.includes(normalizedNext)
    );
  });
}

function extractSourceCandidates(v?: string): string[] {
  const raw = sanitizeThoughtValue(v)
    .replace(/\s+/g, " ")
    .replace(/[«»"]/g, "")
    .trim();

  if (!raw) return [];

  const matches: SourceCandidateMatch[] = [];

  collectSelfSourceMatches(raw, matches);

  const sourcePatterns: Array<[RegExp, string]> = [
    [/\b(?:мой|моего|моему|моим|моём|моем)\s+пап(?:а|у|ы|е)?\b/giu, "твой папа"],
    [/\bпап(?:а|у|ы|е)?\b/giu, "папа"],
    [/\b(?:мой|моего|моему|моим|моём|моем)\s+от(?:е|ц)(?:а|у|ом|е)?\b/giu, "твой отец"],
    [/\bот(?:е|ц)(?:а|у|ом|е)?\b/giu, "отец"],
    [/\b(?:моя|мою|моей|маме|моими|моих)\s+мам(?:а|у|ы|е|ой)?\b/giu, "твоя мама"],
    [/\bмам(?:а|у|ы|е|ой)?\b/giu, "мама"],
    [/\b(?:моя|мою|моей|моими|моих)\s+мат(?:ь|ери|ерью)\b/giu, "твоя мать"],
    [/\bмат(?:ь|ери|ерью)\b/giu, "мать"],
    [/\b(?:мои|моих|моим)\s+родител(?:и|ей|ям|ями)\b/giu, "твои родители"],
    [/\bродител(?:и|ей|ям|ями)\b/giu, "родители"],
    [/\b(?:моя|мою|моей|моими|моих)\s+семь(?:я|ю|и|е|ёй|ей)\b/giu, "твоя семья"],
    [/\bсемь(?:я|ю|и|е|ёй|ей)\b/giu, "семья"],
    [/\b(?:мой|моего|моему|моим|моём|моем)\s+опыт\b/giu, "твой опыт"],
    [/\bдетск\w+\s+опыт\w*\b/giu, "детский опыт"],
    [/\bпрошл\w+\s+опыт\w*\b/giu, "прошлый опыт"],
    [/\bопыт\b/giu, "опыт"],
    [/\bшкол(?:а|у|ы|е|ой)\b/giu, "школа"],
    [/\bучител(?:ь|я|ю|ем|е|и|ей)\b/giu, "учитель"],
    [/\bсообществ(?:о|а|у|ом|е)\b/giu, "сообщество"],
    [/\bкультур(?:а|у|ы|е|ой)\b/giu, "культура"],
    [/\bсистем(?:а|у|ы|е|ой)\b/giu, "система"],
    [/\bобществ(?:о|а|у|ом|е)\b/giu, "общество"],
  ];

  for (const [regex, label] of sourcePatterns) {
    collectPatternMatches(raw, regex, label, matches);
  }

  for (const match of raw.matchAll(/\b[A-ZА-ЯЁ][A-Za-zА-ЯЁа-яё-]{2,}\b/gu)) {
    const candidate = match[0].trim();
    if (SOURCE_NAME_EXCLUDE.has(candidate)) continue;
    if (typeof match.index !== "number") continue;
    pushSourceMatch(matches, match.index, candidate);
  }

  const unique = matches
    .sort((a, b) => a.index - b.index)
    .reduce<string[]>((acc, match) => {
      if (shouldSkipSourceLabel(match.label, acc)) {
        return acc;
      }
      return [...acc, match.label];
    }, []);

  return unique.slice(0, 4);
}

function normalizeAnswerForComparison(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`.,!?;:()[\]{}-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeThoughtInsteadOfSource(source: string, thought?: string): boolean {
  const normalizedSource = normalizeAnswerForComparison(source);
  const normalizedThought = normalizeAnswerForComparison(thought);

  if (!normalizedSource || !normalizedThought) return false;
  if (normalizedSource === normalizedThought) return true;

  return (
    normalizedSource.length > 24 &&
    (normalizedSource.includes(normalizedThought) ||
      normalizedThought.includes(normalizedSource))
  );
}

function sanitizeSourceAnswer(v?: string, thought?: string): string {
  const extracted = extractSourceCandidates(v);
  if (extracted.length) {
    return formatSourceCandidates(extracted);
  }

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

  if (looksLikeThoughtInsteadOfSource(cleaned, thought)) {
    return "";
  }

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
      ? `С какой эгоистичной целью другой человек или система могли внедрять вам мысль «${thought}»? Не описывайте их мотивы по отношению к вам, опишите, в чём была их личная выгода говорить вам такое.`
      : `С какой эгоистичной целью другой человек или система могли внедрять вам эту мысль? Не описывайте их мотивы по отношению к вам, опишите, в чём была их личная выгода говорить вам такое.`;
  }

  if (hasMultipleSources(sourceAnswer)) {
    return thought
      ? `Если взять названные вами источники — ${sourceAnswer}, — какую выгоду для себя они могли получать, когда передавали вам мысль «${thought}»?`
      : `Если взять названные вами источники — ${sourceAnswer}, — какую выгоду для себя они могли получать, когда передавали вам эту мысль?`;
  }

  return thought
    ? `С какой эгоистичной целью ${sourceAnswer} внедрял${/[ая]$/u.test(sourceAnswer) ? "а" : ""} вам мысль «${thought}»? Не описывайте мотивы по отношению к вам, опишите, в чём была личная выгода ${sourceAnswer} говорить вам такое.`
    : `С какой эгоистичной целью ${sourceAnswer} внедрял${/[ая]$/u.test(sourceAnswer) ? "а" : ""} вам эту мысль? Не описывайте мотивы по отношению к вам, опишите, в чём была личная выгода ${sourceAnswer} говорить вам такое.`;
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

function formatSummarySection(title: string, body: string): string {
  return `${title}\n${body}`;
}

function formatReasonSummary(value?: string): string {
  const reasons = splitReasonDrafts(value).slice(0, MAX_REASON_FIELDS);
  if (!reasons.length) return "";

  return reasons.map((reason, index) => `${index + 1}. ${reason}`).join("\n");
}

function buildConclusionSummary(
  subject: Subject,
  answers?: Record<string, string>,
): string {
  const thought = getExactThoughtLabel(subject, answers);

  const reasons = formatReasonSummary(answers?.[`core:${subject}:4`]);
  const source = sanitizeSourceAnswer(answers?.[`core:${subject}:5`], thought);
  const benefit = summarizeStepAnswer(answers?.[`core:${subject}:6`]);
  const emotional = summarizeStepAnswer(answers?.[`core:${subject}:7`]);
  const practical = summarizeStepAnswer(answers?.[`core:${subject}:8`]);

  const sections: string[] = [];

  if (thought) {
    sections.push(`Если собрать всё вместе по мысли «${thought}»:`);
  } else {
    sections.push("Если собрать всё вместе:");
  }

  if (reasons) {
    sections.push(
      formatSummarySection(
        "Почему эта мысль казалась правдой:",
        reasons,
      ),
    );
  }
  if (source) {
    sections.push(
      formatSummarySection(
        "Кто мог передавать или закреплять эту мысль:",
        source,
      ),
    );
  }
  if (benefit) {
    sections.push(
      formatSummarySection(
        "Какая выгода могла быть у источника:",
        benefit,
      ),
    );
  }
  if (emotional) {
    sections.push(
      formatSummarySection(
        "Как это влияло эмоционально:",
        emotional,
      ),
    );
  }
  if (practical) {
    sections.push(
      formatSummarySection(
        "Как это влияло на жизнь и поведение:",
        practical,
      ),
    );
  }

  return sections.join("\n\n");
}

function getCurrentThoughtLabel(
  subject: Subject,
  answers?: Record<string, string>,
): string {
  return getExactThoughtLabel(subject, answers);
}

function getExactThoughtLabel(
  subject: Subject,
  answers?: Record<string, string>,
): string {
  return sanitizeThoughtValue(answers?.[`core:${subject}:3`]);
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

function buildUnknownAnswerAdvancePreface(view: View): string {
  if (view.kind !== "core") {
    return "Ничего страшного, если сейчас нет точного ответа. Давайте двигаться дальше.";
  }

  if (view.step === 6) {
    return "Ничего страшного, если сейчас не получается понять цели или выгоду источника. Это нормально.";
  }

  if (view.step === 5) {
    return "Ничего страшного, если сейчас не получается точно понять, откуда пришла эта мысль. Давайте двигаться дальше по тому, что можно заметить.";
  }

  if (view.step === 7) {
    return "Ничего страшного, если эмоциональные последствия пока трудно назвать точно. Давайте посмотрим на практическую сторону.";
  }

  return "Ничего страшного, если сейчас нет точного ответа. Давайте перейдём к следующему шагу.";
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

function getReasonIdeas(value?: string): string[] {
  return parseImportantOptions(value || "");
}

function buildMindMapKey(part: string): string {
  return part
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildReasonChildren(
  state: DialogState,
  ownerSubject: Subject,
  ownerScopeId: string | undefined,
): MindMapNode[] {
  const answerKey = ownerSubject === "situation" ? "core:situation:4" : "core:thought:4";
  const reasonsText = getAnswerValue(state, answerKey, ownerScopeId) || "";
  const reasons = getReasonIdeas(reasonsText);
  const linkEntries = Object.entries(state.thoughtScopeLinks || {}).filter(
    ([, link]) =>
      link.parentSubject === ownerSubject &&
      (link.parentScopeId || "") === (ownerScopeId || ""),
  );

  return reasons.map((reason, index) => {
    const linkedScopeIds = linkEntries
      .filter(([, link]) => {
        return (
          normalizeAnswerForComparison(link.parentReason) ===
          normalizeAnswerForComparison(reason)
        );
      })
      .map(([scopeId]) => scopeId);

    const children = linkedScopeIds.flatMap((scopeId) =>
      buildReasonChildren(state, "thought", scopeId),
    );
    const active = linkedScopeIds.includes(state.activeThoughtScopeId || "");
    const activePath = active || children.some((child) => child.activePath);

    return {
      key: `reason-${ownerSubject}-${ownerScopeId || "root"}-${index}-${buildMindMapKey(reason)}`,
      label: reason,
      kind: "idea",
      badge: "Идея",
      action: {
        type: "reason",
        label: reason,
        ownerSubject,
        ownerScopeId,
        answerKey,
        index,
        linkedScopeIds,
        parentSubject: ownerSubject,
        parentScopeId: ownerScopeId,
      },
      children,
      active,
      activePath,
    };
  });
}

function buildDeepMindMap(state: DialogState): MindMapNode[] {
  const rootSituation = sanitizeThoughtValue(
    state.answers["core:situation:1"] || (state.subject !== "thought" ? state.situationText : ""),
  );
  const rootThought = sanitizeThoughtValue(state.answers["core:situation:3"]);

  if (rootSituation) {
    const rootChildren: MindMapNode[] = [];

    if (rootThought) {
      const children = buildReasonChildren(state, "situation", undefined);
      rootChildren.push({
        key: `root-thought-${buildMindMapKey(rootThought)}`,
        label: rootThought,
        kind: "thought",
        badge: "Мысль",
        action: {
          type: "root-thought",
          label: rootThought,
          answerKey: "core:situation:3",
          parentSubject: "situation",
        },
        children,
        active: state.subject === "situation" && state.coreStep >= 3,
        activePath:
          (state.subject === "situation" && state.coreStep >= 3) ||
          children.some((child) => child.activePath),
      });
    } else {
      rootChildren.push(...buildReasonChildren(state, "situation", undefined));
    }

    return [
      {
        key: `root-situation-${buildMindMapKey(rootSituation)}`,
        label: rootSituation,
        kind: "situation",
        badge: "Ситуация",
        children: rootChildren,
        active: state.subject === "situation" && state.coreStep <= 10,
        activePath:
          (state.subject === "situation" && state.coreStep <= 10) ||
          rootChildren.some((child) => child.activePath),
      },
    ];
  }

  const standaloneThought = sanitizeThoughtValue(
    getAnswerValue(state, "core:thought:3") || state.situationText,
  );

  if (!standaloneThought) return [];

  const standaloneChildren = buildReasonChildren(
    state,
    "thought",
    state.activeThoughtScopeId,
  );

  return [
    {
      key: `standalone-thought-${buildMindMapKey(standaloneThought)}`,
      label: standaloneThought,
      kind: "thought",
      badge: "Мысль",
      action: {
        type: "root-thought",
        label: standaloneThought,
        answerKey: "core:thought:3",
        scopeId: state.activeThoughtScopeId,
        parentSubject: "thought",
        parentScopeId: state.activeThoughtScopeId,
      },
      children: standaloneChildren,
      active: true,
      activePath: true,
    },
  ];
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

function buildRewardAnswerId(
  state: DialogState,
  view: View,
  baseKey: string,
): string {
  if (view.kind !== "core" || view.subject !== "thought") {
    return baseKey;
  }

  return `${state.activeThoughtScopeId || "thought-root"}:${baseKey}`;
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
    const existing =
      loadSessionStateFromServer(session.dialogStateJson) || loadState(session.id);
    if (existing) return existing;

    const kind =
      getSessionKind(session.id) === "thought" ||
      session.sessionKind === "thought"
        ? "thought"
        : "default";
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
      thoughtScopeLinks: {},
    };
  });
  const persistStateTimeoutRef = useRef<number | null>(null);
  const lastPersistedStateRef = useRef<string>("");

  useEffect(() => {
    if (isDraftSession) return;
    if (session.sessionKind === "thought") {
      setSessionKind(session.id, "thought");
    }
    if (session.notes && session.notes.trim()) {
      setSessionNotes(session.id, session.notes.trim());
    }
  }, [isDraftSession, session.id, session.notes, session.sessionKind]);

  useEffect(() => {
    saveState(session.id, state);
  }, [session.id, state]);

  useEffect(() => {
    if (isDraftSession) return;

    const payload = {
      dialogStateJson: state,
      sessionKind:
        getSessionKind(session.id) === "thought" || session.sessionKind === "thought"
          ? "thought"
          : null,
      notes: getSessionNotes(session.id) ?? session.notes ?? null,
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastPersistedStateRef.current) {
      return;
    }

    if (persistStateTimeoutRef.current) {
      window.clearTimeout(persistStateTimeoutRef.current);
    }

    persistStateTimeoutRef.current = window.setTimeout(() => {
      void apiAgent
        .patch<
          {
            dialogStateJson: DialogState;
            sessionKind: string | null;
            notes: string | null;
          },
          SessionResponseDto
        >(`/sessions/${session.id}`, payload)
        .then(() => {
          lastPersistedStateRef.current = serialized;
        })
        .catch((error: any) => {
          console.error("Failed to persist session state", error);
        });
    }, 250);

    return () => {
      if (persistStateTimeoutRef.current) {
        window.clearTimeout(persistStateTimeoutRef.current);
      }
    };
  }, [isDraftSession, session.id, session.notes, session.sessionKind, state]);

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

  const deepMindMap = useMemo(
    () => (view.kind === "deepPick" ? buildDeepMindMap(state) : []),
    [
      state.answers,
      state.thoughtScopes,
      state.activeThoughtScopeId,
      state.thoughtScopeLinks,
      state.situationText,
      state.subject,
      state.coreStep,
      view.kind,
    ],
  );

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
  const [ideaEditorDraft, setIdeaEditorDraft] = useState("");
  const [ideaEditorTarget, setIdeaEditorTarget] = useState<IdeaEditorTarget | null>(
    null,
  );
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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

  const skipButtonLabel = "Пропустить →";

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

  const persistSessionStateNow = async () => {
    if (isDraftSession) return;

    const payload = {
      dialogStateJson: state,
      sessionKind:
        getSessionKind(session.id) === "thought" || session.sessionKind === "thought"
          ? "thought"
          : null,
      notes: getSessionNotes(session.id) ?? session.notes ?? null,
    };
    const serialized = JSON.stringify(payload);

    if (persistStateTimeoutRef.current) {
      window.clearTimeout(persistStateTimeoutRef.current);
      persistStateTimeoutRef.current = null;
    }

    await apiAgent.patch(`/sessions/${session.id}`, payload);
    lastPersistedStateRef.current = serialized;
  };

  const openFinishSession = async () => {
    try {
      await persistSessionStateNow();
    } catch (error) {
      console.error("Failed to persist session before finish", error);
    }
    setIsFeedbackOpen(true);
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

  const syncThoughtReasonsToMap = async (reasonAnswer: string) => {
    if (isDraftSession || state.subject !== "thought") return;

    const answerUpdate = setAnswerValue(
      state,
      "core:thought:4",
      reasonAnswer,
      state.activeThoughtScopeId,
    );
    const nextState = normalizeStateV3({
      ...state,
      v: 3,
      coreStep: Math.max(state.coreStep, 5),
      answers: answerUpdate.answers,
      thoughtScopes: answerUpdate.thoughtScopes,
    });
    const payload = {
      dialogStateJson: nextState,
      sessionKind: "thought",
      notes: getSessionNotes(session.id) ?? session.notes ?? null,
    };

    await apiAgent.patch(`/sessions/${session.id}`, payload);
    lastPersistedStateRef.current = JSON.stringify(payload);
  };

  const submitReasonDrafts = () => {
    const answer = joinReasonDrafts(reasonDrafts);
    if (!answer || isAnalyzingAnswer || isTransitioning) return;
    setInputText(answer);
    void onAnswer(answer);
    void syncThoughtReasonsToMap(answer).catch((error) => {
      console.error("Failed to sync reason cards to map", error);
    });
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
        thoughtScopeLinks: {
          ...(state.thoughtScopeLinks || {}),
          [thoughtScopeId]: {
            parentSubject: state.subject,
            parentScopeId: state.activeThoughtScopeId,
            parentReason: trimmed,
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

  const animateStateTransition = async (
    displayAnswer: string,
    nextState: DialogState,
    options?: { awardCoins?: boolean },
  ) => {
    const key = currentStepKey;
    const rewardKey = key ? buildRewardAnswerId(state, view, key) : null;
    setPendingUserAnswer(null);
    setLastUserAnswer(displayAnswer);
    if (
      rewardKey &&
      options?.awardCoins !== false &&
      !(isDraftSession && view.kind === "core" && view.step === 1)
    ) {
      try {
        const reward = await awardCoinsForAnswer(session.id, rewardKey, 3);
        if (reward.awarded) {
          showCoinsRewardNotice(`+${reward.delta} монеты`);
        }
      } catch (error) {
        console.error("Failed to award answer coins", error);
      }
    }
    if (
      !isDraftSession &&
      view.kind === "core" &&
      view.step === 9 &&
      nextState.coreStep === 10
    ) {
      try {
        const recommendedReward = await claimPendingSessionReward(session.id);
        if (recommendedReward.awarded) {
          showCoinsRewardNotice(
            `+${recommendedReward.delta} монет за рекомендованную карточку`,
          );
        }
      } catch (error) {
        console.error("Failed to claim pending session reward", error);
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
        try {
          const reward = await awardCoinsForAnswer(newSession.id, answerKey, 3);
          if (reward.awarded) {
            showCoinsRewardNotice(`+${reward.delta} монеты`);
          }
        } catch (error) {
          console.error("Failed to award draft session coins", error);
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

      try {
        await apiAgent.patch<
          {
            dialogStateJson: DialogState;
            sessionKind: string | null;
            notes: string | null;
          },
          SessionResponseDto
        >(`/sessions/${newSession.id}`, {
          dialogStateJson: nextState,
          sessionKind: kind === "thought" ? "thought" : null,
          notes: notes?.trim() || null,
        });
      } catch (error) {
        console.error("Failed to persist new session state", error);
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
      const message = extractApiMessage(e) || "Не удалось создать сессию";
      toast.error(message, {
        action: isSeeTokensExpiredError(e)
          ? {
              label: "Пополнить баланс",
              onClick: () => navigate("/subscription?topup=1"),
            }
          : undefined,
      });
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

          await animateStateTransition(trimmed, clarifyState, { awardCoins: false });
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

            await animateStateTransition(trimmed, clarifyState, { awardCoins: false });
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
            const shouldUseUnknownAdvancePreface =
              options?.skipRequested ||
              looksLikeNonRewardingAnswer(answerToPersist) ||
              (
                settledGuidance.clarificationCount >= 2 &&
                looksLikeNonRewardingAnswer(answerToPersist)
              );
            stageGuidance = {
              ...stageGuidance,
              [nextKey]: {
                ...getStageGuidance(
                  { ...state, stageGuidance } as DialogState,
                  nextKey,
                ),
                preface: shouldUseUnknownAdvancePreface
                  ? buildUnknownAnswerAdvancePreface(view)
                  : assist.reaction,
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

      await animateStateTransition(trimmed, nextStateWithAnswer, {
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

  const goDeepPick = async () => {
    const progress = recordDailyPracticeLineCompletion(
      buildDailyLineCompletionId(session.id, state),
      auth.user?.dailyPracticeMinutes ?? null,
    );
    if (progress.goalCompletedNow) {
      try {
        const streakReward = await awardDailyStreakForProgress(10);
        if (streakReward.awarded) {
          showCoinsRewardNotice(
            `+${streakReward.delta} монет • серия ${formatStreakLabel(streakReward.streak)}`,
          );
        }
      } catch (error) {
        console.error("Failed to award daily streak reward", error);
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

  const goSolve = async () => {
    const progress = recordDailyPracticeLineCompletion(
      buildDailyLineCompletionId(session.id, state),
      auth.user?.dailyPracticeMinutes ?? null,
    );
    if (progress.goalCompletedNow) {
      try {
        const streakReward = await awardDailyStreakForProgress(10);
        if (streakReward.awarded) {
          showCoinsRewardNotice(
            `+${streakReward.delta} монет • серия ${formatStreakLabel(streakReward.streak)}`,
          );
        }
      } catch (error) {
        console.error("Failed to award daily streak reward", error);
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
    startThoughtBranch(idea, {
      parentSubject: state.subject,
      parentScopeId: state.activeThoughtScopeId,
      source: "ideasModal",
    });
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
      const message = extractApiMessage(e) || "Не удалось добавить мысль";
      toast.error(message, {
        action: isSeeTokensExpiredError(e)
          ? {
              label: "Пополнить баланс",
              onClick: () => navigate("/subscription?topup=1"),
            }
          : undefined,
      });
    }
  };

  const closeIdeaEditor = () => {
    setIdeaEditorMode(null);
    setIdeaEditorDraft("");
    setIdeaEditorTarget(null);
  };

  const startThoughtBranch = (
    idea: string,
    options: {
      parentSubject: Subject;
      parentScopeId?: string;
      source: "deepPick" | "ideasModal";
    },
  ) => {
    const trimmed = idea.trim();
    if (!trimmed) return;

    const thoughtScopeId = createThoughtScopeId();

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
      thoughtScopeLinks: {
        ...(s.thoughtScopeLinks || {}),
        [thoughtScopeId]: {
          parentSubject: options.parentSubject,
          parentScopeId: options.parentScopeId,
          parentReason: trimmed,
        },
      },
      ideasPickReturn:
        options.source === "ideasModal"
          ? {
              coreStep: s.coreStep,
              solveStep: s.solveStep,
              subject: s.subject,
              thoughtScopeId: s.activeThoughtScopeId,
            }
          : s.ideasPickReturn,
    }));
    setIsIdeasModalOpen(false);
    setActiveIdeaMenu(null);
    setInputText("");
    setLastUserAnswer(null);
    setIsEditing(true);
  };

  const handleEditIdea = (idea: string, target: IdeaEditorTarget) => {
    setActiveIdeaMenu(null);
    setIdeaEditorMode("edit");
    setIdeaEditorDraft(idea);
    setIdeaEditorTarget(target);
  };

  const handleDeleteIdea = (target: Extract<IdeaEditorTarget, { type: "edit-reason" }>) => {
    setActiveIdeaMenu(null);
    const current = getReasonIdeas(
      getAnswerValue(state, target.answerKey, target.ownerScopeId) || "",
    );
    const updated = current.filter((_, index) => index !== target.index);
    const nextText = joinReasonDrafts(updated);
    const answerUpdate = setAnswerValue(
      state,
      target.answerKey,
      nextText,
      target.ownerScopeId,
    );

    setState((s) => ({
      ...s,
      importantText:
        target.answerKey === "core:situation:4" && s.subject === "situation"
          ? nextText
          : s.importantText,
      answers: answerUpdate.answers,
      thoughtScopes: answerUpdate.thoughtScopes,
    }));
  };

  const handleAppendIdea = (target: IdeaEditorTarget) => {
    setActiveIdeaMenu(null);
    setIdeaEditorMode("create");
    setIdeaEditorDraft("");
    setIdeaEditorTarget(target);
  };

  const submitIdeaEditor = () => {
    const next = ideaEditorDraft.trim();
    if (!next || !ideaEditorTarget) return;

    if (ideaEditorTarget.type === "append-reason") {
      const current = getReasonIdeas(
        getAnswerValue(
          state,
          ideaEditorTarget.answerKey,
          ideaEditorTarget.ownerScopeId,
        ) || "",
      );
      const updated = [...current, next];
      const nextText = joinReasonDrafts(updated);
      const answerUpdate = setAnswerValue(
        state,
        ideaEditorTarget.answerKey,
        nextText,
        ideaEditorTarget.ownerScopeId,
      );
      setState((s) => ({
        ...s,
        importantText:
          ideaEditorTarget.answerKey === "core:situation:4" &&
          s.subject === "situation"
            ? nextText
            : s.importantText,
        answers: answerUpdate.answers,
        thoughtScopes: answerUpdate.thoughtScopes,
      }));
      closeIdeaEditor();
      return;
    }

    if (ideaEditorTarget.type === "edit-root-thought") {
      const answerUpdate = setAnswerValue(
        state,
        ideaEditorTarget.answerKey,
        next,
        ideaEditorTarget.scopeId,
      );
      setState((s) => ({
        ...s,
        situationText:
          ideaEditorTarget.answerKey === "core:thought:3" &&
          s.activeThoughtScopeId === ideaEditorTarget.scopeId
            ? next
            : s.situationText,
        answers: answerUpdate.answers,
        thoughtScopes: answerUpdate.thoughtScopes,
      }));
      closeIdeaEditor();
      return;
    }

    const current = getReasonIdeas(
      getAnswerValue(
        state,
        ideaEditorTarget.answerKey,
        ideaEditorTarget.ownerScopeId,
      ) || "",
    );
    const updated = current.map((item, index) =>
      index === ideaEditorTarget.index ? next : item,
    );
    const nextText = joinReasonDrafts(updated);
    const answerUpdate = setAnswerValue(
      state,
      ideaEditorTarget.answerKey,
      nextText,
      ideaEditorTarget.ownerScopeId,
    );
    const nextThoughtScopes = { ...answerUpdate.thoughtScopes };
    const nextThoughtScopeLinks = { ...(state.thoughtScopeLinks || {}) };

    for (const scopeId of ideaEditorTarget.linkedScopeIds) {
      nextThoughtScopeLinks[scopeId] = {
        ...(nextThoughtScopeLinks[scopeId] || {
          parentSubject: ideaEditorTarget.ownerSubject,
          parentScopeId: ideaEditorTarget.ownerScopeId,
          parentReason: next,
        }),
        parentReason: next,
      };
      nextThoughtScopes[scopeId] = {
        ...(nextThoughtScopes[scopeId] || {}),
        "core:thought:3": next,
      };
    }

    setState((s) => ({
      ...s,
      situationText:
        ideaEditorTarget.linkedScopeIds.includes(s.activeThoughtScopeId || "")
          ? next
          : s.situationText,
      importantText:
        ideaEditorTarget.answerKey === "core:situation:4" &&
        s.subject === "situation"
          ? nextText
          : s.importantText,
      answers: answerUpdate.answers,
      thoughtScopes: nextThoughtScopes,
      thoughtScopeLinks: nextThoughtScopeLinks,
    }));
    closeIdeaEditor();
  };

  const selectMindMapNode = (action: MindMapNodeAction) => {
    startThoughtBranch(action.label, {
      parentSubject: action.parentSubject,
      parentScopeId: action.parentScopeId,
      source: "deepPick",
    });
  };

  const editMindMapNode = (action: MindMapNodeAction) => {
    if (action.type === "root-thought") {
      handleEditIdea(action.label, {
        type: "edit-root-thought",
        answerKey: action.answerKey,
        scopeId: action.scopeId,
      });
      return;
    }

    handleEditIdea(action.label, {
      type: "edit-reason",
      ownerSubject: action.ownerSubject,
      ownerScopeId: action.ownerScopeId,
      answerKey: action.answerKey,
      index: action.index,
      linkedScopeIds: action.linkedScopeIds,
    });
  };

  const deleteMindMapNode = (action: MindMapNodeAction) => {
    if (action.type !== "reason") return;
    handleDeleteIdea({
      type: "edit-reason",
      ownerSubject: action.ownerSubject,
      ownerScopeId: action.ownerScopeId,
      answerKey: action.answerKey,
      index: action.index,
      linkedScopeIds: action.linkedScopeIds,
    });
  };

  const renderMindMapNode = (node: MindMapNode, depth = 0) => {
    const isMenuOpen = activeIdeaMenu === node.key;
    const canOpenMenu = !!node.action;
    const reasonAction = node.action?.type === "reason" ? node.action : null;
    const canDelete =
      !!reasonAction && !node.activePath;

    return (
      <div
        key={node.key}
        className={`${styles.mindMapNodeGroup} ${
          depth === 0 ? styles.mindMapNodeGroupRoot : ""
        }`}
      >
        <div className={styles.mindMapNodeRow}>
          <button
            type="button"
            className={`${styles.mindMapNodeButton} ${
              node.kind === "situation"
                ? styles.mindMapSituation
                : node.kind === "thought"
                  ? styles.mindMapThought
                  : styles.mindMapIdea
            } ${node.activePath ? styles.mindMapNodeActive : ""}`}
            onClick={() =>
              canOpenMenu &&
              setActiveIdeaMenu((prev) => (prev === node.key ? null : node.key))
            }
            disabled={!canOpenMenu || isTransitioning}
          >
            <span className={styles.mindMapBadge}>{node.badge}</span>
            <span className={styles.mindMapLabel}>{node.label}</span>
          </button>

          {isMenuOpen && node.action && (
            <div className={styles.deepIdeaMenu}>
              <button
                type="button"
                className={styles.deepIdeaMenuItem}
                onClick={() => selectMindMapNode(node.action!)}
              >
                Выбрать эту мысль на разбор
              </button>
              <button
                type="button"
                className={styles.deepIdeaMenuItem}
                onClick={() => editMindMapNode(node.action!)}
              >
                Редактировать
              </button>
              {canDelete && (
                <button
                  type="button"
                  className={styles.deepIdeaMenuItem}
                  onClick={() => deleteMindMapNode(node.action!)}
                >
                  Удалить
                </button>
              )}
              {reasonAction && (
                <button
                  type="button"
                  className={styles.deepIdeaMenuItem}
                  onClick={() =>
                    handleAppendIdea({
                      type: "append-reason",
                      ownerSubject: reasonAction.ownerSubject,
                      ownerScopeId: reasonAction.ownerScopeId,
                      answerKey: reasonAction.answerKey,
                    })
                  }
                >
                  Добавить ещё одну мысль
                </button>
              )}
            </div>
          )}
        </div>

        {node.children.length > 0 && (
          <div className={styles.mindMapChildren}>
            {node.children.map((child) => renderMindMapNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
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

        {view.kind === "deepPick" && (
          <div className={styles.deepMindMap}>
            <p className={styles.deepMindMapHint}>
              Нажмите на ячейку, чтобы выбрать мысль на разбор, отредактировать
              её или удалить.
            </p>

            {deepMindMap.length > 0 ? (
              <div className={styles.deepMindMapTree}>
                {deepMindMap.map((node) => renderMindMapNode(node))}
              </div>
            ) : importantOptions.length > 0 ? (
              <div className={styles.deepIdeasList}>
                {importantOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.choiceButton} ${chatStyles.glassButton} ${styles.deepIdeaButton}`}
                    onClick={() =>
                      startThoughtBranch(opt, {
                        parentSubject: state.subject,
                        parentScopeId: state.activeThoughtScopeId,
                        source: "deepPick",
                      })
                    }
                    disabled={isTransitioning}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.deepMindMapFooter}>
              <Button
                type="button"
                variant="outline"
                className={chatStyles.glassButton}
                onClick={() =>
                  handleAppendIdea({
                    type: "append-reason",
                    ownerSubject: state.subject,
                    ownerScopeId: state.activeThoughtScopeId,
                    answerKey:
                      state.subject === "thought"
                        ? "core:thought:4"
                        : "core:situation:4",
                  })
                }
              >
                Добавить ещё одну мысль
              </Button>
            </div>
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
              disabled={!canDeepNow}
            >
              Продолжить разбор
            </Button>
            <Button
              className={`${styles.choiceButton} ${chatStyles.glassButton}`}
              variant="outline"
              onClick={() => void openFinishSession()}
            >
              Завершить сессию
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
            {canDeepNow ? (
              <Button
                className={`${styles.choiceButton} ${chatStyles.glassButton}`}
                variant="outline"
                onClick={goDeepPick}
              >
                Продолжить разбор
              </Button>
            ) : (
              <Button
                className={`${styles.choiceButton} ${chatStyles.glassButton}`}
                variant="outline"
                onClick={() => void openFinishSession()}
              >
                Закончить сессию
              </Button>
            )}
            <Button
              className={`${styles.choiceButton} ${chatStyles.glassButton}`}
              onClick={openAddToList}
            >
              Добавить мысль
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

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        sessionId={session.id}
        situationTitle={sanitizeThoughtValue(state.answers["core:situation:1"] || state.situationText)}
        thoughtTitle={sanitizeThoughtValue(
          getAnswerValue(state, "core:thought:3") ||
            state.answers["core:situation:3"] ||
            state.importantText,
        )}
      />

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
