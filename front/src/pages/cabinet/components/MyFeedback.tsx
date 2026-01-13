import { useState } from "react";
import { useSessions } from "@/hooks/useSessions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import styles from "./MyFeedback.module.css";

const MyFeedback = () => {
  const { sessions, isLoading } = useSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // TODO: Загрузить обратную связь для каждой сессии из API
  // Пока используем заглушку
  const sessionFeedbacks: Record<string, any> = {};

  const handleSessionClick = (sessionId: string) => {
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    } else {
      setSelectedSessionId(sessionId);
    }
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

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          У вас пока нет сессий с обратной связью
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
          {sessions.map((session) => {
            const feedback = sessionFeedbacks[session.id];
            const isExpanded = selectedSessionId === session.id;

            return (
              <div key={session.id} className={styles.sessionItem}>
                <button
                  onClick={() => handleSessionClick(session.id)}
                  className={styles.sessionButton}
                >
                  <span className={styles.sessionTitle}>
                    {session.title || "Без названия"}
                  </span>
                  <span className={styles.sessionArrow}>
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </button>

                {isExpanded && (
                  <div className={styles.feedbackContent}>
                    {feedback ? (
                      <div className={styles.feedbackAnswers}>
                        {/* TODO: Показать ответы на вопросы обратной связи */}
                        <p>Ответы на обратную связь будут здесь</p>
                      </div>
                    ) : (
                      <p className={styles.noFeedback}>
                        Обратная связь для этой сессии отсутствует
                      </p>
                    )}

                    {/* Цепочка ответов пользователя */}
                    <div className={styles.userMessages}>
                      <h4 className={styles.userMessagesTitle}>Ваши ответы по сессии:</h4>
                      {/* TODO: Загрузить и показать только ответы пользователя (не вопросы от приложения) */}
                      <p className={styles.comingSoon}>Функция будет добавлена</p>
                    </div>
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
