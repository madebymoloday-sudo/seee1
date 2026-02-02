import { observer } from "mobx-react-lite";
import SessionHeader from "./components/SessionHeader";
import StepDialogWindow from "./components/StepDialogWindow";
import type { SessionResponseDto } from "@/api/schemas";

const demoSession: SessionResponseDto = {
  id: "demo-session",
  userId: "demo-user",
  title: null,
  messageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const WizardDemoPage = observer(() => {
  return (
    <div
      className="flex flex-col h-screen"
      style={{
        background:
          "linear-gradient(135deg, #ffffff 0%, #f8f9fa 25%, #e9ecef 50%, #f8f9fa 75%, #ffffff 100%)",
      }}
    >
      <SessionHeader session={demoSession} />
      <div className="flex-1 overflow-hidden">
        <StepDialogWindow session={demoSession} />
      </div>
    </div>
  );
});

export default WizardDemoPage;

