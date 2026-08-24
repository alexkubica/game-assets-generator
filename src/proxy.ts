import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function equalSecret(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function readBasicCredentials(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const expectedUsername = process.env.APP_BASIC_AUTH_USERNAME;
  const expectedPassword = process.env.APP_BASIC_AUTH_PASSWORD;
  const hasCompleteConfiguration = Boolean(expectedUsername && expectedPassword);

  if (!hasCompleteConfiguration) {
    if (process.env.NODE_ENV !== "production" && !expectedUsername && !expectedPassword) {
      return NextResponse.next();
    }

    return new NextResponse("Application access is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const credentials = readBasicCredentials(request.headers.get("authorization"));
  if (
    credentials &&
    equalSecret(credentials.username, expectedUsername!) &&
    equalSecret(credentials.password, expectedPassword!)
  ) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Game Asset Generator", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
