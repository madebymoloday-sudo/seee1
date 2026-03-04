import { observer } from "mobx-react-lite";
import { Layout } from "@/components/layout/Layout";
import { Map } from "lucide-react";
import { useEventMapControllerGetEventMap } from "@/api/seee.swr";
import EventMapTable from "./components/EventMapTable";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const MapPage = observer(() => {
  const navigate = useNavigate();
  const { data: eventMap, mutate: refetchMap } =
    useEventMapControllerGetEventMap();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-start sm:items-center justify-between gap-4 mb-6 flex-col sm:flex-row">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Map className="h-8 w-8" />
            Нейрокарта
          </h1>
          <Button onClick={() => navigate("/neuro?refill=1&new=1")}>
            Пополнить нейрокарту
          </Button>
        </div>

        <div>
          <EventMapTable events={eventMap || []} onRefresh={refetchMap} />
        </div>
      </div>
    </Layout>
  );
});

export default MapPage;

