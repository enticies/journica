import { invoke } from '@tauri-apps/api/core';

import { useState } from "react";
import "./App.css";

function App() {
  const [isRecording, setIsRecording] = useState(false);

  const toggleRecording = async () => {
    try {
      if (!isRecording) {
        invoke("start_recording");
        console.log("start recording");
      } else {
        invoke("stop_recording");
        console.log("stop recording");
      }
      setIsRecording(!isRecording);
    }
    catch (err) {
      console.error(err);
      alert(err);
    }
  }

  return (
    <main className="container">
      <button onClick={toggleRecording}>
        {isRecording ? "Stop recording" : "Start recording"}
      </button>
    </main>
  );
}

export default App;
