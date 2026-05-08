// ComfyUI workflow template — Wan 2.1 T2V (text → video).
// REPLACE this skeleton on the other PC after exporting a working workflow:
//   1. In ComfyUI build & test the T2V workflow with WanVideoWrapper nodes
//   2. Save (API Format) → paste the resulting JSON over the WORKFLOW const below
//   3. Update the NODE_IDS map to point at your prompt / seed / duration / output nodes
//
// The buildPrompt() function injects user params into the placeholder nodes.

const NODE_IDS = {
    positive_prompt: '6',     // CLIPTextEncode (positive)
    negative_prompt: '7',     // CLIPTextEncode (negative)
    sampler_seed: '3',        // KSampler / WanSampler
    duration_node: '40',      // WanVideoSampler num_frames or VHS_DurationNode
    output_combine: '50',     // VHS_VideoCombine (saves mp4)
};

const WORKFLOW = {
    // Skeleton — replace with real exported workflow JSON on the other PC.
    // Below shows the SHAPE only; exact node configs depend on installed wrappers.
    '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: '__POSITIVE_PROMPT__', clip: ['11', 0] },
    },
    '7': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'low quality, blurry, distorted', clip: ['11', 0] },
    },
    '3': {
        class_type: 'KSampler',
        inputs: {
            seed: 0,
            steps: 25,
            cfg: 6.5,
            sampler_name: 'uni_pc',
            scheduler: 'simple',
            denoise: 1.0,
            model: ['10', 0],
            positive: ['6', 0],
            negative: ['7', 0],
            latent_image: ['40', 0],
        },
    },
    '10': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'Wan2.1-T2V-1.3B.safetensors' },
    },
    '11': {
        class_type: 'CLIPLoader',
        inputs: { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan' },
    },
    '40': {
        class_type: 'EmptyHunyuanLatentVideo',
        inputs: { width: 832, height: 480, length: 81, batch_size: 1 },
    },
    '45': {
        class_type: 'VAEDecode',
        inputs: { samples: ['3', 0], vae: ['46', 0] },
    },
    '46': {
        class_type: 'VAELoader',
        inputs: { vae_name: 'wan_2.1_vae.safetensors' },
    },
    '50': {
        class_type: 'VHS_VideoCombine',
        inputs: {
            images: ['45', 0],
            frame_rate: 16,
            loop_count: 0,
            filename_prefix: 'cliphie',
            format: 'video/h264-mp4',
            pix_fmt: 'yuv420p',
            crf: 19,
            save_metadata: false,
            pingpong: false,
            save_output: true,
        },
    },
};

// ComfyUI 16fps default for Wan; 81 frames = ~5s, 121 frames = ~7.5s
function durationToFrames(durationSec) {
    return Math.max(17, Math.round(durationSec * 16) + 1);
}

export function buildPrompt({ prompt, seed = 0, duration = 5, resolution = '480p' }) {
    const wf = JSON.parse(JSON.stringify(WORKFLOW));
    wf[NODE_IDS.positive_prompt].inputs.text = prompt;
    wf[NODE_IDS.sampler_seed].inputs.seed = seed || Math.floor(Math.random() * 2 ** 32);

    const frames = durationToFrames(duration);
    if (wf[NODE_IDS.duration_node]) {
        wf[NODE_IDS.duration_node].inputs.length = frames;
        const [w, h] = resolution === '720p' ? [1280, 720] : [832, 480];
        wf[NODE_IDS.duration_node].inputs.width = w;
        wf[NODE_IDS.duration_node].inputs.height = h;
    }

    return { prompt: wf };
}

export const META = { name: 't2v-wan21', kind: 't2v', accepts: ['prompt', 'seed', 'duration', 'resolution'] };
