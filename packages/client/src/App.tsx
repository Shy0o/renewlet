/**
 * SPA 路由表。
 *
 * 架构位置：只声明 URL 到页面组件的映射；页面组件按路由懒加载，
 * 受保护页面统一由 ProtectedRoute 延迟挂载，认证跳转、setup 可见性和缓存刷新继续由 AuthSync / 页面级 hook 处理。
 *
 * 注意： 新增公开页面时必须同步 `public-routes.ts`，否则刷新后会被客户端守卫带回登录页。
 */
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/protected-route";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Subscriptions = lazy(() => import("@/pages/subscriptions"));
const Calendar = lazy(() => import("@/pages/calendar"));
const Statistics = lazy(() => import("@/pages/statistics"));
const Settings = lazy(() => import("@/pages/settings"));
const Setup = lazy(() => import("@/pages/setup"));
const Login = lazy(() => import("@/pages/login"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const NotFound = lazy(() => import("@/pages/not-found"));

function RouteFallback() {
  return (
    <div className="app-page bg-background">
      <div className="h-16 border-b border-border bg-card/60" />
      <main className="app-main mx-auto max-w-7xl">
        <div className="mb-8 h-10 w-56 rounded-md bg-muted/60" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-lg border border-border bg-card/60" />
          ))}
        </div>
        <div className="mt-8 h-[55dvh] rounded-lg border border-border bg-card/50" />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
