import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Layout } from "@/components/layout/Layout";
import { Map } from "lucide-react";
import { useEventMapControllerGetEventMap } from "@/api/seee.swr";
import MapTabs from "./components/MapTabs";
import EventMapTable from "./components/EventMapTable";
import BeforeAfterTable from "./components/BeforeAfterTable";

const MapPage = observer(() => {
  const [activeTab, setActiveTab] = useState<"map" | "before-after">("map");
  const { data: eventMap, mutate: refetchMap } =
    useEventMapControllerGetEventMap();

  // TODO: Добавить хук для before-after, когда он будет доступен на бэкенде
  const beforeAfter: never[] = [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <Map className="h-8 w-8" />
          Карта не территория
        </h1>

        <MapTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "map" && (
          <div>
            <EventMapTable events={eventMap || []} onRefresh={refetchMap} />
          </div>
        )}

        {activeTab === "before-after" && (
          <div>
            <BeforeAfterTable items={beforeAfter} />
          </div>
        )}
      </div>
    </Layout>
  );
});

export default MapPage;

