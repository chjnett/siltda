"use client";

import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { candidates } from "@/lib/demoData";
import { centroid, createDeformationPrimitive, distanceKm } from "@/lib/geo";
import type { CandidateKind, CompareMode, Coordinate, ProjectState, StepId } from "@/lib/types";

type DrawTarget = "dredge" | "restore" | null;

interface Props {
  project: ProjectState;
  step: StepId;
  introActive: boolean;
  introPlaying: boolean;
  introRunId: number;
  compareMode: CompareMode;
  drawTarget: DrawTarget;
  satelliteVisible: boolean;
  candidatesVisible: boolean;
  flowVisible: boolean;
  volumeMarkersVisible: boolean;
  focusCandidateId: string | null;
  focusRequestId: number;
  onProjectChange: (next: ProjectState) => void;
  onSelectCandidate: (kind: CandidateKind, id: string) => void;
  onMapReady: (status: string) => void;
  onSceneReady: () => void;
  onIntroComplete: () => void;
}

declare global {
  interface Window { CESIUM_BASE_URL?: string; }
}

const VIEW_HEIGHTS: Record<StepId, number> = { 1: 46000, 2: 12500, 3: 12500 };

function pickCoordinate(viewer: Cesium.Viewer, screen: Cesium.Cartesian2): Coordinate | null {
  let position: Cesium.Cartesian3 | undefined;
  if (viewer.scene.pickPositionSupported) {
    try { position = viewer.scene.pickPosition(screen); } catch { position = undefined; }
  }
  if (!position) {
    const ray = viewer.camera.getPickRay(screen);
    if (ray) position = viewer.scene.globe.pick(ray, viewer.scene);
  }
  if (!position) position = viewer.camera.pickEllipsoid(screen) ?? undefined;
  if (!position) return null;
  const cartographic = Cesium.Cartographic.fromCartesian(position);
  return [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
}

function polygonHierarchy(points: Coordinate[]) {
  return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(points.flat()));
}

