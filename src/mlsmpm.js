"use strict";
import * as math from "mathjs";
import {SVD} from "svd-js";
import {Clock} from "three";
import * as async from "async";


// material constants
const particle_mass = 1.0;
const vol = 0.03; // particle volume
const hardening = 10.0; // hardening constant for snow plasticity under compression
const E = 14; // Young's modulus
const nu = 0.2; // Poisson's ratio
const mu_0 = E / (2 * (1 + nu)); // Shear modulus (or Dynamic viscosity in fluids)
const lambda_0 = E * nu / ((1+nu) * (1 - 2 * nu)); // Lamé's 1st parameter \lambda=K-(2/3)\mu, where K is the Bulk modulus
const plastic = 1; // whether (1=true) or not (0=false) to simulate plasticity

// const DIM = 2;
// const miden = [[1, 0], [0, 1]];
// const mzero = [[0, 0], [0, 0]];
// const vzero = [0, 0];
// const pzero = [0, 0, 0];

const DIM = 3;
const miden = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mzero = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
const vzero = [0, 0, 0];
const pzero = [0, 0, 0, 0];



class Particle {
    constructor(snow_particle, x) {
        this.snow_particle = snow_particle;
        
        this.x = x;
        this.v = vzero;
        this.F = miden;
        this.C = mzero;
        this.Jp = 1;
    }
}

function orthOuterProduct(a, b) {
    let c = [];
    for (let i = 0; i < a.length; i++) {
        c[i] = [];
        for (let j = 0; j < b.length; j++) {
            c[i][j] = a[i] * b[j];
        }
    }
    return c;
}

export function clamp(x, min, max) {return Math.min(Math.max(x,min),max)}


function polarDecomposition(m) {
    let {u:U, v:V, q:q} = SVD(m);
    return math.multiply(math.transpose(U), V);
}


export default class MPMGrid {
    constructor(box_lowers = [0, 0, 0], box_uppers = [1, 1, 1], n = 40, dt = 1e-4) {
        this.a = box_lowers;
        this.b = box_uppers;

        this.n = n;
        this.dt = dt;

        this.dx = 1.0 / n;
        this.inv_dx = 1.0 / this.dx;

        this.particles = [];
        this.grid = []; // velocity + mass, node_res = cell_res + 1
    }

    gridIndex(i, j, k) {
        return i + (this.n+1)*j + (this.n+1) * (this.n+1) * k;
    }

    worldCoordToGrid(x, y, z) {
        return [
            (x - this.a[0]) / (this.b[0] - this.a[0]),
            (y - this.a[1]) / (this.b[1] - this.a[1]),
            (z - this.a[2]) / (this.b[2] - this.a[2])
        ]
    }

    gridCoordToWorld(x, y, z) {
        return [
            x * (this.b[0] - this.a[0]) + this.a[0],
            y * (this.b[1] - this.a[1]) + this.a[1],
            z * (this.b[2] - this.a[2]) + this.a[2]
        ]
    }

