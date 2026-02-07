import { createBrowserRouter, Navigate } from "react-router-dom";
import CabinetPage from "../pages/cabinet/CabinetPage";
import JournalPage from "../pages/journal/JournalPage";
import MapPage from "../pages/map/MapPage";
import NeuroMapPage from "../pages/neuro/NeuroMapPage";
import PipelineBuilderPage from "../pages/pipeline-builder/PipelineBuilderPage";
import EntryGatePage from "../pages/EntryGatePage";
import SessionPage from "../pages/sessions/SessionPage";
import SessionsCollectionPage from "../pages/sessions/components/SessionsCollectionPage";
import WizardDemoPage from "../pages/sessions/WizardDemoPage";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Роутер для авторизованных пользователей
 */
export const protectedRouter = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <EntryGatePage />,
      },
      {
        path: "sessions/list",
        element: <SessionsCollectionPage />,
      },
      {
        path: "sessions/:id",
        element: <SessionPage />,
      },
      ...(import.meta.env.DEV
        ? [
            {
              path: "wizard-demo",
              element: <WizardDemoPage />,
            },
          ]
        : []),
      {
        path: "map",
        element: <MapPage />,
      },
      {
        path: "neuro",
        element: <NeuroMapPage />,
      },
      {
        path: "cabinet",
        element: <CabinetPage />,
      },
      {
        path: "journal",
        element: <JournalPage />,
      },
      {
        path: "pipeline-builder",
        element: <PipelineBuilderPage />,
      },
      {
        path: "pipeline-builder/:id",
        element: <PipelineBuilderPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />, // Fallback - будет редирект в ProtectedRoute
  },
]);
