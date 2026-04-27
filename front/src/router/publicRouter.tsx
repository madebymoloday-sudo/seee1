import { createBrowserRouter, Navigate } from "react-router-dom";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import SessionPage from "../pages/sessions/SessionPage";
import WizardDemoPage from "../pages/sessions/WizardDemoPage";
import HomePage from "../pages/HomePage";
import LandingPage from "../pages/LandingPage";
import { PublicRoute } from "./PublicRoute";
import SessionsCollectionPage from "../pages/sessions/components/SessionsCollectionPage";
import OfferPage from "../pages/legal/OfferPage";
import PrivacyPolicyPage from "../pages/legal/PrivacyPolicyPage";
import RefundPolicyPage from "../pages/legal/RefundPolicyPage";
import PublicSubscriptionPage from "../pages/subscription/PublicSubscriptionPage";
import PaymentSuccessPage from "../pages/subscription/PaymentSuccessPage";
import TeamLoginPage from "../pages/team/TeamLoginPage";
import InviteRedirectPage from "../pages/people/InviteRedirectPage";

/**
 * Роутер для неавторизованных пользователей
 */
export const publicRouter = createBrowserRouter([
  {
    path: "/",
    element: (
      <PublicRoute>
        <LandingPage />
      </PublicRoute>
    ),
  },
  {
    path: "/login",
    element: (
      <PublicRoute>
        <HomePage />
      </PublicRoute>
    ),
  },
  {
    path: "/team-login",
    element: (
      <PublicRoute>
        <TeamLoginPage />
      </PublicRoute>
    ),
  },
  {
    path: "/invite/:chatId",
    element: <InviteRedirectPage />,
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
  {
    path: "/subscription",
    element: (
      <PublicRoute>
        <PublicSubscriptionPage />
      </PublicRoute>
    ),
  },
  {
    path: "/payment-success",
    element: (
      <PublicRoute>
        <PaymentSuccessPage />
      </PublicRoute>
    ),
  },
  {
    path: "/legal/offer",
    element: <OfferPage />,
  },
  {
    path: "/legal/privacy",
    element: <PrivacyPolicyPage />,
  },
  {
    path: "/legal/refund",
    element: <RefundPolicyPage />,
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
