"use client";

import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** load 함수 참조가 바뀌면(useCallback deps) 다시 불러온다. reload()로 수동 재시도. */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    load(controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if ((error as Error).name === "AbortError") return;
        setState({ status: "error", message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." });
      });
    return () => controller.abort();
  }, [load, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
