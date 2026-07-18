import { createBrowserRouter, Navigate } from "react-router-dom";
import type { ComponentType } from "react";
import EntryGatePage from "../pages/EntryGatePage";
import { ProtectedRoute } from "./ProtectedRoute";

const lazyPage = (load: () => Promise<{ default: ComponentType }>) =>
  async () => {
    const module = await load();
    return { Component: module.default };
  };

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
        path: "sessions",
        lazy: lazyPage(() =>
          import("../pages/sessions/components/SessionsCollectionPage"),
        ),
      },
      {
        path: "sessions/list",
        lazy: lazyPage(() =>
          import("../pages/sessions/components/SessionsCollectionPage"),
        ),
      },
      {
        path: "sessions/:id",
        lazy: lazyPage(() => import("../pages/sessions/SessionPage")),
      },
      ...(import.meta.env.DEV
        ? [
            {
              path: "wizard-demo",
              lazy: lazyPage(() =>
                import("../pages/sessions/WizardDemoPage"),
              ),
            },
          ]
        : []),
      {
        path: "map",
        lazy: lazyPage(() => import("../pages/map/MapPage")),
      },
      {
        path: "neuro",
        lazy: lazyPage(() => import("../pages/neuro/NeuroMapPage")),
      },
      {
        path: "cabinet",
        lazy: lazyPage(() => import("../pages/cabinet/CabinetPage")),
      },
      {
        path: "cabinet/founder",
        lazy: lazyPage(() => import("../pages/cabinet/ManagersPage")),
      },
      {
        path: "cabinet/managers",
        lazy: lazyPage(() => import("../pages/cabinet/ManagersPage")),
      },
      {
        path: "people",
        lazy: lazyPage(() => import("../pages/people/PeoplePage")),
      },
      {
        path: "invite/:chatId",
        lazy: lazyPage(() => import("../pages/people/InviteRedirectPage")),
      },
      {
        path: "rating",
        lazy: lazyPage(() => import("../pages/rating/RatingPage")),
      },
      {
        path: "subscription",
        lazy: lazyPage(() =>
          import("../pages/subscription/SubscriptionGatePage"),
        ),
      },
      {
        path: "journal",
        lazy: lazyPage(() => import("../pages/journal/JournalPage")),
      },
      {
        path: "pipeline-builder",
        lazy: lazyPage(() =>
          import("../pages/pipeline-builder/PipelineBuilderPage"),
        ),
      },
      {
        path: "pipeline-builder/:id",
        lazy: lazyPage(() =>
          import("../pages/pipeline-builder/PipelineBuilderPage"),
        ),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />, // Fallback - будет редирект в ProtectedRoute
  },
]);
