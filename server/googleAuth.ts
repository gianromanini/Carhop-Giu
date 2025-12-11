import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import createMemoryStore from "memorystore";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const MemoryStore = createMemoryStore(session);
  const sessionStore = new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  });
  
  const sessionSecret = process.env.SESSION_SECRET || 'carhop-dev-secret-key-change-in-production';
  
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
}

async function upsertUser(profile: Profile): Promise<GoogleUser> {
  const userData = {
    id: profile.id,
    email: profile.emails?.[0]?.value || '',
    firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || '',
    lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
    profileImageUrl: profile.photos?.[0]?.value || '',
  };
  
  await storage.upsertUser(userData);
  return userData;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientID || !clientSecret) {
    console.warn("Google OAuth credentials not set. Authentication disabled.");
    console.warn("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google login.");
    
    app.get("/api/login", (_req, res) => {
      res.status(503).json({ 
        message: "Authentication not configured",
        hint: "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" 
      });
    });
    
    app.get("/api/logout", (_req, res) => {
      res.redirect("/");
    });
    
    return;
  }

  passport.use(new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL: "/api/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await upsertUser(profile);
        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    }
  ));

  passport.serializeUser((user: Express.User, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: Express.User, done) => {
    done(null, user);
  });

  app.get("/api/login", passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account", // This forces the account selection screen
  }));

  app.get("/api/auth/google/callback", 
    passport.authenticate("google", {
      failureRedirect: "/?error=auth_failed",
    }),
    (_req, res) => {
      res.redirect("/");
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
