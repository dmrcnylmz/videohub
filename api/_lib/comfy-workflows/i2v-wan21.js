// ComfyUI workflow template — Wan 2.1 I2V (image → video).
// Continuity'nin kalbi: önceki klibin son frame'i input olarak verilir,
// yeni klip o frame'den başlar. Multi-shot reklamda hard-cut'ı önler.
//
// REPLACE this skeleton with a real exported workflow on the other PC.
// The local-comfy adapter uploads the input image to ComfyUI's input/ dir
// first via POST /upload/image, then references it by filename in LoadImage.

const NODE_IDS = {
    load_image: '20',         // LoadImage — adapter sets .image to uploaded filename
    positive_prompt: '6',
    negative_prompt: '7',
    sampler_seed: '3',
    output_combine: '50',
};

const WORKFLOW = {
    '20': {
        class_type: 'LoadImage',
        inputs: { image: '__INPUT_IMAGE__' },
    },
    '21': {
        class_type: 'CLIPVisionLoader',
        inputs: { clip_name: 'clip_vision_h.safetensors' },
    },
    '22': {
        class_type: 'CLIPVisionEncode',
        inputs: { clip_vision: ['21', 0], image: ['20', 0], crop: 'center' },
    },
    '6': {
        class_type: 'CLIPTextEncode',
        inputs: { text: '__POSITIVE_PROMPT__', clip: ['11', 0] },
    },
    '7': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'low quality, blurry, distorted, jump cut', clip: ['11', 0] },
    },
    '11': {
        class_type: 'CLIPLoader',
        inputs: { clip_name: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', type: 'wan' },
    },
    '10': {
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'Wan2.1-I2V-1.3B-480P.safetensors' },
    },
    '40': {
        class_type: 'WanImageToVideo',
        inputs: {
            positive: ['6', 0],
            negative: ['7', 0],
            vae: ['46', 0],
            clip_vision_output: ['22', 0],
            start_image: ['20', 0],
            width: 832,
            height: 480,
            length: 81,
            batch_size: 1,
        },
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
            positive: ['40', 0],
            negative: ['40', 1],
            latent_image: ['40', 2],
        },
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
            filename_prefix: 'cliphie-i2v',
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
    return Math.max(17, Math.round(durationSec * 16) + 1);
}

export function buildPrompt({ prompt, image_filename, seed = 0, duration = 5, resolution = '480p' }) {
    if (!image_filename) {
        throw new Error('i2v workflow requires image_filename (uploaded by adapter)');
    }
    const wf = JSON.parse(JSON.stringify(WORKFLOW));
    wf[NODE_IDS.load_image].inputs.image = image_filename;
    wf[NODE_IDS.positive_prompt].inputs.text = prompt;
    wf[NODE_IDS.sampler_seed].inputs.seed = seed || Math.floor(Math.random() * 2 ** 32);

    const frames = durationToFrames(duration);
    const [w, h] = resolution === '720p' ? [1280, 720] : [832, 480];
    if (wf['40']) {
        wf['40'].inputs.length = frames;
        wf['40'].inputs.width = w;
        wf['40'].inputs.height = h;
    }

    return { prompt: wf };
}

export const META = { name: 'i2v-wan21', kind: 'i2v', accepts: ['prompt', 'image_url', 'seed', 'duration', 'resolution'] };
