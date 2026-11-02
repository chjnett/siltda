DELETE FROM documents WHERE project_id IN ('match-2607', 'match-2608');
DELETE FROM matches WHERE id IN ('match-2607', 'match-2608');
DELETE FROM listings WHERE id IN ('demand-dadaepo', 'demand-songjeong', 'demand-new-port-fill', 'demand-wetland');

UPDATE listings
SET material = '고함수비 실트·점토질 (세립분 85%)', updated_at = '2026-10-27T13:30:00.000Z'
WHERE id = 'supply-new-port';

UPDATE listings
SET material = '실트질 준설토 (세립분 74%)', updated_at = '2026-10-27T13:30:00.000Z'
WHERE id = 'supply-north-port';

INSERT INTO listings (id, kind, title, organization, location, volume, material, period, status, updated_at) VALUES
  ('demand-new-port-fill', 'demand', '부산신항 배후부지 관리형 매립 수요', '부산항만공사', '부산신항 배후부지', 158000, '세립질 수용 · 오염도/함수비 시험 필요', '2027.02–2027.05', 'matched', '2026-10-27T13:30:00.000Z'),
  ('demand-wetland', 'demand', '낙동강 하구 염습지 고도 보강 수요', '부산광역시 연안관리팀', '낙동강 하구', 72000, '세립질 수용 · 얇은층 살포 검토', '2027.04–2027.06', 'open', '2026-10-27T13:30:00.000Z'),
  ('demand-dadaepo', 'demand', '다대포 사질 해안 조건부 양빈 수요', '부산광역시 연안관리팀', '다대포', 32000, '모래 85% 이상 선별 물량만 허용', '2027.05–2027.06', 'open', '2026-10-27T13:30:00.000Z');

INSERT INTO matches (id, supply_id, demand_id, project_name, status, score, distance_km, matched_volume, assignee, updated_at) VALUES
  ('match-2607', 'supply-new-port', 'demand-new-port-fill', '부산신항 준설토 현장 내 순환 실증', 'quality', 93, 2.8, 158000, '박현우', '2026-10-27T13:30:00.000Z'),
  ('match-2608', 'supply-north-port', 'demand-wetland', '북항–낙동강 하구 습지 보강', 'review', 78, 11.2, 72000, '이수연', '2026-10-27T13:30:00.000Z');

INSERT INTO documents (id, name, category, size, project_id, uploaded_by, uploaded_at) VALUES
  ('doc-1', '부산신항_입도시험성적서.pdf', '시험성적서', 1840000, 'match-2607', '김해진', '2026-10-27T13:30:00.000Z'),
  ('doc-2', '부산신항_토양오염시험_검토서.pdf', '허가서', 920000, 'match-2607', '이수연', '2026-10-27T13:30:00.000Z');

UPDATE activities SET action = '토양오염 시험 검토 단계로 변경', target = '부산신항 준설토 현장 내 순환 실증' WHERE id = 'activity-1';
UPDATE activities SET target = '북항–낙동강 하구 습지 보강' WHERE id = 'activity-3';
UPDATE spatial_datasets SET name = 'busan_utilization_candidates.geojson', feature_count = 5 WHERE id = 'dataset-1';
UPDATE spatial_datasets SET name = 'new_port_demo_bathymetry.tif' WHERE id = 'dataset-2';
