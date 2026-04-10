import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import styles from "./MyFeedback.module.css";
import useSwr from "swr";
import apiAgent from "@/lib/api";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MyFeedback = () => {
  type FeedbackItem = {
    id: string;
    sessionId?: string | null;
    sessionTitle?: string | null;
    title?: string | null;
    description: string;
    emotionAfter?: string | null;
    createdAt: string;
    updatedAt: string;
  };

  const fetchMyFeedback = (url: string) => apiAgent.get<FeedbackItem[]>(url);

  const {
    data: feedbacks,
    isLoading,
    mutate,
  } = useSwr<FeedbackItem[]>("/feedback/my?sessionOnly=1", fetchMyFeedback);

  const items = useMemo(() => feedbacks ?? [], [feedbacks]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          Загрузка...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          У вас пока нет обратной связи
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Моя обратная связь</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={styles.sessionsList}>
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const displayTitle =
              item.title?.trim() ||
              item.sessionTitle?.trim() ||
              "Отзыв";

            return (
              <div key={item.id} className={styles.sessionItem}>
                <div className={styles.sessionRow}>
                  <button
                    onClick={() => handleToggle(item.id)}
                    className={styles.sessionButton}
                  >
                    <span className={styles.sessionTitle}>{displayTitle}</span>
                    <span className={styles.sessionArrow}>
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </button>

                  <button
                    className={styles.editButton}
                    title="Редактировать"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setExpandedId(item.id);
                      setEditingId(item.id);
                      setDraftTitle(item.title ?? "");
                      setDraftDescription(item.description ?? "");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className={styles.feedbackContent}>
                    {editingId === item.id ? (
                      <div className={styles.editForm}>
                        <div className={styles.editRow}>
                          <Input
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            placeholder="Название"
                            disabled={isSaving}
                          />
                        </div>
                        <div className={styles.editRow}>
                          <Textarea
                            value={draftDescription}
                            onChange={(e) => setDraftDescription(e.target.value)}
                            rows={6}
                            disabled={isSaving}
                          />
                        </div>
                        <div className={styles.editActions}>
                          <Button
                            onClick={async () => {
                              const nextTitle = draftTitle.trim();
                              const nextDescription = draftDescription.trim();
                              if (nextDescription.length < 3) {
                                toast.error(
                                  "Текст обратной связи должен быть не короче 3 символов"
                                );
                                return;
                              }

                              setIsSaving(true);
                              try {
                                await apiAgent.patch(`/feedback/${item.id}`, {
                                  title: nextTitle,
                                  description: nextDescription,
                                });
                                await mutate();
                                toast.success("Обратная связь обновлена");
                                setEditingId(null);
                              } catch {
                                toast.error("Не удалось сохранить изменения");
                              } finally {
                                setIsSaving(false);
                              }
                            }}
                            disabled={isSaving}
                            className={styles.iconButton}
                          >
                            <Check size={16} />
                            Сохранить
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            disabled={isSaving}
                            className={styles.iconButton}
                          >
                            <X size={16} />
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {item.emotionAfter ? (
                          <div className="mb-3 text-sm text-muted-foreground">
                            Эмоциональное состояние после сессии:{" "}
                            <span className="font-medium text-foreground">{item.emotionAfter}</span>
                          </div>
                        ) : null}
                        <pre className={styles.feedbackText}>{item.description}</pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default MyFeedback;
