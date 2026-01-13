import { createBrowserRouter, Navigate } from "react-router-dom";
import RegisterPage from "../pages/auth/RegisterPage";
import SessionsPage from "../pages/sessions/SessionsPage";
import SessionPage from "../pages/sessions/SessionPage";
import HomePage from "../pages/HomePage";
import { PublicRoute } from "./PublicRoute";

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
        <SessionsPage />
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
    path: "*",
    element: (
      <PublicRoute>
        <Navigate to="/" replace />
      </PublicRoute>
    ),
  },
]);