    advance() {
        let clock = new Clock();
        clock.start();
        
        // Reset grid
        for(let i = 0; i < (this.n+1)*(this.n+1)*(this.n+1); i++) {
            this.grid[i] = pzero;  // [x, y, mass]
        }
    
        // 1. Particles to grid
        // for (let p of this.particles) {
        const ptg = (p) => {
            // const base_coord=sub2D(sca2D(p.x, this.inv_dx), [0.5,0.5]).map((o)=>parseInt(o)); // element-wise floor
            const base_coord = math.chain(p.x).multiply(this.inv_dx).add(-0.5).floor().done();  // element-wise floor
            // const fx = sub2D(sca2D(p.x, this.inv_dx), base_coord); // base position in grid units
            const fx = math.chain(p.x).multiply(this.inv_dx).add(math.unaryMinus(base_coord)).done();
    
            // Quadratic kernels  [http://mpm.graphics   Eqn. 123, with x=fx, fx-1,fx-2]
            // const w = [
            //     had2D([0.5, 0.5], sub2D([1.5, 1.5], fx).map(o=>o*o)),
            //     sub2D([0.75, 0.75], sub2D(fx, [1.0, 1.0]).map(o=>o*o)),
            //     had2D([0.5, 0.5], sub2D(fx, [0.5, 0.5]).map(o=>o*o))
            // ];

            const w = [
                math.chain(fx).unaryMinus().add(1.5).square().multiply(0.5).done(),
                math.chain(fx).add(-1.0).square().unaryMinus().add(0.75).done(),
                math.chain(fx).add(-0.5).square().multiply(0.5).done()
            ]

            // Snow-like hardening
            const e = Math.exp(hardening * (1.0 - p.Jp));
            const mu=mu_0*e;
            const lambda=lambda_0*e;
    
            // Cauchy stress times dt and inv_dx
            // original taichi: stress = -4*inv_dx*inv_dx*dt*vol*( 2*mu*(p.F-r)*transposed(p.F) + lambda*(J-1)*J )
            // (in taichi matrices are coded transposed)
            // const J = determinant(p.F); // Current volume

            const J = math.det(p.F);
            // const {R:r, S:s} = polar_decomp(p.F); // Polar decomp. for fixed corotated model
            const mr = polarDecomposition(p.F);

            const k1 = -4*this.inv_dx*this.inv_dx*this.dt*vol;
            const k2 = lambda*(J-1)*J;

            // const stress = addMat( mulMat(subMat(transposed(p.F),r),p.F).map(o=>o*2*mu), [k2,0,0,k2] ).map(o=>o*k1);

            const mstress = math.chain(p.F).transpose()
                                .add(math.unaryMinus(mr))
                                .multiply(p.F)
                                .multiply(2*mu)
                                .add(math.diag([k2, k2, k2]))
                                .multiply(k1)
                                .done();

            // const affine = addMat(stress, p.C.map(o=>o*particle_mass));
            
            const maffine = math.chain(p.C).multiply(particle_mass).add(mstress).done();
    
            // const mv = [p.v[0]*particle_mass, p.v[1]*particle_mass, particle_mass]; // translational momentum
            
            const mv = [...math.multiply(p.v, particle_mass), particle_mass];

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) { // scatter to grid
                    for (let k = 0; k < 3; k++) {
                        // const dpos = [(i-fx[0])*this.dx, (j-fx[1])*this.dx];
                        const dpos = math.chain(fx).unaryMinus().add([i, j, k]).multiply(this.dx).done();
                        // const ii = this.gridIndex(base_coord[0] + i, base_coord[1] + j);
                        const ii = this.gridIndex(...math.add(base_coord, [i, j, k]));

                        const weight = w[i][0] * w[j][1] * w[k][2];  // ???
                        
                        // this.grid[ii] = add3D(this.grid[ii], sca3D(add3D(mv, [...mulMatVec(affine, dpos),0]), weight));
                        if(0<=ii && ii <this.grid.length){
                            this.grid[ii] = math.chain([...math.multiply(maffine, dpos), 0])
                                                .add(mv)
                                                .multiply(weight)
                                                .add(this.grid[ii])
                                                .done();
                        }
                    }
                }
            }
        }
        async.each(this.particles, ptg);

        // console.log("PTG", clock.getDelta());
    
        // Modify grid velocities to respect boundaries
        const boundary = 0.05;
        for(let i = 0; i <= this.n; i++) {
            for(let j = 0; j <= this.n; j++) { // for all grid nodes
                for (let k = 0; k < this.n; k++) {
                    const ii = this.gridIndex(i, j, k);
                    if (this.grid[ii][DIM] > 0) { // no need for epsilon here
                        this.grid[ii] = this.grid[ii].map(o=>o/this.grid[ii][DIM]); // normalize by mass

                        // this.grid[ii] = add3D(this.grid[ii], [0,-200*this.dt,0]); // add gravity
                        this.grid[ii] = math.add(this.grid[ii], [0, -200*this.dt,0, 0]);

                        const x = i/this.n;
                        const y = j/this.n; // boundary thickness, node coord
                        const z = k/this.n;
        
                        // stick
                        if (z < boundary||z > 1-boundary||x < boundary||x > 1-boundary||y > 1-boundary) {
                            this.grid[ii]=pzero;
                        }
        
                        // separate
                        if (y < boundary) {
                            this.grid[ii][1] = Math.max(0.0, this.grid[ii][1]);
                        }
                    }
                }
            }
        }

        // console.log("PTG2", clock.getDelta());
    
        // 2. Grid to particle
        // for (let p of this.particles) {
        const gtp = (p) => {
            // const base_coord=sub2D(p.x.map(o=>o*this.inv_dx),[0.5,0.5]).map(o=>parseInt(o));// element-wise floor
            const base_coord = math.chain(p.x).multiply(this.inv_dx).add(-0.5).floor().done();  // element-wise floor


            // const fx = sub2D(sca2D(p.x, this.inv_dx), base_coord); // base position in grid units
            const fx = math.chain(p.x).multiply(this.inv_dx).add(math.unaryMinus(base_coord)).done();

            // const w = [
            //     had2D([0.5, 0.5], sub2D([1.5, 1.5], fx).map(o=>o*o)),
            //     sub2D([0.75, 0.75], sub2D(fx, [1.0, 1.0]).map(o=>o*o)),
            //     had2D([0.5, 0.5], sub2D(fx, [0.5,0.5]).map(o=>o*o))
            // ];
            const w = [
                math.chain(fx).unaryMinus().add(1.5).square().multiply(0.5).done(),
                math.chain(fx).add(-1.0).square().unaryMinus().add(0.75).done(),
                math.chain(fx).add(-0.5).square().multiply(0.5).done()
            ]

            p.C = mzero;
            p.v = vzero;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    for (let k = 0; k < 3; k++) {
                        // const dpos = sub2D([i, j], fx);
                        const dpos = math.chain(fx).unaryMinus().add([i, j, k]).done();

                        // const ii = this.gridIndex(base_coord[0] + i, base_coord[1] + j);
                        const ii = this.gridIndex(...math.add(base_coord, [i, j, k]));

                        const weight = w[i][0] * w[j][1] * w[k][2];
                        // p.v = add2D(p.v, sca2D(this.grid[ii], weight)); // velocity
                        p.v = math.chain(this.grid[ii].slice(0, DIM)).multiply(weight).add(p.v).done();

                        // p.C = addMat(p.C, outer_product(sca2D(this.grid[ii], weight), dpos).map(o=>o*4*this.inv_dx)); // APIC (affine particle-in-cell); p.C is the affine momentum
                        
                        const op_res = math.multiply(orthOuterProduct(math.multiply(this.grid[ii].slice(0, DIM), weight), dpos), 4*this.inv_dx);
                        p.C = math.add(op_res, p.C);
                    }
                }
            }
    
            // advection
            // p.x = add2D(p.x, sca2D(p.v, this.dt));
            p.x = math.chain(p.v).multiply(this.dt).add(p.x).done();
    
            // MLS-MPM F-update
            // original taichi: F = (Mat(1) + dt * p.C) * p.F
            // let F = mulMat(p.F, addMat([1,0, 0,1], p.C.map(o=>o*this.dt)));

            let cc = math.chain(p.C).multiply(this.dt).add(miden).done();
            let mF = math.multiply(p.F, cc);
    
            // Snow-like plasticity
            // let {U:svd_u, sig:sig, V:svd_v} = svd(F);
            
            // for (let i = 0; i < 2 * plastic; i++) {
            //     sig[i+2*i] = clamp(sig[i+2*i], 1.0 - 2.5e-2, 1.0 + 7.5e-3);
            // }

            let {u:svd_um, v:svd_vm, q:q} = SVD(mF);
            for (let i = 0; i < q.length; ++i) {
                q[i] = clamp(q[i], 1.0 - 2.5e-2, 1.0 + 7.5e-3);
            }
            const sig_m = math.diag(q);

            // const oldJ = determinant(F);
            const oldJ = math.det(mF);

            // original taichi: F = svd_u * sig * transposed(svd_v)
            // F = mulMat(mulMat(svd_u, sig), transposed(svd_v));

            mF = math.chain(svd_um).multiply(sig_m).multiply(math.transpose(svd_vm)).done();

            // const Jp_new = clamp(p.Jp * oldJ / determinant(F), 0.6, 20.0);
            const Jp_new = clamp(p.Jp * oldJ / math.det(mF), 0.6, 20.0);

            p.Jp = Jp_new;
            p.F = mF;
        }

        async.each(this.particles, gtp);
        // console.log("GTP", clock.getDelta());
    }

    add_particle(snow_particle) {
        let x = this.worldCoordToGrid(snow_particle.position.x, snow_particle.position.y, snow_particle.position.z);
        // let x = this.worldCoordToGrid(snow_particle.position.x, snow_particle.position.y);
        this.particles.push(new Particle(snow_particle, x));
    }

    update_snow_particles() {
        for (let particle of this.particles) {
            let x = this.gridCoordToWorld(...particle.x);
            particle.snow_particle.position.x = x[0];
            particle.snow_particle.position.y = x[1];
            particle.snow_particle.position.z = x[2];
        }
    }
}