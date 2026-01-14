import { createBrowserRouter, Navigate } from "react-router-dom";
import CabinetPage from "../pages/cabinet/CabinetPage";
import JournalPage from "../pages/journal/JournalPage";
import MapPage from "../pages/map/MapPage";
import PipelineBuilderPage from "../pages/pipeline-builder/PipelineBuilderPage";
import SessionPage from "../pages/sessions/SessionPage";
import SessionsCollectionPage from "../pages/sessions/components/SessionsCollectionPage";
import SubscriptionSuccessPage from "../pages/subscription/SubscriptionSuccessPage";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * Роутер для авторизованных пользователей
 * Проверка подписки выполняется в ProtectedRoute
 */
export const protectedRouter = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        path: "subscription/success",
        element: <SubscriptionSuccessPage />,
      },
      {
        index: true,
        element: <SessionsCollectionPage />,
      },
      {
        path: "sessions/list",
        element: <SessionsCollectionPage />,
      },
      {
        path: "sessions/:id",
        element: <SessionPage />,
      },
      {
        path: "map",
        element: <MapPage />,
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
