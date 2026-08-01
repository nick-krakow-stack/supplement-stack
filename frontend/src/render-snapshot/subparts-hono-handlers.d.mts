export function fetchSubpartsHono(
  request: Request,
  env: Record<string, unknown>,
  executionContext: {
    passThroughOnException: () => void;
    props: Record<string, unknown>;
    waitUntil: (promise: Promise<unknown>) => void;
  },
): Promise<Response>;
