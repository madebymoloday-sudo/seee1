import { createBrowserRouter, Navigate } from "react-router-dom";
import type { ComponentType } from "react";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import HomePage from "../pages/HomePage";
import LandingPage from "../pages/LandingPage";
import { PublicRoute } from "./PublicRoute";
import OfferPage from "../pages/legal/OfferPage";
import PrivacyPolicyPage from "../pages/legal/PrivacyPolicyPage";
import RefundPolicyPage from "../pages/legal/RefundPolicyPage";
import PublicSubscriptionPage from "../pages/subscription/PublicSubscriptionPage";
import PaymentSuccessPage from "../pages/subscription/PaymentSuccessPage";
import TeamLoginPage from "../pages/team/TeamLoginPage";

const lazyPage = (load: () => Promise<{ default: ComponentType }>) =>
  async () => {
    const module = await load();
    return { Component: module.default };
  };

const lazyPublicPage = (load: () => Promise<{ default: ComponentType }>) =>
  async () => {
    const module = await load();
    const Page = module.default;
    return {
      Component: () => (
        <PublicRoute>
          <Page />
        </PublicRoute>
      ),
    };
  };

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
    lazy: lazyPage(() => import("../pages/people/InviteRedirectPage")),
  },
  {
    path: "/sessions",
    lazy: lazyPublicPage(() =>
      import("../pages/sessions/components/SessionsCollectionPage"),
    ),
  },
  {
    path: "/sessions/:id",
    lazy: lazyPublicPage(() => import("../pages/sessions/SessionPage")),
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
          lazy: lazyPage(() => import("../pages/sessions/WizardDemoPage")),
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
