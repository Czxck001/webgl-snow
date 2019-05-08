"use strict";

import {add2D, sub2D, sca2D, had2D, determinant, polar_decomp, 
    addMat, mulMat, subMat, transposed, add3D, sca3D, mulMatVec, outer_product,
    svd, clamp} from "./algebra.js";

// material constants
const particle_mass = 1.0;
const vol = 1.0; // particle volume
const hardening = 10.0; // hardening constant for snow plasticity under compression
const E = 1e+4; // Young's modulus
const nu = 0.2; // Poisson's ratio
const mu_0 = E / (2 * (1 + nu)); // Shear modulus (or Dynamic viscosity in fluids)
const lambda_0 = E * nu / ((1+nu) * (1 - 2 * nu)); // Lamé's 1st parameter \lambda=K-(2/3)\mu, where K is the Bulk modulus
const plastic = 1; // whether (1=true) or not (0=false) to simulate plasticity

class Particle {
    constructor(snow_particle, x) {
        this.snow_particle = snow_particle;
        
        this.x = x;
        this.v = [0, 0];
        this.F = [1, 0, 0, 1];
        this.C = [0, 0, 0, 0];
        this.Jp = 1;
    }
}


export default class MPMGrid {
    constructor(box_lowers = [0, 0], box_uppers = [1, 1], n = 80, dt = 1e-4) {
        this.a = box_lowers;
        this.b = box_uppers;

        this.n = n;
        this.dt = dt;

        this.dx = 1.0 / n;
        this.inv_dx = 1.0 / this.dx;

        this.particles = [];
        this.grid = []; // velocity + mass, node_res = cell_res + 1
    }

    gridIndex(i, j) {
        return i + (this.n+1)*j;
    }

    worldCoordToGrid(x, y) {
        return [
            (x - this.a[0]) / (this.b[0] - this.a[0]),
            (y - this.a[1]) / (this.b[1] - this.a[1])
        ]
    }

    gridCoordToWorld(x, y) {
        return [
            x * (this.b[0] - this.a[0]) + this.a[0],
            y * (this.b[1] - this.a[1]) + this.a[1]
        ]
    }

