import { Button } from "@/components/ui/button";

interface MapTabsProps {
  activeTab: "map" | "before-after";
  onTabChange: (tab: "map" | "before-after") => void;
}

const MapTabs = ({ activeTab, onTabChange }: MapTabsProps) => {
  return (
    <div className="flex gap-2 mb-6 border-b">
      <Button
        variant={activeTab === "map" ? "default" : "ghost"}
        onClick={() => onTabChange("map")}
        className="rounded-b-none"
      >
        Карта событий
      </Button>
      <Button
        variant={activeTab === "before-after" ? "default" : "ghost"}
        onClick={() => onTabChange("before-after")}
        className="rounded-b-none"
      >
        До-После
      </Button>
    </div>
  );
};

export default MapTabs;

