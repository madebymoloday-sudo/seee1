import { observer } from "mobx-react-lite";
import { Layout } from "@/components/layout/Layout";
import { User } from "lucide-react";
import { useAuthControllerGetMe } from "@/api/seee.swr";
import ProfileSection from "./components/ProfileSection";
import SubscriptionSection from "./components/SubscriptionSection";
import TransactionsSection from "./components/TransactionsSection";

const CabinetPage = observer(() => {
  const { data: profile } = useAuthControllerGetMe();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <User className="h-8 w-8" />
          Профиль
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProfileSection profile={profile} />
          <SubscriptionSection />
          <div className="lg:col-span-2">
            <TransactionsSection />
          </div>
        </div>
      </div>
    </Layout>
  );
});

export default CabinetPage;