export default function CesiumScene(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const projectRef = useRef(props.project);
  const drawTargetRef = useRef<DrawTarget>(props.drawTarget);
  const onProjectChangeRef = useRef(props.onProjectChange);
  const onSelectCandidateRef = useRef(props.onSelectCandidate);
  const satelliteLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const candidateEntitiesRef = useRef<Cesium.Entity[]>([]);
  const operationsEntitiesRef = useRef<Cesium.Entity[]>([]);
  const draftEntitiesRef = useRef<Cesium.Entity[]>([]);
  const deformationRef = useRef<{ dredge?: Cesium.Primitive; restore?: Cesium.Primitive }>({});
  const cameraByStepRef = useRef(new Map<StepId, { destination: Cesium.Cartesian3; orientation: { heading: number; pitch: number; roll: number } }>());
  const previousStepRef = useRef<StepId>(props.step);
  const previousIntroActiveRef = useRef(true);
  const [ready, setReady] = useState(false);

  useEffect(() => { projectRef.current = props.project; }, [props.project]);
  useEffect(() => { drawTargetRef.current = props.drawTarget; }, [props.drawTarget]);
  useEffect(() => { onProjectChangeRef.current = props.onProjectChange; }, [props.onProjectChange]);
  useEffect(() => { onSelectCandidateRef.current = props.onSelectCandidate; }, [props.onSelectCandidate]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    let cancelled = false;
    window.CESIUM_BASE_URL = "/cesium";

    const initialize = async () => {
      const viewer = new Cesium.Viewer(containerRef.current!, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        selectionIndicator: false,
        infoBox: false,
        baseLayer: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        requestRenderMode: false,
        msaaSamples: 4,
      });
      if (cancelled) { viewer.destroy(); return; }
      viewerRef.current = viewer;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.highDynamicRange = true;
      viewer.scene.globe.maximumScreenSpaceError = 1.25;
      viewer.scene.globe.tileCacheSize = 512;
      viewer.scene.globe.preloadAncestors = true;
      viewer.scene.globe.preloadSiblings = true;
      viewer.resolutionScale = Math.min(window.devicePixelRatio, 2);
      viewer.camera.percentageChanged = 0.01;

      try {
        const local = await Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
        );
        viewer.imageryLayers.addImageryProvider(local);
      } catch (error) {
        console.warn("Local Cesium imagery fallback unavailable", error);
      }

      try {
        const satellite = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
          { enablePickFeatures: false },
        );
        if (!viewer.isDestroyed()) {
          satelliteLayerRef.current = viewer.imageryLayers.addImageryProvider(satellite);
          satelliteLayerRef.current.show = props.satelliteVisible;
          props.onMapReady("Esri 위성영상 · 로컬 지구본 대체 경로 활성");
        }
      } catch {
        props.onMapReady("키 없는 로컬 지구본 모드");
      }

      const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN?.trim();
      if (ionToken) {
        try {
          Cesium.Ion.defaultAccessToken = ionToken;
          const terrain = await Cesium.createWorldTerrainAsync({ requestVertexNormals: true });
          if (!viewer.isDestroyed()) viewer.terrainProvider = terrain;
        } catch (error) {
          console.warn("Cesium World Terrain fallback to ellipsoid", error);
        }
      }

      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.trim();
      if (googleKey) {
        try {
          const tileset = await Cesium.createGooglePhotorealistic3DTileset({ key: googleKey });
          if (!viewer.isDestroyed()) viewer.scene.primitives.add(tileset);
        } catch (error) {
          console.warn("Photorealistic 3D Tiles unavailable", error);
        }
      }

      for (const site of candidates) {
        const isDeposit = site.kind === "deposit";
        const entity = viewer.entities.add({
          id: `candidate-${site.id}`,
          name: site.name,
          position: Cesium.Cartesian3.fromDegrees(...centroid(site.polygon), 34),
          properties: { siteId: site.id, siteKind: site.kind },
          polygon: {
            hierarchy: polygonHierarchy(site.polygon),
            height: 7,
            extrudedHeight: 9,
            material: (isDeposit ? Cesium.Color.fromCssColorString("#38bdf8") : Cesium.Color.fromCssColorString("#f59e0b")).withAlpha(0.34),
            outline: true,
            outlineColor: isDeposit ? Cesium.Color.CYAN : Cesium.Color.ORANGE,
          },
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([...site.polygon, site.polygon[0]].flat()),
            width: 2,
            material: isDeposit ? Cesium.Color.CYAN : Cesium.Color.ORANGE,
            clampToGround: false,
          },
          label: {
            text: site.name,
            font: "600 13px sans-serif",
            fillColor: Cesium.Color.WHITE,
            showBackground: true,
            backgroundColor: Cesium.Color.fromCssColorString("#07131f").withAlpha(0.82),
            pixelOffset: new Cesium.Cartesian2(0, -18),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 65000),
          },
        });
        candidateEntitiesRef.current.push(entity);
      }

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      let dragging: { target: Exclude<DrawTarget, null>; index: number } | null = null;

      handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const picked = viewer.scene.pick(event.position) as { id?: Cesium.Entity } | undefined;
        const entity = picked?.id;
        const vertexIndex = entity?.properties?.vertexIndex?.getValue(Cesium.JulianDate.now());
        const vertexTarget = entity?.properties?.vertexTarget?.getValue(Cesium.JulianDate.now());
        if (Number.isInteger(vertexIndex) && (vertexTarget === "dredge" || vertexTarget === "restore")) {
          dragging = { target: vertexTarget, index: vertexIndex };
          viewer.scene.screenSpaceCameraController.enableInputs = false;
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (!dragging) return;
        const coordinate = pickCoordinate(viewer, event.endPosition);
        if (!coordinate) return;
        const current = projectRef.current;
        const key = dragging.target === "dredge" ? "dredgePolygon" : "restorationPolygon";
        const points = [...current[key]];
        points[dragging.index] = coordinate;
        onProjectChangeRef.current({ ...current, [key]: points });
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      handler.setInputAction(() => {
        dragging = null;
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }, Cesium.ScreenSpaceEventType.LEFT_UP);

      handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (dragging) return;
        const picked = viewer.scene.pick(event.position) as { id?: Cesium.Entity } | undefined;
        const entity = picked?.id;
        const siteId = entity?.properties?.siteId?.getValue(Cesium.JulianDate.now());
        const siteKind = entity?.properties?.siteKind?.getValue(Cesium.JulianDate.now());
        if (siteId && (siteKind === "deposit" || siteKind === "erosion")) {
          onSelectCandidateRef.current(siteKind, siteId);
          return;
        }
        const target = drawTargetRef.current;
        if (!target) return;
        const coordinate = pickCoordinate(viewer, event.position);
        if (!coordinate) return;
        const current = projectRef.current;
        const key = target === "dredge" ? "dredgePolygon" : "restorationPolygon";
        onProjectChangeRef.current({ ...current, [key]: [...current[key], coordinate] });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      handler.setInputAction(() => {
        drawTargetRef.current = null;
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(127.6, 35.3, 19_000_000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      });

      let sceneReadyReported = false;
      const reportSceneReady = () => {
        if (sceneReadyReported || viewer.isDestroyed()) return;
        sceneReadyReported = true;
        props.onSceneReady();
      };
      const removeTileListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((pending) => {
        if (pending === 0) window.requestAnimationFrame(reportSceneReady);
      });
      const readinessFallback = window.setTimeout(reportSceneReady, 3500);
      setReady(true);
      props.onMapReady("3D 지구본 준비 완료 · Esri 위성영상 연결 중");

      return () => {
        removeTileListener();
        window.clearTimeout(readinessFallback);
        handler.destroy();
        viewer.destroy();
        viewerRef.current = null;
      };
    };

    let cleanup: (() => void) | undefined;
    void initialize().then((dispose) => { cleanup = dispose; });
    return () => { cancelled = true; cleanup?.(); };
    // The viewer must be created once; mutable callbacks are held in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (satelliteLayerRef.current) satelliteLayerRef.current.show = props.satelliteVisible;
  }, [props.satelliteVisible]);

  useEffect(() => {
    for (const entity of candidateEntitiesRef.current) entity.show = props.candidatesVisible && !props.introActive;
  }, [props.candidatesVisible, props.introActive]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    for (const entity of operationsEntitiesRef.current) viewer.entities.remove(entity);
    operationsEntitiesRef.current = [];
    if (props.introActive) return;

    if (props.volumeMarkersVisible) {
      for (const site of candidates) {
        const [lon, lat] = centroid(site.polygon);
        const height = Math.max(520, Math.min(2200, site.volume / 110));
        const isDeposit = site.kind === "deposit";
        operationsEntitiesRef.current.push(viewer.entities.add({
          id: `volume-${site.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, height / 2 + 16),
          properties: { siteId: site.id, siteKind: site.kind },
          cylinder: {
            length: height,
            topRadius: isDeposit ? 145 : 34,
            bottomRadius: isDeposit ? 145 : 180,
            material: (isDeposit ? Cesium.Color.fromCssColorString("#22d3ee") : Cesium.Color.fromCssColorString("#f59e0b")).withAlpha(0.72),
            outline: true,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.42),
          },
        }));
      }
    }

    const deposit = candidates.find((site) => site.id === props.project.selectedDepositId);
    const erosion = candidates.find((site) => site.id === props.project.selectedErosionId);
    if (props.flowVisible && deposit && erosion) {
      const [fromLon, fromLat] = centroid(deposit.polygon);
      const [toLon, toLat] = centroid(erosion.polygon);
      const midLon = (fromLon + toLon) / 2;
      const midLat = (fromLat + toLat) / 2;
      operationsEntitiesRef.current.push(viewer.entities.add({
        id: "selected-match-route",
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            fromLon, fromLat, 42,
            midLon, midLat, 1450,
            toLon, toLat, 42,
          ]),
          width: 5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.22,
            taperPower: 0.35,
            color: Cesium.Color.fromCssColorString("#67e8f9").withAlpha(0.92),
          }),
        },
      }));
      operationsEntitiesRef.current.push(viewer.entities.add({
        id: "selected-match-flow-marker",
        position: new Cesium.CallbackPositionProperty(() => {
          const t = (performance.now() % 5200) / 5200;
          const lon = fromLon + (toLon - fromLon) * t;
          const lat = fromLat + (toLat - fromLat) * t;
          const height = 80 + Math.sin(Math.PI * t) * 1370;
          return Cesium.Cartesian3.fromDegrees(lon, lat, height);
        }, false),
        point: {
          pixelSize: 10,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString("#22d3ee"),
          outlineWidth: 4,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }));
    }
    viewer.scene.requestRender();
  }, [props.flowVisible, props.introActive, props.project.selectedDepositId, props.project.selectedErosionId, props.volumeMarkersVisible, ready]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready || !props.introPlaying) return;

    let koreaTimer: number | undefined;
    let busanTimer: number | undefined;
    let finishTimer: number | undefined;
    viewer.camera.cancelFlight();
    viewer.scene.screenSpaceCameraController.enableInputs = false;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(127.6, 35.3, 19_000_000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    });

    koreaTimer = window.setTimeout(() => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(127.7, 36.1, 2_250_000),
        orientation: { heading: Cesium.Math.toRadians(4), pitch: Cesium.Math.toRadians(-78), roll: 0 },
        duration: 1.55,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          busanTimer = window.setTimeout(() => {
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(129.02, 35.12, 82_000),
              orientation: { heading: Cesium.Math.toRadians(14), pitch: Cesium.Math.toRadians(-56), roll: 0 },
              duration: 1.55,
              easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
              complete: () => {
                finishTimer = window.setTimeout(props.onIntroComplete, 300);
              },
            });
          }, 160);
        },
      });
    }, 400);

    return () => {
      if (koreaTimer) window.clearTimeout(koreaTimer);
      if (busanTimer) window.clearTimeout(busanTimer);
      if (finishTimer) window.clearTimeout(finishTimer);
      viewer.camera.cancelFlight();
      viewer.scene.screenSpaceCameraController.enableInputs = true;
    };
  }, [props.introPlaying, props.introRunId, props.onIntroComplete, ready]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    if (props.introActive) {
      previousIntroActiveRef.current = true;
      return;
    }
    const oldStep = previousStepRef.current;
    const cameOutOfIntro = previousIntroActiveRef.current;
    previousIntroActiveRef.current = false;
    if (!cameOutOfIntro && oldStep === props.step) return;
    cameraByStepRef.current.set(oldStep, {
      destination: Cesium.Cartesian3.clone(viewer.camera.positionWC),
      orientation: { heading: viewer.camera.heading, pitch: viewer.camera.pitch, roll: viewer.camera.roll },
    });
    previousStepRef.current = props.step;
    const saved = cameraByStepRef.current.get(props.step);
    if (saved) {
      viewer.camera.flyTo({ ...saved, duration: 1.1, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT });
      return;
    }
    const id = props.step === 3 ? props.project.selectedErosionId : props.project.selectedDepositId;
    const site = candidates.find((item) => item.id === id) ?? candidates[0];
    const [lon, lat] = centroid(site.polygon);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, VIEW_HEIGHTS[props.step]),
      orientation: { heading: Cesium.Math.toRadians(18), pitch: Cesium.Math.toRadians(props.step === 1 ? -58 : -42), roll: 0 },
      duration: 1.6,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, [props.step, ready, props.introActive, props.project.selectedDepositId, props.project.selectedErosionId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready || props.introActive || !props.focusCandidateId) return;
    const site = candidates.find((candidate) => candidate.id === props.focusCandidateId);
    if (!site) return;

    const [lon, lat] = centroid(site.polygon);
    const height = props.step === 1 ? 6_200 : 4_800;
    viewer.camera.cancelFlight();
    viewer.scene.screenSpaceCameraController.enableInputs = true;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: {
        heading: Cesium.Math.toRadians(12),
        pitch: Cesium.Math.toRadians(props.step === 1 ? -68 : -48),
        roll: 0,
      },
      duration: 1.2,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, [props.focusCandidateId, props.focusRequestId, props.introActive, props.step, ready]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    for (const entity of draftEntitiesRef.current) viewer.entities.remove(entity);
    draftEntitiesRef.current = [];

    const configs: Array<{ key: "dredgePolygon" | "restorationPolygon"; target: "dredge" | "restore"; color: Cesium.Color }> = [
      { key: "dredgePolygon", target: "dredge", color: Cesium.Color.fromCssColorString("#22d3ee") },
      { key: "restorationPolygon", target: "restore", color: Cesium.Color.fromCssColorString("#4fd39a") },
    ];
    for (const config of configs) {
      const points = props.project[config.key];
      if (points.length >= 2) {
        draftEntitiesRef.current.push(viewer.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([...points, ...(points.length >= 3 ? [points[0]] : [])].flat()),
            width: 4,
            material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.18, color: config.color }),
          },
        }));
      }
      if (points.length >= 3) {
        draftEntitiesRef.current.push(viewer.entities.add({
          polygon: {
            hierarchy: polygonHierarchy(points),
            height: 6.2,
            material: config.color.withAlpha(props.compareMode === "before" ? 0.24 : 0.09),
            outline: true,
            outlineColor: config.color,
          },
        }));
      }
      if (props.drawTarget === config.target || (props.step === 2 && config.target === "dredge") || (props.step === 3 && config.target === "restore")) {
        points.forEach(([lon, lat], index) => {
          draftEntitiesRef.current.push(viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, 9),
            properties: { vertexIndex: index, vertexTarget: config.target },
            point: {
              pixelSize: 11,
              color: Cesium.Color.WHITE,
              outlineColor: config.color,
              outlineWidth: 3,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          }));
        });
      }
    }

    for (const key of ["dredge", "restore"] as const) {
      const primitive = deformationRef.current[key];
      if (primitive && !primitive.isDestroyed()) viewer.scene.primitives.remove(primitive);
      delete deformationRef.current[key];
    }

    if (props.compareMode !== "before") {
      if (props.project.dredgePolygon.length >= 3) {
        const dredge = createDeformationPrimitive({
          points: props.project.dredgePolygon,
          baseHeight: 6,
          deltaHeight: -props.project.dredgeDepth,
          color: Cesium.Color.fromCssColorString("#0891b2").withAlpha(props.compareMode === "compare" ? 0.6 : 0.88),
        });
        if (dredge) deformationRef.current.dredge = viewer.scene.primitives.add(dredge);
      }
      if (props.project.restorationPolygon.length >= 3) {
        const restore = createDeformationPrimitive({
          points: props.project.restorationPolygon,
          baseHeight: 6,
          deltaHeight: props.project.fillThickness,
          color: Cesium.Color.fromCssColorString("#2fbf87").withAlpha(props.compareMode === "compare" ? 0.58 : 0.86),
        });
        if (restore) deformationRef.current.restore = viewer.scene.primitives.add(restore);
      }
    }
    viewer.scene.requestRender();
  }, [props.project, props.drawTarget, props.step, props.compareMode, ready]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    for (const entity of candidateEntitiesRef.current) {
      const siteId = entity.properties?.siteId?.getValue(Cesium.JulianDate.now());
      const selected = siteId === props.project.selectedDepositId || siteId === props.project.selectedErosionId;
      if (entity.polygon) {
        const site = candidates.find((candidate) => candidate.id === siteId);
        const base = site?.kind === "deposit" ? Cesium.Color.fromCssColorString("#38bdf8") : Cesium.Color.fromCssColorString("#f59e0b");
        entity.polygon.material = new Cesium.ColorMaterialProperty(base.withAlpha(selected ? 0.52 : 0.22));
        entity.polygon.outlineColor = new Cesium.ConstantProperty(selected ? Cesium.Color.WHITE : base);
      }
    }
  }, [props.project.selectedDepositId, props.project.selectedErosionId, ready]);

  const flyPreset = (kind: "aerial" | "oblique" | "close" | "match") => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (kind === "match") {
      const deposit = candidates.find((item) => item.id === props.project.selectedDepositId);
      const erosion = candidates.find((item) => item.id === props.project.selectedErosionId);
      if (deposit && erosion) {
        const [depositLon, depositLat] = centroid(deposit.polygon);
        const [erosionLon, erosionLat] = centroid(erosion.polygon);
        const sphere = Cesium.BoundingSphere.fromPoints([
          Cesium.Cartesian3.fromDegrees(depositLon, depositLat, 0),
          Cesium.Cartesian3.fromDegrees(erosionLon, erosionLat, 0),
        ]);
        viewer.camera.flyToBoundingSphere(sphere, {
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(28),
            Cesium.Math.toRadians(-48),
            Math.max(15500, sphere.radius * 3.15),
          ),
          duration: 1.35,
          easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        });
      }
      return;
    }
    const id = props.step === 3 ? props.project.selectedErosionId : props.project.selectedDepositId;
    const site = candidates.find((item) => item.id === id) ?? candidates[0];
    const [lon, lat] = centroid(site.polygon);
    const settings = {
      aerial: { height: 28000, pitch: -78 },
      oblique: { height: 13500, pitch: -38 },
      close: { height: 5200, pitch: -28 },
    }[kind];
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, settings.height),
      orientation: { heading: Cesium.Math.toRadians(24), pitch: Cesium.Math.toRadians(settings.pitch), roll: 0 },
      duration: 1.25,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  };

  const selectedDeposit = candidates.find((site) => site.id === props.project.selectedDepositId);
  const selectedErosion = candidates.find((site) => site.id === props.project.selectedErosionId);
  const routeDistance = selectedDeposit && selectedErosion
    ? distanceKm(centroid(selectedDeposit.polygon), centroid(selectedErosion.polygon))
    : 0;

  return (
    <div className="map-stage">
      <div ref={containerRef} className="cesium-host" aria-label="부산 연안 3D GIS 지도" />
      <div className="map-vignette" aria-hidden="true" />
      <div className="map-topline">
        <span className="live-dot" />
        <span>BUSAN COAST · WGS84 / ELLIPSOID HEIGHT</span>
        <span className="topline-divider" />
        <span>{routeDistance.toFixed(1)} KM ROUTE</span>
      </div>
      <div className="camera-presets" aria-label="카메라 프리셋">
        <button onClick={() => flyPreset("aerial")}>상공</button>
        <button onClick={() => flyPreset("oblique")}>사선</button>
        <button onClick={() => flyPreset("close")}>근접</button>
        <button onClick={() => flyPreset("match")}>연결</button>
      </div>
      {(props.flowVisible || props.volumeMarkersVisible) && !props.introActive && (
        <div className="operations-legend" aria-label="3D 운영 레이어 범례">
          {props.volumeMarkersVisible && <span><i className="legend-volume supply" /> 공급 물량 <i className="legend-volume demand" /> 복원 수요</span>}
          {props.flowVisible && <span><i className="legend-route" /> 선택 매칭 경로</span>}
        </div>
      )}
      {props.drawTarget && (
        <div className="draw-hint">
          <strong>{props.drawTarget === "dredge" ? "준설 구역 입력 중" : "복원 구역 입력 중"}</strong>
          <span>지도를 클릭해 꼭짓점을 추가하고, 흰 점을 드래그해 수정하세요.</span>
        </div>
      )}
    </div>
  );
}
