import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Layout } from "@/components/layout/Layout";
import { User, CreditCard, Network, MessageSquare, Brain } from "lucide-react";
import { useAuthControllerGetMe } from "@/api/seee.swr";
import ProfileSection from "./components/ProfileSection";
import SubscriptionSection from "./components/SubscriptionSection";
import TransactionsSection from "./components/TransactionsSection";
import SecuritySettings from "./components/SecuritySettings";
import ReferralSystem from "./components/ReferralSystem";
import MyFeedback from "./components/MyFeedback";
import SubscriptionModal from "@/components/subscription/SubscriptionModal";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CabinetPage = observer(() => {
  const { data: profile } = useAuthControllerGetMe();
  const navigate = useNavigate();
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const handleSubscriptionClick = () => {
    setIsSubscriptionModalOpen(true);
  };

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
          <SubscriptionSection />
        </div>

        {/* Настройки безопасности */}
        <div className="mb-6">
          <SecuritySettings />
        </div>

        {/* Кнопки действий */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Button
            onClick={handleSubscriptionClick}
            variant="outline"
            className="flex items-center gap-2"
          >
            <CreditCard className="h-5 w-5" />
            Подписка
          </Button>
          <Button
            onClick={handleNeurocardClick}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Brain className="h-5 w-5" />
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

        {/* Транзакции */}
        <div className="lg:col-span-2">
          <TransactionsSection />
        </div>

        <SubscriptionModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => setIsSubscriptionModalOpen(false)}
        />
      </div>
    </Layout>
  );
});

export default CabinetPage;
