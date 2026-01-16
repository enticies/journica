use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};
use std::thread;

pub enum AudioCommand {
    Start,
    Stop,
}

pub fn spawn_audio_thread(rx: Receiver<AudioCommand>) {
    thread::spawn(move || {
        let mut _stream: Option<cpal::Stream> = None;
        let mut writer: Option<Arc<Mutex<WavWriter<BufWriter<File>>>>> = None;

        let host = cpal::default_host();
        let device = host.default_input_device().expect("No input device");
        let config = device.default_input_config().expect("No default config");

        loop {
            match rx.recv() {
                Ok(AudioCommand::Start) => {
                    println!("Starting recording...");

                    let spec = WavSpec {
                        channels: config.channels(),
                        sample_rate: config.sample_rate().0,
                        bits_per_sample: 32,
                        sample_format: hound::SampleFormat::Float,
                    };
                    let wav_writer = WavWriter::create("recording.wav", spec).unwrap();
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
                            |err| eprintln!("Stream error: {}", err),
                            None,
                        )
                        .unwrap();

                    new_stream.play().unwrap();
                    _stream = Some(new_stream);
                }
                Ok(AudioCommand::Stop) => {
                    println!("Stopping recording...");
                    _stream = None;

                    if let Some(w) = writer.take() {
                        if let Ok(w) = Arc::try_unwrap(w) {
                            w.into_inner().unwrap().finalize().ok();
                        }
                    }
                }
                Err(_) => break,
            }
        }
    });
}