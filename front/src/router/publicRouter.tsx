import { createBrowserRouter, Navigate } from "react-router-dom";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import SessionPage from "../pages/sessions/SessionPage";
import WizardDemoPage from "../pages/sessions/WizardDemoPage";
import HomePage from "../pages/HomePage";
import { PublicRoute } from "./PublicRoute";
import SessionsCollectionPage from "../pages/sessions/components/SessionsCollectionPage";

/**
 * Роутер для неавторизованных пользователей
 */
export const publicRouter = createBrowserRouter([
  {
    path: "/",
    element: (
      <PublicRoute>
        <HomePage />
      </PublicRoute>
    ),
  },
  {
    path: "/sessions",
    element: (
      <PublicRoute>
        <SessionsCollectionPage />
      </PublicRoute>
    ),
  },
  {
    path: "/sessions/:id",
    element: (
      <PublicRoute>
        <SessionPage />
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
    path: "/forgot-password",
    element: (
      <PublicRoute>
        <ForgotPasswordPage />
      </PublicRoute>
    ),
  },
  {
    path: "/reset-password",
    element: (
      <PublicRoute>
        <ResetPasswordPage />
      </PublicRoute>
    ),
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: "/wizard-demo",
          element: <WizardDemoPage />,
        },
      ]
    : []),
  {
    path: "*",
    element: (
      <PublicRoute>
        <Navigate to="/" replace />
      </PublicRoute>
    ),
  },
]);