    advance() {
        // Reset grid
        for(let i = 0; i < (this.n+1)*(this.n+1); i++) {
            this.grid[i] = [0,0,0];
        }
    
        // 1. Particles to grid
        for (let p of this.particles) {
            const base_coord=sub2D(sca2D(p.x, this.inv_dx), [0.5,0.5]).map((o)=>parseInt(o)); // element-wise floor
            const fx = sub2D(sca2D(p.x, this.inv_dx), base_coord); // base position in grid units
    
            // Quadratic kernels  [http://mpm.graphics   Eqn. 123, with x=fx, fx-1,fx-2]
            const w = [
                had2D([0.5, 0.5], sub2D([1.5, 1.5], fx).map(o=>o*o)),
                sub2D([0.75, 0.75], sub2D(fx, [1.0, 1.0]).map(o=>o*o)),
                had2D([0.5, 0.5], sub2D(fx, [0.5, 0.5]).map(o=>o*o))
            ];
    
            // Snow-like hardening
            const e = Math.exp(hardening * (1.0 - p.Jp));
            const mu=mu_0*e;
            const lambda=lambda_0*e;
    
            // Cauchy stress times dt and inv_dx
            // original taichi: stress = -4*inv_dx*inv_dx*dt*vol*( 2*mu*(p.F-r)*transposed(p.F) + lambda*(J-1)*J )
            // (in taichi matrices are coded transposed)
            const J = determinant(p.F); // Current volume
            const {R:r, S:s} = polar_decomp(p.F); // Polar decomp. for fixed corotated model
            const k1 = -4*this.inv_dx*this.inv_dx*this.dt*vol;
            const k2 = lambda*(J-1)*J;
            const stress = addMat( mulMat(subMat(transposed(p.F),r),p.F).map(o=>o*2*mu), [k2,0,0,k2] ).map(o=>o*k1);
            const affine = addMat(stress, p.C.map(o=>o*particle_mass));
    
            const mv = [p.v[0]*particle_mass, p.v[1]*particle_mass, particle_mass]; // translational momentum
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) { // scatter to grid
                    const dpos = [(i-fx[0])*this.dx, (j-fx[1])*this.dx];
                    const ii = this.gridIndex(base_coord[0] + i, base_coord[1] + j);
                    const weight = w[i][0] * w[j][1];
                    this.grid[ii] = add3D(this.grid[ii], sca3D(add3D(mv, [...mulMatVec(affine, dpos),0]), weight));
                }
            }
        }
    
        // Modify grid velocities to respect boundaries
        const boundary = 0.05;
        for(let i = 0; i <= this.n; i++) {
            for(let j = 0; j <= this.n; j++) { // for all grid nodes
                const ii = this.gridIndex(i, j);
                if (this.grid[ii][2] > 0) { // no need for epsilon here
                    this.grid[ii] = this.grid[ii].map(o=>o/this.grid[ii][2]); // normalize by mass
                    this.grid[ii] = add3D(this.grid[ii], [0,-200*this.dt,0]); // add gravity
                    const x = i/this.n;
                    const y = j/this.n; // boundary thickness, node coord
    
                    // stick
                    if (x < boundary||x > 1-boundary||y > 1-boundary) {
                        this.grid[ii]=[0,0,0];
                    }
    
                    // separate
                    if (y < boundary) {
                        this.grid[ii][1] = Math.max(0.0, this.grid[ii][1]);
                    }
                }
            }
        }
    
        // 2. Grid to particle
        for (let p of this.particles) {
            const base_coord=sub2D(p.x.map(o=>o*this.inv_dx),[0.5,0.5]).map(o=>parseInt(o));// element-wise floor
            const fx = sub2D(sca2D(p.x, this.inv_dx), base_coord); // base position in grid units
            const w = [
                had2D([0.5, 0.5], sub2D([1.5, 1.5], fx).map(o=>o*o)),
                sub2D([0.75, 0.75], sub2D(fx, [1.0, 1.0]).map(o=>o*o)),
                had2D([0.5, 0.5], sub2D(fx, [0.5,0.5]).map(o=>o*o))
            ];
            p.C = [0,0, 0,0];
            p.v = [0, 0];
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    const dpos = sub2D([i, j], fx);
                    const ii = this.gridIndex(base_coord[0] + i, base_coord[1] + j);
                    const weight = w[i][0] * w[j][1];
                    p.v = add2D(p.v, sca2D(this.grid[ii], weight)); // velocity
                    p.C = addMat(p.C, outer_product(sca2D(this.grid[ii],weight), dpos).map(o=>o*4*this.inv_dx)); // APIC (affine particle-in-cell); p.C is the affine momentum
                }
            }
    
            // advection
            p.x = add2D(p.x, sca2D(p.v, this.dt));
    
            // MLS-MPM F-update
            // original taichi: F = (Mat(1) + dt * p.C) * p.F
            let F = mulMat(p.F, addMat([1,0, 0,1], p.C.map(o=>o*this.dt)));
    
            // Snow-like plasticity
            let {U:svd_u, sig:sig, V:svd_v} = svd(F);
            for (let i = 0; i < 2 * plastic; i++) {
                sig[i+2*i] = clamp(sig[i+2*i], 1.0 - 2.5e-2, 1.0 + 7.5e-3);
            }
            const oldJ = determinant(F);
            // original taichi: F = svd_u * sig * transposed(svd_v)
            F = mulMat(mulMat(svd_u, sig), transposed(svd_v));
            const Jp_new = clamp(p.Jp * oldJ / determinant(F), 0.6, 20.0);
            p.Jp = Jp_new;
            p.F = F;
        }
    }

    add_particle(snow_particle) {
        let x = this.worldCoordToGrid(snow_particle.position.x, snow_particle.position.y);
        this.particles.push(new Particle(snow_particle, x));
    }

    update_snow_particles() {
        for (let particle of this.particles) {
            let x = this.gridCoordToWorld(particle.x[0], particle.x[1]);
            particle.snow_particle.position.x = x[0];
            particle.snow_particle.position.y = x[1];
        }
    }
}