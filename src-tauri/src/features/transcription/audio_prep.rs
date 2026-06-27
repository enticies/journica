use audioadapter::Adapter;
use audioadapter_buffers::owned::InterleavedOwned;
use hound::WavReader;
use rubato::{
    Async, FixedAsync, Resampler, SincInterpolationParameters, SincInterpolationType,
    WindowFunction,
};
use std::path::Path;

const WHISPER_SAMPLE_RATE: u32 = 16000;
const MIN_TRANSCRIPTION_SECONDS: f32 = 0.5;
const SILENCE_RMS_THRESHOLD: f32 = 0.004;
const SILENCE_PEAK_THRESHOLD: f32 = 0.02;

pub fn is_effectively_silent(samples: &[f32]) -> bool {
    if samples.len() < (WHISPER_SAMPLE_RATE as f32 * MIN_TRANSCRIPTION_SECONDS) as usize {
        return true;
    }

    let mut sum_squares = 0.0_f32;
    let mut peak = 0.0_f32;
    for sample in samples {
        let abs = sample.abs();
        sum_squares += sample * sample;
        peak = peak.max(abs);
    }

    let rms = (sum_squares / samples.len() as f32).sqrt();
    rms < SILENCE_RMS_THRESHOLD && peak < SILENCE_PEAK_THRESHOLD
}

pub fn convert_audio(path: &Path) -> Result<Vec<f32>, Box<dyn std::error::Error + Send + Sync>> {
    let reader = WavReader::open(path)?;
    let spec = reader.spec();

    println!(
        "Loading audio: {} channels, {} Hz, {:?}",
        spec.channels, spec.sample_rate, spec.sample_format
    );

    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader
            .into_samples::<f32>()
            .filter_map(|s| s.ok())
            .collect(),
        hound::SampleFormat::Int => {
            let bits = spec.bits_per_sample;
            let max_val = (1_i64 << (bits - 1)) as f32;
            reader
                .into_samples::<i32>()
                .filter_map(|s| s.ok())
                .map(|s| s as f32 / max_val)
                .collect()
        }
    };

    let mono_samples: Vec<f32> = if spec.channels == 2 {
        samples
            .chunks(2)
            .map(|chunk| {
                let left = chunk[0];
                let right = chunk.get(1).copied().unwrap_or(left);
                (left + right) / 2.0
            })
            .collect()
    } else if spec.channels > 2 {
        samples
            .chunks(spec.channels as usize)
            .map(|chunk| chunk[0])
            .collect()
    } else {
        samples
    };

    let resampled = if spec.sample_rate != WHISPER_SAMPLE_RATE {
        resample(&mono_samples, spec.sample_rate, WHISPER_SAMPLE_RATE)?
    } else {
        mono_samples
    };

    println!(
        "Converted to {} samples at 16kHz mono ({:.2} seconds)",
        resampled.len(),
        resampled.len() as f32 / WHISPER_SAMPLE_RATE as f32
    );

    Ok(resampled)
}

fn resample(
    samples: &[f32],
    from_rate: u32,
    to_rate: u32,
) -> Result<Vec<f32>, Box<dyn std::error::Error + Send + Sync>> {
    let ratio = to_rate as f64 / from_rate as f64;
    let chunk_size = 1024;
    let channels = 1;

    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };

    let mut resampler =
        Async::<f32>::new_sinc(ratio, 1.1, &params, chunk_size, channels, FixedAsync::Input)?;

    let mut output = Vec::new();

    for chunk in samples.chunks(chunk_size) {
        let frames = chunk.len();

        let input_data: Vec<f32> = if frames < chunk_size {
            let mut padded = chunk.to_vec();
            padded.resize(chunk_size, 0.0);
            padded
        } else {
            chunk.to_vec()
        };

        let input_buf = InterleavedOwned::new_from(input_data, channels, chunk_size)
            .map_err(|e| format!("Failed to create input buffer: {:?}", e))?;

        let resampled_buf = resampler.process(&input_buf, 0, None)?;

        let output_frames = resampled_buf.frames();
        for frame in 0..output_frames {
            let sample = resampled_buf.read_sample(0, frame).unwrap_or(0.0);
            output.push(sample);
        }
    }

    Ok(output)
}
