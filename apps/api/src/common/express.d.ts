import type { AuthorizationContext } from "@tms/security";

declare global {
  namespace Express {
    interface Request {
      tmsContext?: AuthorizationContext;
    }
  }
}

export {};