import { Suspense } from "react";
import { HashRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { TOOLS } from "./tools/registry";

function ToolFallback() {
  return (
    <div className="py-16 text-center text-sm text-stone-500 dark:text-zinc-400">
      Loading tool…
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">
        Tool not found
      </h1>
      <p className="text-sm text-stone-600 dark:text-zinc-400">
        The page you requested does not exist.
      </p>
      <Link
        to="/"
        className="inline-flex items-center rounded-lg bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 transition-colors"
      >
        Back to All Tools
      </Link>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Layout>
          <Suspense fallback={<ToolFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              {TOOLS.map((tool) => {
                const ToolComponent = tool.component;
                return (
                  <Route
                    key={tool.id}
                    path={tool.path}
                    element={<ToolComponent />}
                  />
                );
              })}
              <Route
                path="/tools/emanation"
                element={<Navigate to="/tools/aoe" replace />}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
