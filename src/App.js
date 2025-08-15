import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_SAMPLE = {
  language: "en",
  verbosity: "medium",
  sections: [
    {
      id: "intro",
      title: "What this app does",
      body:
        "This demo structures content into clear headings with collapsible bodies. Use Up/Down to move between headers. Press Enter or Space to expand/collapse the body. Left collapses, Right expands.",
      children: [
        {
          id: "keys",
          title: "Keyboard shortcuts",
          body:
            "Up or Down: move between headings. Enter or Space: toggle body. Left: collapse. Right: expand.",
        },
      ],
    },
    {
      id: "setup",
      title: "How to generate content",
      body:
        "Type a prompt, pick verbosity and language, then press Generate. In production, your server calls Gemini and returns strict JSON.",
    },
    {
      id: "a11y",
      title: "WCAG and ARIA notes",
      body:
        "Use real headings, buttons with aria-expanded controlling regions with aria-labelledby. Keep contrast high and focus visible.",
    },
  ],
};

export default function App() {
  const [outline, setOutline] = useState(DEFAULT_SAMPLE);
  const [prompt, setPrompt] = useState("");
  const [verbosity, setVerbosity] = useState("medium");
  const [language, setLanguage] = useState("en");
  const [status, setStatus] = useState("");
  const [inFlight, setInFlight] = useState(null);

  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [autoSpeakTitles, setAutoSpeakTitles] = useState(true);
  const [autoSpeakBodies, setAutoSpeakBodies] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const flat = useMemo(() => flattenSections(outline.sections), [outline]);

  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(() => new Set());
  const headerRefs = useRef([]);
  const promptRef = useRef(null);

  useEffect(() => {
    const btn = headerRefs.current[index];
    if (btn && btn.focus) btn.focus();
  }, [index, flat.length]);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const speakRef = useRef(null);
  const speakTimer = useRef(null);

  useEffect(() => {
    const hasSynth = typeof window !== "undefined" && "speechSynthesis" in window;
    setTtsAvailable(hasSynth);
    if (!hasSynth) return;
    function loadVoices() {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      if (!voiceURI && v.length) {
        const match = v.find((vv) =>
          vv.lang?.toLowerCase().startsWith((language || "en").toLowerCase())
        );
        setVoiceURI((match || v[0]).voiceURI);
      }
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [language, voiceURI]);

  function stopSpeak() {
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch {}
    setIsSpeaking(false);
    speakRef.current = null;
    if (speakTimer.current) clearTimeout(speakTimer.current);
  }

  function speak(text) {
    if (!ttsAvailable || !text) return;
    const u = new SpeechSynthesisUtterance(String(text).trim());
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    if (voice) u.voice = voice;
    u.rate = rate;
    u.volume = volume;
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    speakRef.current = u;
    window.speechSynthesis.speak(u);
    setIsSpeaking(true);
  }

  function cancelAndSpeak(text, delay = 120) {
    stopSpeak();
    speakTimer.current = setTimeout(() => speak(text), delay);
  }

  function focusPrompt(select = true) {
    const el = promptRef.current;
    if (el) {
      el.focus();
      if (select) el.select();
    }
  }

  useEffect(() => {
    function handler(e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setTimeout(generateOutline, 0); 
      return;
    }
    if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      setTimeout(generateOutline, 0); 
      return;
    }

      if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        focusPrompt();
        cancelAndSpeak("Prompt field. Type your request, then press Control or Command plus Enter to generate.", 60);
        return;
      }

      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) {
        return;
      }

      const k = e.key;
      if (k === "Escape") { e.preventDefault(); stopSpeak(); return; }
      if (k.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        const cur = flat[index]; if (cur) cancelAndSpeak(cur.title);
        return;
      }
      if (k.toLowerCase() === "s" && e.shiftKey) {
        e.preventDefault();
        const cur = flat[index];
        if (cur && expanded.has(cur.id)) cancelAndSpeak(cur.body);
        return;
      }
      if (k === "ArrowDown") {
        e.preventDefault();
        setIndex((prev) => {
          const next = Math.min(prev + 1, flat.length - 1);
          if (autoSpeakTitles && flat[next]) cancelAndSpeak(flat[next].title);
          return next;
        });
        return;
      }
      if (k === "ArrowUp") {
        e.preventDefault();
        setIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          if (autoSpeakTitles && flat[next]) cancelAndSpeak(flat[next].title);
          return next;
        });
        return;
      }
      if (k === "ArrowRight") {
        e.preventDefault();
        const cur = flat[index]; if (!cur) return;
        if (!expanded.has(cur.id)) {
          toggle(cur.id, true);
          if (autoSpeakBodies) cancelAndSpeak(cur.body, 80);
        }
        return;
      }
      if (k === "ArrowLeft") {
        e.preventDefault();
        const cur = flat[index]; if (!cur) return;
        if (expanded.has(cur.id)) {
          toggle(cur.id, false);
        }
        return;
      }
      if ((k === "Enter" || k === " ") && tag !== "button" && tag !== "a") {
        e.preventDefault();
        const cur = flat[index]; if (!cur) return;
        const willOpen = !expanded.has(cur.id);
        toggle(cur.id, willOpen);
        if (willOpen && autoSpeakBodies) cancelAndSpeak(cur.body, 80);
        return;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flat, index, expanded, autoSpeakTitles, autoSpeakBodies, rate, volume, voiceURI, ttsAvailable, voices]);

  function toggle(id, force) {
    setExpanded((prev) => {
      const next = new Set(prev);
      const isOpen = next.has(id);
      const shouldOpen = typeof force === "boolean" ? force : !isOpen;
      if (shouldOpen) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function generateOutline() {
    const currentPrompt = (promptRef.current?.value ?? prompt).trim();
    if (currentPrompt !== prompt) setPrompt(currentPrompt);

    if (!currentPrompt) {
      setStatus("Error: Prompt is empty");
      cancelAndSpeak(
        "Prompt is empty. Press Alt or Control plus E to edit the prompt, then press Control or Command plus Enter to generate.",
        80
      );
      focusPrompt();
      return;
    }

    if (inFlight) inFlight.abort();
    const controller = new AbortController();
    setInFlight(controller);
    setStatus("Generating response please wait...");

    try {
    const res = await fetch("http://localhost:5000/api/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: currentPrompt, verbosity, language }),
      signal: controller.signal,
    });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOutline(data);
      setIndex(0);
      setExpanded(new Set());
      setStatus("");
      if (autoSpeakTitles && data.sections && data.sections.length) {
        const first = flattenSections(data.sections)[0];
        if (first) cancelAndSpeak(first.title, 120);
      }
    } catch (err) {
      if (err.name === "AbortError") setStatus("Canceled");
      else { console.error(err); setStatus(`Error: ${err.message || "generating content"}`); }
    } finally {
      setInFlight(null);
    }
  }

  const styles = {
    app: { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", lineHeight: 1.5, height: "100vh", display: "flex", flexDirection: "column", overflow: "auto" },
    header: { padding: "12px 16px", borderBottom: "1px solid #ddd", background: "#0b3d91", color: "#fff", flex: "0 0 auto" },
    container: { display: "grid", gridTemplateColumns: "320px 1fr", flex: 1, overflow: "auto" },
    sidebar: { borderRight: "1px solid #e5e7eb", padding: 12, overflow: "auto" },
    main: { padding: 16, display: "flex", flexDirection: "column", overflow: "auto" },
    controlsSticky: { position: "sticky", top: 0, background: "#fff", zIndex: 1, paddingBottom: 8, borderBottom: "1px solid #e5e7eb", marginBottom: 16 },
    readerScroll: { flex: 1, overflowY: "auto", paddingTop: 8 },
    button: { width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 6, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" },
    buttonActive: { outline: "3px solid #0b3d91", background: "#eef3ff" },
    controlsRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
    label: { fontSize: 12, fontWeight: 600 },
    input: { padding: 8, border: "1px solid #ccc", borderRadius: 8, minWidth: 120 },
    textarea: { width: "100%", minHeight: 40, padding: 8, border: "1px solid #ccc", borderRadius: 8 },
    badge: { padding: "2px 8px", borderRadius: 999, background: "#eef2ff", color: "#1e40af", fontSize: 12 },
    ttsRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 },
    bodyRow: { display: "flex", gap: 10, alignItems: "start" },
    dot: { width: 10, height: 10, borderRadius: "50%", background: "#e5e7eb", flex: "0 0 auto", marginTop: 6 },
    dotActive: { width: 12, height: 12, borderRadius: "50%", background: "#0b3d91", boxShadow: "0 0 0 2px #c7d2fe", flex: "0 0 auto", marginTop: 6 },
  };

  return (
    <div style={styles.app}>
      <a href="#content" style={{ position: "absolute", top: 0, left: 0, transform: "translateY(-120%)", background: "#fff", padding: 8 }}
         onFocus={(e)=> e.currentTarget.style.transform = "none"}
         onBlur={(e)=> e.currentTarget.style.transform = "translateY(-120%)"}>
        Skip to content
      </a>

      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Navigation Aware Output Formatting System (NAOFS)</h1>
      </header>

      <div style={styles.container}>
        <nav style={styles.sidebar} aria-label="Table of contents">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>Headings</strong>
            <span style={styles.badge}>{flat.length}</span>
          </div>
          <ul role="list" aria-label="Section headings">
            {flat.map((s, i) => {
              const isOpen = expanded.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    ref={(el) => (headerRefs.current[i] = el)}
                    style={{ ...styles.button, ...(i === index ? styles.buttonActive : {}) }}
                    aria-controls={`section-${s.id}`}
                    aria-expanded={isOpen}
                    aria-current={i === index ? "true" : undefined}
                    onFocus={() => { setIndex(i); if (autoSpeakTitles) cancelAndSpeak(s.title, 80); }}
                    onClick={() => {
                      setIndex(i);
                      const willOpen = !expanded.has(s.id);
                      toggle(s.id, willOpen);
                      if (willOpen && autoSpeakBodies) cancelAndSpeak(s.body, 80);
                    }}
                  >
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ul>
             
        </nav>

        <main id="content" style={styles.main} tabIndex={0} role="region" aria-label="Content area" aria-live="polite">
          <section aria-labelledby="controls-h" style={styles.controlsSticky}>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr" }}>
              
              <label style={styles.label} htmlFor="prompt">Ask Anything</label>
              <textarea style={{
    ...styles.textarea,
    height: "40px", 
  }} id="prompt" ref={promptRef}  value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask for an anything… e.g., 'Explain climate change for beginners'" />

                     <h5 aria-live="polite" style={{fontSize:10, padding:2, margin:0}}>{status}</h5>

              <div style={styles.controlsRow}>
                <label style={styles.label} htmlFor="verbosity">Verbosity</label>
                <select id="verbosity" style={styles.input} value={verbosity} onChange={(e) => setVerbosity(e.target.value)}>
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>

                <label style={styles.label} htmlFor="language">Language</label>
                <select id="language" style={styles.input} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>

                <button onClick={generateOutline} disabled={!!inFlight}
                        style={{ ...styles.input, cursor: "pointer", fontWeight: 600, opacity: inFlight ? 0.6 : 1 }}>
                  {inFlight ? "Generating…" : "Generate (Ctrl/Cmd+Enter or Ctrl/Alt+G)"}
                </button>
                <button onClick={() => { setOutline(DEFAULT_SAMPLE); setIndex(0); setExpanded(new Set());
                          if (autoSpeakTitles) { const first = flattenSections(DEFAULT_SAMPLE.sections)[0]; if (first) cancelAndSpeak(first.title, 120); } }}
                        style={{ ...styles.input, cursor: "pointer" }}>
                  Refresh
                </button>
              </div>

              <div style={styles.ttsRow} aria-label="Speech settings">
                <label style={{fontSize:13}}><input type="checkbox" checked={autoSpeakTitles} onChange={(e)=>setAutoSpeakTitles(e.target.checked)}  /> Auto-speak titles</label>
                <label style={{fontSize:13}}><input type="checkbox" checked={autoSpeakBodies} onChange={(e)=>setAutoSpeakBodies(e.target.checked)} /> Auto-speak bodies</label>
                <button onClick={stopSpeak} style={{ ...styles.input, cursor: "pointer", minWidth: 90 }}>
                  {isSpeaking ? "Stop (Esc)" : "Stop"}
                </button>
                {ttsAvailable ? (
                  <>
                    <label style={{fontSize:13}}>Voice 
                      <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}
                              style={{ ...styles.input, minWidth: 120}} aria-label="Voice">
                        {voices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{fontSize:13}}>Speech Rate
                      <input type="range" min="0.5" max="2" step="0.1"
                          style={{ width: 80, height: 16, verticalAlign: "middle" }} 

                             value={rate} onChange={(e)=>setRate(parseFloat(e.target.value))} aria-label="Speech rate" />
                    </label>
                    <label style={{fontSize:13}}>Volume
                      <input type="range" min="0" max="1" step="0.05"   style={{ width: 80, height: 16, verticalAlign: "middle" }} 

                             value={volume} onChange={(e)=>setVolume(parseFloat(e.target.value))} aria-label="Speech volume" />
                    </label>
                  </>
                ) : (
                  <span role="status" aria-live="polite" style={{ marginLeft: 8 }}>
                    Speech not available in this browser.
                  </span>
                )}
              </div>


           
            </div>
          </section>

          <section aria-labelledby="reader-h" style={styles.readerScroll}>
            <h2 id="reader-h" style={{ fontSize: 13, marginBottom: 8 }}>Structured Response</h2>
            {flat.map((s, i) => {
              const isOpen = expanded.has(s.id);
              const isActive = i === index;
              return (
                <article key={s.id} id={`section-${s.id}`} role="region" aria-labelledby={`heading-${s.id}`}
                         style={{ marginBottom: 12 }}>
                  <h3 id={`heading-${s.id}`} style={{ marginBottom: 6 }}>
                    <button
                      style={{ ...styles.button, width: "auto" }}
                      aria-expanded={isOpen}
                      aria-controls={`panel-${s.id}`}
                      onClick={() => {
                        setIndex(i);
                        const willOpen = !expanded.has(s.id);
                        toggle(s.id, willOpen);
                        if (willOpen && autoSpeakBodies) cancelAndSpeak(s.body, 80);
                      }}
                      onFocus={() => { setIndex(i); if (autoSpeakTitles) cancelAndSpeak(s.title, 80); }}
                    >
                      {s.title}
                    </button>
                  </h3>
                  <div id={`panel-${s.id}`} role="region" aria-labelledby={`heading-${s.id}`} hidden={!isOpen}>
                    <div style={styles.bodyRow}>
                      <span aria-hidden="true" style={isActive ? styles.dotActive : styles.dot}></span>
                      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{s.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </main>
      </div>

      <footer style={{ padding: 12, borderTop: "1px solid #eee", fontSize: 13 }}>

<div role="note"  aria-label="Keyboard help"
                   style={{ background: "#f8fafc",fontSize:"12px", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12,  }}>
                <p style={{ margin: 0 }}>
                  <strong>Shortcuts:</strong> ↑/↓ move • Enter/Space toggle • → expand • ← collapse •
                  S speak title • Shift+S speak body • Esc stop • Ctrl/Cmd+Enter Generate • Ctrl/Alt+G Generate • Ctrl/Alt+E Edit prompt
                </p>
              </div>
      </footer>
    </div>
  );
}

function flattenSections(list, acc = []) {
  for (const s of list || []) {
    acc.push({ id: s.id, title: s.title, body: s.body });
    if (s.children && s.children.length) flattenSections(s.children, acc);
  }
  return acc;
}
