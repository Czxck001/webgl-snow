import { Group, Points, Geometry, Vector3, Face3, SphereGeometry, MeshBasicMaterial, Mesh, Object3D, Clock, MeshPhongMaterial, ShaderMaterial, Color} from 'three';
import Land from './Land/Land.js';
import Flower from './Flower/Flower.js';
import BasicLights from './Lights.js';
var HashMap = require('hashmap');


class SnowParticle extends Group {
  constructor(x = 0, y = 0, z = 0) {
    super();
    const geometry = new SphereGeometry( 0.06, 32, 32 );
    const material = new MeshPhongMaterial( {color: 0xffffff} );


    const vertexShader = `
    varying vec3 vUv; 

    void main() {
      vUv = position; 

      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewPosition; 
    }`;

    const fragmentShader = `
    uniform vec3 color;
    varying vec3 vUv;

    void main() {
      gl_FragColor = vec4(color, 1.0);
    }
    `;

    const uniforms = {
      color: {type: "vec3", value: new Color(0xffffff)}
    }
    const shader = new ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    })

    const sphereMesh = new Mesh( geometry, shader );
    this.add(sphereMesh);

    this.translateX(x);
    this.translateY(y);
    this.translateZ(z);


    this.latest = undefined;
    this.clock = new Clock();
  }
  
  update(timeStamp) {

    if (this.position.y < 0.05) {
      this.position.y = 0.05;
      return;
    }

    if (this.latest === undefined) {
      this.latest = timeStamp;
    } else {
      const delta = timeStamp - this.latest;
      this.translateY(-delta / 200);
      this.latest = timeStamp;
    }
  }
}

class SnowParticleDrops extends Group {
  constructor(height = 4, dropRadius = 1.5, grid_width = 1.0) {
    super();
    this.height = height;
    this.dropRadius = dropRadius;
    this.clock = new Clock();
    this.oldElapsedTime = 0.0;

    this.h = grid_width;
    this.grid = new HashMap();
  }
  // Step 1
  // Hw 4
  hash_position(pos) {
  // Hash a 3D position into a unique float identifier that represents membership in some 3D box volume.
  const x = ( pos.x - Math.fmod(pos.x, this.h)) / this.h;
  const y = ( pos.y - Math.fmod(pos.y, this.h)) / this.h;
  const z = ( pos.z - Math.fmod(pos.z, this.h)) / this.h;

  // return x*pow(3, 5) + y * pow(7, 3) + z * pow(13, 2);
  return x * 243.0 + y * 113.0 + z * 169.0;
  }

  // Put particles into grid
  rasterize_particle(){
    // Clear all pairs
    this.grid.clear();
    // append particles to grid
    this.children.forEach((snow) => {
       const hash_key = this.hash_position(snow.position);
       if(this.grid.has(hash_key)){
         this.grid.get(hash_key).push(snow);
       }
       else{
         this.grid.set(hash_key, new Array(snow));
       }
    })
  }

  TransferParticletoGrid(){
    function N(x){
      const abs_x = Math.abs(x);
      if( 0<= abs_x < 1){
        return 0.5 * Math.pow(abs_x, 3) - Math.pow(abs_x, 2) + 2.0/3.0;
      }
      else if( 1<= abs_x < 2){
        return (1.0/6.0) * Math.pow(abs_x, 3) + Math.pow(abs_x, 2) - 2 * abs_x + 4.0/3.0;
      }
      else{
        return 0;
      }
    }
    function N_h( particle, grid_idx){
      return N( 1/h * (particle.position.x -  grid_idx.x * this.h) ) * N( 1/h * (particle.position.y -  grid_idx.y * this.h) ) * N( 1/h * (particle.position.z -  grid_idx.z * this.h) );
    }
    // weighting function
    var m_i = 0.0, v_i = 0.0;
    // traverse every particle in the grid
    this.grid.get(this.hash_position(snow.position)).forEach( function(element){
          m_i += element.weight * N_h(element, grid_idx);
          v_i += element.velocity * element.weight * N_h(element, grid_idx);
        }
    )
    v_i /= m_i;

    // compute

  }
  
  update(timeStamp) {
    this.rasterize_particle();
    this.TransferParticletoGrid();
    // Original Falling
    this.children.forEach((snow) => {
      if (snow.clock.getElapsedTime() > 15) {
        this.remove(snow);
        return;
      }
      snow.update(timeStamp);
    })

    const newElapsedTime = this.clock.getElapsedTime();
    if (newElapsedTime - this.oldElapsedTime > 0.2) {

      const randomX = Math.random() * this.dropRadius * 2 - this.dropRadius;
      const randomZ = Math.random() * this.dropRadius * 2 - this.dropRadius;

      this.add(new SnowParticle(randomX, this.height, randomZ));
      this.oldElapsedTime = newElapsedTime;
    // Original Falling End

      
    }
  }
}


export default class SeedScene extends Group {
  constructor() {
    super();

    const land = new Land();
    const flower = new Flower();
    const lights = new BasicLights();
    this.snow = new SnowParticleDrops();

    this.add(land, flower, lights, this.snow);
  }

  update(timeStamp) {
    this.rotation.y = timeStamp / 10000;
    this.snow.update(timeStamp);
  }
}