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
      <div className="flex items-center justify-center h-screen" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 25%, #e9ecef 50%, #f8f9fa 75%, #ffffff 100%)'
      }}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-screen" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 25%, #e9ecef 50%, #f8f9fa 75%, #ffffff 100%)'
      }}>
        <div className="text-center">
          <p className="text-gray-800 text-lg">
            {error ? "Ошибка загрузки сессии" : "Сессия не найдена"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 25%, #e9ecef 50%, #f8f9fa 75%, #ffffff 100%)'
    }}>
      <SessionHeader session={session} />
      <div className="flex-1 overflow-hidden">
        <StepDialogWindow session={session} />
      </div>
    </div>
  );
});

export default SessionPage;

