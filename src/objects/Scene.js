import { Group, ObjectLoader, AmbientLight, PointLight, LightShadow, PerspectiveCamera, SpotLight, IcosahedronGeometry, Points, Geometry, Vector3, Face3, SphereGeometry, MeshBasicMaterial, Mesh, Object3D, Clock, MeshPhongMaterial, ShaderMaterial, Color} from 'three';
import Land from './Land/Land.js';
import Flower from './Flower/Flower.js';
import BasicLights from './Lights.js';
import MPMGrid from '../mlsmpm.js';
import MODEL_Heart from './Heart.json';
import MODEL_Egg from './UncrackedEgg.json';
import HashMap from 'hashmap';

const vertexShader =
    `
      vec3 mod289(vec3 x)
      {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 mod289(vec4 x)
      {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 permute(vec4 x)
      {
        return mod289(((x*34.0)+1.0)*x);
      }
      
      vec4 taylorInvSqrt(vec4 r)
      {
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      
      vec3 fade(vec3 t) 
      {
        return t*t*t*(t*(t*6.0-15.0)+10.0);
      }
      
      float pnoise(vec3 P, vec3 rep)
      {
        vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
        vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
        Pi0 = mod289(Pi0);
        Pi1 = mod289(Pi1);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;
        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);
        vec4 gx0 = ixy0 * (1.0 / 7.0);
        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);
        vec4 gx1 = ixy1 * (1.0 / 7.0);
        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);
        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;
        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);
        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
        return 2.2 * n_xyz;
      }
      
      varying vec2 vUv;
      varying float noise;
      float turbulence( vec3 p ) {
        float w = 100.0;
        float t = -.5;
        for (float f = 1.0 ; f <= 10.0 ; f++ ){
          float power = pow( 2.0, f );
          t += abs( pnoise( vec3( power * p ), vec3( 10.0, 10.0, 10.0 ) ) / power );
        }
      return t;
      }
      
      void main() 
      {
        vUv = uv;
        noise = 0.1 *  -.10 * turbulence( .5 * normal );
        float b = 5.0 * pnoise( 0.05 * position, vec3( 100.0 ) );
        float displacement = - 5.0 * noise + b;
        vec3 newPosition = position + normal * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
      }
      
    `;


const fragmentShader =
    `
      uniform vec3 color;
      varying vec2 vUv;
      varying float noise;
      
      void main() 
      {
        vec3 new_color = color * ( 1. - 10. * noise );
        gl_FragColor = vec4( new_color, 1.0 );
      }
      
    `;

const uniforms = {
    color: {type: "vec3", value: new Color(0xffffff)}
}

const shader = new ShaderMaterial(
    {
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    }
)

// const material = new ShaderMaterial( {
//   uniforms: uniforms,
//   vertexShader: vertexShader,
//   fragmentShader: fragmentShader
// } );

