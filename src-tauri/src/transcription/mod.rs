pub mod audio_prep;

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct TranscriptionResult {
    pub entry_id: String,
    pub transcript: String,
}
