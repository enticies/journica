use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SupportedStreamConfig};
use hound::{WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

type SharedWriter = Arc<Mutex<Option<WavWriter<BufWriter<File>>>>>;

pub enum AudioCommand {
    Start { file_path: PathBuf },
    Pause,
    Resume,
    Stop { response_tx: Sender<Option<f64>> },
}

fn start_audio(
    config: &SupportedStreamConfig,
    device: &Device,
    file_path: PathBuf,
) -> Option<(cpal::Stream, SharedWriter)> {
    println!("Starting recording to {:?}", file_path);

    let spec = WavSpec {
        channels: config.channels(),
        sample_rate: config.sample_rate().0,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let writer = WavWriter::create(&file_path, spec).ok()?;
    let shared_writer = Arc::new(Mutex::new(Some(writer)));

    let writer_clone = Arc::clone(&shared_writer);
    let stream_config = config.clone().into();
    let new_stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if let Ok(mut guard) = writer_clone.lock() {
                    if let Some(writer) = guard.as_mut() {
                        for &sample in data {
                            writer.write_sample(sample).ok();
                        }
                    }
                }
            },
            |err| eprintln!("Stream error: {err}"),
            None,
        )
        .ok()?;

    new_stream.play().ok()?;

    Some((new_stream, shared_writer))
}

fn stop_audio(writer: Option<SharedWriter>) -> Option<f64> {
    println!("Stopping recording...");

    let shared_writer = writer?;
    let mut guard = shared_writer.lock().ok()?;
    let writer = guard.take()?;

    let duration_seconds = writer.duration() as f64 / writer.spec().sample_rate as f64;
    writer.finalize().ok()?;

    Some(duration_seconds)
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
                Ok(AudioCommand::Start { file_path }) => {
                    if let Some((new_stream, new_writer)) = start_audio(&config, &device, file_path)
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
                    let duration = stop_audio(writer.take());
                    response_tx.send(duration).ok();
                }
                Err(_) => break,
            }
        }
    });
}
