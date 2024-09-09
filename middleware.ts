// middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // This protects all API routes and some other specific routes
    '/(api|trpc)(.*)',
  ],
};

