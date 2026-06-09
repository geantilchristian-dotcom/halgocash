import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";

const isProd = process.env["NODE_ENV"] === "production";

const app: Express = express();

// ── Trust the reverse-proxy (Replit uses one) ──────────────────────────────
app.set("trust proxy", 1);

// ── Security headers (helmet) ─────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false, // Allow iframes in dev canvas
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://clerk.com", "*.clerk.accounts.dev", "*.halgocash.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https:"],
        frameSrc: ["'none'"],
      },
    },
  }),
);

// ── Logging ───────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Clerk proxy (must come before CORS / JSON parsing) ────────────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── CORS — restrict to known origins ─────────────────────────────────────
const allowedOrigins = [
  /\.replit\.app$/,
  /\.replit\.dev$/,
  /\.repl\.co$/,
  /\.onrender\.com$/,
  /halgocash\.com$/,
  /localhost/,
  /127\.0\.0\.1/,
];
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Replit preview)
      if (!origin) return callback(null, true);
      const ok = allowedOrigins.some((pattern) => pattern.test(origin));
      if (ok) return callback(null, true);
      logger.warn({ origin }, "CORS blocked request from unknown origin");
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// ── Body parsing — keep limits tight ──────────────────────────────────────
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));

// ── Session ───────────────────────────────────────────────────────────────
// Use PostgreSQL store in production so sessions survive restarts/hibernation.
// Falls back to MemoryStore in dev (no DATABASE_URL needed).
const PgSession = connectPgSimple(session);
const sessionStore = isProd && process.env["DATABASE_URL"]
  ? new PgSession({
      conString: process.env["DATABASE_URL"],
      tableName: "session",
      createTableIfMissing: false, // table created by migrate.ts
    })
  : undefined;

app.use(
  session({
    store: sessionStore,
    secret: process.env["SESSION_SECRET"] ?? "halgo-dev-secret",
    resave: false,
    saveUninitialized: false,
    name: "halgosid", // Don't expose default "connect.sid" name
    cookie: {
      httpOnly: true,
      secure: isProd,          // HTTPS-only in production
      sameSite: "lax",         // lax: works across same-site navigations & redirects
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }),
);

// ── Global rate limit (all /api routes) ───────────────────────────────────
// 300 requests per minute per IP — blocks basic scrapers/bots
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Trop de requêtes. Réessayez dans une minute." },
    skip: (req) => req.path === "/healthz",
  }),
);

// ── Clerk middleware ───────────────────────────────────────────────────────
app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    proxyUrl: isProd ? `https://halgocash.com${CLERK_PROXY_PATH}` : undefined,
  }),
);

// ── API routes ────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Static file serving for single-server deployments (e.g. Render) ──────
// On Replit each app runs its own dev server; dist/ only exists after build.
// Paths are served in order: specific sub-paths first, root (halgo) last.
{
  const root = process.cwd();

  function tryServeApp(basePath: string, distDir: string) {
    const absDir = path.join(root, distDir);
    if (!fs.existsSync(absDir)) return;
    logger.info({ basePath, absDir }, "Serving static app");
    app.use(basePath, express.static(absDir, { index: false }));
    // SPA fallback — all unmatched sub-routes return index.html
    app.use(basePath, (_req: Request, res: Response) => {
      res.sendFile(path.join(absDir, "index.html"));
    });
  }

  tryServeApp("/admin", "artifacts/admin-app/dist/public");
  tryServeApp("/vendor", "artifacts/vendor-app/dist/public");
  tryServeApp("/display", "artifacts/display-app/dist/public");

  // Root app (halgo-app) — must be registered last so /api and sub-paths match first
  const halgoDist = path.join(root, "artifacts/halgo-app/dist/public");
  if (fs.existsSync(halgoDist)) {
    logger.info({ halgoDist }, "Serving halgo-app at /");
    app.use(express.static(halgoDist, { index: false }));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(halgoDist, "index.html"));
    });
  }
}

// ── 404 handler (only reached when no dist/ folders exist) ────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route introuvable" });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  const status = (err as NodeJS.ErrnoException & { status?: number }).status ?? 500;
  res.status(status).json({ error: isProd ? "Erreur serveur interne" : err.message });
});

export default app;
