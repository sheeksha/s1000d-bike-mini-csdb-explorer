import logo from "./assets/logo.png";
import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function App() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedLabels, setSelectedLabels] = useState("Mountain bicycle, Brook trekker Mk9");
  const [applicablePaths, setApplicablePaths] = useState(null);
  const [applicText, setApplicText] = useState("");
  const [selectedDM, setSelectedDM] = useState(null);
  const [dmXml, setDmXml] = useState("");
  const [appliesInfo, setAppliesInfo] = useState(null);

  const openDM = async (dm) => {
    if (selectedDM?.path === dm.path) {
      setSelectedDM(null);
      setDmXml(data.xml || "");
      setApplicText(data.applic_text || "");
      return;
    }
    setSelectedDM(dm);
    setErr("");
    setDmXml("Loading XML...");
    try {
      const url = `${API_BASE}/dm?path=${encodeURIComponent(dm.path)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load DM XML");
      setDmXml(data.xml || "");
    } catch (e) {
      setDmXml("");
      setErr(String(e));
    }
    setAppliesInfo(null);
    const evalUrl = `${API_BASE}/dm-eval?path=${encodeURIComponent(dm.path)}&selected=${encodeURIComponent(selectedLabels)}`;
    const evalRes = await fetch(evalUrl);
    const evalData = await evalRes.json();
    if (evalRes.ok) setAppliesInfo(evalData);
  };

  const loadDMs = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/dms?only_dmc=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load DMs");
      setItems(data.items || []);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  const clearFilter = () => {
    setApplicablePaths(null);   // removes applicability filtering
    setErr("");                 // clears any previous error
    setSelectedDM(null);        // collapses expanded row (optional but feels right)
    setDmXml("");               // clears xml cache (optional)
    // setAppliesInfo(null);       // if you have appliesInfo/applicText state, clear those too:
    // setApplicText("");
  };

  const runResolve = async () => {
    setErr("");

    const selected = selectedLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`${API_BASE}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Resolve failed");

      const paths = new Set((data.applicable || []).map((x) => x.path));
      setApplicablePaths(paths.size > 0 ? paths : null);
      setSelectedDM(null);
      setDmXml("");
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => {
    document.title = "S1000D Mini CSDB Explorer";
    loadDMs();
  }, []);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();

    return items.filter((dm) => {
      if (applicablePaths && !applicablePaths.has(dm.path)) return false;
      if (!query) return true;

      return (
        (dm.dmCode || "").toLowerCase().includes(query) ||
        (dm.dmTitle || "").toLowerCase().includes(query) ||
        (dm.path || "").toLowerCase().includes(query)
      );
    });
  }, [items, q, applicablePaths]);

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <img src={logo} alt="Logo" style={{ height: 36 }} />
        <h2 style={{ margin: 0 }}>S1000D Bike Mini CSDB Explorer</h2>
      </div>
      <div style={{ color: "#555", marginBottom: 16 }}>
        Browse Data Modules, filter by applicability, and inspect metadata.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dmCode / title..."
          style={{ padding: 10, flex: "1 1 320px" }}
        />

        <input
          value={selectedLabels}
          onChange={(e) => setSelectedLabels(e.target.value)}
          placeholder="Applicability labels (comma-separated)"
          style={{ padding: 10, flex: "2 1 420px" }}
        />

        <button onClick={runResolve} style={{ padding: "10px 14px" }}>
          Filter by Applicability
        </button>

        <button
          onClick={clearFilter}
          style={{ padding: "10px 14px" }}
          disabled={!applicablePaths || applicablePaths.size === 0}

        >
          Clear Filter
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {loading && <div>Loading DMs…</div>}
        {err && (
          <div style={{ color: "crimson" }}>
            <strong>Error:</strong> {err}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", color: "#444" }}>
        <div>
          Showing <strong>{filtered.length}</strong> of <strong>{items.length}</strong> DMs
          {applicablePaths ? " (applicability filter ON)" : ""}
        </div>
      </div>

      {/* DM list table */}
      <div
        style={{
          marginTop: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          background: "white",
        }}
>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr 140px",
            background: "#fafafa",
            padding: 10,
            fontWeight: 600,
          }}
        >
          <div>dmCode</div>
          <div>Title</div>
          <div>Has applic?</div>
        </div>

        {filtered.map((dm) => (
          <div key={dm.path}>
            {/* Row */}
            <div
              onClick={() => openDM(dm)}
              style={{
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: "260px 1fr 140px",
                padding: 10,
                borderTop: "1px solid #eee",
                gap: 10,
              }}
            >
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                {dm.dmCode || "—"}
              </div>
              <div>{dm.dmTitle || "—"}</div>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    border: "1px solid #e5e7eb",
                    background: dm.has_applicability ? "#ecfdf5" : "#f3f4f6",
                  }}
                >
                  {dm.has_applicability ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {/* Detail panel directly under this row */}
            {selectedDM?.path === dm.path && (
              <div
                style={{
                  borderTop: "1px solid #eee",
                  padding: 12,
                  background: "#fafafa",
                }}
              >

              <div style={{ marginBottom: 10, fontSize: 12, color: "#374151" }}>
                <div>
                  <strong>Applies:</strong>{" "}
                  {appliesInfo ? (appliesInfo.applies ? "✅ Yes" : "❌ No") : "…"}
                </div>

                <div style={{ marginTop: 4 }}>
                  <strong>Reason kind:</strong> {appliesInfo?.reason_kind || "…"}
                </div>

                {appliesInfo?.act_dmCode && (
                  <div style={{ marginTop: 4 }}>
                    <strong>ACT:</strong> {appliesInfo.act_dmCode}
                  </div>
                )}

                <div style={{ marginTop: 6 }}>
                  <strong>Why:</strong>{" "}
                  {appliesInfo?.reason_text
                    ? appliesInfo.reason_text
                    : "(No matching group expression found for current selection)"}
                </div>
              </div>

                <pre
                  style={{
                    maxHeight: 360,
                    overflow: "auto",
                    background: "#0f172a",
                    color: "#e5e7eb",
                    padding: 12,
                    borderRadius: 10,
                    fontSize: 12,
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    margin: 0,
                  }}
                >
                  {dmXml || "(no xml loaded)"}
                </pre>
              </div>
            )}
          </div>
        ))}
              </div>
    </div>
  );
}
