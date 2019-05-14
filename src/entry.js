/**
 * entry.js
 * 
 * This is the first file loaded. It sets up the Renderer, 
 * Scene and Camera. It also starts the render loop and 
 * handles window resizes.
 * 
 */

import { WebGLRenderer, PerspectiveCamera, Scene, Vector3, BasicShadowMap, PCFSoftShadowMap } from 'three';
import SeedScene from './objects/Scene.js';
import Stats from 'stats-js';
import {GUI} from 'dat.gui';

const scene = new Scene();
const camera = new PerspectiveCamera();
const renderer = new WebGLRenderer({antialias: true});
const seedScene = new SeedScene();
var stats = new Stats();

stats.showPanel( 0 );


// For GUI
// http://www.hangge.com/blog/cache/detail_1785.html
// http://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage
var FizzyText = function() {
  // this.message = 'dat.gui';
  // this.speed = 0.8;
  // this.displayOutline = false;
  this.model = "Box";
  this.N = 50;
  this.p_size = 0.06;
  this.clear = function() { seedScene.snow.clear_snow() };
  this.start = function () {seedScene.snow.init_snow(undefined,undefined,undefined, this.N,undefined, this.model, this.p_size)};
};

const mygui = function() {
  var text = new FizzyText();
  var gui = new GUI();
  gui.add(text, 'clear');
  gui.add(text, 'start');
  gui.add(text, 'model', ['Box', 'Heart', 'Uncracked_Egg']);
  gui.add(text, 'N', 0, 100).step(1);
  gui.add(text, 'p_size', 0.001, 0.1).step(0.001);
};
//end

document.body.appendChild( stats.dom );

// scene
scene.add(seedScene);

// camera
camera.position.set(0,2,-6);
camera.lookAt(new Vector3(0,0,0));

// renderer
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x7ec0ee, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;


  // monitored code goes here
  // render loop
  const onAnimationFrameHandler = (timeStamp) => {
    stats.begin();
    renderer.render(scene, camera);
    seedScene.update && seedScene.update(timeStamp);
    stats.end();
    window.requestAnimationFrame(onAnimationFrameHandler);
  }
  window.requestAnimationFrame(onAnimationFrameHandler);
  window.onload = mygui();


// resize
const windowResizeHanlder = () => { 
  const { innerHeight, innerWidth } = window;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
windowResizeHanlder();
window.addEventListener('resize', windowResizeHanlder);

// dom
document.body.style.margin = 0;
document.body.appendChild( renderer.domElement );

