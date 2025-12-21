import { observer } from "mobx-react-lite";
import { Download, MapPin, MessageSquare, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import apiAgent from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { SessionResponseDto } from "@/api/schemas";
import { getAllPipelines } from "@/api/pipeline.api";
import { toast } from "sonner";

interface SessionHeaderProps {
  session: SessionResponseDto;
}

const SessionHeader = observer(({ session }: SessionHeaderProps) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const isAdmin = (auth.user as { role?: string } | null)?.role === 'admin';

  const handleDownloadDocument = async () => {
    try {
      const response = await apiAgent.get<{ document: string }>(
        `/sessions/${session.id}/document`
      );

      if (response.document) {
        const blob = new Blob([response.document], {
          type: "text/markdown;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `concept_map_${session.id}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        toast.info("Документ пока пуст. Продолжите диалог.");
      }
    } catch (error) {
      console.error("Ошибка загрузки документа:", error);
      toast.error("Ошибка загрузки документа");
    }
  };

  const handleAddToMap = async () => {
    if (
      !confirm(
        "Добавить эту сессию в нейрокарту? GPT проанализирует диалог и создаст записи."
      )
    ) {
      return;
    }

    try {
      await apiAgent.post(`/sessions/${session.id}/add-to-map`);
      toast.success("Сессия успешно добавлена в нейрокарту!");
      navigate("/map");
    } catch (error) {
      console.error("Ошибка добавления в нейрокарту:", error);
      toast.error("Ошибка добавления в нейрокарту");
    }
  };


  // Автоматическая установка дефолтной программы для не-админов
  useEffect(() => {
    const setupDefaultProgram = async () => {
      // Только для не-админов устанавливаем дефолтную программу автоматически
      if (isAdmin) return;

      try {
        // Загружаем пайплайны
        const pipelines = await getAllPipelines();

        // Получаем pipelineState для сессии
        let currentProgramName: string | undefined;
        let pipelineStateExists = false;
        try {
          const response = await apiAgent.get<{ programName?: string }>(
            `/sessions/${session.id}/pipeline-state`
          );
          currentProgramName = response?.programName;
          pipelineStateExists = true;
        } catch (error) {
          // Игнорируем ошибку, если pipelineState не существует
          pipelineStateExists = false;
        }

        // Ищем дефолтную программу
        const defaultPipeline = pipelines.find((p) => p.isDefault);
        if (defaultPipeline) {
          // Если pipelineState не существует или текущая программа не дефолтная, устанавливаем дефолтную
          if (!pipelineStateExists || currentProgramName !== defaultPipeline.name) {
            try {
              await apiAgent.patch(`/sessions/${session.id}/program`, {
                pipelineId: defaultPipeline.id,
              });
            } catch (error) {
              console.error("Ошибка установки дефолтной программы:", error);
            }
          }
        } else if (pipelines.length > 0) {
          // Если дефолтной нет, используем первую доступную
          const firstPipeline = pipelines[0];
          if (!pipelineStateExists || currentProgramName !== firstPipeline.name) {
            try {
              await apiAgent.patch(`/sessions/${session.id}/program`, {
                pipelineId: firstPipeline.id,
              });
            } catch (error) {
              console.error("Ошибка установки программы:", error);
            }
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки пайплайнов:", error);
      }
    };

    setupDefaultProgram();
  }, [session.id, isAdmin]);

  return (
    <div className="bg-white border-b p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="text-xl font-semibold">
            {session.title || "Без названия"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/pipeline-builder")}
              title="Редактировать программу"
            >
              <Settings className="h-4 w-4" strokeWidth={2} />
            </Button>
          )}
          <Button variant="outline" onClick={handleDownloadDocument}>
            <Download className="h-4 w-4 mr-2" />
            Скачать документ
          </Button>
          <Button variant="outline" onClick={handleAddToMap}>
            <MapPin className="h-4 w-4 mr-2" />
            Добавить в нейрокарту
          </Button>
        </div>
      </div>
    </div>
  );
});

export default SessionHeader;

