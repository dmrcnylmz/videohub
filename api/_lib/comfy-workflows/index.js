import * as t2vWan21 from './t2v-wan21.js';
import * as i2vWan21 from './i2v-wan21.js';
import * as t2vLtx from './t2v-ltx.js';
import * as stitch from './stitch.js';

export const WORKFLOWS = {
    't2v-wan21': t2vWan21,
    'i2v-wan21': i2vWan21,
    't2v-ltx': t2vLtx,
    'stitch': stitch,
};

export function getWorkflow(name) {
    return WORKFLOWS[name] || null;
}
