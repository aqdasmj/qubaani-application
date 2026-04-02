import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";

const STORAGE_KEY = "qurbani-haq-data-v5";
const ADMIN_PIN = "9028";
const CATEGORIES = [
  { id: "bewa", label: "Bewa (Widow)", points: 3 },
  { id: "yateem", label: "Yateem (Orphan)", points: 3 },
  { id: "no_earner", label: "No Earner in Family", points: 2 },
  { id: "buzurg", label: "Buzurg (Elderly Alone)", points: 2 },
  { id: "majboor", label: "Majboor (Helpless)", points: 2 },
  { id: "zarooratmand", label: "Zarooratmand (Needy)", points: 1 },
  { id: "large_family", label: "Large Family", points: 1 },
];

const colors = {
  bg: "#0c1a12",
  card: "#142a1d",
  border: "#1e3d2c",
  gold: "#d4a94c",
  text: "#e4efe8",
  secondary: "#6b9a7e",
  label: "#4a7e60",
  danger: "#c0392b",
  amber: "#e67e22",
  success: "#27ae60",
};

const font = "system-ui, -apple-system, sans-serif";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function calcScore(categories, members) {
  let s = 0;
  CATEGORIES.forEach((c) => {
    if (categories.includes(c.id)) s += c.points;
  });
  if (members > 6) s += 1;
  return s;
}

