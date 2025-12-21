/**
 * @deprecated Этот роутер устарел. Используйте publicRouter и protectedRouter из соответствующих файлов.
 * Оставлен для обратной совместимости.
 */
import { createBrowserRouter } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import CabinetPage from "../pages/cabinet/CabinetPage";
import JournalPage from "../pages/journal/JournalPage";
import MapPage from "../pages/map/MapPage";
import PipelineBuilderPage from "../pages/pipeline-builder/PipelineBuilderPage";
import SessionPage from "../pages/sessions/SessionPage";
import SessionsPage from "../pages/sessions/SessionsPage";
import SubscriptionPage from "../pages/subscription/SubscriptionPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { PublicRoute } from "./PublicRoute";
import { SubscriptionRoute } from "./SubscriptionRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: "/register",
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        path: "subscription",
        element: <SubscriptionPage />,
      },
      {
        element: <SubscriptionRoute />,
        children: [
          {
            index: true,
            element: <SessionsPage />,
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
    ],
  },
]);
