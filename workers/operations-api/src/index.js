const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = String(env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim());
  return allowed.includes(origin) ? {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,x-feature-count",
    "access-control-allow-methods": "GET,PUT,OPTIONS",
    "vary": "origin",
  } : {};
}

function responseJson(value, init = {}) {
  return Response.json(value, { ...init, headers: { ...jsonHeaders, ...(init.headers ?? {}) } });
}

async function requireUser(request, env) {
  if (env.API_ENABLED !== "true") {
    throw new HttpError(503, "운영 API는 Cloudflare Access 설정이 완료될 때까지 잠겨 있습니다.");
  }
  const email = request.headers.get("cf-access-authenticated-user-email");
  if (env.AUTH_MODE === "access" && !email) throw new HttpError(401, "Cloudflare Access 로그인이 필요합니다.");
  if (!email && env.AUTH_MODE !== "access") return { id: "user-admin", name: "Local admin", role: "admin" };
  const user = await env.DB.prepare("SELECT id, name, role FROM users WHERE email = ? AND active = 1").bind(email).first();
  if (!user) throw new HttpError(403, "등록된 운영 사용자가 아닙니다.");
  return user;
}

const rowMappers = {
  users: (row) => ({ id: row.id, name: row.name, organization: row.organization, role: row.role }),
  listings: (row) => ({ id: row.id, kind: row.kind, title: row.title, organization: row.organization, location: row.location, volume: row.volume, material: row.material, period: row.period, status: row.status, updatedAt: row.updated_at }),
  matches: (row) => ({ id: row.id, supplyId: row.supply_id, demandId: row.demand_id, projectName: row.project_name, status: row.status, score: row.score, distanceKm: row.distance_km, matchedVolume: row.matched_volume, assignee: row.assignee, updatedAt: row.updated_at }),
  documents: (row) => ({ id: row.id, name: row.name, category: row.category, size: row.size, projectId: row.project_id, uploadedBy: row.uploaded_by, uploadedAt: row.uploaded_at }),
  datasets: (row) => ({ id: row.id, name: row.name, format: row.format, featureCount: row.feature_count ?? undefined, size: row.size, status: row.status, uploadedAt: row.uploaded_at }),
  activities: (row) => ({ id: row.id, actor: row.actor, action: row.action, target: row.target, at: row.at }),
};

async function bootstrap(env) {
  const results = await env.DB.batch([
    env.DB.prepare("SELECT users.id, users.name, users.role, organizations.name AS organization FROM users JOIN organizations ON users.organization_id = organizations.id WHERE users.active = 1 ORDER BY users.name"),
    env.DB.prepare("SELECT * FROM listings ORDER BY updated_at DESC"),
    env.DB.prepare("SELECT * FROM matches ORDER BY updated_at DESC"),
    env.DB.prepare("SELECT * FROM documents ORDER BY uploaded_at DESC"),
    env.DB.prepare("SELECT * FROM activities ORDER BY at DESC LIMIT 200"),
    env.DB.prepare("SELECT * FROM spatial_datasets ORDER BY uploaded_at DESC"),
  ]);
  const keys = ["users", "listings", "matches", "documents", "activities", "datasets"];
  return Object.fromEntries(keys.map((key, index) => [key, results[index].results.map(rowMappers[key])]));
}

