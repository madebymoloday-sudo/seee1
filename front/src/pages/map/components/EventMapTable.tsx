import { observer } from "mobx-react-lite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventMapResponseDto } from "@/api/schemas";

interface EventMapTableProps {
  events: EventMapResponseDto[];
  onRefresh?: () => void; // Для будущего использования
}

const EventMapTable = observer(({ events }: EventMapTableProps) => {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Нет записей в карте событий
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Карта событий</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>№</TableHead>
              <TableHead>Событие</TableHead>
              <TableHead>Эмоция</TableHead>
              <TableHead>Идея</TableHead>
              <TableHead>Корневое убеждение</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{event.eventNumber}</TableCell>
                <TableCell>{event.event}</TableCell>
                <TableCell>
                  <Badge variant="outline">{event.emotion}</Badge>
                </TableCell>
                <TableCell>{event.idea}</TableCell>
                <TableCell>{event.rootBelief || "-"}</TableCell>
                <TableCell>
                  <Badge variant={event.isCompleted ? "default" : "secondary"}>
                    {event.isCompleted ? "Завершено" : "В процессе"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});

export default EventMapTable;

