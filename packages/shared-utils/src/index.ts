import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import type { ApiResponse, PaginationMeta } from '@qa-platform/shared-types';

// =============================================================================
// ID UTILITIES
// =============================================================================
export const generateId = (): string => uuidv4();

export const generateShortId = (): string => uuidv4().split('-')[0];

// =============================================================================
// DATE UTILITIES
// =============================================================================
export const formatDate = (date: Date | string, format = 'YYYY-MM-DD HH:mm:ss'): string =>
  dayjs(date).format(format);

export const timeAgo = (date: Date | string): string => {
  const diff = dayjs().diff(dayjs(date), 'second');
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const durationMs = (start: Date, end: Date): number =>
  dayjs(end).diff(dayjs(start), 'millisecond');

export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
};

// =============================================================================
// API RESPONSE HELPERS
// =============================================================================
export const successResponse = <T>(
  data: T,
  message?: string,
  meta?: PaginationMeta,
): ApiResponse<T> => ({
  success: true,
  data,
  message,
  meta,
});

export const errorResponse = (error: string): ApiResponse<never> => ({
  success: false,
  error,
});

export const paginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

// =============================================================================
// SCORE UTILITIES
// =============================================================================
export const calculateOverallScore = (scores: Record<string, number | undefined>): number => {
  const weights: Record<string, number> = {
    visual: 0.25,
    accessibility: 0.2,
    performance: 0.2,
    security: 0.2,
    codeQuality: 0.15,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const score = scores[key];
    if (score !== undefined) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
};

export const scoreToGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'E' => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'E';
};

export const scoreToColor = (score: number): string => {
  if (score >= 90) return '#22c55e';  // green
  if (score >= 70) return '#f59e0b';  // amber
  return '#ef4444';                    // red
};

// =============================================================================
// FIGMA UTILITIES
// =============================================================================
export const extractFigmaFileId = (figmaUrl: string): string | null => {
  const patterns = [
    /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/,
    /figma\.com\/proto\/([a-zA-Z0-9]+)/,
  ];
  for (const pattern of patterns) {
    const match = figmaUrl.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const figmaColorToHex = (color: {
  r: number;
  g: number;
  b: number;
  a?: number;
}): string => {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
};

export const figmaColorToRgba = (color: {
  r: number;
  g: number;
  b: number;
  a?: number;
}): string => {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a ?? 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const pxToRem = (px: number, base = 16): string => `${px / base}rem`;

export const normalizeName = (name: string): string =>
  name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const toPascalCase = (str: string): string =>
  str
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

export const toKebabCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();

export const toCamelCase = (str: string): string => {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

// =============================================================================
// RETRY UTILITY
// =============================================================================
export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(delay * attempt);
    }
  }
  throw new Error('Max retries exceeded');
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// VALIDATION
// =============================================================================
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isFigmaUrl = (url: string): boolean =>
  /^https:\/\/(www\.)?figma\.com\/(file|design|proto)\//.test(url);

export const sanitizeHtml = (html: string): string =>
  html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');

// =============================================================================
// CHUNK ARRAY
// =============================================================================
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const unique = <T>(array: T[]): T[] => Array.from(new Set(array));

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> =>
  array.reduce(
    (acc, item) => {
      const k = String(item[key]);
      acc[k] = acc[k] ? [...acc[k], item] : [item];
      return acc;
    },
    {} as Record<string, T[]>,
  );