class SnowParticle extends Group {
  constructor(x = 0, y = 0, z = 0, size = 0.06) {
    super();

    const geo = new IcosahedronGeometry( size, 4 )

    const sphereMesh = new Mesh( geo, shader );
    sphereMesh.castShadow = true;
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

  constructor(x_radius = 1, y_height = 2, padding = 0.2, N = 50, n = 10, loadmodel = "Box", p_size = 0.06) {
    super();
    this.initialized = false;
    this.mpm_grid = new MPMGrid([-x_radius, 0.1, -x_radius], [x_radius, y_height + 0.1, x_radius], n, 8 * 1e-4);
    this.init_snow(x_radius, y_height, padding, N, n, loadmodel, p_size);
  }

  init_snow(x_radius = 1, y_height = 2, padding = 0.2, N = 50, n = 10, loadmodel = 'Box', p_size = 0.06) {
    if(this.initialized){
      return;
    }
    this.initialized = true;
    if (loadmodel != "Box") {
      console.log(loadmodel);
      let MODEL;
      if(loadmodel == 'Heart'){
        MODEL = MODEL_Heart;
      }
      else if(loadmodel == 'Uncracked_Egg'){
        MODEL = MODEL_Egg;
      }
      const loader = new ObjectLoader();
      loader.load(MODEL, (mesh) => {
        // mesh.scale.set(0.01,0.01,0.01);
        // mesh.scale.set(1, 1, 1);
        mesh.translateY(1);
        var geo = mesh.children[0].geometry;
        var pos = geo.getAttribute('position');
        const vertices = pos.array;
        // mesh.children[0].material.wireframe = true;
        // this.add(mesh);
        let dic = new HashMap();
        let cnt = 0;
        for (let i = 0; i < vertices.length; i += 3) {
          var tmp = new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
          let h_tmp = this.hash_function(tmp);
          if (dic.has(h_tmp)) {
            continue;
          } else {
            dic.set(h_tmp, i);
            cnt += 1;
            tmp = tmp.multiplyScalar(0.009).add(mesh.position);
            let snow_particle = new SnowParticle(tmp.x, tmp.y, tmp.z, p_size);
            this.mpm_grid.add_particle(snow_particle);
            this.add(snow_particle);
          }
        }
        for (let i = 0; i < N;) {
          let i1 = Math.floor(Math.random() * dic.count());
          let i2 = Math.floor(Math.random() * dic.count());
          if (i1 == i2) {
            continue;
          } else {
            i += 1;
            cnt += 1;
            let w = Math.random();
            // linear interpolation
            let v1 = new Vector3(vertices[i1], vertices[i1 + 1], vertices[i1 + 2]);
            let v2 = new Vector3(vertices[i2], vertices[i2 + 1], vertices[i2 + 2]);
            let tmp = v1.multiplyScalar(w).add(v2.multiplyScalar(1.0 - w));
            tmp = tmp.multiplyScalar(0.01).add(mesh.position);
            let snow_particle = new SnowParticle(tmp.x, tmp.y, tmp.z, p_size);
            this.mpm_grid.add_particle(snow_particle);
            this.add(snow_particle);
          }
        }
        console.log(cnt);
      });
    } else {
      const y_center = y_height / 2;
      const sphere_r = x_radius / 4;
      for (let i = 0; i < N; ++i) {
        // let snow_particle = new SnowParticle((Math.random()*2-1)*(x_radius-padding), Math.random() * (y_height - 2 * padding) + padding, (Math.random()*2-1)*(x_radius-padding));
        let snow_particle = new SnowParticle((Math.random() * 2 - 1) * sphere_r, (Math.random() * 2 - 1) * sphere_r + y_center, (Math.random() * 2 - 1) * sphere_r, p_size);
        this.mpm_grid.add_particle(snow_particle);
        this.add(snow_particle);
      }
    }
  }
  clear_snow(){
    this.mpm_grid.grid = [];
    this.children = [];
    this.initialized = false;
  }
  hash_function(v) {
      return v.x * 2.0 + v.y * 3.0 + v.z * 5.0;
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
    land.receiveShadow =true;
    // const flower = new Flower();
    // const lights = new BasicLights();
    const lights = new PointLight(0xFFFFFF);
    const amblight = new AmbientLight(0xFFFFFF, 0.5);
    lights.position.set(10,100,10);

    lights.castShadow = true;
    // var cam = new PerspectiveCamera();
    // cam.position.set(6,3,-10);
    // cam.lookAt(new Vector3(0,0,0));
    // lights.shadow = new LightShadow(cam);
    // lights.shadow.bias = -0.01;
    // lights.shadow.mapSize.width = 100 * 2;
    // lights.shadow.mapSize.height = 100 * 2;


    this.snow = new SnowGroup();

    this.add(land, lights,amblight, this.snow);
  }

  update(timeStamp) {
    // this.rotation.y = timeStamp / 10000;
    this.snow.advance();
  }
}