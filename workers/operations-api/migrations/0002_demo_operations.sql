INSERT INTO listings (id, kind, title, organization, location, volume, material, period, status, updated_at) VALUES
  ('supply-new-port', 'supply', '부산신항 항로 유지 준설토', '부산항만공사', '부산신항', 182000, '세립사 혼합 실트', '2026.12–2027.02', 'matched', '2026-10-27T10:00:00.000Z'),
  ('supply-north-port', 'supply', '부산항 북항 부두 전면 준설토', '부산항만공사', '부산항 북항', 96000, '중립사', '2027.01–2027.03', 'open', '2026-10-27T10:00:00.000Z'),
  ('demand-dadaepo', 'demand', '다대포 완충사구 복원 수요', '부산광역시 연안관리팀', '다대포', 151000, '요구 입도 0.12–0.48 mm', '2027.01–2027.04', 'matched', '2026-10-27T10:00:00.000Z'),
  ('demand-songjeong', 'demand', '송정 해빈 침식 복원 수요', '해운대구', '송정 해안', 123000, '요구 입도 0.25–0.62 mm', '2027.03–2027.06', 'open', '2026-10-27T10:00:00.000Z');

INSERT INTO matches (id, supply_id, demand_id, project_name, status, score, distance_km, matched_volume, assignee, updated_at) VALUES
  ('match-2607', 'supply-new-port', 'demand-dadaepo', '부산신항–다대포 순환 실증', 'quality', 96, 13.6, 151000, '박현우', '2026-10-27T10:00:00.000Z'),
  ('match-2608', 'supply-north-port', 'demand-songjeong', '북항–송정 연안 복원', 'review', 84, 18.4, 96000, '이수연', '2026-10-27T10:00:00.000Z');

INSERT INTO documents (id, name, category, size, project_id, uploaded_by, uploaded_at) VALUES
  ('doc-1', '부산신항_입도시험성적서.pdf', '시험성적서', 1840000, 'match-2607', '김해진', '2026-10-27T10:00:00.000Z'),
  ('doc-2', '다대포_복원사업_협의서.pdf', '허가서', 920000, 'match-2607', '이수연', '2026-10-27T10:00:00.000Z');

INSERT INTO spatial_datasets (id, name, format, feature_count, size, status, uploaded_at) VALUES
  ('dataset-1', 'busan_candidates.geojson', 'GeoJSON', 4, 42800, 'validated', '2026-10-27T10:00:00.000Z'),
  ('dataset-2', 'dadaepo_demo_bathymetry.tif', 'GeoTIFF', NULL, 12840000, 'metadata-only', '2026-10-27T10:00:00.000Z');

INSERT INTO activities (id, actor, action, target, at) VALUES
  ('activity-1', '박현우', '품질 검증 단계로 변경', '부산신항–다대포 순환 실증', '2026-10-27T10:00:00.000Z'),
  ('activity-2', '김해진', '시험성적서 등록', '부산신항 항로 유지 준설토', '2026-10-27T09:15:00.000Z'),
  ('activity-3', '이수연', '매칭 검토 요청', '북항–송정 연안 복원', '2026-10-26T16:40:00.000Z');
