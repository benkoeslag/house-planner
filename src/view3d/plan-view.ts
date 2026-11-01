import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { detectRooms } from '../model/rooms';
import type { Plan, Point } from '../model/types';
import { buildWalls, planBounds } from './pieces';

/**
 * Simple 3D view of a plan. One 3D unit is one inch. Plan x is 3D x, plan y is 3D -z
 * (north is away from the viewer), and up is 3D y.
 *
 * Call `setPlan` whenever the plan changes; the view rebuilds its meshes. The camera keeps framing
 * the whole plan until the owner orbits, pans or zooms; after that it stays where they left it.
 */
export class PlanView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 2, 20000);
  private readonly controls: OrbitControls;
  private readonly content = new THREE.Group();
  private readonly resizeObserver: ResizeObserver;
  /** Set once the owner moves the 3D camera; until then the view keeps framing the whole plan. */
  private userMoved = false;
  private frame = 0;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xf2f4f5);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a949a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-300, 600, 400);
    this.scene.add(sun);
    this.scene.add(this.content);

    this.camera.position.set(260, 220, 300);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // keep the camera above the floor
    this.controls.addEventListener('change', () => this.requestRender());
    this.controls.addEventListener('start', () => {
      this.userMoved = true;
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Replaces what is shown with the given plan. */
  setPlan(plan: Plan): void {
    this.clear();
    const built = buildWalls(plan);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.9, side: THREE.DoubleSide });
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4a5a63 });
    for (const piece of built.pieces) {
      const mesh = new THREE.Mesh(this.prism(piece.outline, piece.z1 - piece.z0), wallMaterial);
      mesh.position.y = piece.z0;
      mesh.rotation.x = -Math.PI / 2;
      this.content.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), edgeMaterial);
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      this.content.add(edges);
    }

    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.35, roughness: 0.1 });
    for (const pane of built.glass) {
      const mesh = new THREE.Mesh(this.prism(pane.outline, pane.z1 - pane.z0), glassMaterial);
      mesh.position.y = pane.z0;
      mesh.rotation.x = -Math.PI / 2;
      this.content.add(mesh);
    }

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcdb48c, roughness: 0.95 });
    for (const room of detectRooms(plan)) {
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(this.shape(room.interior)), floorMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.05; // just above the ground grid so the two do not flicker
      this.content.add(mesh);
    }

    this.content.add(this.grid(plan));

    // Keep the whole plan in view as it grows, until the owner moves the camera themselves.
    const b = planBounds(plan);
    if (!b) this.userMoved = false;
    else if (!this.userMoved) this.fit(b.min, b.max, b.height);
    this.requestRender();
  }

  /** Points the camera at the given plan from the south-east, close enough to fill the view. */
  fitToPlan(plan: Plan): void {
    this.resize(); // the container may have just been shown, so measure it first
    const b = planBounds(plan);
    if (b) this.fit(b.min, b.max, b.height);
  }

  /** Points the camera at the middle of the given plan area from the south-east. */
  fit(min: Point, max: Point, height: number): void {
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    // On a tall, narrow screen the width is the limit, so back the camera off.
    const size = Math.max(max.x - min.x, max.y - min.y, height) * Math.max(1, 1 / this.camera.aspect);
    this.controls.target.set(cx, height / 3, -cy);
    this.camera.position.set(cx + size * 0.9, size * 0.95 + height / 3, -cy + size * 1.1);
    this.controls.update();
    this.requestRender();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private shape(points: Point[]): THREE.Shape {
    return new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)));
  }

  /** A plan outline lifted `height` inches; rotate by -90 degrees about x to stand it up. */
  private prism(outline: Point[], height: number): THREE.ExtrudeGeometry {
    return new THREE.ExtrudeGeometry(this.shape(outline), { depth: height, bevelEnabled: false });
  }

  private grid(plan: Plan): THREE.GridHelper {
    const b = planBounds(plan);
    const span = b ? Math.max(b.max.x - b.min.x, b.max.y - b.min.y) : 240;
    const size = Math.max(480, Math.ceil((span * 2) / 12) * 12);
    const grid = new THREE.GridHelper(size, size / 12, 0x7a8a93, 0xc9d1d5); // a line every foot
    if (b) grid.position.set((b.min.x + b.max.x) / 2, 0, -(b.min.y + b.max.y) / 2);
    return grid;
  }

  private clear(): void {
    this.content.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.content.clear();
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  /** Draws on the next animation frame; many changes in one frame draw once. */
  private requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }
}
