"use strict";

export function add2D(a, b) {return [a[0]+b[0], a[1]+b[1]]}
export function sca2D(a, t) {return [a[0]*t, a[1]*t]}
export function sub2D(a, b) {return [a[0]-b[0], a[1]-b[1]]}
export function add3D(a, b) {return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]}
export function sca3D(a, t) {return [a[0]*t, a[1]*t, a[2]*t]}
export function determinant(a) {return a[0]*a[3]-a[1]*a[2]}
export function transposed(a) {return [a[0], a[2], a[1], a[3]]}
export function mulMat(a, b) {
    return [
        a[0]*b[0]+a[1]*b[2],
        a[0]*b[1]+a[1]*b[3],
        a[2]*b[0]+a[3]*b[2],
        a[2]*b[1]+a[3]*b[3]
    ];
}
export function mulMatVec(a, b) { // transposed, as for taichi's convention
    return [
        a[0]*b[0]+a[2]*b[1],
        a[1]*b[0]+a[3]*b[1]
    ];
}
export function addMat(a, b) {return [a[0]+b[0],a[1]+b[1],a[2]+b[2],a[3]+b[3]]}
export function subMat(a, b) {return [a[0]-b[0],a[1]-b[1],a[2]-b[2],a[3]-b[3]]}
export function outer_product(a, b) { // transposed, as for taichi's convention
    return [
        a[0]*b[0],a[1]*b[0],
        a[0]*b[1],a[1]*b[1]
    ]
}
export function clamp(x, min, max) {return Math.min(Math.max(x,min),max)}
export function polar_decomp(m) { // transposed as in taichi
    const x = m[0] + m[3];
    const y = m[2] - m[1];
    const scale = 1.0 / Math.sqrt(x * x + y * y);
    const c = x * scale;
    const s = y * scale;
    const R = [];
    R[0] = c;
    R[1] = s;
    R[2] = -s;
    R[3] = c;
    const S = mulMat(m, R);

    return {R, S};
}
export function svd(m) { // transposed as in taichi
    let {R:U, S:S} = polar_decomp(m);
    let c, s;
    let sig;
    let V = [];
    if (Math.abs(S[1]) < 1e-6) {
        sig = S;
        c = 1;
        s = 0;
    } else {
        const tao = 0.5 * (S[0] - S[3]);
        const w = Math.sqrt(tao * tao + S[1] * S[1]);
        const t = tao > 0 ? S[1] / (tao + w) : S[1] / (tao - w);
        c = 1.0 / Math.sqrt(t * t + 1);
        s = -t * c;
        sig = [0,0, 0,0];
        sig[0] = c * c * S[0] - 2 * c * s * S[1] + s * s * S[3];
        sig[3] = s * s * S[0] + 2 * c * s * S[1] + c * c * S[3];
    }
    if (sig[0] < sig[3]) {
        const tmp = sig[0];
        sig[0] = sig[3];
        sig[3] = tmp;
        V[0] = -s;
        V[1] = -c;
        V[2] = c;
        V[3] = -s;
    } else {
        V[0] = c;
        V[1] = -s;
        V[2] = s;
        V[3] = c;
    }
    V = transposed(V);
    U = mulMat(U, V);

    return {U, sig, V};
}

/**
 * @description Hadamard product of vectors
 */
export function had2D(a,b) {
    return [a[0]*b[0],a[1]*b[1]];
}