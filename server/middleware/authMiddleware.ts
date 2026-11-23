import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { memoryStore } from '../config/firebaseAdmin.js';

function resolveProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (parsed?.projectId) return String(parsed.projectId);
    }
  } catch {
    // ignore
  }
  return 'toolpotro-creators-network';
}

const projectId = resolveProjectId();
const adminApp = getApps().length > 0 ? getApp() : initializeApp({ projectId });
const adminAuth = getAuth(adminApp);

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

function isAdminEmail(email?: string): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  for (const adminEmail of memoryStore.adminEmails) {
    if (adminEmail.toLowerCase() === normalized) return true;
  }
  return normalized === 'anglaranni66@gmail.com';
}

async function verifyBearerToken(authHeader?: string): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;

  const decoded = await adminAuth.verifyIdToken(idToken);
  const email = (decoded.email || '').trim();
  const emailVerified = decoded.email_verified !== false;
  const isAdmin = emailVerified && isAdminEmail(email);

  return {
    uid: decoded.uid,
    email,
    name: String(decoded.name || email.split('@')[0] || 'Toolpotro Creator'),
    emailVerified,
    isAdmin,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = await verifyBearerToken(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({ error: 'অননুমোদিত প্রবেশ। অনুগ্রহ করে Google অ্যাকাউন্ট দিয়ে লগইন করুন।' });
    }
    if (!authUser.emailVerified) {
      return res.status(403).json({ error: 'আপনার ইমেইল ভেরিফাইড নয়। ভেরিফাইড Google অ্যাকাউন্ট দিয়ে লগইন করুন।' });
    }
    req.authUser = authUser;
    next();
  } catch (err: any) {
    console.warn('[AuthMiddleware] Invalid or expired token:', err?.message || err);
    return res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ বা অবৈধ টোকেন। দয়া করে আবার লগইন করুন।' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!req.authUser?.isAdmin) {
      return res.status(403).json({ error: 'অ্যাক্সেস নিষিদ্ধ। শুধুমাত্র অ্যাডমিন এই অংশটি ব্যবহার করতে পারবেন।' });
    }
    next();
  });
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authUser = await verifyBearerToken(req.headers.authorization);
    if (authUser) {
      req.authUser = authUser;
    }
  } catch {
    // Public/unauthenticated fallback for read-only campaign showcase
  }
  next();
}
