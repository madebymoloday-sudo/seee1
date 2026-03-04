import { observer } from "mobx-react-lite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface JournalEntry {
  id: string;
  content: string;
  sessionId?: string;
  createdAt: string;
}

interface JournalEntryListProps {
  entries: JournalEntry[];
  onRefresh?: () => void; // Для будущего использования
}

const JournalEntryList = observer(
  ({ entries }: JournalEntryListProps) => {
    if (entries.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Нет записей в журнале
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Записи журнала</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  {new Date(entry.createdAt).toLocaleDateString("ru-RU", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="whitespace-pre-wrap">{entry.content}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export default JournalEntryList;

