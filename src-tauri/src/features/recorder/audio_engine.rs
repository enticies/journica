use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, SupportedStreamConfig};
use hound::{WavSpec, WavWriter};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

type SharedWriter = Arc<Mutex<Option<ChunkedWriter>>>;

const CHUNK_SECONDS: u32 = 30;

#[derive(Clone, Serialize, Deserialize)]
pub struct RecordingManifest {
    pub id: String,
    pub storage_path: String,
    pub display_name: String,
    pub created_at: i64,
    pub sample_rate: u32,
    pub channels: u16,
    pub chunks: Vec<String>,
    pub total_frames: u64,
    pub status: String,
}

pub struct StoppedRecording {
    pub duration_seconds: Option<f64>,
}

pub enum AudioCommand {
    Start {
        session_dir: PathBuf,
        final_file_path: PathBuf,
        manifest: RecordingManifest,
    },
    Pause,
    Resume,
    Stop {
        response_tx: Sender<Result<StoppedRecording, String>>,
    },
}

fn manifest_path(session_dir: &Path) -> PathBuf {
    session_dir.join("manifest.json")
}

pub fn write_manifest(session_dir: &Path, manifest: &RecordingManifest) -> Result<(), String> {
    std::fs::create_dir_all(session_dir).map_err(|e| e.to_string())?;

    let path = manifest_path(session_dir);
    let tmp_path = session_dir.join("manifest.json.tmp");
    let contents = serde_json::to_vec_pretty(manifest).map_err(|e| e.to_string())?;
    let mut file = File::create(&tmp_path).map_err(|e| e.to_string())?;
    file.write_all(&contents).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &path).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn read_manifest(session_dir: &Path) -> Result<RecordingManifest, String> {
    let contents = std::fs::read(manifest_path(session_dir)).map_err(|e| e.to_string())?;
    serde_json::from_slice(&contents).map_err(|e| e.to_string())
}

fn chunk_name(index: usize) -> String {
    format!("chunk_{index:06}.wav")
}

fn tmp_chunk_name(index: usize) -> String {
    format!("chunk_{index:06}.tmp.wav")
}

fn create_wav_writer(path: &Path, spec: WavSpec) -> Result<WavWriter<BufWriter<File>>, String> {
    WavWriter::create(path, spec).map_err(|e| e.to_string())
}

struct ChunkedWriter {
    session_dir: PathBuf,
    final_file_path: PathBuf,
    manifest: RecordingManifest,
    spec: WavSpec,
    writer: Option<WavWriter<BufWriter<File>>>,
    chunk_index: usize,
    samples_in_chunk: u64,
    max_samples_per_chunk: u64,
}

impl ChunkedWriter {
    fn new(
        session_dir: PathBuf,
        final_file_path: PathBuf,
        manifest: RecordingManifest,
        spec: WavSpec,
    ) -> Result<Self, String> {
        std::fs::create_dir_all(&session_dir).map_err(|e| e.to_string())?;

        let mut chunked = Self {
            session_dir,
            final_file_path,
            manifest,
            spec,
            writer: None,
            chunk_index: 1,
            samples_in_chunk: 0,
            max_samples_per_chunk: spec.sample_rate as u64
                * spec.channels as u64
                * CHUNK_SECONDS as u64,
        };
        chunked.open_next_chunk()?;
        chunked.write_manifest()?;

        Ok(chunked)
    }

    fn write_manifest(&self) -> Result<(), String> {
        write_manifest(&self.session_dir, &self.manifest)
    }

    fn open_next_chunk(&mut self) -> Result<(), String> {
        let tmp_path = self.session_dir.join(tmp_chunk_name(self.chunk_index));
        self.writer = Some(create_wav_writer(&tmp_path, self.spec)?);
        self.samples_in_chunk = 0;
        Ok(())
    }

    fn write_sample(&mut self, sample: f32) -> Result<(), String> {
        if let Some(writer) = self.writer.as_mut() {
            writer.write_sample(sample).map_err(|e| e.to_string())?;
            self.samples_in_chunk += 1;
            self.manifest.total_frames +=
                (self.samples_in_chunk % self.spec.channels as u64 == 0) as u64;
        }

        if self.samples_in_chunk >= self.max_samples_per_chunk {
            self.finalize_current_chunk()?;
            self.chunk_index += 1;
            self.open_next_chunk()?;
        }

        Ok(())
    }

    fn finalize_current_chunk(&mut self) -> Result<(), String> {
        let Some(writer) = self.writer.take() else {
            return Ok(());
        };

        let chunk_samples = self.samples_in_chunk;
        writer.finalize().map_err(|e| e.to_string())?;

        let tmp_path = self.session_dir.join(tmp_chunk_name(self.chunk_index));
        let chunk = chunk_name(self.chunk_index);
        let chunk_path = self.session_dir.join(&chunk);

        if chunk_samples > 0 {
            std::fs::rename(&tmp_path, &chunk_path).map_err(|e| e.to_string())?;
            self.manifest.chunks.push(chunk);
            self.write_manifest()?;
        } else {
            std::fs::remove_file(&tmp_path).ok();
        }

        Ok(())
    }

    fn stop(mut self) -> Result<StoppedRecording, String> {
        self.finalize_current_chunk()?;

        if self.manifest.chunks.is_empty() {
            return Ok(StoppedRecording {
                duration_seconds: None,
            });
        }

        merge_manifest_chunks(&self.session_dir, &self.manifest, &self.final_file_path)?;
        self.manifest.status = "ready".to_string();
        self.write_manifest()?;

        Ok(StoppedRecording {
            duration_seconds: Some(
                self.manifest.total_frames as f64 / self.manifest.sample_rate as f64,
            ),
        })
    }
}

