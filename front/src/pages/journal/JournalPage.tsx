import { observer } from "mobx-react-lite";
import { Layout } from "@/components/layout/Layout";
import { BookOpen } from "lucide-react";
import JournalEntryList from "./components/JournalEntryList";
import InterestingThoughts from "./components/InterestingThoughts";
import JournalStats from "./components/JournalStats";

const JournalPage = observer(() => {
  // TODO: Добавить хуки для получения записей журнала и интересных мыслей, когда они будут доступны на бэкенде
  const entries: never[] = [];
  const thoughts: never[] = [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Журнал сессий
        </h1>

        <JournalStats entries={entries} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <JournalEntryList entries={entries} />
          <InterestingThoughts thoughts={thoughts} />
        </div>
      </div>
    </Layout>
  );
});

export default JournalPage;

