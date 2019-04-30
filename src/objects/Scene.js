import { Group, Points, Geometry, Vector3, Face3, SphereGeometry, MeshBasicMaterial, Mesh, Object3D, Clock, MeshPhongMaterial, ShaderMaterial, Color} from 'three';
import Land from './Land/Land.js';
import Flower from './Flower/Flower.js';
import BasicLights from './Lights.js';



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
  constructor(height = 4, dropRadius = 1.5) {
    super();
    this.height = height;
    this.dropRadius = dropRadius;
    this.clock = new Clock();
    this.oldElapsedTime = 0.0;
  }
  
  update(timeStamp) {
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