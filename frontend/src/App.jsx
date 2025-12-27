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

    const dmType = (preview?.dm_type_guess || "")
      .toString()
      .trim()
      .toLowerCase();

    if (dmType === "procedure") {
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

    if (dmType === "description") {
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

    if (dmType === "frontmatter") {
      const blocks = Array.isArray(preview.blocks) ? preview.blocks : [];

      // Title page block (fm01-ish)
      const tp = blocks.find(b => (b?.type || "").toLowerCase() === "frontmatter_title_page");

      // List block (fm02-ish)
      const list = blocks.filter(b => (b?.type || "").toLowerCase() === "frontmatter_list");

      if (tp) {
        const logoUrl = tp.publisher_logo_urn
          ? `${API_BASE}/icn?urn=${encodeURIComponent(tp.publisher_logo_urn)}`
          : null;

        return (
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#666" }}>
              Type: <strong>Front Matter (Title page)</strong>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {!!tp.product_intro_name && (
                <div style={{ fontWeight: 800, fontSize: 14 }}>{tp.product_intro_name}</div>
              )}

              {!!tp.pm_title && <div style={{ fontSize: 18, fontWeight: 900 }}>{tp.pm_title}</div>}

              {!!tp.short_pm_title && (
                <div style={{ fontSize: 12, color: "#555" }}>
                  Short title: <strong>{tp.short_pm_title}</strong>
                </div>
              )}

              {!!tp.models?.length && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Models</div>
                  <ul style={{ marginTop: 0 }}>
                    {tp.models.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {logoUrl && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Publisher Logo</div>
                  <img
                    src={logoUrl}
                    alt="Publisher logo"
                    style={{
                      maxWidth: 260,
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "white",
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                    If logo doesn’t display, it may be CGM (not supported in browsers).
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      // ---- Front Matter LIST (table) ----
      if (list.length) {
        return (
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#666" }}>
              Type: <strong>Front Matter (List)</strong>
            </div>

            {list.map((b, idx) => {
              const entries = Array.isArray(b.entries) ? b.entries : [];

              return (
                <div key={idx} style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    📄 Front matter list ({b.frontMatterType || "—"})
                  </div>

                  {entries.length === 0 ? (
                    <div style={{ color: "#666" }}>No entries.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          marginTop: 6,
                        }}
                      >
                        <thead>
                          <tr style={{ textAlign: "left", fontSize: 12, color: "#555" }}>
                            <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                              Title
                            </th>
                            <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                              Issue date
                            </th>
                            <th style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                              URN
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {entries.map((e, i) => (
                            <tr key={i}>
                              <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2" }}>
                                <div style={{ fontWeight: 600 }}>
                                  {(e.techName || "—") + " — " + (e.infoName || "—")}
                                </div>
                              </td>

                              <td
                                style={{
                                  padding: 8,
                                  borderBottom: "1px solid #f2f2f2",
                                  fontSize: 12,
                                  color: "#555",
                                }}
                              >
                                {e.issueDate || "—"}
                              </td>

                              <td
                                style={{
                                  padding: 8,
                                  borderBottom: "1px solid #f2f2f2",
                                  fontSize: 12,
                                  fontFamily:
                                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {e.href || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }


      return (
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#666" }}>
            Type: <strong>Front Matter</strong>
          </div>
          <div style={{ marginTop: 8, color: "#666" }}>No front matter blocks found.</div>
        </div>
      );
    }

    if (dmType === "appliccrossreftable") {
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

    if (dmType === "brex") {
      const intro = preview.intro || {};
      const rules = preview.context_rules || [];
      const nonCtx = preview.non_context_rules || [];
      const rfu = preview.reason_for_update || {};

      const pill = (text) => (
        <span
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
          {text}
        </span>
      );

      const renderRfu = (rfuIds) => {
        if (!rfuIds) return null;
        const ids = rfuIds.split(/\s+/).filter(Boolean);
        if (!ids.length) return null;

        return (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Reasons for update</div>
            <div style={{ display: "grid", gap: 8 }}>
              {ids.map((id) => (
                <div
                  key={id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                    {id}
                  </div>
                  {(rfu[id] || []).length ? (
                    <ul style={{ margin: "6px 0 0 18px" }}>
                      {rfu[id].map((t, i) => (
                        <li key={i} style={{ lineHeight: 1.4 }}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>No text found for this ID.</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      };

      return (
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#666" }}>
            Type: <strong>BREX (Business rules)</strong>
          </div>

          {/* Intro */}
          <div style={{ marginTop: 10 }}>
            {intro.title && (
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
                {intro.title}
              </div>
            )}
            {(intro.paras || []).map((p, i) => (
              <p key={i} style={{ margin: "8px 0", lineHeight: 1.55 }}>
                {p}
              </p>
            ))}
            {!!intro.bullets?.length && (
              <ul style={{ marginTop: 6 }}>
                {intro.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Context Rules */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Context rules ({rules.length})</div>

            <div style={{ display: "grid", gap: 10 }}>
              {rules.slice(0, 200).map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>
                      {r.objectUse || "(no objectUse)"}
                    </div>
                    {r.allowedObjectFlag ? pill(`flag ${r.allowedObjectFlag}`) : null}
                    {r.changeMark ? pill(`mark ${r.changeMark}`) : null}
                    {r.changeType ? pill(`${r.changeType}`) : null}
                  </div>

                  {r.objectPath && (
                    <div style={{ marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: "#333" }}>
                      {r.objectPath}
                    </div>
                  )}

                  {!!r.values?.length && (
                    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                      {r.values.map((v, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#333" }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            {v.valueAllowed ? pill(v.valueAllowed) : pill("—")}
                            {v.valueForm ? pill(v.valueForm) : null}
                            {v.valueTailoring ? pill(v.valueTailoring) : null}
                            {v.changeMark ? pill(`mark ${v.changeMark}`) : null}
                            {v.changeType ? pill(v.changeType) : null}
                          </div>
                          {v.text ? <div style={{ marginTop: 4, lineHeight: 1.4 }}>{v.text}</div> : null}
                          {v.reasonForUpdateRefIds ? renderRfu(v.reasonForUpdateRefIds) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rule-level RFU */}
                  {r.reasonForUpdateRefIds ? renderRfu(r.reasonForUpdateRefIds) : null}
                </div>
              ))}
            </div>

            {rules.length > 200 && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                Showing first 200 rules for performance.
              </div>
            )}
          </div>

          {/* Non-context rules */}
          {!!nonCtx.length && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Non-context rules</div>
              <ul style={{ marginTop: 0 }}>
                {nonCtx.map((t, i) => (
                  <li key={i} style={{ lineHeight: 1.45 }}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: "#666" }}>
          Type: <strong>{dmType || "unknown"}</strong>
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
      const url = `${API_BASE}/dm-preview?path=${encodeURIComponent(dm.path)}&t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
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
    <div style={{ fontFamily: "system-ui", maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "center", justifyContent: "center"}}>
        <img src={logo} alt="Logo" style={{ height: 38 }} />
        <h2 style={{ margin: 0, fontWeight: 800 }}>S1000D Bike Mini CSDB Explorer</h2>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto 22px", textAlign: "center"}}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#222", marginBottom: 6 }}>
          S1000D Bike CSDB Explorer
        </div>

        <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
          Explore and preview S1000D Bike Data Modules in a structured, manual-style viewer.
        </div>

        <div style={{ fontSize: 12, color: "#777", marginTop: 8 }}>
          Sample dataset from{" "}
          <a
            href="https://users.s1000d.org/Default.aspx"
            target="_blank"
            rel="noreferrer"
            style={{ fontWeight: 600, color: "#555", textDecoration: "none" }}
          >
            S1000D.ORG
          </a>{" "}
          (S1000D 4.1 Bike Sample)
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 900, margin: "0 auto", justifyContent: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search dmCode / title..."
          style={{ padding: 10, flex: "1 1 260px", borderRadius: 6,border: "1px solid #ddd" }}
        />

        <input
          value={selectedLabels}
          onChange={(e) => setSelectedLabels(e.target.value)}
          placeholder="Applicability labels (comma-separated)"
          style={{ padding: 10, flex: "2 1 360px", borderRadius: 6, border: "1px solid #ddd" }}
        />

        <button onClick={runResolve} style={{ padding: "10px 16px", borderRadius: 6, fontWeight: 600 }}>
          Filter by Applicability
        </button>

        <button
          onClick={clearFilter}
          style={{ padding: "10px 16px", borderRadius: 6 }}
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
      <div
        style={{
          marginTop: 24,
          paddingTop: 14,
          borderTop: "1px solid #eee",
          fontSize: 12,
          color: "#666",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span>
          Built by <strong>Sheeksha D. Joyseeree</strong> • S1000D Viewer Prototype
        </span>

        <span>•</span>

        <a
          href="https://sheeksha-joyseeree-v2.netlify.app/"
          target="_blank"
          rel="noreferrer"
          style={{ fontWeight: 700, color: "#111", textDecoration: "none" }}
        >
          Portfolio
        </a>

        <span style={{ marginLeft: "auto" }}>
          © {new Date().getFullYear()} Sheeksha D. Joyseeree
        </span>
      </div>
    </div>
  );
}
