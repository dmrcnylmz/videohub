// ComfyUI workflow template — concat & crossfade N video clips into one final mp4.
// Used by the multi-shot ad pipeline after all individual clips are generated.
//
// Architecture: Cliphie passes a list of ComfyUI output filenames + transition
// duration. The workflow loads each via VHS_LoadVideoPath, applies a small
// crossfade between each pair, and writes a single final.mp4.
//
// REPLACE this skeleton on the other PC after exporting a working workflow:
//   1. Build a 2-clip concat workflow in ComfyUI using VideoHelperSuite nodes
//   2. Save (API Format) → use as a base; the buildPrompt below will dynamically
//      duplicate the LoadVideoPath node for arbitrary clip count
//   3. Update NODE_IDS to point at the right ids

const NODE_IDS = {
    output_combine: '99',
};

function loadVideoNodeId(idx) {
    return `100${idx.toString().padStart(2, '0')}`;
}

export function buildPrompt({ clip_filenames = [], transition_seconds = 0.4, frame_rate = 16, output_prefix = 'cliphie-stitched' }) {
    if (!clip_filenames.length) {
        throw new Error('stitch workflow requires at least one clip filename');
    }
    const wf = {};

    clip_filenames.forEach((fname, idx) => {
        wf[loadVideoNodeId(idx)] = {
            class_type: 'VHS_LoadVideoPath',
            inputs: {
                video: fname,                  // resolved relative to ComfyUI output/
                force_rate: frame_rate,
                force_size: 'Disabled',
                custom_width: 0,
                custom_height: 0,
                frame_load_cap: 0,
                skip_first_frames: 0,
                select_every_nth: 1,
            },
        };
    });

    // Concat with crossfade. Real workflow needs more nodes (VHS_BatchManager,
    // image batch concat, FrameInterpolation for the transition window) — this
    // skeleton is the SHAPE; replace with exported workflow.
    if (clip_filenames.length === 1) {
        wf['200'] = {
            class_type: 'VHS_VideoCombine',
            inputs: {
                images: [loadVideoNodeId(0), 0],
                frame_rate,
                loop_count: 0,
                filename_prefix: output_prefix,
                format: 'video/h264-mp4',
                pix_fmt: 'yuv420p',
                crf: 19,
                save_metadata: false,
                pingpong: false,
                save_output: true,
            },
        };
    } else {
        // Pairwise concat — chain crossfades.
        // NOTE: Real implementation needs custom node like ImpactPack's
        // ImageBatchToImageList + xfade. For now we just sequential concat
        // (hard cuts) as a fallback until real workflow is exported.
        wf['199'] = {
            class_type: 'VHS_BatchManager',
            inputs: clip_filenames.reduce((acc, _, idx) => {
                acc[`frames_${idx}`] = [loadVideoNodeId(idx), 0];
                return acc;
            }, { frames_per_batch: 0, transition_frames: Math.round(transition_seconds * frame_rate) }),
        };
        wf[NODE_IDS.output_combine] = {
            class_type: 'VHS_VideoCombine',
            inputs: {
                images: ['199', 0],
                frame_rate,
                loop_count: 0,
                filename_prefix: output_prefix,
                format: 'video/h264-mp4',
                pix_fmt: 'yuv420p',
                crf: 19,
                save_metadata: false,
                pingpong: false,
                save_output: true,
            },
        };
    }

    return { prompt: wf };
}

export const META = { name: 'stitch', kind: 'stitch', accepts: ['clip_filenames', 'transition_seconds', 'frame_rate'] };
