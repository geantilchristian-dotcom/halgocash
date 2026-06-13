import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
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
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://clerk.com",
          "*.clerk.accounts.dev",
          "*.halgocash.com",
          "https://challenges.cloudflare.com", // Clerk Turnstile bot-protection
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https:",
          "wss:",
          "https://challenges.cloudflare.com", // Clerk Turnstile
        ],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https:"],
        // Allow Cloudflare Turnstile iframe (Clerk CAPTCHA bot-protection)
        frameSrc: ["https://challenges.cloudflare.com"],
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

// ── Body parsing ──────────────────────────────────────────────────────────
// 10 MB to handle base64-encoded image uploads (banners, game covers, jackpot poster)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Session ───────────────────────────────────────────────────────────────
// Use PostgreSQL store in production so sessions survive restarts/hibernation.
// Falls back to MemoryStore in dev (no DATABASE_URL needed).
const PgSession = connectPgSimple(session);
const sessionStore = isProd && process.env["DATABASE_URL"]
  ? new PgSession({
      conString: process.env["DATABASE_URL"],
      tableName: "session",
      createTableIfMissing: true, // create if missing (safety net)
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
// publishableKeyFromHost resolves the correct key for the requesting hostname
// so the same server can serve multiple Clerk custom domains (e.g. halgocash.com
// and halgocash.replit.app both work with the one deployed binary).
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
    secretKey: process.env.CLERK_SECRET_KEY,
  })),
);

// ── Private-page cache control — prevents browser back-button data leak ───
// /vendor and /admin pages must never be stored in browser cache.
app.use(["/vendor", "/hx7721-admin"], (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ── Vendor session idle timeout (15 minutes) ──────────────────────────────
// If a vendor session has been inactive for >15 min, destroy it automatically.
// lastActivity is updated on every authenticated vendor API call.
const VENDOR_IDLE_MS = 15 * 60 * 1000;
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const sess = req.session as typeof req.session & { userId?: number; lastActivity?: number };
  if (sess.userId) {
    const now = Date.now();
    if (sess.lastActivity && now - sess.lastActivity > VENDOR_IDLE_MS) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
      return;
    }
    sess.lastActivity = now;
  }
  next();
});

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

  tryServeApp("/hx7721-admin", "artifacts/admin-app/dist/public");
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
  // Guard: headers may already be sent (e.g. streaming, sendFile mid-transfer)
  if (res.headersSent) return;
  const status = (err as NodeJS.ErrnoException & { status?: number }).status ?? 500;
  res.status(status).json({ error: isProd ? "Erreur serveur interne" : err.message });
});

export default app;