function formatAadhaar(a) {
  if (!a) return "";
  const d = a.replace(/\D/g, "");
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export default function QurbaniHaq() {
  const [data, setData] = useState({ households: [], totalMeatKg: 0, deliveries: {}, areas: [] });
  const [tab, setTab] = useState("home");
  const [areaFilter, setAreaFilter] = useState("");
  const [toast, setToast] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminTab, setAdminTab] = useState("overview");
  const [prevTab, setPrevTab] = useState("home");
  const toastTimer = useRef(null);

  useEffect(() => {
    if (window.storage) {
      window.storage.get(STORAGE_KEY).then((d) => {
        if (d?.value) {
          try { setData(JSON.parse(d.value)); } catch (e) { console.error("Parse error:", e); }
        }
      }).catch(() => {});
    }
  }, []);

  const saveData = useCallback((newData) => {
    setData(newData);
    if (window.storage) {
      window.storage.set(STORAGE_KEY, JSON.stringify(newData)).catch(() => {});
    }
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // Lock admin when switching tabs
  useEffect(() => {
    if (prevTab === "admin" && tab !== "admin") {
      setAdminUnlocked(false);
      setAdminTab("overview");
    }
    setPrevTab(tab);
  }, [tab]);

  const filtered = useMemo(() => {
    if (!areaFilter) return data.households;
    return data.households.filter((h) => h.area === areaFilter);
  }, [data.households, areaFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => calcScore(b.categories, b.members) - calcScore(a.categories, a.members));
  }, [filtered]);

  const stats = useMemo(() => {
    const families = filtered.length;
    const members = filtered.reduce((s, h) => s + (parseInt(h.members) || 0), 0);
    let delivered = 0, kgGiven = 0;
    filtered.forEach((h) => {
      const d = data.deliveries[h.id];
      if (d && d.done) { delivered++; kgGiven += d.kg || 0; }
    });
    const sugPerFamily = families > 0 ? Math.round((data.totalMeatKg / families) * 10) / 10 : 0;
    return { families, members, delivered, kgGiven, sugPerFamily };
  }, [filtered, data.deliveries, data.totalMeatKg]);

  const switchTab = (t) => {
    setDetailId(null);
    setEditId(null);
    setTab(t);
  };

  // Styles
  const s = {
    app: { background: colors.bg, minHeight: "100vh", fontFamily: font, color: colors.text, maxWidth: 480, margin: "0 auto", paddingBottom: 70, position: "relative" },
    header: { padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${colors.border}` },
    title: { fontSize: 18, fontWeight: 700, color: colors.gold, margin: 0 },
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", background: colors.card, borderTop: `1px solid ${colors.border}`, zIndex: 100 },
    navBtn: (active) => ({ flex: 1, padding: "10px 0 8px", border: "none", background: "none", color: active ? colors.gold : colors.secondary, fontSize: 11, fontFamily: font, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }),
    card: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 14, marginBottom: 10 },
    input: { width: "100%", padding: "10px 12px", background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 14, fontFamily: font, boxSizing: "border-box", outline: "none" },
    btn: (bg = colors.gold, c = colors.bg) => ({ padding: "10px 20px", background: bg, color: c, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, fontFamily: font, cursor: "pointer", width: "100%", textAlign: "center" }),
    smallBtn: (bg = colors.gold, c = colors.bg) => ({ padding: "6px 14px", background: bg, color: c, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: font, cursor: "pointer" }),
    label: { fontSize: 12, color: colors.label, marginBottom: 4, display: "block", fontWeight: 600 },
    areaTag: { display: "inline-block", background: "#1e3d2c", color: colors.secondary, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 },
    scoreBadge: (score) => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: colors.gold, color: colors.bg, fontSize: 13, fontWeight: 700 }),
    section: { padding: "16px" },
    toastStyle: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: colors.gold, color: colors.bg, padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, zIndex: 999, textAlign: "center", maxWidth: 350 },
    ayah: { background: colors.card, border: `1px solid ${colors.gold}33`, borderRadius: 10, padding: 14, margin: "0 16px 12px", textAlign: "center", fontSize: 13, color: colors.secondary, lineHeight: 1.5, fontStyle: "italic" },
  };

  // Area filter dropdown
  const AreaDropdown = () => (
    <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ ...s.input, width: "auto", padding: "6px 10px", fontSize: 12, maxWidth: 140 }}>
      <option value="">All Areas</option>
      {data.areas.map((a) => <option key={a} value={a}>{a}</option>)}
    </select>
  );

  // HOME
  const HomeScreen = () => {
    const [editMeat, setEditMeat] = useState(false);
    const [meatVal, setMeatVal] = useState(data.totalMeatKg.toString());
    const pct = stats.families > 0 ? Math.round((stats.delivered / stats.families) * 100) : 0;
    return (
      <div>
        <div style={s.ayah}>
          \u201CTheir meat will not reach Allah, nor will their blood, but what reaches Him is your taqwa (piety).\u201D
          <div style={{ marginTop: 6, fontSize: 11, color: colors.label }}>\u2014 Surah Al-Hajj 22:37</div>
        </div>
        <div style={{ ...s.section, paddingTop: 0 }}>
          {areaFilter && <div style={{ marginBottom: 10, fontSize: 12, color: colors.gold }}>Filtered: {areaFilter}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { l: "Families", v: stats.families },
              { l: "Members", v: stats.members },
              { l: "Delivered", v: stats.delivered },
              { l: "Kg Given", v: stats.kgGiven },
            ].map((x) => (
              <div key={x.l} style={{ ...s.card, textAlign: "center", padding: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.gold }}>{x.v}</div>
                <div style={{ fontSize: 11, color: colors.secondary }}>{x.l}</div>
              </div>
            ))}
          </div>
          <div style={{ ...s.card, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: colors.label, marginBottom: 4 }}>Total Meat (Kg)</div>
            {editMeat ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
                <input type="number" value={meatVal} onChange={(e) => setMeatVal(e.target.value)} style={{ ...s.input, width: 100, textAlign: "center" }} autoFocus />
                <button onClick={() => { saveData({ ...data, totalMeatKg: parseFloat(meatVal) || 0 }); setEditMeat(false); showToast("Meat updated"); }} style={s.smallBtn()}>Save</button>
              </div>
            ) : (
              <div onClick={() => setEditMeat(true)} style={{ fontSize: 28, fontWeight: 700, color: colors.gold, cursor: "pointer" }}>
                {data.totalMeatKg} <span style={{ fontSize: 12, color: colors.label }}>tap to edit</span>
              </div>
            )}
          </div>
          <div style={{ ...s.card, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: colors.label, marginBottom: 4 }}>Suggested Per Family</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{stats.sugPerFamily} kg</div>
          </div>
          <div style={{ ...s.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: colors.secondary }}>Distribution Progress</span>
              <span style={{ fontSize: 12, color: colors.gold, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: colors.bg, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: colors.gold, borderRadius: 4, transition: "width 0.3s" }} />
            </div>
          </div>
        </div>
        <div style={s.ayah}>
          \u201CEat from them and feed the needy and the beggar.\u201D
          <div style={{ marginTop: 6, fontSize: 11, color: colors.label }}>\u2014 Surah Al-Hajj 22:36</div>
        </div>
      </div>
    );
  };

  // REGISTER
  const RegisterScreen = () => {
    const isEdit = !!editId;
    const existing = isEdit ? data.households.find((h) => h.id === editId) : null;
    const [form, setForm] = useState(existing || { name: "", mukhia: "", members: "", address: "", phone: "", aadhaar: "", area: "", categories: [], notes: "" });
    const [newArea, setNewArea] = useState("");
    const [showNewArea, setShowNewArea] = useState(false);
    const [dupWarnings, setDupWarnings] = useState([]);
    const [dupAcked, setDupAcked] = useState(false);
    const [scanning, setScanning] = useState(false);

    const upd = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setDupAcked(false); };
    const toggleCat = (id) => {
      setForm((p) => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id] }));
    };

    const score = calcScore(form.categories, parseInt(form.members) || 0);

    const checkDuplicates = useCallback(() => {
      const warns = [];
      const others = data.households.filter((h) => h.id !== editId);
      others.forEach((h) => {
        if (form.aadhaar && form.aadhaar.replace(/\D/g, "").length === 12 && h.aadhaar && h.aadhaar.replace(/\D/g, "") === form.aadhaar.replace(/\D/g, "")) {
          warns.push({ type: "aadhaar", level: "red", h });
        }
        if (form.phone && form.phone.length >= 10 && h.phone === form.phone) {
          warns.push({ type: "phone", level: "amber", h });
        }
        if (form.name && form.area && h.name.toLowerCase() === form.name.toLowerCase() && h.area === form.area) {
          warns.push({ type: "name+area", level: "soft", h });
        }
      });
      setDupWarnings(warns);
    }, [form.name, form.phone, form.aadhaar, form.area, data.households, editId]);

    const handleAadhaarScan = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setScanning(true);
      try {
        const reader = new FileReader();
        const base64 = await new Promise((res, rej) => { reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(file); });
        const b64Data = base64.split(",")[1];
        const mediaType = file.type || "image/jpeg";
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: b64Data } },
                { type: "text", text: "Extract from this Aadhaar card image: name, aadhaar_number (12 digits), address, dob, gender. Return ONLY valid JSON like: {\"name\":\"\",\"aadhaar_number\":\"\",\"address\":\"\",\"dob\":\"\",\"gender\":\"\"}" }
              ]
            }]
          })
        });
        const result = await resp.json();
        const text = result?.content?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setForm((p) => ({
            ...p,
            name: parsed.name || p.name,
            mukhia: parsed.name || p.mukhia,
            aadhaar: parsed.aadhaar_number || p.aadhaar,
            address: parsed.address || p.address,
          }));
          showToast("Aadhaar scanned successfully");
        } else {
          showToast("Could not parse Aadhaar data");
        }
      } catch (err) {
        showToast("Scan failed: " + err.message);
      }
      setScanning(false);
    };

    const submit = () => {
      if (!form.name || !form.mukhia || !form.members || !form.area) {
        showToast("Fill required fields"); return;
      }
      if (dupWarnings.length > 0 && !dupAcked) {
        showToast("Acknowledge duplicates first"); return;
      }
      const h = { ...form, id: isEdit ? editId : genId(), members: parseInt(form.members) || 0, aadhaar: form.aadhaar?.replace(/\D/g, "") || "" };
      let newHouseholds;
      if (isEdit) {
        newHouseholds = data.households.map((x) => x.id === editId ? h : x);
      } else {
        newHouseholds = [...data.households, h];
      }
      let newAreas = data.areas;
      if (form.area && !data.areas.includes(form.area)) {
        newAreas = [...data.areas, form.area];
      }
      saveData({ ...data, households: newHouseholds, areas: newAreas });
      showToast(isEdit ? "Household updated" : "Household registered");
      setEditId(null);
      setForm({ name: "", mukhia: "", members: "", address: "", phone: "", aadhaar: "", area: "", categories: [], notes: "" });
      setDupWarnings([]);
    };

    const Field = ({ label, k, type = "text", required, placeholder, onBlurExtra }) => (
      <div style={{ marginBottom: 12 }}>
        <label style={s.label}>{label}{required && " *"}</label>
        <input type={type} value={form[k] || ""} onChange={(e) => upd(k, e.target.value)} onBlur={() => { if (onBlurExtra) onBlurExtra(); checkDuplicates(); }} placeholder={placeholder} style={s.input} />
      </div>
    );

    return (
      <div style={s.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.gold }}>{isEdit ? "Edit Household" : "Register Household"}</h2>
          {isEdit && <button onClick={() => { setEditId(null); }} style={s.smallBtn("#1e3d2c", colors.text)}>Cancel</button>}
        </div>

        {/* Aadhaar Scan */}
        <div style={{ ...s.card, marginBottom: 16, textAlign: "center" }}>
          <label style={{ ...s.btn(colors.gold, colors.bg), display: "inline-block", cursor: "pointer", opacity: scanning ? 0.6 : 1 }}>
            {scanning ? "\u23F3 Scanning Aadhaar..." : "\uD83D\uDCF7 Scan Aadhaar Card"}
            <input type="file" accept="image/*" capture="environment" onChange={handleAadhaarScan} style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} disabled={scanning} />
          </label>
        </div>

        <Field label="Household Name" k="name" required />
        <Field label="Head of Family (Mukhia)" k="mukhia" required />
        <Field label="Members" k="members" type="number" required placeholder="Number of members" />
        <Field label="Address" k="address" />
        <Field label="Phone" k="phone" type="tel" />
        <Field label="Aadhaar Number" k="aadhaar" placeholder="12 digit number" />

        {/* Area */}
        <div style={{ marginBottom: 12 }}>
          <label style={s.label}>Area *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={form.area} onChange={(e) => upd("area", e.target.value)} style={{ ...s.input, flex: 1 }}>
              <option value="">Select Area</option>
              {data.areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={() => setShowNewArea(!showNewArea)} style={s.smallBtn()}>+ Add</button>
          </div>
          {showNewArea && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="New area name" style={{ ...s.input, flex: 1 }} />
              <button onClick={() => {
                if (newArea.trim()) {
                  const a = newArea.trim();
                  if (!data.areas.includes(a)) saveData({ ...data, areas: [...data.areas, a] });
                  upd("area", a);
                  setNewArea("");
                  setShowNewArea(false);
                }
              }} style={s.smallBtn()}>Add</button>
            </div>
          )}
        </div>

        {/* Categories */}
        <div style={{ marginBottom: 12 }}>
          <label style={s.label}>Categories</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((c) => {
              const active = form.categories.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleCat(c.id)} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${active ? colors.gold : colors.border}`, background: active ? colors.gold + "22" : "transparent", color: active ? colors.gold : colors.secondary, fontSize: 12, fontFamily: font, cursor: "pointer" }}>
                  {c.label} (+{c.points})
                </button>
              );
            })}
          </div>
        </div>

        {/* Score */}
        <div style={{ ...s.card, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: colors.secondary }}>Priority Score</span>
          <span style={s.scoreBadge()}>{score}</span>
        </div>

        <Field label="Notes" k="notes" placeholder="Additional notes" />

        {/* Duplicate Warnings */}
        {dupWarnings.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {dupWarnings.map((w, i) => (
              <div key={i} style={{ ...s.card, borderColor: w.level === "red" ? colors.danger : w.level === "amber" ? colors.amber : colors.label, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: w.level === "red" ? colors.danger : w.level === "amber" ? colors.amber : colors.secondary, marginBottom: 4 }}>
                  {w.level === "red" ? "\u26A0 AADHAAR MATCH" : w.level === "amber" ? "\u26A0 Phone Match" : "Name+Area Match"}
                </div>
                <div style={{ fontSize: 12, color: colors.secondary }}>
                  {w.h.name} \u2022 {w.h.area} \u2022 {w.h.phone || "No phone"}
                </div>
              </div>
            ))}
            {!dupAcked && (
              <button onClick={() => setDupAcked(true)} style={{ ...s.btn(colors.amber, "#fff"), marginTop: 4 }}>
                Not a duplicate \u2014 proceed
              </button>
            )}
          </div>
        )}

        <button onClick={submit} style={s.btn()}>{isEdit ? "Update Household" : "Register Household"}</button>
      </div>
    );
  };

  // DETAIL SCREEN
  const DetailScreen = () => {
    const h = data.households.find((x) => x.id === detailId);
    if (!h) return <div style={s.section}>Not found</div>;
    const score = calcScore(h.categories, h.members);
    const delivery = data.deliveries[h.id];
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
      <div style={s.section}>
        <button onClick={() => setDetailId(null)} style={{ ...s.smallBtn("#1e3d2c", colors.text), marginBottom: 16 }}>{"\u2190"} Back</button>
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, color: colors.text }}>{h.name}</h2>
              <span style={s.areaTag}>{h.area}</span>
            </div>
            <span style={s.scoreBadge()}>{score}</span>
          </div>
          {[
            ["Head of Family", h.mukhia],
            ["Members", h.members],
            ["Aadhaar", formatAadhaar(h.aadhaar)],
            ["Address", h.address],
            ["Phone", h.phone],
            ["Notes", h.notes],
          ].map(([l, v]) => v ? (
            <div key={l} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: colors.label }}>{l}</div>
              <div style={{ fontSize: 14, color: colors.text }}>{v}</div>
            </div>
          ) : null)}

          {h.categories.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: colors.label, marginBottom: 4 }}>Categories</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {h.categories.map((cid) => {
                  const cat = CATEGORIES.find((c) => c.id === cid);
                  return cat ? <span key={cid} style={s.areaTag}>{cat.label} (+{cat.points})</span> : null;
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: delivery?.done ? colors.success + "22" : colors.bg, textAlign: "center" }}>
            <span style={{ fontSize: 13, color: delivery?.done ? colors.success : colors.secondary }}>
              {delivery?.done ? `Delivered \u2022 ${delivery.kg || 0} kg` : "Not yet delivered"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={() => { setEditId(h.id); setDetailId(null); switchTab("register"); }} style={{ ...s.btn(colors.gold, colors.bg), flex: 1 }}>Edit</button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ ...s.btn(colors.danger, "#fff"), flex: 1 }}>Delete</button>
          ) : (
            <div style={{ flex: 1, display: "flex", gap: 6 }}>
              <button onClick={() => {
                const newH = data.households.filter((x) => x.id !== h.id);
                const newD = { ...data.deliveries };
                delete newD[h.id];
                saveData({ ...data, households: newH, deliveries: newD });
                setDetailId(null);
                showToast("Household deleted");
              }} style={{ ...s.btn(colors.danger, "#fff"), flex: 1, padding: "10px 8px" }}>Confirm</button>
              <button onClick={() => setConfirmDelete(false)} style={{ ...s.btn("#1e3d2c", colors.text), flex: 1, padding: "10px 8px" }}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // LIST
  const ListScreen = () => {
    const [search, setSearch] = useState("");
    const list = useMemo(() => {
      if (!search) return sorted;
      const q = search.toLowerCase();
      return sorted.filter((h) =>
        h.name.toLowerCase().includes(q) ||
        h.mukhia.toLowerCase().includes(q) ||
        (h.phone && h.phone.includes(q)) ||
        (h.aadhaar && h.aadhaar.includes(q))
      );
    }, [sorted, search]);

    if (detailId) return <DetailScreen />;

    return (
      <div style={s.section}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, head, phone, aadhaar..." style={{ ...s.input, marginBottom: 12 }} />
        {list.length === 0 && <div style={{ textAlign: "center", color: colors.secondary, padding: 20 }}>No households found</div>}
        {list.map((h, i) => {
          const sc = calcScore(h.categories, h.members);
          const del = data.deliveries[h.id];
          return (
            <div key={h.id} onClick={() => setDetailId(h.id)} style={{ ...s.card, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: colors.label, fontWeight: 700 }}>#{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: colors.secondary }}>{h.mukhia} \u2022 {h.members} members</div>
                    <span style={s.areaTag}>{h.area}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={s.scoreBadge()}>{sc}</span>
                  {del?.done && <div style={{ fontSize: 10, color: colors.success, marginTop: 4 }}>{"\u2713"} Delivered</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // DISTRIBUTE
  const DistributeScreen = () => {
    const shareWhatsApp = () => {
      if (!areaFilter) return;
      let msg = `*Qurbani Haq - ${areaFilter}*\n\n`;
      msg += `Families: ${stats.families}\nDelivered: ${stats.delivered}/${stats.families}\n`;
      msg += `Kg Given: ${stats.kgGiven}\n\n`;
      sorted.forEach((h) => {
        const d = data.deliveries[h.id];
        msg += `${d?.done ? "\u2713" : "\u2610"} ${h.name} (${h.members}) ${d?.done ? d.kg + "kg" : ""}\n`;
      });
      window.open("https://wa.me/?text=" + encodeURIComponent(msg));
    };

    const setDelivery = (id, done, kg) => {
      const newDel = { ...data.deliveries, [id]: { done, kg: parseFloat(kg) || 0 } };
      saveData({ ...data, deliveries: newDel });
    };

    return (
      <div style={s.section}>
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: colors.secondary, marginBottom: 4 }}>
            <span>Delivered: {stats.delivered}/{stats.families}</span>
            <span>Per family: {stats.sugPerFamily} kg</span>
          </div>
          <div style={{ fontSize: 12, color: colors.label }}>Total meat: {data.totalMeatKg} kg</div>
        </div>
        {areaFilter && (
          <button onClick={shareWhatsApp} style={{ ...s.btn(colors.success, "#fff"), marginBottom: 16 }}>
            Share {areaFilter} on WhatsApp
          </button>
        )}
        {sorted.map((h) => {
          const d = data.deliveries[h.id] || { done: false, kg: 0 };
          const sc = calcScore(h.categories, h.members);
          const kgVal = d.kg || stats.sugPerFamily;
          return (
            <div key={h.id} style={{ ...s.card, opacity: d.done ? 0.7 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{h.name}</div>
                  <div style={{ fontSize: 12, color: colors.secondary }}>{h.area} \u2022 {h.members} members</div>
                </div>
                <span style={s.scoreBadge()}>{sc}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" value={kgVal} onChange={(e) => setDelivery(h.id, d.done, e.target.value)} style={{ ...s.input, width: 80, padding: "8px 10px" }} placeholder="kg" />
                <span style={{ fontSize: 12, color: colors.label }}>kg</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setDelivery(h.id, !d.done, kgVal)} style={s.smallBtn(d.done ? colors.amber : colors.success, "#fff")}>
                  {d.done ? "Undo" : "Delivered"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ADMIN
  const AdminScreen = () => {
    const [pin, setPin] = useState(["", "", "", ""]);
    const pinRefs = [useRef(), useRef(), useRef(), useRef()];

    if (!adminUnlocked) {
      return (
        <div style={{ ...s.section, textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{"\uD83D\uDD12"}</div>
          <h3 style={{ color: colors.gold, marginBottom: 20 }}>Admin Access</h3>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
            {pin.map((d, i) => (
              <input key={i} ref={pinRefs[i]} type="password" maxLength={1} value={d} style={{ ...s.input, width: 48, height: 48, textAlign: "center", fontSize: 22, padding: 0 }}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  const newPin = [...pin];
                  newPin[i] = v;
                  setPin(newPin);
                  if (v && i < 3) pinRefs[i + 1].current?.focus();
                  if (i === 3 && v) {
                    const entered = newPin.join("");
                    if (entered === ADMIN_PIN) {
                      setAdminUnlocked(true);
                    } else {
                      showToast("Invalid PIN");
                      setPin(["", "", "", ""]);
                      setTimeout(() => pinRefs[0].current?.focus(), 100);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !pin[i] && i > 0) {
                    pinRefs[i - 1].current?.focus();
                  }
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: colors.secondary }}>Enter 4-digit PIN</div>
        </div>
      );
    }

    // Admin Dashboard
    const allHouseholds = data.households;
    const allStats = useMemo(() => {
      const f = allHouseholds.length;
      const m = allHouseholds.reduce((s, h) => s + (parseInt(h.members) || 0), 0);
      let del = 0, kg = 0;
      allHouseholds.forEach((h) => { const d = data.deliveries[h.id]; if (d?.done) { del++; kg += d.kg || 0; } });
      return { families: f, members: m, delivered: del, kgGiven: kg };
    }, [allHouseholds, data.deliveries]);

    const areaStats = useMemo(() => {
      return data.areas.map((a) => {
        const hs = allHouseholds.filter((h) => h.area === a);
        let del = 0;
        hs.forEach((h) => { if (data.deliveries[h.id]?.done) del++; });
        return { area: a, count: hs.length, delivered: del };
      });
    }, [allHouseholds, data.areas, data.deliveries]);

    const priorityDist = useMemo(() => {
      const bins = { critical: 0, high: 0, medium: 0, low: 0 };
      allHouseholds.forEach((h) => {
        const sc = calcScore(h.categories, h.members);
        if (sc >= 7) bins.critical++;
        else if (sc >= 5) bins.high++;
        else if (sc >= 3) bins.medium++;
        else bins.low++;
      });
      return bins;
    }, [allHouseholds]);

    // Duplicates
    const duplicates = useMemo(() => {
      const dups = [];
      for (let i = 0; i < allHouseholds.length; i++) {
        for (let j = i + 1; j < allHouseholds.length; j++) {
          const a = allHouseholds[i], b = allHouseholds[j];
          if (a.aadhaar && b.aadhaar && a.aadhaar.replace(/\D/g, "") === b.aadhaar.replace(/\D/g, "") && a.aadhaar.replace(/\D/g, "").length === 12) {
            dups.push({ type: "Aadhaar", a, b });
          }
          if (a.phone && b.phone && a.phone === b.phone && a.phone.length >= 10) {
            dups.push({ type: "Phone", a, b });
          }
        }
      }
      return dups;
    }, [allHouseholds]);

    const exportExcel = () => {
      const wb = XLSX.utils.book_new();
      const allData = allHouseholds.map((h) => ({
        Name: h.name, Head: h.mukhia, Members: h.members, Area: h.area, Phone: h.phone || "", Aadhaar: formatAadhaar(h.aadhaar),
        Score: calcScore(h.categories, h.members), Categories: h.categories.map((c) => CATEGORIES.find((x) => x.id === c)?.label || c).join(", "),
        Delivered: data.deliveries[h.id]?.done ? "Yes" : "No", Kg: data.deliveries[h.id]?.kg || 0, Address: h.address || "", Notes: h.notes || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData), "All Households");
      data.areas.forEach((a) => {
        const areaData = allData.filter((d) => d.Area === a);
        if (areaData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areaData), a.slice(0, 31));
      });
      const summary = areaStats.map((as) => ({ Area: as.area, Families: as.count, Delivered: as.delivered, Remaining: as.count - as.delivered }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
      XLSX.writeFile(wb, "qurbani-haq-report.xlsx");
      showToast("Excel exported");
    };

    const exportPDF = () => {
      const w = window.open("", "_blank");
      let html = `<!DOCTYPE html><html><head><title>Qurbani Haq Report</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}h1{color:#0c1a12;border-bottom:3px solid #27ae60;padding-bottom:10px}h2{color:#27ae60;margin-top:30px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#27ae60;color:#fff}.ayah{text-align:center;padding:15px;font-style:italic;color:#666;border:1px solid #27ae60;border-radius:8px;margin:20px 0}@media print{body{padding:0}}</style></head><body>`;
      html += `<h1>Qurbani Haq \u2014 Meat Distribution Report</h1>`;
      html += `<div class="ayah">"Their meat will not reach Allah, nor will their blood, but what reaches Him is your taqwa (piety)." \u2014 Surah Al-Hajj 22:37</div>`;
      html += `<p>Total Families: ${allStats.families} | Total Members: ${allStats.members} | Delivered: ${allStats.delivered} | Total Meat: ${data.totalMeatKg} kg</p>`;
      data.areas.forEach((a) => {
        const hs = allHouseholds.filter((h) => h.area === a).sort((x, y) => calcScore(y.categories, y.members) - calcScore(x.categories, x.members));
        if (hs.length === 0) return;
        html += `<h2>${a} (${hs.length} families)</h2><table><tr><th>#</th><th>Name</th><th>Head</th><th>Members</th><th>Score</th><th>Delivered</th><th>Kg</th></tr>`;
        hs.forEach((h, i) => {
          const d = data.deliveries[h.id];
          html += `<tr><td>${i + 1}</td><td>${h.name}</td><td>${h.mukhia}</td><td>${h.members}</td><td>${calcScore(h.categories, h.members)}</td><td>${d?.done ? "Yes" : "No"}</td><td>${d?.kg || 0}</td></tr>`;
        });
        html += `</table>`;
      });
      html += `<div class="ayah">"Eat from them and feed the needy and the beggar." \u2014 Surah Al-Hajj 22:36</div>`;
      html += `</body></html>`;
      w.document.write(html);
      w.document.close();
      w.print();
    };

    const exportWord = () => {
      let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:Calibri,sans-serif}h1{color:#0c1a12}h2{color:#27ae60}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px;font-size:11px}th{background:#27ae60;color:#fff}</style></head><body>`;
      html += `<h1>Qurbani Haq Report</h1><p>Families: ${allStats.families} | Members: ${allStats.members} | Delivered: ${allStats.delivered} | Meat: ${data.totalMeatKg} kg</p>`;
      data.areas.forEach((a) => {
        const hs = allHouseholds.filter((h) => h.area === a).sort((x, y) => calcScore(y.categories, y.members) - calcScore(x.categories, x.members));
        if (hs.length === 0) return;
        html += `<h2>${a} (${hs.length})</h2><table><tr><th>#</th><th>Name</th><th>Head</th><th>Members</th><th>Phone</th><th>Score</th><th>Delivered</th><th>Kg</th></tr>`;
        hs.forEach((h, i) => {
          const d = data.deliveries[h.id];
          html += `<tr><td>${i + 1}</td><td>${h.name}</td><td>${h.mukhia}</td><td>${h.members}</td><td>${h.phone || ""}</td><td>${calcScore(h.categories, h.members)}</td><td>${d?.done ? "Yes" : "No"}</td><td>${d?.kg || 0}</td></tr>`;
        });
        html += `</table>`;
      });
      html += `</body></html>`;
      const blob = new Blob(["\ufeff", html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "qurbani-haq-report.doc"; a.click();
      URL.revokeObjectURL(url);
      showToast("Word exported");
    };

    const tabStyle = (t) => ({ ...s.smallBtn(adminTab === t ? colors.gold : "#1e3d2c", adminTab === t ? colors.bg : colors.text), fontSize: 11 });

    return (
      <div style={s.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.gold }}>Admin Dashboard</h2>
          <button onClick={() => { setAdminUnlocked(false); setAdminTab("overview"); }} style={s.smallBtn(colors.danger, "#fff")}>Lock</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {["overview", "duplicates", "areas", "settings"].map((t) => (
            <button key={t} onClick={() => setAdminTab(t)} style={tabStyle(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {adminTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { l: "Total Families", v: allStats.families },
                { l: "Total Members", v: allStats.members },
                { l: "Delivered", v: allStats.delivered },
                { l: "Remaining", v: allStats.families - allStats.delivered },
                { l: "Kg Given", v: allStats.kgGiven },
                { l: "Kg Remaining", v: Math.max(0, data.totalMeatKg - allStats.kgGiven) },
                { l: "Areas", v: data.areas.length },
                { l: "Avg Score", v: allStats.families ? (allHouseholds.reduce((s, h) => s + calcScore(h.categories, h.members), 0) / allStats.families).toFixed(1) : 0 },
              ].map((x) => (
                <div key={x.l} style={{ ...s.card, textAlign: "center", padding: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: colors.gold }}>{x.v}</div>
                  <div style={{ fontSize: 10, color: colors.secondary }}>{x.l}</div>
                </div>
              ))}
            </div>

            {/* Overall progress */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: colors.secondary }}>Overall Progress</span>
                <span style={{ fontSize: 12, color: colors.gold, fontWeight: 700 }}>{allStats.families ? Math.round((allStats.delivered / allStats.families) * 100) : 0}%</span>
              </div>
              <div style={{ height: 8, background: colors.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${allStats.families ? (allStats.delivered / allStats.families) * 100 : 0}%`, background: colors.gold, borderRadius: 4 }} />
              </div>
            </div>

            {/* Area-wise progress */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 10 }}>Area-wise Progress</div>
              {areaStats.map((as) => {
                const pct = as.count > 0 ? Math.round((as.delivered / as.count) * 100) : 0;
                return (
                  <div key={as.area} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: colors.secondary }}>{as.area} ({as.count})</span>
                      <span style={{ color: colors.gold }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: colors.bg, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: colors.success, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Priority Distribution */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 10 }}>Priority Distribution</div>
              {[
                { l: "Critical (7+)", v: priorityDist.critical, c: colors.danger },
                { l: "High (5-6)", v: priorityDist.high, c: colors.amber },
                { l: "Medium (3-4)", v: priorityDist.medium, c: colors.gold },
                { l: "Low (1-2)", v: priorityDist.low, c: colors.secondary },
              ].map((p) => (
                <div key={p.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: colors.secondary }}>{p.l}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: p.c }}>{p.v}</span>
                </div>
              ))}
            </div>

            {/* Export buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportExcel} style={{ ...s.btn(colors.success, "#fff"), flex: 1 }}>Excel</button>
              <button onClick={exportPDF} style={{ ...s.btn("#2980b9", "#fff"), flex: 1 }}>PDF</button>
              <button onClick={exportWord} style={{ ...s.btn("#8e44ad", "#fff"), flex: 1 }}>Word</button>
            </div>
          </div>
        )}

        {adminTab === "duplicates" && (
          <div>
            {duplicates.length === 0 ? (
              <div style={{ ...s.card, textAlign: "center", color: colors.success }}>
                {"\u2713"} No duplicates found. Dataset is clean.
              </div>
            ) : (
              duplicates.map((d, i) => (
                <div key={i} style={{ ...s.card, borderColor: d.type === "Aadhaar" ? colors.danger : colors.amber }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: d.type === "Aadhaar" ? colors.danger : colors.amber, color: "#fff", marginBottom: 8 }}>{d.type} Match</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[d.a, d.b].map((h) => (
                      <div key={h.id} style={{ fontSize: 12, color: colors.secondary }}>
                        <div style={{ fontWeight: 600, color: colors.text }}>{h.name}</div>
                        <div>{h.area}</div>
                        <div>{h.phone || "No phone"}</div>
                        <div>{formatAadhaar(h.aadhaar) || "No aadhaar"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {adminTab === "areas" && (
          <div>
            {areaStats.map((as) => (
              <div key={as.area} style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{as.area}</div>
                  <div style={{ fontSize: 12, color: colors.secondary }}>{as.count} families \u2022 {as.delivered} delivered</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => {
                    const hs = allHouseholds.filter((h) => h.area === as.area);
                    let msg = `*Qurbani Haq - ${as.area}*\nFamilies: ${hs.length}\n\n`;
                    hs.forEach((h) => { const d = data.deliveries[h.id]; msg += `${d?.done ? "\u2713" : "\u2610"} ${h.name} (${h.members}) ${d?.done ? (d.kg || 0) + "kg" : ""}\n`; });
                    window.open("https://wa.me/?text=" + encodeURIComponent(msg));
                  }} style={s.smallBtn(colors.success, "#fff")}>WhatsApp</button>
                  {as.count === 0 && (
                    <button onClick={() => {
                      saveData({ ...data, areas: data.areas.filter((a) => a !== as.area) });
                      showToast("Area deleted");
                    }} style={s.smallBtn(colors.danger, "#fff")}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === "settings" && (
          <div>
            <div style={s.card}>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 12 }}>Clear All Data</div>
              <ClearDataButton />
            </div>
            <div style={{ ...s.card, marginTop: 10, textAlign: "center" }}>
              <div style={{ fontSize: 14, color: colors.gold, fontWeight: 600 }}>Qurbani Haq</div>
              <div style={{ fontSize: 12, color: colors.secondary }}>Version 5.0</div>
              <div style={{ fontSize: 11, color: colors.label, marginTop: 4 }}>Sakharinate Village, Ratnagiri, Konkan</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ClearDataButton = () => {
    const [confirm, setConfirm] = useState(false);
    if (!confirm) return <button onClick={() => setConfirm(true)} style={s.btn(colors.danger, "#fff")}>Clear All Data</button>;
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          const empty = { households: [], totalMeatKg: 0, deliveries: {}, areas: [] };
          saveData(empty);
          showToast("All data cleared");
          setConfirm(false);
        }} style={{ ...s.btn(colors.danger, "#fff"), flex: 1 }}>Yes, Clear Everything</button>
        <button onClick={() => setConfirm(false)} style={{ ...s.btn("#1e3d2c", colors.text), flex: 1 }}>Cancel</button>
      </div>
    );
  };

  // NAV ICONS
  const icons = {
    home: "\u2302",
    register: "+",
    list: "\u2630",
    distribute: "\u2713",
    admin: "\u2699",
  };

  return (
    <div style={s.app}>
      {/* Toast */}
      {toast && <div style={s.toastStyle}>{toast}</div>}

      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Qurbani Haq</h1>
        {(tab === "home" || tab === "list" || tab === "distribute") && <AreaDropdown />}
      </div>

      {/* Content */}
      {tab === "home" && <HomeScreen />}
      {tab === "register" && <RegisterScreen />}
      {tab === "list" && <ListScreen />}
      {tab === "distribute" && <DistributeScreen />}
      {tab === "admin" && <AdminScreen />}

      {/* Bottom Nav */}
      <div style={s.nav}>
        {["home", "register", "list", "distribute", "admin"].map((t) => (
          <button key={t} onClick={() => switchTab(t)} style={s.navBtn(tab === t)}>
            <span style={{ fontSize: 18 }}>{icons[t]}</span>
            <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
