import { Card, CardContent } from "@/components/ui/card";

interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
}

interface JournalStatsProps {
  entries: JournalEntry[];
}

const JournalStats = ({ entries }: JournalStatsProps) => {
  const totalEntries = entries.length;
  const thisMonthEntries = entries.filter((entry) => {
    const entryDate = new Date(entry.createdAt);
    const now = new Date();
    return (
      entryDate.getMonth() === now.getMonth() &&
      entryDate.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold">{totalEntries}</div>
          <p className="text-xs text-muted-foreground">Всего записей</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold">{thisMonthEntries}</div>
          <p className="text-xs text-muted-foreground">Записей в этом месяце</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default JournalStats;

