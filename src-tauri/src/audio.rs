use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

pub enum AudioCommand {
    Start { file_path: PathBuf },
    Stop { response_tx: Sender<Option<f64>> },
}

pub fn spawn_audio_thread(rx: Receiver<AudioCommand>) {
    thread::spawn(move || {
        let mut _stream: Option<cpal::Stream> = None;
        let mut writer: Option<Arc<Mutex<WavWriter<BufWriter<File>>>>> = None;

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
                    println!("Starting recording to {:?}", file_path);

                    let spec = WavSpec {
                        channels: config.channels(),
                        sample_rate: config.sample_rate().0,
                        bits_per_sample: 32,
                        sample_format: hound::SampleFormat::Float,
                    };
                    let wav_writer = WavWriter::create(&file_path, spec).unwrap();
                    let wav_writer = Arc::new(Mutex::new(wav_writer));
                    writer = Some(wav_writer.clone());

                    let writer_clone = wav_writer.clone();
                    let stream_config = config.clone().into();
                    let new_stream = device
                        .build_input_stream(
                            &stream_config,
                            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                                if let Ok(mut w) = writer_clone.lock() {
                                    for &sample in data {
                                        w.write_sample(sample).ok();
                                    }
                                }
                            },
                            |err| eprintln!("Stream error: {err}"),
                            None,
                        )
                        .unwrap();

                    new_stream.play().unwrap();
                    _stream = Some(new_stream);
                }
                Ok(AudioCommand::Stop { response_tx }) => {
                    println!("Stopping recording...");
                    _stream = None;

                    let duration = if let Some(w) = writer.take() {
                        if let Ok(w) = Arc::try_unwrap(w) {
                            let w = w.into_inner().unwrap();
                            let duration_seconds =
                                w.duration() as f64 / w.spec().sample_rate as f64;
                            w.finalize().ok();
                            Some(duration_seconds)
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    response_tx.send(duration).ok();
                }
                Err(_) => break,
            }
        }
    });
}
