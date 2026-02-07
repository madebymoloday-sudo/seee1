import { observer } from "mobx-react-lite";
import { Layout } from "@/components/layout/Layout";
import { User } from "lucide-react";
import { useAuthControllerGetMe } from "@/api/seee.swr";
import ProfileSection from "./components/ProfileSection";
import SecuritySettings from "./components/SecuritySettings";
import ReferralSystem from "./components/ReferralSystem";
import MyFeedback from "./components/MyFeedback";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CabinetPage = observer(() => {
  const { data: profile } = useAuthControllerGetMe();
  const navigate = useNavigate();

  const handleNeurocardClick = () => {
    navigate("/map");
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <User className="h-8 w-8" />
          Личный кабинет
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ProfileSection profile={profile} />
        </div>

        {/* Настройки безопасности */}
        <div className="mb-6">
          <SecuritySettings />
        </div>

        {/* Кнопки действий */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Button
            onClick={handleNeurocardClick}
            variant="outline"
            className="flex items-center gap-2"
          >
            <img
              src="/seee-logo-128.png"
              alt="Seee"
              className="h-5 w-5 rounded-full"
              draggable={false}
            />
            Нейрокарта
          </Button>
        </div>

        {/* Реферальная система */}
        <div className="mb-6">
          <ReferralSystem />
        </div>

        {/* Моя обратная связь */}
        <div className="mb-6">
          <MyFeedback />
        </div>
      </div>
    </Layout>
  );
});

export default CabinetPage;
