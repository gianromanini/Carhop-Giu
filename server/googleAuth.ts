import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
// passport-apple does not publish TypeScript declarations.
// @ts-expect-error -- the runtime package is intentionally used without types
import { Strategy as AppleStrategy } from "passport-apple";
import session from "express-session";

// Extend Express.User to include our User type
declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      city?: string | null;
      state?: string | null;
      profileImageUrl?: string | null;
      isAdmin?: boolean | null;
      isHost?: boolean | null;
      pickupLocations?: string[] | null;
      createdAt?: Date | null;
      updatedAt?: Date | null;
    }
  }
}
import type { Express, RequestHandler } from "express";
import createMemoryStore from "memorystore";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const MemoryStore = createMemoryStore(session);
  const sessionStore = new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  });
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.warn("SESSION_SECRET not set. Using fallback for development only.");
  }
  
  return session({
    secret: sessionSecret || 'carhop-dev-secret-key-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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

async function upsertGoogleUser(profile: Profile): Promise<GoogleUser> {
  const email = profile.emails?.[0]?.value;
  if (!email) {
    throw new Error("Google account must have an email address");
  }
  
  const userData = {
    id: profile.id,
    email: email.toLowerCase().trim(),
    firstName: (profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User').trim(),
    lastName: (profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '').trim(),
    profileImageUrl: profile.photos?.[0]?.value || '',
  };
  
  await storage.upsertUser(userData);
  return userData;
}

async function upsertAppleUser(profile: any): Promise<GoogleUser> {
  const email = profile.email;
  if (!email) {
    throw new Error("Apple account must have an email address");
  }
  
  const name = profile.name || {};
  const userData = {
    id: profile.id,
    email: email.toLowerCase().trim(),
    firstName: (name.firstName || 'User').trim(),
    lastName: (name.lastName || '').trim(),
    profileImageUrl: '',
  };
  
  await storage.upsertUser(userData);
  return userData;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const googleClientID = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleKeyId = process.env.APPLE_KEY_ID;
  const applePrivateKey = process.env.APPLE_PRIVATE_KEY;
  
  const hasGoogle = googleClientID && googleClientSecret;
  const hasApple = appleTeamId && appleKeyId && applePrivateKey;
  
  if (!hasGoogle && !hasApple) {
    console.warn("No OAuth credentials configured. Authentication disabled.");
    console.warn("Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET for Google login or APPLE_TEAM_ID + APPLE_KEY_ID + APPLE_PRIVATE_KEY for Apple login.");
    
    app.get("/api/login", (_req, res) => {
      res.status(503).json({ 
        message: "Authentication not configured",
        hint: "Please configure OAuth credentials" 
      });
    });
    
    app.get("/api/logout", (_req, res) => {
      res.redirect("/");
    });
    
    return;
  }

  if (hasGoogle) {
    // Dynamic callback URL based on request host
    app.get("/api/auth/google", (req, res, next) => {
      const strategy = new GoogleStrategy(
        {
          clientID: googleClientID!,
          clientSecret: googleClientSecret!,
          callbackURL: `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
          scope: ["profile", "email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const user = await upsertGoogleUser(profile);
            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      );
      
      passport.use("google-dynamic", strategy);
      passport.authenticate("google-dynamic", {
        scope: ["profile", "email"],
        prompt: "select_account",
      })(req, res, next);
    });

    passport.use(new GoogleStrategy(
      {
        clientID: googleClientID!,
        clientSecret: googleClientSecret!,
        callbackURL: "/api/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await upsertGoogleUser(profile);
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    ));


    app.get("/api/auth/google/callback", 
      passport.authenticate("google", {
        failureRedirect: "/?error=auth_failed",
      }),
      (_req, res) => {
        res.redirect("/");
      }
    );
  }

  if (hasApple) {
    passport.use(new AppleStrategy(
      {
        teamID: appleTeamId!,
        keyID: appleKeyId!,
        privateKeyString: applePrivateKey!,
        callbackURL: "/api/auth/apple/callback",
        passReqToCallback: true,
      },
      async (_req: any, _accessToken: any, _refreshToken: any, profile: any, done: any) => {
        try {
          const user = await upsertAppleUser(profile);
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    ));

    app.get("/api/auth/apple", passport.authenticate("apple", {
      scope: ["email", "name"],
    }));

    app.post("/api/auth/apple/callback",
      passport.authenticate("apple", {
        failureRedirect: "/?error=auth_failed",
      }),
      (_req, res) => {
        res.redirect("/");
      }
    );
  }

  passport.serializeUser((user: Express.User, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: Express.User, done) => {
    done(null, user);
  });

  app.get("/api/login", (req, res) => {
    if (hasGoogle) {
      return passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account",
      })(req, res);
    } else if (hasApple) {
      return passport.authenticate("apple", {
        scope: ["email", "name"],
      })(req, res);
    }
    res.status(503).json({ message: "No authentication methods available" });
  });

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
  // Always allow the auth status check to pass so the app can load
  if (req.path === '/api/auth/user') {
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    return res.json(null);
  }

  if (req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