pub fn merge_manifest_chunks(
    session_dir: &Path,
    manifest: &RecordingManifest,
    final_file_path: &Path,
) -> Result<f64, String> {
    if manifest.chunks.is_empty() {
        return Err("Recording has no recoverable audio chunks.".to_string());
    }

    if let Some(parent) = final_file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let tmp_final_path = final_file_path.with_extension("wav.tmp");
    std::fs::remove_file(&tmp_final_path).ok();

    let spec = WavSpec {
        channels: manifest.channels,
        sample_rate: manifest.sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let mut writer = create_wav_writer(&tmp_final_path, spec)?;
    let mut total_samples = 0_u64;

    for chunk in &manifest.chunks {
        let chunk_path = session_dir.join(chunk);
        let mut reader = hound::WavReader::open(&chunk_path).map_err(|e| e.to_string())?;
        if reader.spec() != spec {
            return Err(format!(
                "Recovered chunk has incompatible audio format: {chunk}"
            ));
        }

        for sample in reader.samples::<f32>() {
            writer
                .write_sample(sample.map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
            total_samples += 1;
        }
    }

    writer.finalize().map_err(|e| e.to_string())?;
    std::fs::remove_file(final_file_path).ok();
    std::fs::rename(&tmp_final_path, final_file_path).map_err(|e| e.to_string())?;

    Ok(total_samples as f64 / manifest.channels as f64 / manifest.sample_rate as f64)
}

fn start_audio(
    config: &SupportedStreamConfig,
    device: &Device,
    session_dir: PathBuf,
    final_file_path: PathBuf,
    mut manifest: RecordingManifest,
) -> Option<(cpal::Stream, SharedWriter)> {
    println!("Starting recording session in {:?}", session_dir);

    let spec = WavSpec {
        channels: config.channels(),
        sample_rate: config.sample_rate().0,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    manifest.sample_rate = spec.sample_rate;
    manifest.channels = spec.channels;
    write_manifest(&session_dir, &manifest).ok()?;

    let writer = ChunkedWriter::new(session_dir, final_file_path, manifest, spec).ok()?;
    let shared_writer = Arc::new(Mutex::new(Some(writer)));
    let writer_clone = Arc::clone(&shared_writer);
    let stream_config = config.clone().into();

    let write_sample = move |sample: f32| {
        if let Ok(mut guard) = writer_clone.lock() {
            if let Some(writer) = guard.as_mut() {
                writer.write_sample(sample).ok();
            }
        }
    };

    let new_stream = match config.sample_format() {
        SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                for &sample in data {
                    write_sample(sample);
                }
            },
            |err| eprintln!("Stream error: {err}"),
            None,
        ),
        SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _: &cpal::InputCallbackInfo| {
                for &sample in data {
                    write_sample(sample as f32 / i16::MAX as f32);
                }
            },
            |err| eprintln!("Stream error: {err}"),
            None,
        ),
        SampleFormat::U16 => device.build_input_stream(
            &stream_config,
            move |data: &[u16], _: &cpal::InputCallbackInfo| {
                for &sample in data {
                    write_sample((sample as f32 - 32768.0) / 32768.0);
                }
            },
            |err| eprintln!("Stream error: {err}"),
            None,
        ),
        sample_format => {
            eprintln!("Unsupported input sample format: {sample_format:?}");
            return None;
        }
    }
    .ok()?;

    new_stream.play().ok()?;

    Some((new_stream, shared_writer))
}

fn stop_audio(writer: Option<SharedWriter>) -> Result<StoppedRecording, String> {
    println!("Stopping recording...");

    let Some(shared_writer) = writer else {
        return Ok(StoppedRecording {
            duration_seconds: None,
        });
    };
    let mut guard = shared_writer.lock().map_err(|e| e.to_string())?;
    let Some(writer) = guard.take() else {
        return Ok(StoppedRecording {
            duration_seconds: None,
        });
    };

    writer.stop()
}

pub fn spawn_audio_thread(rx: Receiver<AudioCommand>) {
    thread::spawn(move || {
        let mut _stream: Option<cpal::Stream> = None;
        let mut writer: Option<SharedWriter> = None;

        let host = cpal::default_host();
        println!("Audio host: {:?}", host.id());

        let device = host.default_input_device().expect("No input device");
        let device_name = device
            .name()
            .unwrap_or_else(|e| format!("Unknown device (error: {e})"));
        println!("Recording device: {device_name}");

        let config = device.default_input_config().expect("No default config");
        println!(
            "Audio config: {} channels, {} Hz, {:?}",
            config.channels(),
            config.sample_rate().0,
            config.sample_format()
        );

        loop {
            match rx.recv() {
                Ok(AudioCommand::Start {
                    session_dir,
                    final_file_path,
                    manifest,
                }) => {
                    if let Some((new_stream, new_writer)) =
                        start_audio(&config, &device, session_dir, final_file_path, manifest)
                    {
                        _stream = Some(new_stream);
                        writer = Some(new_writer);
                    }
                }
                Ok(AudioCommand::Pause) => {
                    if let Some(stream) = _stream.as_ref() {
                        stream.pause().ok();
                    }
                }
                Ok(AudioCommand::Resume) => {
                    if let Some(stream) = _stream.as_ref() {
                        stream.play().ok();
                    }
                }
                Ok(AudioCommand::Stop { response_tx }) => {
                    _stream = None;
                    response_tx.send(stop_audio(writer.take())).ok();
                }
                Err(_) => break,
            }
        }
    });
}
