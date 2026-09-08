import type { RouteHead } from './route-head-contract.mjs';

export type PublicShareStatus = 200 | 404 | 409 | 410 | 503;
export type ShareHeadInput = {
  status: PublicShareStatus | 'loading';
  title?: string;
  creatorName?: string;
  message?: string;
};
export function publicShareFailure(status: number, code?: unknown): { status: 404 | 409 | 410 | 503; message: string };
export function projectShareHead(share: ShareHeadInput, token?: string): { head: RouteHead; title: string; description: string };
