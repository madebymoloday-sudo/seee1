import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import BottomNavigation from "../sessions/components/BottomNavigation";
import type { SessionResponseDto } from "@/api/schemas";
import apiAgent from "@/lib/api";
import {
  extractApiMessage,
  isSeeTokensExpiredError,
  SEE_TOKENS_EXPIRED_MESSAGE,
} from "@/lib/subscription";
import { parseImportantOptions } from "@/lib/sessionUtils";
import {
  ChevronDown,
  ChevronRight,
  Map as MapIcon,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import styles from "./MapPage.module.css";

type MindNodeType = "SITUATION" | "EMOTION" | "THOUGHT" | "LEGACY";

type EventMapNodeDto = {
  id: string;
  userId: string;
  eventNumber?: number | null;
  event?: string | null;
  emotion?: string | null;
  idea?: string | null;
  rootBelief?: string | null;
  isCompleted: boolean;
  nodeType?: string;
  title?: string | null;
  description?: string | null;
  parentId?: string | null;
  level?: number;
  displayOrder?: number;
  sourceSessionId?: string | null;
  sourceThoughtScopeId?: string | null;
  isMuted?: boolean;
  metaJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type DialogState = {
  subject?: "situation" | "thought";
  situationText?: string;
  importantText?: string;
  answers?: Record<string, string>;
  thoughtScopes?: Record<string, Record<string, string>>;
  activeThoughtScopeId?: string;
  thoughtScopeLinks?: Record<
    string,
    {
      parentSubject: "situation" | "thought";
      parentScopeId?: string;
      parentReason: string;
    }
  >;
};

type MindNode = EventMapNodeDto & {
  resolvedType: MindNodeType;
  resolvedTitle: string;
  childCount: number;
  children: MindNode[];
};

type ModalState =
  | { type: "create-situation" }
  | { type: "edit-situation"; node: MindNode }
  | { type: "create-emotions"; parent: MindNode }
  | { type: "edit-emotion"; node: MindNode }
  | { type: "create-thoughts"; parent: MindNode }
  | { type: "edit-thought"; node: MindNode }
  | null;

const DEFAULT_EMOTION_FIELDS = 3;
const DEFAULT_THOUGHT_FIELDS = 1;
const THOUGHT_REWARD = 25;
const MIN_MAP_SCALE = 0.35;
const MAX_MAP_SCALE = 1.35;

function clampScale(value: number) {
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, value));
}

