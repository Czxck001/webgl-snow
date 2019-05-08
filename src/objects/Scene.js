import { Group, Points, Geometry, Vector3, Face3, SphereGeometry, MeshBasicMaterial, Mesh, Object3D, Clock, MeshPhongMaterial, ShaderMaterial, Color} from 'three';
import Land from './Land/Land.js';
import Flower from './Flower/Flower.js';
import BasicLights from './Lights.js';
import MPMGrid from '../mlsmpm.js';


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


class SnowParticle extends Group {
  constructor(x = 0, y = 0, z = 0) {
    super();
    const geometry = new SphereGeometry( 0.06, 32, 32 );

    const sphereMesh = new Mesh( geometry, shader );
    this.add(sphereMesh);

    this.translateX(x);
    this.translateY(y);
    this.translateZ(z);

    this.latest = undefined;
    this.clock = new Clock();
  }
  
  drop(timeStamp) {

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
  
  drop(timeStamp) {
    this.children.forEach((snow) => {
      if (snow.clock.getElapsedTime() > 15) {
        this.remove(snow);
        return;
      }
      snow.drop(timeStamp);
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


class SnowGroup extends Group {
  constructor(x_radius = 2, y_height = 4, padding = 0.5, N = 1000) {
    super();

    this.mpm_grid = new MPMGrid([-x_radius, 0], [x_radius, y_height], 80, 1.5 * 1e-4);

    for (let i = 0; i < N; ++i) {
      let snow_particle = new SnowParticle((Math.random()*2-1)*(x_radius-padding), Math.random() * (y_height - padding));
      this.mpm_grid.add_particle(snow_particle);
      this.add(snow_particle);
    }
  }
  advance() {
    this.mpm_grid.advance();
    this.mpm_grid.update_snow_particles();
  }
}


export default class SeedScene extends Group {
  constructor() {
    super();

    const land = new Land();
    const flower = new Flower();
    const lights = new BasicLights();
    this.snow = new SnowGroup();

    this.add(land, flower, lights, this.snow);
  }

  update(timeStamp) {
    this.rotation.y = timeStamp / 10000;
    this.snow.advance();
  }
}