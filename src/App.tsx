import { RecordingControl } from "./features/recorder";
import { RecordingsList, useEntries } from "./features/recordings-list";

function App() {
  const { entries, loadEntries, deleteEntry } = useEntries();

  return (
    <div className="h-screen flex">
      <RecordingControl onStop={loadEntries} />
      <aside className="w-80 border-l bg-gray-50">
        <RecordingsList entries={entries} onDelete={deleteEntry} />
      </aside>
    </div>
  );
}

export default App;
