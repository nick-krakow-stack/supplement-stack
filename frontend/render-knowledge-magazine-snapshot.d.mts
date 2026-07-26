export type ClosableViteServer = {
  close(): Promise<void>;
};

export function closeViteServer(vite: ClosableViteServer | null | undefined): Promise<void>;
export function main(): Promise<void>;
