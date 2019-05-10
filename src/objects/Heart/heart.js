import { Group, ObjectLoader  } from 'three';
import MODEL from '../Heart.json';

export default class Heart extends Group {
  constructor() {
    const loader = new ObjectLoader();
    
    super();

    this.name = 'heart';

    loader.load(MODEL, (mesh)=>{
      mesh.scale.set(0.01,0.01,0.01);
      mesh.translateY(1);
      // console.log(mesh.children[0].isMesh);
      var geo = mesh.children[0].geometry;
      var pos = geo.getAttribute('position');
      // console.log(pos.array);
      this.vert = pos.array;
      console.log(this.vert);

      // geo.Indices.forEach();
      this.add(mesh);
    });
  }
}
