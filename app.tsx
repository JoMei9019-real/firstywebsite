// frontend/src/App.tsx
import { useState } from "react";

function App() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setError("");
    setResult(null);
    try {
      const res = await fetch(`http://localhost:8000/verify/${username}?token=changeme`);
      if (!res.ok) throw new Error("User not found or unauthorized.");
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="backdrop-blur-xl bg-white/10 p-10 rounded-3xl shadow-2xl w-[90%] max-w-xl text-white">
        <h1 className="text-3xl font-semibold text-center mb-6">🔍 ICCID Lookup</h1>
        <input
          type="text"
          placeholder="Enter Discord Username"
          className="w-full px-4 py-2 rounded-xl bg-white/20 placeholder-white/70 text-white focus:outline-none mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          onClick={fetchData}
          className="w-full py-2 bg-green-500 hover:bg-green-600 rounded-xl font-semibold transition"
        >
          Search
        </button>

        {error && <p className="mt-4 text-red-400">{error}</p>}

        {result && (
          <div className="mt-6 p-4 rounded-xl bg-white/10 border border-white/10">
            <p><strong>Username:</strong> {result.username}</p>
            <p><strong>ICCID:</strong> {result.esim_number}</p>
            <p><strong>Verified:</strong> {new Date(result.timestamp).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
