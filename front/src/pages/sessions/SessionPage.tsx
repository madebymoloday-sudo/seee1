import { observer } from "mobx-react-lite";
import { useParams } from "react-router-dom";
import { useSessionsControllerGetSession } from "@/api/seee.swr";
import SessionHeader from "./components/SessionHeader";
import StepDialogWindow from "./components/StepDialogWindow";
import { Loader2 } from "lucide-react";

const SessionPage = observer(() => {
  const { id } = useParams<{ id: string }>();

  const { data: session, isLoading, error } = useSessionsControllerGetSession(
    id!,
    {
      swr: {
        enabled: !!id,
      },
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Загрузка сессии...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 dark:border-slate-700/50">
          <p className="text-gray-800 dark:text-gray-200 text-lg font-medium">
            {error ? "Ошибка загрузки сессии" : "Сессия не найдена"}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            {error ? "Попробуйте обновить страницу" : "Возможно, сессия была удалена"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <SessionHeader session={session} />
      <div className="flex-1 overflow-hidden">
        <StepDialogWindow session={session} />
      </div>
    </div>
  );
});

export default SessionPage;

