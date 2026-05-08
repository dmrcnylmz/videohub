// ComfyUI workflow template — LTX-Video T2V (fast iteration).
// LTX is the fastest open model (real-time on capable GPUs);
// good for prototyping shots before committing to Wan/Seedance Pro.

const NODE_IDS = {
    positive_prompt: '6',
    negative_prompt: '7',
    sampler_seed: '3',
    latent_size: '40',
    output_combine: '50',
};

const WORKFLOW = {
    '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: '__POSITIVE_PROMPT__', clip: ['11', 0] },
    },
    '7': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'low quality, blurry, distorted', clip: ['11', 0] },
    },
    '11': {
        class_type: 'CLIPLoader',
        inputs: { clip_name: 't5xxl_fp16.safetensors', type: 'ltxv' },
    },
    '10': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'ltx-video-0.9.7.safetensors' },
    },
    '40': {
        class_type: 'EmptyLTXVLatentVideo',
        inputs: { width: 768, height: 512, length: 121, batch_size: 1 },
    },
    '3': {
        class_type: 'KSampler',
        inputs: {
            seed: 0,
            steps: 30,
            cfg: 3.0,
            sampler_name: 'euler',
            scheduler: 'normal',
            denoise: 1.0,
            model: ['10', 0],
            positive: ['6', 0],
            negative: ['7', 0],
            latent_image: ['40', 0],
        },
    },
    '45': {
        class_type: 'VAEDecode',
        inputs: { samples: ['3', 0], vae: ['10', 2] },
    },
    '50': {
        class_type: 'VHS_VideoCombine',
        inputs: {
            images: ['45', 0],
            frame_rate: 24,
            loop_count: 0,
            filename_prefix: 'cliphie-ltx',
            format: 'video/h264-mp4',
            pix_fmt: 'yuv420p',
            crf: 19,
            save_metadata: false,
            pingpong: false,
            save_output: true,
        },
    },
};

function durationToFrames(durationSec) {
    return Math.max(25, Math.round(durationSec * 24) + 1);
}

export function buildPrompt({ prompt, seed = 0, duration = 5, resolution = '720p' }) {
    const wf = JSON.parse(JSON.stringify(WORKFLOW));
    wf[NODE_IDS.positive_prompt].inputs.text = prompt;
    wf[NODE_IDS.sampler_seed].inputs.seed = seed || Math.floor(Math.random() * 2 ** 32);

    const frames = durationToFrames(duration);
    const [w, h] = resolution === '720p' ? [1216, 704] : [768, 512];
    wf[NODE_IDS.latent_size].inputs.length = frames;
    wf[NODE_IDS.latent_size].inputs.width = w;
    wf[NODE_IDS.latent_size].inputs.height = h;

    return { prompt: wf };
}

export const META = { name: 't2v-ltx', kind: 't2v', accepts: ['prompt', 'seed', 'duration', 'resolution'] };