async function replaceSnapshot(request, env, user) {
  if (user.role !== "admin") throw new HttpError(403, "전체 운영 데이터 저장은 관리자만 수행할 수 있습니다.");
  const state = await request.json();
  const statements = [
    env.DB.prepare("DELETE FROM documents"),
    env.DB.prepare("DELETE FROM activities"),
    env.DB.prepare("DELETE FROM matches"),
    env.DB.prepare("DELETE FROM listings"),
    env.DB.prepare("DELETE FROM spatial_datasets"),
  ];
  for (const item of state.listings ?? []) statements.push(env.DB.prepare("INSERT INTO listings (id, kind, title, organization, location, volume, material, period, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(item.id, item.kind, item.title, item.organization, item.location, item.volume, item.material, item.period, item.status, item.updatedAt));
  for (const item of state.matches ?? []) statements.push(env.DB.prepare("INSERT INTO matches (id, supply_id, demand_id, project_name, status, score, distance_km, matched_volume, assignee, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(item.id, item.supplyId, item.demandId, item.projectName, item.status, item.score, item.distanceKm, item.matchedVolume, item.assignee, item.updatedAt));
  for (const item of state.documents ?? []) statements.push(env.DB.prepare("INSERT INTO documents (id, name, category, size, project_id, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(item.id, item.name, item.category, item.size, item.projectId, item.uploadedBy, item.uploadedAt));
  for (const item of state.activities ?? []) statements.push(env.DB.prepare("INSERT INTO activities (id, actor, action, target, at) VALUES (?, ?, ?, ?, ?)").bind(item.id, item.actor, item.action, item.target, item.at));
  for (const item of state.datasets ?? []) statements.push(env.DB.prepare("INSERT INTO spatial_datasets (id, name, format, feature_count, size, status, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(item.id, item.name, item.format, item.featureCount ?? null, item.size, item.status, item.uploadedAt));
  await env.DB.batch(statements);
  return { ok: true };
}

async function uploadFile(request, env, user, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const projectId = decodeURIComponent(parts[2] ?? "");
  const category = decodeURIComponent(parts[3] ?? "");
  const filename = decodeURIComponent(parts.slice(4).join("/"));
  if (!projectId || !category || !filename || filename.includes("..")) throw new HttpError(400, "파일 경로가 올바르지 않습니다.");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 50 * 1024 * 1024) throw new HttpError(413, "파일은 50MB 이하여야 합니다.");
  const id = crypto.randomUUID();
  const objectKey = `projects/${projectId}/${id}/${filename}`;
  const object = await env.BUCKET.put(objectKey, request.body, { httpMetadata: { contentType: request.headers.get("content-type") ?? "application/octet-stream" }, customMetadata: { uploadedBy: String(user.id), category } });
  const uploadedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO documents (id, name, category, size, project_id, object_key, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, filename, category, object.size, projectId, objectKey, user.name, uploadedAt),
    env.DB.prepare("INSERT INTO activities (id, actor, action, target, at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), user.name, `${category} 파일 업로드`, filename, uploadedAt),
  ]);
  return { id, name: filename, category, size: object.size, projectId, uploadedBy: user.name, uploadedAt };
}

async function uploadSpatial(request, env, user, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const format = decodeURIComponent(parts[2] ?? "");
  const filename = decodeURIComponent(parts.slice(3).join("/"));
  if (!format || !filename || filename.includes("..")) throw new HttpError(400, "공간 데이터 경로가 올바르지 않습니다.");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 250 * 1024 * 1024) throw new HttpError(413, "공간 데이터는 250MB 이하여야 합니다.");
  const id = crypto.randomUUID();
  const objectKey = `spatial/${id}/${filename}`;
  const object = await env.BUCKET.put(objectKey, request.body, { httpMetadata: { contentType: request.headers.get("content-type") ?? "application/octet-stream" }, customMetadata: { uploadedBy: String(user.id), format } });
  const uploadedAt = new Date().toISOString();
  const featureCountValue = request.headers.get("x-feature-count");
  const featureCount = featureCountValue === null ? null : Number(featureCountValue);
  const status = format === "GeoJSON" ? "validated" : "processing";
  await env.DB.batch([
    env.DB.prepare("INSERT INTO spatial_datasets (id, name, format, feature_count, size, status, object_key, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, filename, format, Number.isFinite(featureCount) ? featureCount : null, object.size, status, objectKey, uploadedAt),
    env.DB.prepare("INSERT INTO activities (id, actor, action, target, at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), user.name, `${format} 공간 데이터 업로드`, filename, uploadedAt),
  ]);
  return { id, name: filename, format, featureCount: Number.isFinite(featureCount) ? featureCount : undefined, size: object.size, status, uploadedAt };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      if (url.pathname === "/health") return responseJson({ ok: true, service: "siltda-operations-api" }, { headers: cors });
      const user = await requireUser(request, env);
      if (url.pathname === "/api/bootstrap" && request.method === "GET") return responseJson(await bootstrap(env), { headers: cors });
      if (url.pathname === "/api/snapshot" && request.method === "PUT") return responseJson(await replaceSnapshot(request, env, user), { headers: cors });
      if (url.pathname.startsWith("/api/files/") && request.method === "PUT") return responseJson(await uploadFile(request, env, user, url), { status: 201, headers: cors });
      if (url.pathname.startsWith("/api/spatial/") && request.method === "PUT") return responseJson(await uploadSpatial(request, env, user, url), { status: 201, headers: cors });
      throw new HttpError(404, "요청 경로를 찾을 수 없습니다.");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      return responseJson({ error: error instanceof Error ? error.message : "서버 오류" }, { status, headers: cors });
    }
  },
};
