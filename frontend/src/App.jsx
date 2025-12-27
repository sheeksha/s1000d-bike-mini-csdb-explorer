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

  const [selectedDM, setSelectedDM] = useState(null);
  const [dmPreview, setDmPreview] = useState(null);

  const [showRawXml, setShowRawXml] = useState(false);
  const [dmXml, setDmXml] = useState("");

  const [appliesInfo, setAppliesInfo] = useState(null);

  // -------------------------
  // Manual preview renderer
  // -------------------------
  const ManualPreview = ({ preview }) => {
    if (!preview) return <div style={{ color: "#666" }}>Select a DM to preview.</div>;

    const cardStyle = {
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 14,
      background: "white",
    };

    const label = (emoji, title) => (
      <div style={{ fontWeight: 700, marginTop: 12, marginBottom: 6 }}>
        <span style={{ marginRight: 8 }}>{emoji}</span>
        {title}
      </div>
    );

    if (preview.dm_type_guess === "procedure") {
      return (
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#666" }}>
            Type: <strong>Procedure</strong>
          </div>

          {!!preview.warnings?.length && (
            <>
              {label("⚠️", "Warnings")}
              <ul style={{ marginTop: 0 }}>
                {preview.warnings.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {!!preview.cautions?.length && (
            <>
              {label("❗", "Cautions")}
              <ul style={{ marginTop: 0 }}>
                {preview.cautions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {!!preview.notes?.length && (
            <>
              {label("ℹ️", "Notes")}
              <ul style={{ marginTop: 0 }}>
                {preview.notes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {label("🧾", "Steps")}
          <ol style={{ marginTop: 0 }}>
            {(preview.steps || []).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      );
    }

    if (preview.dm_type_guess === "description") {
      return (
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#666" }}>
            Type: <strong>Description</strong>
          </div>

          <div style={{ marginTop: 10 }}>
            {(preview.blocks || []).map((b, idx) => {
              if (b.type === "heading") {
                return (
                  <div key={idx} style={{ fontWeight: 800, fontSize: 16, marginTop: 14 }}>
                    {b.text}
                  </div>
                );
              }
              if (b.type === "para") {
                return (
                  <p key={idx} style={{ margin: "8px 0", lineHeight: 1.55 }}>
                    {b.text}
                  </p>
                );
              }
              if (b.type === "bullet") {
                return (
                  <div key={idx} style={{ display: "flex", gap: 10, margin: "6px 0" }}>
                    <div>•</div>
                    <div style={{ lineHeight: 1.5 }}>{b.text}</div>
                  </div>
                );
              }
              if (b.type === "figure") {
                const imgUrl = b.urn ? `${API_BASE}/icn?urn=${encodeURIComponent(b.urn)}` : null;

                return (
                  <div
                    key={idx}
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px dashed #ddd",
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>🖼️ {b.title}</div>

                    {b.urn && (
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                        {b.urn}
                      </div>
                    )}

                    {imgUrl && (
                      <div style={{ marginTop: 10 }}>
                        <img
                          src={imgUrl}
                          alt={b.title || "figure"}
                          style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid #e5e7eb" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                          If image doesn’t display, it may be CGM (not supported in browsers).
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      );
    }


    if (preview.dm_type_guess === "appliccrossreftable") {
      const attrs = preview.product_attributes || [];

      return (
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#666" }}>
            Type: <strong>Applicability Cross-Reference Table (ACT)</strong>
          </div>

          {attrs.length === 0 ? (
            <div style={{ marginTop: 10, color: "#666" }}>
              No product attributes found in this ACT.
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {attrs.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>{a.name || "(unnamed attribute)"}</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: "#555" }}>
                      id: {a.id || "—"}
                    </div>
                  </div>

                  {!!a.displayName && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
                      Display: <strong>{a.displayName}</strong>
                    </div>
                  )}

                  {!!a.descr && (
                    <div style={{ marginTop: 6, color: "#444", lineHeight: 1.5 }}>
                      {a.descr}
                    </div>
                  )}

                  {!!a.values?.length && (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {a.values.map((v) => (
                        <span
                          key={v}
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            border: "1px solid #e5e7eb",
                            background: "#f8fafc",
                            fontSize: 12,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          }}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }


    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: "#666" }}>
          Type: <strong>{preview.dm_type_guess || "unknown"}</strong>
        </div>
        <div style={{ marginTop: 8, color: "#666" }}>No preview renderer for this type yet.</div>
      </div>
    );
  };

  

  // -------------------------
  // API calls
  // -------------------------
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

  const openDM = async (dm) => {
    // toggle close
    if (selectedDM?.path === dm.path) {
      setSelectedDM(null);
      setDmPreview(null);
      setShowRawXml(false);
      setDmXml("");
      setAppliesInfo(null);
      return;
    }

    setSelectedDM(dm);
    setErr("");
    setDmPreview(null);
    setShowRawXml(false);
    setDmXml("");
    setAppliesInfo(null);

    // 1) DM preview
    try {
      const url = `${API_BASE}/dm-preview?path=${encodeURIComponent(dm.path)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load DM preview");
      setDmPreview(data);
    } catch (e) {
      setErr(String(e));
    }

    // 2) DM eval (optional)
    try {
      const evalUrl = `${API_BASE}/dm-eval?path=${encodeURIComponent(dm.path)}&selected=${encodeURIComponent(
        selectedLabels
      )}`;
      const evalRes = await fetch(evalUrl);
      const evalData = await evalRes.json();
      if (evalRes.ok) setAppliesInfo(evalData);
    } catch {
      // ignore eval failure
    }
  };

  const loadRawXml = async () => {
    if (!selectedDM) return;
    setErr("");
    setDmXml("Loading XML...");
    try {
      const url = `${API_BASE}/dm?path=${encodeURIComponent(selectedDM.path)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load DM XML");
      setDmXml(data.xml || "");
    } catch (e) {
      setDmXml("");
      setErr(String(e));
    }
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

      // reset open DM
      setSelectedDM(null);
      setDmPreview(null);
      setShowRawXml(false);
      setDmXml("");
      setAppliesInfo(null);
    } catch (e) {
      setErr(String(e));
    }
  };

  const clearFilter = () => {
    setApplicablePaths(null);
    setErr("");

    setSelectedDM(null);
    setDmPreview(null);
    setShowRawXml(false);
    setDmXml("");
    setAppliesInfo(null);
  };

  // -------------------------
  // Derived list
  // -------------------------
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



  // -------------------------
  // UI
  // -------------------------
  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <img src={logo} alt="Logo" style={{ height: 36 }} />
        <h2 style={{ margin: 0 }}>S1000D Bike Mini CSDB Explorer</h2>
      </div>

      <div style={{ color: "#555", marginBottom: 16 }}>
        Browse Data Modules, filter by applicability, and preview content in a manual-like view.
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
          disabled={!applicablePaths}
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
                background: selectedDM?.path === dm.path ? "#f8fafc" : "white",
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

            {/* Detail panel ONLY under the clicked row */}
            {selectedDM?.path === dm.path && (
              <div style={{ padding: 14, background: "#fafafa", borderTop: "1px solid #eee" }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                    <strong>{selectedDM.dmCode || "—"}</strong>
                  </div>
                  <div style={{ color: "#444" }}>{selectedDM.dmTitle || "—"}</div>
                  <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>{selectedDM.path}</div>

                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRawXml((v) => !v);
                      }}
                      style={{ padding: "8px 10px" }}
                    >
                      {showRawXml ? "Hide Raw XML" : "Show Raw XML"}
                    </button>

                    {showRawXml && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadRawXml();
                        }}
                        style={{ padding: "8px 10px" }}
                      >
                        Load XML
                      </button>
                    )}
                  </div>
                </div>

                {/* Manual-style preview */}
                <ManualPreview preview={dmPreview} />

                {/* Raw XML */}
                {showRawXml && (
                  <pre
                    style={{
                      marginTop: 12,
                      maxHeight: 420,
                      overflow: "auto",
                      background: "#0f172a",
                      color: "#e5e7eb",
                      padding: 12,
                      borderRadius: 10,
                      fontSize: 12,
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {dmXml || "(click Load XML)"}
                  </pre>
                )}

                {/* Optional: show ACT eval summary if you want later */}
                {appliesInfo && (
                  <div style={{ marginTop: 12, fontSize: 12, color: "#444" }}>
                    <strong>Applicability:</strong>{" "}
                    {appliesInfo.applies ? "Applies ✅" : "Does not apply ❌"}{" "}
                    <span style={{ color: "#666" }}>
                      ({appliesInfo.reason_kind || "—"})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