function normalizeText(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleForNode(node: EventMapNodeDto): string {
  return (
    node.title?.trim() ||
    node.idea?.trim() ||
    node.emotion?.trim() ||
    node.event?.trim() ||
    "Без названия"
  );
}

function levelForNode(node: EventMapNodeDto): number {
  if (typeof node.level === "number" && Number.isFinite(node.level)) {
    return node.level;
  }
  if (node.nodeType === "EMOTION") return 2;
  if (node.nodeType === "THOUGHT") return 3;
  return 1;
}

function sortNodes(nodes: EventMapNodeDto[]) {
  return [...nodes].sort((a, b) => {
    const orderDiff = (a.displayOrder || 0) - (b.displayOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function getThoughtScopeIds(state: DialogState) {
  return Object.keys(state.thoughtScopes || {});
}

function getCandidateThoughtScopeIds(state: DialogState, node: EventMapNodeDto) {
  const ids = new globalThis.Set<string>();
  if (node.sourceThoughtScopeId) ids.add(node.sourceThoughtScopeId);
  if (state.activeThoughtScopeId) ids.add(state.activeThoughtScopeId);

  const nodeTitle = normalizeText(titleForNode(node));
  for (const scopeId of getThoughtScopeIds(state)) {
    const scopeTitle = normalizeText(state.thoughtScopes?.[scopeId]?.["core:thought:3"]);
    if (scopeTitle && scopeTitle === nodeTitle) ids.add(scopeId);
  }

  for (const scopeId of getThoughtScopeIds(state)) {
    ids.add(scopeId);
  }

  return [...ids];
}

function getThoughtAnswer(
  state: DialogState,
  key: string,
  scopeId?: string | null,
) {
  if (key.startsWith("core:thought:")) {
    const resolvedScopeId = scopeId || state.activeThoughtScopeId || getThoughtScopeIds(state)[0];
    if (!resolvedScopeId) return "";
    return state.thoughtScopes?.[resolvedScopeId]?.[key] || "";
  }
  return state.answers?.[key] || "";
}

function getLinkedScopeIdsForReason(
  state: DialogState,
  ownerScopeId: string | undefined,
  reason: string,
) {
  const normalizedOwnerScopeId = ownerScopeId || "";
  return Object.entries(state.thoughtScopeLinks || {})
    .filter(([, link]) => {
      return (
        link.parentSubject === "thought" &&
        (link.parentScopeId || "") === normalizedOwnerScopeId &&
        normalizeText(link.parentReason) === normalizeText(reason)
      );
    })
    .map(([scopeId]) => scopeId);
}

function getReasonEntriesForNode(state: DialogState, node: EventMapNodeDto) {
  const entries: Array<{ reason: string; linkedScopeId: string | null; displayOrder: number }> = [];
  const seen = new globalThis.Set<string>();
  const ownerScopeIds = getCandidateThoughtScopeIds(state, node);

  ownerScopeIds.forEach((ownerScopeId) => {
    const reasons = parseImportantOptions(getThoughtAnswer(state, "core:thought:4", ownerScopeId));
    reasons.forEach((reason) => {
      const normalized = normalizeText(reason);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      entries.push({
        reason,
        linkedScopeId: getLinkedScopeIdsForReason(state, ownerScopeId, reason)[0] || null,
        displayOrder: entries.length,
      });
    });
  });

  return entries;
}

function toState(raw: unknown): DialogState | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as DialogState;
}

function asMindNode(node: EventMapNodeDto, children: MindNode[] = []): MindNode {
  return {
    ...node,
    resolvedType: ((node.nodeType || "LEGACY").toUpperCase() as MindNodeType) || "LEGACY",
    resolvedTitle: titleForNode(node),
    childCount: children.length,
    children,
  };
}

async function createThoughtSession(title: string) {
  const session = await apiAgent.post<{ title: string }, SessionResponseDto>("/sessions", {
    title: title.trim(),
  });
  await apiAgent.patch(`/sessions/${session.id}`, {
    title: title.trim(),
    sessionKind: "thought",
  });
  return session;
}

const MapPage = observer(() => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<EventMapNodeDto[]>([]);
  const [sessions, setSessions] = useState<SessionResponseDto[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [inspectedNode, setInspectedNode] = useState<MindNode | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [mapScale, setMapScale] = useState(1);
  const [situationTitle, setSituationTitle] = useState("");
  const [situationDescription, setSituationDescription] = useState("");
  const [emotionDrafts, setEmotionDrafts] = useState<string[]>(
    Array.from({ length: DEFAULT_EMOTION_FIELDS }, () => ""),
  );
  const [thoughtDrafts, setThoughtDrafts] = useState<string[]>(
    Array.from({ length: DEFAULT_THOUGHT_FIELDS }, () => ""),
  );
  const [thoughtHint, setThoughtHint] = useState("");
  const syncingRef = useRef(false);

  const showMapSaveError = (error: unknown, fallback: string) => {
    const message = isSeeTokensExpiredError(error)
      ? SEE_TOKENS_EXPIRED_MESSAGE
      : extractApiMessage(error) || fallback;
    toast.error(message, {
      action: isSeeTokensExpiredError(error)
        ? {
            label: "Пополнить баланс",
            onClick: () => navigate("/subscription?topup=1"),
          }
        : undefined,
    });
  };

  const fetchMap = async () => {
    setLoading(true);
    try {
      const [mapNodes, sessionItems] = await Promise.all([
        apiAgent.get<EventMapNodeDto[]>("/event-map"),
        apiAgent.get<SessionResponseDto[]>("/sessions"),
      ]);
      setNodes(sortNodes(mapNodes));
      setSessions(sessionItems);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить нейрокарту");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMap();
  }, []);

  const sessionById = useMemo(() => {
    return new globalThis.Map<string, SessionResponseDto>(
      sessions.map((session) => [session.id, session]),
    );
  }, [sessions]);

  const rawNodes = useMemo(() => {
    return nodes.filter((node) => {
      const type = (node.nodeType || "LEGACY").toUpperCase();
      return type === "SITUATION" || type === "EMOTION" || type === "THOUGHT";
    });
  }, [nodes]);

  const nodesByParent = useMemo(() => {
    const grouped = new globalThis.Map<string, EventMapNodeDto[]>();
    for (const node of rawNodes) {
      const key = node.parentId || "__root__";
      const current = grouped.get(key) || [];
      current.push(node);
      grouped.set(key, current);
    }
    for (const [key, value] of grouped) {
      grouped.set(key, sortNodes(value));
    }
    return grouped;
  }, [rawNodes]);

  const buildTree = (parentId?: string | null): MindNode[] => {
    const key = parentId || "__root__";
    const items = nodesByParent.get(key) || [];
    return items.map((node) => {
      const children = buildTree(node.id);
      return {
        ...node,
        resolvedType: ((node.nodeType || "LEGACY").toUpperCase() as MindNodeType) || "LEGACY",
        resolvedTitle: titleForNode(node),
        childCount: children.length,
        children,
      };
    });
  };

  const tree = useMemo(() => buildTree(null), [nodesByParent]);

  const treeNodeMap = useMemo(() => {
    const map = new globalThis.Map<string, MindNode>();
    const visit = (items: MindNode[]) => {
      for (const item of items) {
        map.set(item.id, item);
        visit(item.children);
      }
    };
    visit(tree);
    return map;
  }, [tree]);

  const getBranchIds = (nodeId: string): string[] => {
    const root = treeNodeMap.get(nodeId);
    if (!root) return [];
    const result: string[] = [];
    const walk = (node: MindNode) => {
      result.push(node.id);
      node.children.forEach(walk);
    };
    walk(root);
    return result;
  };

  const expandBranch = (nodeId: string) => {
    const branchIds = getBranchIds(nodeId);
    setExpanded((prev) => {
      const next = { ...prev };
      for (const id of branchIds) next[id] = true;
      return next;
    });
  };

  const collapseBranch = (nodeId: string) => {
    const branchIds = getBranchIds(nodeId);
    setExpanded((prev) => {
      const next = { ...prev };
      for (const id of branchIds) delete next[id];
      return next;
    });
  };

  useEffect(() => {
    if (syncingRef.current || rawNodes.length === 0 || sessions.length === 0) return;

    const syncDerivedThoughts = async () => {
      syncingRef.current = true;
      try {
        let changed = false;
        const currentNodes = sortNodes(nodes);
        const currentByParent = new Map<string, EventMapNodeDto[]>();
        for (const node of currentNodes) {
          const key = node.parentId || "__root__";
          const list = currentByParent.get(key) || [];
          list.push(node);
          currentByParent.set(key, list);
        }

        for (const node of currentNodes) {
          if ((node.nodeType || "").toUpperCase() !== "THOUGHT" || !node.sourceSessionId) continue;
          const session = sessionById.get(node.sourceSessionId);
          const state = toState(session?.dialogStateJson);
          if (!state) continue;

          const reasonEntries = getReasonEntriesForNode(state, node);
          if (reasonEntries.length === 0) continue;

          for (const entry of reasonEntries) {
            const reason = entry.reason;
            const siblings = currentByParent.get(node.id) || [];
            const existingChild = siblings.find(
              (item) =>
                (item.nodeType || "").toUpperCase() === "THOUGHT" &&
                normalizeText(titleForNode(item)) === normalizeText(reason),
            );
            if (existingChild) {
              if (
                entry.linkedScopeId &&
                (existingChild.sourceSessionId !== node.sourceSessionId ||
                  existingChild.sourceThoughtScopeId !== entry.linkedScopeId)
              ) {
                await apiAgent.patch(`/event-map/${existingChild.id}`, {
                  sourceSessionId: node.sourceSessionId,
                  sourceThoughtScopeId: entry.linkedScopeId,
                });
                changed = true;
              }
              continue;
            }

            const created = await apiAgent.post<CreateEventMapPayload, EventMapNodeDto>(
              "/event-map",
              {
                nodeType: "THOUGHT",
                title: reason,
                parentId: node.id,
                level: levelForNode(node) + 1,
                displayOrder: entry.displayOrder,
                sourceSessionId: entry.linkedScopeId ? node.sourceSessionId : null,
                sourceThoughtScopeId: entry.linkedScopeId,
                isMuted: false,
              },
            );
            currentNodes.push(created);
            const nextSiblings = currentByParent.get(node.id) || [];
            nextSiblings.push(created);
            currentByParent.set(node.id, nextSiblings);
            changed = true;
          }
        }

        if (changed) {
          await fetchMap();
        }
      } catch (error) {
        console.error(error);
      } finally {
        syncingRef.current = false;
      }
    };

    void syncDerivedThoughts();
  }, [nodes, rawNodes.length, sessionById, sessions.length]);

  const openCreateSituation = () => {
    setSituationTitle("");
    setSituationDescription("");
    setModal({ type: "create-situation" });
  };

  const openEditSituation = (node: MindNode) => {
    setSituationTitle(node.resolvedTitle);
    setSituationDescription(node.description || "");
    setModal({ type: "edit-situation", node });
  };

  const openCreateEmotions = (parent: MindNode) => {
    setEmotionDrafts(Array.from({ length: DEFAULT_EMOTION_FIELDS }, () => ""));
    setModal({ type: "create-emotions", parent });
  };

  const openEditEmotion = (node: MindNode) => {
    setEmotionDrafts([node.resolvedTitle]);
    setModal({ type: "edit-emotion", node });
  };

  const openCreateThoughts = (parent: MindNode) => {
    setThoughtDrafts(Array.from({ length: DEFAULT_THOUGHT_FIELDS }, () => ""));
    setThoughtHint("");
    setModal({ type: "create-thoughts", parent });
  };

  const openEditThought = (node: MindNode) => {
    setThoughtDrafts([node.resolvedTitle]);
    setThoughtHint("");
    setModal({ type: "edit-thought", node });
  };

  const closeModal = () => {
    setModal(null);
    setThoughtHint("");
  };

  const closeNodeDetails = () => {
    setInspectedNode(null);
  };

  const handleMapWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setMapScale((current) => clampScale(current - event.deltaY * 0.0015));
  };

  const zoomMap = (delta: number) => {
    setMapScale((current) => clampScale(Number((current + delta).toFixed(2))));
  };

  const submitSituation = async () => {
    const title = situationTitle.trim();
    if (!title) {
      toast.error("Введите название ситуации");
      return;
    }
    setSaving(true);
    try {
      if (modal?.type === "edit-situation") {
        await apiAgent.patch(`/event-map/${modal.node.id}`, {
          title,
          description: situationDescription.trim() || null,
          event: title,
          rootBelief: situationDescription.trim() || null,
        });
        closeModal();
        await fetchMap();
      } else {
        const created = await apiAgent.post<CreateEventMapPayload, EventMapNodeDto>("/event-map", {
          nodeType: "SITUATION",
          title,
          description: situationDescription.trim() || null,
          event: title,
          rootBelief: situationDescription.trim() || null,
          level: 1,
          displayOrder: tree.length,
        });
        await fetchMap();
        setExpanded((prev) => ({ ...prev, [created.id]: true }));
        setEmotionDrafts(Array.from({ length: DEFAULT_EMOTION_FIELDS }, () => ""));
        setModal({ type: "create-emotions", parent: asMindNode(created) });
        toast.success("Ситуация сохранена. Теперь добавьте эмоции к этой ситуации.");
      }
    } catch (error) {
      console.error(error);
      showMapSaveError(error, "Не удалось сохранить ситуацию");
    } finally {
      setSaving(false);
    }
  };

  const submitEmotions = async () => {
    const values = emotionDrafts.map((item) => item.trim()).filter(Boolean);
    if (values.length === 0 || modal?.type !== "create-emotions" && modal?.type !== "edit-emotion") {
      toast.error("Добавьте хотя бы одну эмоцию");
      return;
    }
    setSaving(true);
    try {
      if (modal.type === "edit-emotion") {
        const title = values[0];
        await apiAgent.patch(`/event-map/${modal.node.id}`, {
          title,
          emotion: title,
        });
        closeModal();
        await fetchMap();
      } else {
        const createdEmotions: EventMapNodeDto[] = [];
        for (let index = 0; index < values.length; index += 1) {
          const title = values[index];
          const created = await apiAgent.post<CreateEventMapPayload, EventMapNodeDto>("/event-map", {
            nodeType: "EMOTION",
            title,
            emotion: title,
            parentId: modal.parent.id,
            level: 2,
            displayOrder: index,
          });
          createdEmotions.push(created);
        }
        const firstEmotion = createdEmotions[0];
        await fetchMap();
        if (firstEmotion) {
          setExpanded((prev) => ({
            ...prev,
            [modal.parent.id]: true,
            [firstEmotion.id]: true,
          }));
          setThoughtDrafts(Array.from({ length: DEFAULT_THOUGHT_FIELDS }, () => ""));
          setThoughtHint("");
          setModal({ type: "create-thoughts", parent: asMindNode(firstEmotion) });
          toast.success(`Эмоции сохранены. Теперь добавьте мысль для эмоции «${firstEmotion.title || firstEmotion.emotion || "эмоция"}».`);
        } else {
          closeModal();
        }
      }
    } catch (error) {
      console.error(error);
      showMapSaveError(error, "Не удалось сохранить эмоции");
    } finally {
      setSaving(false);
    }
  };

  const submitThoughts = async () => {
    const values = thoughtDrafts.map((item) => item.trim()).filter(Boolean);
    if (values.length === 0 || modal?.type !== "create-thoughts" && modal?.type !== "edit-thought") {
      toast.error("Добавьте хотя бы одну мысль");
      return;
    }
    setSaving(true);
    try {
      if (modal.type === "edit-thought") {
        const nextTitle = values[0];
        await apiAgent.patch(`/event-map/${modal.node.id}`, {
          title: nextTitle,
          idea: nextTitle,
        });
        if (modal.node.sourceSessionId) {
          await apiAgent.patch(`/sessions/${modal.node.sourceSessionId}`, {
            title: nextTitle,
            sessionKind: "thought",
          });
        }
      } else {
        for (let index = 0; index < values.length; index += 1) {
          const title = values[index];
          await apiAgent.post<CreateEventMapPayload, EventMapNodeDto>("/event-map", {
            nodeType: "THOUGHT",
            title,
            idea: title,
            parentId: modal.parent.id,
            level: levelForNode(modal.parent) + 1,
            displayOrder: index,
            sourceSessionId: null,
            isMuted: false,
          });
        }
        setExpanded((prev) => ({ ...prev, [modal.parent.id]: true }));
      }
      closeModal();
      await fetchMap();
    } catch (error) {
      console.error(error);
      showMapSaveError(error, "Не удалось сохранить мысли");
    } finally {
      setSaving(false);
    }
  };

  const deleteNode = async (node: MindNode) => {
    setSaving(true);
    try {
      await apiAgent.delete(`/event-map/${node.id}`);
      if (node.sourceSessionId) {
        try {
          await apiAgent.delete(`/sessions/${node.sourceSessionId}`);
        } catch {
          // ignore session delete errors
        }
      }
      setActiveMenuId(null);
      await fetchMap();
    } catch (error) {
      console.error(error);
      toast.error("Не удалось удалить узел");
    } finally {
      setSaving(false);
    }
  };

  const toggleMuted = async (node: MindNode) => {
    try {
      await apiAgent.patch(`/event-map/${node.id}`, {
        isMuted: !node.isMuted,
      });
      await fetchMap();
    } catch (error) {
      console.error(error);
      toast.error("Не удалось обновить статус мысли");
    }
  };

  const openThoughtSession = async (node: MindNode) => {
    try {
      let sessionId = node.sourceSessionId || null;
      if (!sessionId) {
        const session = await createThoughtSession(node.resolvedTitle);
        sessionId = session.id;
        await apiAgent.patch(`/event-map/${node.id}`, {
          sourceSessionId: session.id,
        });
        await fetchMap();
      }
      navigate(`/sessions/${sessionId}`);
    } catch (error) {
      console.error(error);
      showMapSaveError(error, "Не удалось открыть разбор мысли");
    }
  };

  const requestThoughtHint = async () => {
    if (modal?.type !== "create-thoughts" || !modal.parent) return;
    const emotion = modal.parent.resolvedTitle;
    const situationNode = treeNodeMap.get(modal.parent.parentId || "");
    const situationText = [situationNode?.resolvedTitle, situationNode?.description]
      .filter(Boolean)
      .join(". ");
    try {
      const response = await apiAgent.post<{ situation: string; emotion: string }, { message: string }>(
        "/psychologist/neuro-hint",
        {
          situation: situationText || situationNode?.resolvedTitle || "",
          emotion,
        },
      );
      setThoughtHint(response.message);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Не удалось получить подсказку. Попробуйте описать мысль коротко и своими словами.";
      setThoughtHint(String(message));
    }
  };

  const renderMenu = (node: MindNode) => {
    const isOpen = activeMenuId === node.id;
    if (!isOpen) return null;

    const canExpand = node.childCount > 0;

    return (
      <div className={styles.nodeMenu}>
        {node.resolvedType === "THOUGHT" && (
          <>
            <button type="button" className={styles.nodeMenuItem} onClick={() => void openThoughtSession(node)}>
              Начать разбирать эту мысль
            </button>
            <button type="button" className={styles.nodeMenuItem} onClick={() => openCreateThoughts(node)}>
              Добавить ещё одну мысль
            </button>
            <button type="button" className={styles.nodeMenuItem} onClick={() => openEditThought(node)}>
              Редактировать
            </button>
          </>
        )}

        {node.resolvedType === "SITUATION" && (
          <>
            <button type="button" className={styles.nodeMenuItem} onClick={() => openEditSituation(node)}>
              Редактировать
            </button>
            <button type="button" className={styles.nodeMenuItem} onClick={() => openCreateEmotions(node)}>
              Добавить эмоции
            </button>
          </>
        )}

        {node.resolvedType === "EMOTION" && (
          <>
            <button type="button" className={styles.nodeMenuItem} onClick={() => openEditEmotion(node)}>
              Редактировать
            </button>
            <button type="button" className={styles.nodeMenuItem} onClick={() => openCreateThoughts(node)}>
              Добавить мысли
            </button>
          </>
        )}

        {canExpand && (
          <>
            <button type="button" className={styles.nodeMenuItem} onClick={() => expandBranch(node.id)}>
              Раскрыть всю цепочку полностью
            </button>
            <button type="button" className={styles.nodeMenuItem} onClick={() => collapseBranch(node.id)}>
              Свернуть ветку
            </button>
          </>
        )}

        {node.resolvedType === "THOUGHT" && (
          <button type="button" className={styles.nodeMenuItem} onClick={() => void toggleMuted(node)}>
            <span className={`${styles.statusDot} ${node.isMuted ? styles.statusDotActive : ""}`} />
            {node.isMuted ? "Эта мысль снова важна" : "Эта мысль больше не важна"}
          </button>
        )}

        <button type="button" className={`${styles.nodeMenuItem} ${styles.nodeMenuDanger}`} onClick={() => void deleteNode(node)}>
          Удалить
        </button>
      </div>
    );
  };

  const renderAddPlaceholder = (parent?: MindNode) => {
    const level = parent ? levelForNode(parent) + 1 : 1;
    const onClick = () => {
      if (!parent) {
        openCreateSituation();
        return;
      }
      if (parent.resolvedType === "SITUATION") {
        openCreateEmotions(parent);
        return;
      }
      if (parent.resolvedType === "EMOTION" || parent.resolvedType === "THOUGHT") {
        openCreateThoughts(parent);
      }
    };

    const label =
      level === 1
        ? "Добавить ситуацию"
        : level === 2
          ? "Добавить эмоцию"
          : "Добавить мысль";

    return (
      <li className={styles.treeNode}>
        <button type="button" className={styles.addCard} onClick={onClick}>
          <Plus className={styles.addIcon} />
          <span>{label}</span>
        </button>
      </li>
    );
  };

  const renderNode = (node: MindNode) => {
    const showChildren = !!expanded[node.id];
    return (
      <li key={node.id} className={styles.treeNode}>
        <div className={styles.nodeWrap}>
          <div
            className={`${styles.nodeCard} ${
              node.resolvedType === "SITUATION"
                ? styles.nodeSituation
                : node.resolvedType === "EMOTION"
                  ? styles.nodeEmotion
                  : styles.nodeThought
            } ${node.isMuted ? styles.nodeMuted : ""}`}
          >
            <button
              type="button"
              className={styles.nodeMain}
              onClick={() => setInspectedNode(node)}
            >
              <span className={styles.nodeTypeLabel}>
                {node.resolvedType === "SITUATION"
                  ? "Ситуация"
                  : node.resolvedType === "EMOTION"
                    ? "Эмоция"
                    : "Мысль"}
              </span>
              <span className={styles.nodeTitle}>{node.resolvedTitle}</span>
              {node.description ? (
                <span className={styles.nodeDescription}>{node.description}</span>
              ) : null}
              <span className={styles.nodeChildCount}>{node.childCount}</span>
              {node.resolvedType === "THOUGHT" && (
                <span className={styles.nodeCoins}>+{THOUGHT_REWARD} 🪙</span>
              )}
            </button>

            <div className={styles.nodeActions}>
              {node.childCount > 0 ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={showChildren ? "Свернуть ветку" : "Раскрыть всю ветку"}
                  onClick={() => {
                    if (showChildren) {
                      collapseBranch(node.id);
                    } else {
                      expandBranch(node.id);
                    }
                  }}
                >
                  {showChildren ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Действия с карточкой"
                onClick={() => setActiveMenuId((prev) => (prev === node.id ? null : node.id))}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
          {renderMenu(node)}
        </div>

        {showChildren ? (
          <ul className={styles.treeList}>
            {node.children.map(renderNode)}
            {renderAddPlaceholder(node)}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <MapIcon className={styles.titleIcon} />
              Нейрокарта
            </h1>
            <p className={styles.subtitle}>
              Ситуации, эмоции, мысли и цепочки разбора в одном дереве.
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.zoomControls} aria-label="Масштаб нейрокарты">
              <button type="button" className={styles.zoomButton} onClick={() => zoomMap(-0.1)}>
                −
              </button>
              <button type="button" className={styles.zoomValue} onClick={() => setMapScale(0.58)}>
                {Math.round(mapScale * 100)}%
              </button>
              <button type="button" className={styles.zoomButton} onClick={() => zoomMap(0.1)}>
                +
              </button>
            </div>
            <Button onClick={openCreateSituation} className={styles.primaryButton}>
              <Plus size={16} />
              Добавить ситуацию
            </Button>
          </div>
        </div>

        <div className={styles.canvas} onWheel={handleMapWheel}>
          {loading ? (
            <div className={styles.emptyState}>Загружаю нейрокарту...</div>
          ) : tree.length === 0 ? (
            <div className={styles.emptyState}>
              <button type="button" className={styles.emptyAddCard} onClick={openCreateSituation}>
                <Plus className={styles.addIcon} />
                <span>Добавить первую ситуацию</span>
              </button>
            </div>
          ) : (
            <div
              className={styles.scaledCanvas}
              style={{
                width: `${Math.max(100, 100 / mapScale)}%`,
                transform: `scale(${mapScale})`,
              }}
            >
              <ul className={styles.treeListRoot}>
                {tree.map(renderNode)}
                {renderAddPlaceholder()}
              </ul>
            </div>
          )}
        </div>
      </div>

      <BottomNavigation
        onCabinet={() => navigate("/cabinet")}
        onRating={() => navigate("/rating")}
        onMindMap={() => navigate("/map")}
      />

      {inspectedNode && (
        <div className={styles.modalOverlay} onClick={closeNodeDetails}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.modalClose} onClick={closeNodeDetails}>
              <X size={18} />
            </button>
            <h2 className={styles.modalTitle}>
              {inspectedNode.resolvedType === "SITUATION"
                ? "Ситуация"
                : inspectedNode.resolvedType === "EMOTION"
                  ? "Эмоция"
                  : "Мысль"}
            </h2>
            <div className={styles.modalBody}>
              <div className={styles.detailSection}>
                <div className={styles.detailLabel}>Название</div>
                <div className={styles.detailText}>{inspectedNode.resolvedTitle}</div>
              </div>
              {inspectedNode.description?.trim() ? (
                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Полный текст</div>
                  <div className={styles.detailText}>{inspectedNode.description}</div>
                </div>
              ) : null}
            </div>
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={closeNodeDetails}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.modalClose} onClick={closeModal}>
              <X size={18} />
            </button>

            {(modal.type === "create-situation" || modal.type === "edit-situation") && (
              <>
                <h2 className={styles.modalTitle}>
                  {modal.type === "create-situation" ? "Какая ситуация у вас произошла?" : "Редактировать ситуацию"}
                </h2>
                <div className={styles.modalBody}>
                  <label className={styles.fieldLabel}>
                    Название ситуации
                    <Input
                      value={situationTitle}
                      onChange={(event) => setSituationTitle(event.target.value)}
                      placeholder="Короткое название"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Описание ситуации
                    <Textarea
                      value={situationDescription}
                      onChange={(event) => setSituationDescription(event.target.value)}
                      placeholder="Опишите, что произошло"
                      rows={5}
                    />
                  </label>
                </div>
                <div className={styles.modalFooter}>
                  <Button variant="outline" onClick={closeModal}>
                    Отмена
                  </Button>
                  <Button onClick={() => void submitSituation()} disabled={saving}>
                    OK
                  </Button>
                </div>
              </>
            )}

            {(modal.type === "create-emotions" || modal.type === "edit-emotion") && (
              <>
                <h2 className={styles.modalTitle}>
                  Перечислите эмоции, которые вызывает эта ситуация
                </h2>
                <div className={styles.modalBody}>
                  {emotionDrafts.map((value, index) => (
                    <label key={`emotion-${index}`} className={styles.fieldLabel}>
                      Эмоция {index + 1}
                      <Input
                        value={value}
                        onChange={(event) =>
                          setEmotionDrafts((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? event.target.value : item,
                            ),
                          )
                        }
                        placeholder="Например: тревога"
                      />
                    </label>
                  ))}
                  {modal.type === "create-emotions" && (
                    <Button
                      variant="outline"
                      className={styles.secondaryAction}
                      onClick={() => setEmotionDrafts((prev) => [...prev, ""])}
                    >
                      Добавить ещё одну эмоцию
                    </Button>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <Button variant="outline" onClick={closeModal}>
                    Отмена
                  </Button>
                  <Button onClick={() => void submitEmotions()} disabled={saving}>
                    OK
                  </Button>
                </div>
              </>
            )}

            {(modal.type === "create-thoughts" || modal.type === "edit-thought") && (
              <>
                <h2 className={styles.modalTitle}>
                  {modal.type === "create-thoughts" && modal.parent.resolvedType === "EMOTION"
                    ? `Какая мысль у вас вызывает эмоцию «${modal.parent.resolvedTitle}»?`
                    : modal.type === "create-thoughts"
                      ? `Какая следующая мысль связана с «${modal.parent.resolvedTitle}»?`
                      : "Редактировать мысль"}
                </h2>
                <div className={styles.modalBody}>
                  {modal.type === "create-thoughts" && (
                    <Button
                      variant="outline"
                      className={styles.secondaryAction}
                      onClick={() => void requestThoughtHint()}
                    >
                      Не знаю, как ответить
                    </Button>
                  )}
                  {thoughtHint ? <div className={styles.hintBox}>{thoughtHint}</div> : null}
                  {thoughtDrafts.map((value, index) => (
                    <label key={`thought-${index}`} className={styles.fieldLabel}>
                      Мысль {index + 1}
                      <Textarea
                        value={value}
                        onChange={(event) =>
                          setThoughtDrafts((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? event.target.value : item,
                            ),
                          )
                        }
                        placeholder="Коротко сформулируйте мысль"
                        rows={3}
                      />
                    </label>
                  ))}
                  {modal.type === "create-thoughts" && (
                    <Button
                      variant="outline"
                      className={styles.secondaryAction}
                      onClick={() => setThoughtDrafts((prev) => [...prev, ""])}
                    >
                      Добавить ещё одну мысль
                    </Button>
                  )}
                </div>
                <div className={styles.modalFooter}>
                  <Button variant="outline" onClick={closeModal}>
                    Отмена
                  </Button>
                  <Button onClick={() => void submitThoughts()} disabled={saving}>
                    OK
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
});

type CreateEventMapPayload = {
  eventNumber?: number | null;
  event?: string | null;
  emotion?: string | null;
  idea?: string | null;
  rootBelief?: string | null;
  nodeType?: string;
  title?: string | null;
  description?: string | null;
  parentId?: string | null;
  level?: number;
  displayOrder?: number;
  sourceSessionId?: string | null;
  sourceThoughtScopeId?: string | null;
  isMuted?: boolean;
  metaJson?: Record<string, unknown> | null;
};

export default MapPage;
