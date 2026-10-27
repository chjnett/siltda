import { initialOperationsState, type OperationsDocument, type OperationsState, type SpatialDataset } from "./operationsDomain";

const STORAGE_KEY = "siltda-operations-v1";
const API_URL = process.env.NEXT_PUBLIC_SILTDA_OPERATIONS_API_URL?.replace(/\/$/, "");

export interface OperationsSnapshot {
  state: OperationsState;
  source: "cloud" | "local";
}

function cloneInitialState(): OperationsState {
  return JSON.parse(JSON.stringify(initialOperationsState)) as OperationsState;
}

export async function loadOperations(): Promise<OperationsSnapshot> {
  if (API_URL) {
    try {
      const response = await fetch(`${API_URL}/api/bootstrap`, { credentials: "include" });
      if (response.ok) return { state: await response.json() as OperationsState, source: "cloud" };
    } catch { /* use the local demo repository */ }
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return { state: cloneInitialState(), source: "local" };
  try {
    return { state: { ...cloneInitialState(), ...JSON.parse(stored) }, source: "local" };
  } catch {
    return { state: cloneInitialState(), source: "local" };
  }
}

export async function persistOperations(state: OperationsState, source: OperationsSnapshot["source"]): Promise<void> {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (source === "cloud" && API_URL) {
    const response = await fetch(`${API_URL}/api/snapshot`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!response.ok) throw new Error("운영 API 저장에 실패했습니다.");
  }
}

export function resetLocalOperations(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function uploadOperationsDocument(file: File, projectId: string, category: OperationsDocument["category"]): Promise<OperationsDocument | null> {
  if (!API_URL) return null;
  const response = await fetch(`${API_URL}/api/files/${encodeURIComponent(projectId)}/${encodeURIComponent(category)}/${encodeURIComponent(file.name)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error("R2 문서 업로드에 실패했습니다.");
  return await response.json() as OperationsDocument;
}

export async function uploadSpatialDataset(file: File, format: SpatialDataset["format"], featureCount?: number): Promise<SpatialDataset | null> {
  if (!API_URL) return null;
  const response = await fetch(`${API_URL}/api/spatial/${encodeURIComponent(format)}/${encodeURIComponent(file.name)}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "content-type": file.type || "application/octet-stream",
      ...(featureCount === undefined ? {} : { "x-feature-count": String(featureCount) }),
    },
    body: file,
  });
  if (!response.ok) throw new Error("R2 공간 데이터 업로드에 실패했습니다.");
  return await response.json() as SpatialDataset;
}
