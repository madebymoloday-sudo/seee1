import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MessageSquare } from "lucide-react";
import type { SessionResponseDto } from "@/api/schemas";

interface SessionCardProps {
  session: SessionResponseDto;
}

const SessionCard = observer(({ session }: SessionCardProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/sessions/${session.id}`);
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={handleClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {session.title || "Без названия"}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {new Date(session.createdAt).toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Создана {new Date(session.createdAt).toLocaleDateString("ru-RU")}
        </p>
      </CardContent>
    </Card>
  );
});

export default SessionCard;

