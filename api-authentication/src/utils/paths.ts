import path from 'path';
import fs from 'fs';

/**
 * Resolves the path to openapi.yaml that works in both development and production.
 *
 * In development (ts-node): Files are in backend/src/, openapi.yaml is at backend/openapi.yaml
 * In production (compiled): Files are in dist/backend/, openapi.yaml is at dist/backend/openapi.yaml
 *
 * @param fromDir - The __dirname of the calling module
 * @returns Absolute path to openapi.yaml
 */
export function resolveOpenApiPath(fromDir: string): string {
  // Calculate how many levels up from src/ or the equivalent compiled location
  // For files in src/middleware/, we need to go up 2 levels in dev, 1 in prod
  // For files in src/, we need to go up 1 level in dev, 0 in prod

  // Try paths from most specific to least specific
  const possiblePaths = [
    path.join(fromDir, 'openapi.yaml'),           // Same directory (production root)
    path.join(fromDir, '..', 'openapi.yaml'),     // One level up
    path.join(fromDir, '..', '..', 'openapi.yaml'), // Two levels up (dev from middleware)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback: assume production structure
  // Find the dist/backend or backend root
  let current = fromDir;
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, 'openapi.yaml');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    current = path.dirname(current);
  }

  // Last resort: return the most likely production path
  return path.join(fromDir, 'openapi.yaml');
}
