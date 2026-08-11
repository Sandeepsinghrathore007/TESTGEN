import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

import { useRuntimePerformanceMode } from "@/hooks/useRuntimePerformanceMode";
import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";
import { NAV_ITEMS } from "@/constants/navigation";
import {
  APP_THEME_OPTIONS,
  BG,
  BORDER,
  SURFACE,
  THEME_STORAGE_KEY,
  applyAppTheme,
  readStoredAppThemeId,
} from "@/constants/theme";

const MOBILE_MEDIA_QUERY = "(max-width: 768px)";
const DEFAULT_PAGE = "tests";
const PAGE_HASHES = {
  tests: "#/tests",
  questionBank: "#/question-bank",
};
const PAGE_IDS = Object.keys(PAGE_HASHES);

const TestsPage = lazy(() => import("@/pages/TestsPage"));
const QuestionBankPage = lazy(() => import("@/pages/QuestionBankPage"));

function normalizePageHash(hashValue = "") {
  const hash = String(hashValue || "").trim().replace(/^#/, "");
  if (!hash || hash === "/") return "/tests";
  return hash.startsWith("/") ? hash : `/${hash}`;
}

function getPageHash(page) {
  return PAGE_HASHES[page] || PAGE_HASHES[DEFAULT_PAGE];
}

function readPageFromLocation() {
  if (typeof window === "undefined") return DEFAULT_PAGE;
  const normalizedHash = normalizePageHash(window.location.hash);
  const matchedPage = Object.entries(PAGE_HASHES).find(
    ([, hash]) => normalizePageHash(hash) === normalizedHash,
  );
  return matchedPage?.[0] || DEFAULT_PAGE;
}

function syncPageHash(page, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const nextHash = getPageHash(page);
  if (window.location.hash === nextHash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (replace) {
    window.history.replaceState(null, "", nextUrl);
    return;
  }
  window.location.hash = nextHash;
}

function PersistentPage({ active, mounted, children }) {
  if (!mounted && !active) return null;
  return (
    <div
      hidden={!active}
      aria-hidden={!active}
      style={{
        display: active ? "block" : "none",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function RouteFallback() {
  return <div style={{ padding: '24px', color: '#fff' }}>Loading...</div>;
}

export default function App() {
  const initialPage = readPageFromLocation();
  const [activePage, setActivePage] = useState(initialPage);
  const [mountedPages, setMountedPages] = useState(() => ({
    [initialPage]: true,
  }));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_MEDIA_QUERY).matches
      : false,
  );
  const [themeId, setThemeId] = useState(() => readStoredAppThemeId());
  const [installPending, setInstallPending] = useState(false);
  const [installNotice, setInstallNotice] = useState("");
  const { canInstall, installApp, lastOutcome } = usePWAInstallPrompt();
  const performanceMode = useRuntimePerformanceMode({
    mobile: isMobile,
    applyDocumentAttribute: true,
  });
  const contentScrollRef = useRef(null);

  const handlePageChange = useCallback((page, options = {}) => {
    const nextPage = PAGE_HASHES[page] ? page : DEFAULT_PAGE;
    setActivePage(nextPage);
    if (options.syncLocation !== false) {
      syncPageHash(nextPage, { replace: options.replaceHistory === true });
    }
    if (options.closeMobileNav !== false && isMobile) {
      setMobileNavOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncActivePageFromHash = () => {
      setActivePage(readPageFromLocation());
      setMobileNavOpen(false);
    };
    const currentPage = readPageFromLocation();
    if (window.location.hash !== getPageHash(currentPage)) {
      syncPageHash(currentPage, { replace: true });
    }
    window.addEventListener("hashchange", syncActivePageFromHash);
    return () => window.removeEventListener("hashchange", syncActivePageFromHash);
  }, []);

  useEffect(() => {
    setMountedPages((currentPages) =>
      currentPages[activePage]
        ? currentPages
        : { ...currentPages, [activePage]: true },
    );
  }, [activePage]);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activePage]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const syncIsMobile = (event) => setIsMobile(event.matches);
    syncIsMobile(mediaQuery);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncIsMobile);
      return () => mediaQuery.removeEventListener("change", syncIsMobile);
    }
    mediaQuery.addListener(syncIsMobile);
    return () => mediaQuery.removeListener(syncIsMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    applyAppTheme(themeId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    }
  }, [themeId]);

  useEffect(() => {
    if (!installNotice) return undefined;
    const timeoutId = window.setTimeout(() => setInstallNotice(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [installNotice]);

  const sidebarWidth = isMobile ? 0 : collapsed ? 68 : 228;

  const pageTitle = useMemo(
    () => NAV_ITEMS.find((item) => item.id === activePage)?.label ?? "LearnLedger",
    [activePage],
  );

  const handleMenuToggle = useCallback(() => {
    setMobileNavOpen((value) => !value);
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (installPending) return;
    setInstallPending(true);
    try {
      const result = await installApp();
      if (result.outcome === "accepted") setInstallNotice("Install prompt accepted.");
      else if (result.outcome === "dismissed") setInstallNotice("Install prompt dismissed.");
      else if (result.outcome === "unavailable") setInstallNotice("Install is not available on this browser yet.");
    } catch (error) {
      console.error("Failed to trigger install prompt:", error);
      setInstallNotice("Failed to open install prompt.");
    } finally {
      setInstallPending(false);
    }
  }, [installApp, installPending]);

  const renderPageContent = (page) => {
    if (page === "tests") return <TestsPage />;
    if (page === "questionBank") return <QuestionBankPage />;
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: BG }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileNavOpen}
        ultraLite={performanceMode.ultraLite}
        setMobileOpen={setMobileNavOpen}
        activePage={activePage}
        setActivePage={handlePageChange}
      />

      {isMobile && mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main
        style={{
          marginLeft: `${sidebarWidth}px`,
          transition: isMobile ? "none" : "margin-left 0.24s cubic-bezier(0.4,0,0.2,1)",
          flex: 1,
          height: "100vh",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <TopBar
          pageTitle={pageTitle}
          showMenuButton={isMobile}
          ultraLite={performanceMode.ultraLite}
          onMenuClick={handleMenuToggle}
          activeThemeId={themeId}
          themeOptions={APP_THEME_OPTIONS}
          onThemeChange={setThemeId}
          canInstall={canInstall}
          onInstallClick={handleInstallApp}
          isInstallPending={installPending}
        />

        <div
          ref={contentScrollRef}
          className="flex-1 min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-[30px] lg:py-[28px]"
          style={{
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {installNotice && (
            <div
              style={{
                border: "1px solid rgba(139,92,246,0.28)",
                background:
                  lastOutcome === "dismissed"
                    ? "rgba(245,158,11,0.08)"
                    : "rgba(139,92,246,0.08)",
                borderRadius: "10px",
                color: lastOutcome === "dismissed" ? "#fcd34d" : "#d7c8ff",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                padding: "9px 10px",
                marginBottom: "12px",
              }}
            >
              {installNotice}
            </div>
          )}

          {PAGE_IDS.map((pageId) => (
            <PersistentPage
              key={pageId}
              active={activePage === pageId}
              mounted={activePage === pageId || Boolean(mountedPages[pageId])}
            >
              <Suspense fallback={<RouteFallback />}>
                {renderPageContent(pageId)}
              </Suspense>
            </PersistentPage>
          ))}
        </div>
      </main>
    </div>
  );
}
