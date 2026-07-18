import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, TouchEvent, WheelEvent } from "react";
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
import {
  ChevronDown,
  ChevronRight,
  Download,
  Map as MapIcon,
  Maximize2,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { parseImportantOptions } from "@/lib/sessionUtils";
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

type MindNode = EventMapNodeDto & {
  resolvedType: MindNodeType;
  resolvedTitle: string;
  childCount: number;
  children: MindNode[];
};

type ExportTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

type MapEdge = {
  id: string;
  path: string;
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
const MAX_MAP_SCALE = 1.5;

function clampScale(value: number) {
  return Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, value));
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

function asMindNode(node: EventMapNodeDto, children: MindNode[] = []): MindNode {
  return {
    ...node,
    resolvedType: ((node.nodeType || "LEGACY").toUpperCase() as MindNodeType) || "LEGACY",
    resolvedTitle: titleForNode(node),
    childCount: children.length,
    children,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function parseDialogState(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return asRecord(value);
}

function normalizeExportValue(value: unknown): string {
  return String(value ?? "").trim();
}

function getScopedAnswer(
  state: Record<string, unknown>,
  scope: Record<string, unknown> | null,
  key: string,
): string {
  const scoped = normalizeExportValue(scope?.[key]);
  if (scoped) return scoped;
  return normalizeExportValue(asRecord(state.answers)[key]);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableToHtml(table: ExportTable) {
  const headers = table.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const rows = table.rows
    .map((row) => (
      `<tr>${table.headers
        .map((_, index) => `<td>${escapeHtml(row[index] || "").replace(/\n/g, "<br>")}</td>`)
        .join("")}</tr>`
    ))
    .join("");

  return `
    <h2>${escapeHtml(table.title)}</h2>
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function downloadTablesAsXls(filename: string, tables: ExportTable[]) {
  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #111827; }
          h2 { margin: 18px 0 8px; font-size: 18px; }
          table { border-collapse: collapse; margin-bottom: 28px; }
          th, td { border: 1px solid #d9dde5; padding: 8px 10px; vertical-align: top; white-space: pre-wrap; mso-number-format: "\\@"; }
          th { background: #eef4ff; font-weight: 700; }
        </style>
      </head>
      <body>${tables.map(tableToHtml).join("")}</body>
    </html>`;
  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [inspectedNode, setInspectedNode] = useState<MindNode | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [mapScale, setMapScale] = useState(1);
  const [mapEdges, setMapEdges] = useState<MapEdge[]>([]);
  const [situationTitle, setSituationTitle] = useState("");
  const [situationDescription, setSituationDescription] = useState("");
  const [emotionDrafts, setEmotionDrafts] = useState<string[]>(
    Array.from({ length: DEFAULT_EMOTION_FIELDS }, () => ""),
  );
  const [thoughtDrafts, setThoughtDrafts] = useState<string[]>(
    Array.from({ length: DEFAULT_THOUGHT_FIELDS }, () => ""),
  );
  const [thoughtHint, setThoughtHint] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapContentRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

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
      const mapNodes = await apiAgent.get<EventMapNodeDto[]>("/event-map");
      setNodes(sortNodes(mapNodes));
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
      grouped.set(
        key,
        key === "__root__"
          ? [...value].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
          : sortNodes(value),
      );
    }
    return grouped;
  }, [rawNodes]);

  const tree = useMemo(() => {
    const buildTree = (parentId: string | null, path: Set<string>): MindNode[] => {
      const items = nodesByParent.get(parentId || "__root__") || [];
      return items.flatMap((node) => {
        if (path.has(node.id)) return [];
        const nextPath = new globalThis.Set(path);
        nextPath.add(node.id);
        const children = buildTree(node.id, nextPath);
        return [{
          ...node,
          resolvedType: ((node.nodeType || "LEGACY").toUpperCase() as MindNodeType) || "LEGACY",
          resolvedTitle: titleForNode(node),
          childCount: children.length,
          children,
        }];
      });
    };
    return buildTree(null, new globalThis.Set<string>());
  }, [nodesByParent]);

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

  useLayoutEffect(() => {
    const content = mapContentRef.current;
    if (!content) {
      setMapEdges([]);
      return;
    }

    let frame = 0;
    const updateEdges = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = Array.from(
          content.querySelectorAll<HTMLElement>("[data-map-node-id]"),
        );
        const cardsById = new globalThis.Map<string, HTMLElement>();
        for (const card of cards) {
          const nodeId = card.dataset.mapNodeId;
          if (nodeId) cardsById.set(nodeId, card);
        }

        const getPosition = (element: HTMLElement) => {
          let x = 0;
          let y = 0;
          let current: HTMLElement | null = element;
          while (current && current !== content) {
            x += current.offsetLeft;
            y += current.offsetTop;
            current = current.offsetParent as HTMLElement | null;
          }
          return { x, y };
        };

        const nextEdges: MapEdge[] = [];
        for (const child of cards) {
          const childId = child.dataset.mapNodeId;
          const parentId = child.dataset.mapParentId;
          if (!childId || !parentId) continue;
          const parent = cardsById.get(parentId);
          if (!parent) continue;

          const parentPosition = getPosition(parent);
          const childPosition = getPosition(child);
          const startX = parentPosition.x + parent.offsetWidth;
          const startY = parentPosition.y + parent.offsetHeight / 2;
          const endX = childPosition.x;
          const endY = childPosition.y + child.offsetHeight / 2;
          const distance = Math.max(44, (endX - startX) * 0.48);
          nextEdges.push({
            id: `${parentId}:${childId}`,
            path: `M ${startX} ${startY} C ${startX + distance} ${startY}, ${endX - distance} ${endY}, ${endX} ${endY}`,
          });
        }
        setMapEdges(nextEdges);
      });
    };

    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(content);
    for (const card of content.querySelectorAll<HTMLElement>("[data-map-node-id]")) {
      observer.observe(card);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [tree, expanded]);

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

  const fitMapToViewport = () => {
    const canvas = canvasRef.current;
    const content = mapContentRef.current;
    if (!canvas || !content) return;
    const availableWidth = Math.max(320, canvas.clientWidth - 32);
    const contentWidth = Math.max(1, content.scrollWidth);
    const overviewScale = Math.max(0.55, Math.min(1, availableWidth / contentWidth));
    setMapScale(clampScale(overviewScale));
    canvas.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  const getTouchDistance = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) return 0;
    const [first, second] = [event.touches[0], event.touches[1]];
    return Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    );
  };

  const handleMapTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const distance = getTouchDistance(event);
    if (distance > 0) {
      pinchRef.current = { distance, scale: mapScale };
    }
  };

  const handleMapTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!pinchRef.current || event.touches.length < 2) return;
    const distance = getTouchDistance(event);
    if (distance <= 0) return;
    event.preventDefault();
    setMapScale(
      clampScale(pinchRef.current.scale * (distance / pinchRef.current.distance)),
    );
  };

  const handleMapTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) {
      pinchRef.current = null;
    }
  };

  const buildNeuroMapExportTable = (): ExportTable => {
    type RowDraft = {
      situation: string;
      emotion: string;
      thoughts: string[];
    };

    const drafts: RowDraft[] = [];
    const visit = (node: MindNode, draft: RowDraft) => {
      const next: RowDraft = {
        situation: draft.situation,
        emotion: draft.emotion,
        thoughts: [...draft.thoughts],
      };

      if (node.resolvedType === "SITUATION") {
        next.situation = [node.resolvedTitle, node.description].filter(Boolean).join("\n");
      } else if (node.resolvedType === "EMOTION") {
        next.emotion = node.resolvedTitle;
      } else {
        next.thoughts.push(node.resolvedTitle);
      }

      if (node.children.length === 0) {
        drafts.push(next);
        return;
      }

      node.children.forEach((child) => visit(child, next));
    };

    tree.forEach((node) => visit(node, { situation: "", emotion: "", thoughts: [] }));

    const maxThoughtDepth = Math.max(
      6,
      ...drafts.map((draft) => draft.thoughts.length),
    );
    const headers = [
      "Ситуация",
      "Эмоции",
      ...Array.from({ length: maxThoughtDepth }, (_, index) => `Мысли ${index + 1} уровень`),
    ];
    const rows = drafts.length > 0
      ? drafts.map((draft) => [
          draft.situation,
          draft.emotion,
          ...Array.from({ length: maxThoughtDepth }, (_, index) => draft.thoughts[index] || ""),
        ])
      : [["", "", ...Array.from({ length: maxThoughtDepth }, () => "")]];

    return {
      title: "Нейрокарта",
      headers,
      rows,
    };
  };

  const buildSessionDetailsExportTable = (sessions: SessionResponseDto[]): ExportTable => {
    const rows: string[][] = [];
    let maxReasonCount = 4;

    for (const session of sessions) {
      const state = parseDialogState(session.dialogStateJson);
      const rootAnswers = asRecord(state.answers);
      const scopes = asRecord(state.thoughtScopes);
      const scopeEntries = Object.entries(scopes)
        .map(([scopeId, scopeRaw]) => [scopeId, asRecord(scopeRaw)] as const)
        .filter(([, scope]) => Object.keys(scope).length > 0);
      const normalizedScopes = scopeEntries.length > 0 ? scopeEntries : [["", null] as const];

      for (const [, scope] of normalizedScopes) {
        const title =
          getScopedAnswer(state, scope, "core:thought:3") ||
          normalizeExportValue(rootAnswers["core:situation:3"]) ||
          normalizeExportValue(session.title) ||
          "Без названия";
        const reasons = parseImportantOptions(
          getScopedAnswer(state, scope, "core:thought:4") ||
            normalizeExportValue(state.importantText) ||
            normalizeExportValue(rootAnswers["core:situation:4"]),
        );
        maxReasonCount = Math.max(maxReasonCount, reasons.length);

        rows.push([
          title,
          ...reasons,
          getScopedAnswer(state, scope, "core:thought:5") ||
            normalizeExportValue(rootAnswers["core:situation:5"]),
          getScopedAnswer(state, scope, "core:thought:6") ||
            normalizeExportValue(rootAnswers["core:situation:6"]),
          getScopedAnswer(state, scope, "core:thought:7") ||
            normalizeExportValue(rootAnswers["core:situation:7"]),
          getScopedAnswer(state, scope, "core:thought:8") ||
            normalizeExportValue(rootAnswers["core:situation:8"]),
          getScopedAnswer(state, scope, "core:thought:9") ||
            normalizeExportValue(rootAnswers["core:situation:9"]),
        ]);
      }
    }

    const headers = [
      "Название",
      ...Array.from({ length: maxReasonCount }, (_, index) => `почему это важно ${index + 1}`),
      "Владелец",
      "Эгоистичная цель",
      "Эмоциональные пос",
      "практические пос",
      "Вывод",
    ];
    const rowsWithAlignedReasons = rows.length > 0
      ? rows.map((row) => {
          const [title, ...tail] = row;
          const fixedTailCount = 5;
          const reasons = tail.slice(0, Math.max(0, tail.length - fixedTailCount));
          const fixed = tail.slice(-fixedTailCount);
          return [
            title,
            ...Array.from({ length: maxReasonCount }, (_, index) => reasons[index] || ""),
            ...fixed,
          ];
        })
      : [["", ...Array.from({ length: maxReasonCount + 5 }, () => "")]];

    return {
      title: "Сессии",
      headers,
      rows: rowsWithAlignedReasons,
    };
  };

  const exportNeuroMap = async () => {
    setExporting(true);
    try {
      const sessions = await apiAgent.get<SessionResponseDto[]>("/sessions");
      const date = new Date().toISOString().slice(0, 10);
      downloadTablesAsXls(`seee-neuro-map-${date}.xls`, [
        buildNeuroMapExportTable(),
        buildSessionDetailsExportTable(sessions),
      ]);
      toast.success("Таблица нейрокарты скачана");
    } catch (error) {
      console.error(error);
      toast.error("Не удалось скачать таблицу нейрокарты");
    } finally {
      setExporting(false);
    }
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
        for (const value of values) {
          const title = value;
          const created = await apiAgent.post<CreateEventMapPayload, EventMapNodeDto>("/event-map", {
            nodeType: "EMOTION",
            title,
            emotion: title,
            parentId: modal.parent.id,
            level: 2,
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
        for (const value of values) {
          const title = value;
          await apiAgent.post<CreateEventMapPayload, EventMapNodeDto>("/event-map", {
            nodeType: "THOUGHT",
            title,
            idea: title,
            parentId: modal.parent.id,
            level: levelForNode(modal.parent) + 1,
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
    const childCount = getBranchIds(node.id).length - 1;
    const details =
      childCount > 0
        ? ` Вместе с ней будет удалена вся вложенная ветка (${childCount} ${
            childCount === 1 ? "карточка" : "карточек"
          }).`
        : "";
    if (!window.confirm(`Удалить карточку «${node.resolvedTitle}»?${details}`)) {
      return;
    }
    setSaving(true);
    try {
      await apiAgent.delete(`/event-map/${node.id}`);
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
      const scopeQuery = node.sourceThoughtScopeId
        ? `?thoughtScope=${encodeURIComponent(node.sourceThoughtScopeId)}`
        : "";
      navigate(`/sessions/${sessionId}${scopeQuery}`);
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
    } catch (error: unknown) {
      const message =
        extractApiMessage(error) ||
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
            data-map-node-id={node.id}
            data-map-parent-id={node.parentId || undefined}
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
                  aria-label={showChildren ? "Скрыть следующий уровень" : "Показать следующий уровень"}
                  onClick={() => {
                    setExpanded((prev) => ({ ...prev, [node.id]: !showChildren }));
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
              <button
                type="button"
                className={styles.zoomValue}
                title="Вернуть масштаб 100%"
                onClick={() => setMapScale(1)}
              >
                {Math.round(mapScale * 100)}%
              </button>
              <button type="button" className={styles.zoomButton} onClick={() => zoomMap(0.1)}>
                +
              </button>
            </div>
            <button
              type="button"
              className={styles.fitButton}
              onClick={fitMapToViewport}
              title="Показать всю раскрытую карту"
            >
              <Maximize2 size={15} />
              Вписать
            </button>
            <Button
              variant="outline"
              onClick={() => void exportNeuroMap()}
              className={styles.primaryButton}
              disabled={exporting}
            >
              <Download size={16} />
              {exporting ? "Готовлю таблицу..." : "Скачать таблицу"}
            </Button>
            <Button onClick={openCreateSituation} className={styles.primaryButton}>
              <Plus size={16} />
              Добавить ситуацию
            </Button>
          </div>
        </div>

        <div
          ref={canvasRef}
          className={styles.canvas}
          onWheel={handleMapWheel}
          onTouchStart={handleMapTouchStart}
          onTouchMove={handleMapTouchMove}
          onTouchEnd={handleMapTouchEnd}
          onTouchCancel={handleMapTouchEnd}
        >
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
              ref={mapContentRef}
              className={styles.scaledCanvas}
              style={{ "--map-zoom": mapScale } as CSSProperties}
            >
              <svg
                className={styles.edgeLayer}
                aria-hidden="true"
                width="100%"
                height="100%"
              >
                {mapEdges.map((edge) => (
                  <path key={edge.id} d={edge.path} />
                ))}
              </svg>
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
