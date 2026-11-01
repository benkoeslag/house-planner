import * as THREE from 'three';
import { APP_NAME, placeholderMessage } from './app';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app element');

const label = document.createElement('p');
label.className = 'label';
label.textContent = placeholderMessage();
root.append(label);

// An empty 3D scene with a floor grid: proves the 3D toolchain works end to end.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
root.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f5);
// One unit is one inch. A 20 ft x 20 ft grid with a line every foot.
scene.add(new THREE.GridHelper(240, 20, 0x7a8a93, 0xc9d1d5));

const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
camera.position.set(220, 180, 220);
camera.lookAt(0, 0, 0);

function resize(): void {
  const { clientWidth: w, clientHeight: h } = renderer.domElement.parentElement ?? root!;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
window.addEventListener('resize', resize);
resize();
document.title = APP_NAME;
