import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

// ── Translations ──────────────────────────────────────────────────
//
// Bible text is fetched from bible-api.com (open source, no key needed).
// Source: https://bible-api.com — wraps public domain Bible translations.
//
// KJV — Public domain (1611, crown copyright expired)
// NIV — New International Version © Biblica Inc. Used via bible-api.com
// TB2 — Terjemahan Baru 2 is not yet on any public API.
//       We fetch NIV and have Claude render a faithful Indonesian paraphrase.
//       This is clearly disclosed to the user in the UI.
//
const TRANSLATIONS = [
  { id: "kjv", label: "KJV", name: "King James Version",        lang: "en", apiCode: "kjv" },
  { id: "web", label: "WEB", name: "World English Bible",        lang: "en", apiCode: "web" },
];

// ── Theologians ───────────────────────────────────────────────────
//
// All commentaries are AI-generated in the voice and theological tradition
// of each historical figure. They are not verbatim quotes.
//
const THEOLOGIANS = [
  { id: "calvin",   name: "John Calvin",      desc: "Reformed · Exegetical",   era: "1509–1564" },
  { id: "henry",    name: "Matthew Henry",    desc: "Pastoral · Devotional",    era: "1662–1714" },
  { id: "wright",   name: "N.T. Wright",      desc: "Narrative · Historical",   era: "1948–present" },
  { id: "spurgeon", name: "Charles Spurgeon", desc: "Preacher · Applicational", era: "1834–1892" },
  { id: "luther",   name: "Martin Luther",    desc: "Law & Gospel · Bold",      era: "1483–1546" },
  { id: "aquinas",  name: "Thomas Aquinas",   desc: "Scholastic · Systematic",  era: "1225–1274" },
];

// ── Reformed & Presbyterian Knowledge Base ────────────────────────
//
// Sources injected into Claude's context window on every request.
// All are public domain or broadly published confessional documents.
//
// Westminster Confession of Faith (1646)       — Public domain
// Westminster Shorter Catechism (1647)         — Public domain
// Westminster Larger Catechism (1648)          — Public domain
// Heidelberg Catechism (1563)                  — Public domain
// Belgic Confession (1561, Guido de Brès)      — Public domain
// Canons of Dort (1618–1619)                   — Public domain
// Second Helvetic Confession (1566, Bullinger) — Public domain
// Calvin's Institutes of the Chr. Religion (1559) — Public domain (1845 Beveridge trans.)
// Apostles', Nicene, Athanasian Creeds         — Public domain, ancient
//
const REFORMED_KNOWLEDGE = `
You have deep knowledge of the following confessional standards and Reformed texts
(all public domain). Reference them specifically when relevant.

WESTMINSTER STANDARDS (1646–1648):
- Westminster Confession of Faith (WCF): 33 chapters covering Scripture, God,
  decrees, creation, providence, fall, covenant of works, covenant of grace,
  Christ the Mediator, free will, effectual calling, justification, adoption,
  sanctification, saving faith, repentance, good works, perseverance, assurance,
  law, Christian liberty, worship, sabbath, church, sacraments (baptism & Lord's
  Supper), church censures, synods, civil magistrate, marriage, resurrection, judgment.
- Westminster Shorter Catechism (WSC): 107 Q&As. Q1: Man's chief end; Q2–3: Scripture;
  Q4: God's nature; Q6: Trinity; Q7: Decrees; Q9: Creation; Q11: Providence;
  Q13–19: Fall; Q20–28: Redemption; Q23–26: Offices of Christ; Q29–38: Benefits
  of redemption; Q39–82: Ten Commandments; Q91–97: Sacraments; Q98–107: Lord's Prayer.
- Westminster Larger Catechism (WLC): 196 Q&As — extended treatment of the law,
  sacraments, and means of grace.

THREE FORMS OF UNITY:
- Belgic Confession (1561, Guido de Brès): 37 articles — Scripture, God, creation,
  humanity, sin, election, Christ, justification, church, sacraments, civil
  government, last things.
- Heidelberg Catechism (1563): 129 Q&As in three parts:
    Part 1 — Misery (Q1–11)
    Part 2 — Deliverance (Q12–85)
    Part 3 — Gratitude (Q86–129)
  Famous Q1: "What is your only comfort in life and in death? That I am not my
  own, but belong — body and soul, in life and in death — to my faithful Saviour,
  Jesus Christ."
- Canons of Dort (1618–1619): Five heads of doctrine (the doctrinal basis of
  TULIP): Total depravity, Unconditional election, Definite (limited) atonement,
  Irresistible grace, Perseverance of the saints.

OTHER REFORMED STANDARDS:
- Second Helvetic Confession (1566, Heinrich Bullinger): 30 chapters, comprehensive
  Reformed confession covering all major loci of systematic theology.
- Calvin's Institutes of the Christian Religion (1559, trans. Beveridge 1845):
    Book I   — Knowledge of God the Creator
    Book II  — Knowledge of God the Redeemer in Christ
    Book III — Grace of the Holy Spirit and benefits of Christ
    Book IV  — External means of grace (church, ministry, sacraments)

ECUMENICAL CREEDS (affirmed by all Reformed churches):
- Apostles' Creed (c. 2nd–9th century)
- Nicene Creed (325 AD, rev. 381 AD)
- Athanasian Creed (c. 5th century)

When citing these documents, be specific: name the document, chapter or question
number, and the relevant clause. Example: "As WCF Chapter 3, Section 1 states..."
or "The Heidelberg Catechism Q1 reminds us..." or "WSC Q.14 defines sin as..."
`;

// ── Theologian voice prompts ──────────────────────────────────────
const THEOLOGIAN_PROMPTS = {
  calvin:
    "You are John Calvin writing a biblical commentary in the tradition of his Commentaries on the Bible (1540–1565). " +
    "Be precise, exegetical, and deeply Reformed in your theology. Reference original Greek or Hebrew where helpful. " +
    "Emphasise God's absolute sovereignty, covenant theology, and the glory of God as the chief end of all things. " +
    "Draw naturally on the Institutes and the Westminster Standards. Write with the gravity and clarity Calvin was known for.",

  henry:
    "You are Matthew Henry writing in the style of his Exposition of the Old and New Testaments (1708–1710). " +
    "Be warm, pastoral, and richly devotional. Make practical applications to daily Christian life in every paragraph. " +
    "Reference Reformed confessional standards naturally and without pedantry. " +
    "Your tone is spiritually encouraging, saturated in Scripture cross-references, and deeply pastoral.",

  wright:
    "You are N.T. Wright writing in the style of his New Testament for Everyone and Paul for Everyone series. " +
    "Emphasise the historical and Jewish context, second-temple Judaism, and how this passage fits the grand narrative " +
    "of Israel, new exodus, and new creation. Engage with the Greek text and ancient background. " +
    "Interact respectfully but critically with Reformed confessional theology where relevant.",

  spurgeon:
    "You are Charles Spurgeon writing a sermon commentary in the style of the Metropolitan Tabernacle Pulpit (1855–1892). " +
    "Be vivid, bold, and urgently applicational. Preach to the conscience and heart. " +
    "Draw the gospel from every passage. Use striking illustrations and metaphors. " +
    "Reference Puritan and Calvinist theology with warmth. Your tone is passionate, urgent, and full of love for souls.",

  luther:
    "You are Martin Luther writing a commentary in the tradition of his Lectures on Galatians (1535) and Romans (1515–1516). " +
    "Sharply distinguish law and gospel at every turn. Be earthy, direct, and sometimes provocative. " +
    "Show relentlessly how this passage confronts human pride and drives sinners to grace alone (sola gratia), " +
    "faith alone (sola fide), and Christ alone (solus Christus). Reference the confessions where appropriate.",

  aquinas:
    "You are Thomas Aquinas writing a commentary in the style of his Catena Aurea and biblical Lecturae. " +
    "Structure your commentary with careful scholastic method: state the sense of the text, raise distinctions, " +
    "draw on patristic sources (Augustine, Chrysostom, Ambrose), and resolve apparent tensions with logical precision. " +
    "Show how faith and reason illuminate each other. Be systematic and precise about theological categories.",
};

// ── UI strings ────────────────────────────────────────────────────
const UI = {
  en: {
    appTitle: "Lectio · Scriptura",
    appSub: "Bible Study with the Great Theologians",
    passagePlaceholder: "Enter a passage — e.g. Romans 8:1-11, John 3:16, Psalm 23...",
    studyBtn: "Study",
    loading1: "Fetching passage from Scripture...",
    loading2: "Consulting",
    passageLabel: "Scripture",
    commentaryLabel: "Commentary",
    aiNotice: "AI-generated commentary in the voice of",
    chatTitle: "Continue the Study",
    chatSub: "Ask follow-up questions about this passage",
    chatEmpty: "Ask a question to go deeper into this passage...",
    chatPlaceholder: "Ask a question about this passage...",
    emptyTitle: "Enter a passage to begin",
    emptySub: "Choose a translation · Pick a theologian · Press Study",
    citationNote: "Bible text sourced from bible-api.com · Commentary AI-generated",
    error: "Error",
  },
  id: {
    appTitle: "Lectio · Scriptura",
    appSub: "Studi Alkitab bersama Para Teolog Besar",
    passagePlaceholder: "Masukkan perikop — mis. Yohanes 3:16, Roma 8:1-11, Mazmur 23...",
    studyBtn: "Pelajari",
    loading1: "Mengambil perikop dari Alkitab...",
    loading2: "Berkonsultasi dengan",
    passageLabel: "Alkitab",
    commentaryLabel: "Tafsiran",
    aiNotice: "Tafsiran AI dalam gaya penulisan",
    chatTitle: "Lanjutkan Studi",
    chatSub: "Ajukan pertanyaan lanjutan tentang perikop ini",
    chatEmpty: "Ajukan pertanyaan untuk menggali lebih dalam...",
    chatPlaceholder: "Ajukan pertanyaan tentang perikop ini...",
    emptyTitle: "Masukkan perikop untuk memulai",
    emptySub: "Pilih terjemahan · Pilih teolog · Tekan Pelajari",
    citationNote: "Teks Alkitab dari bible-api.com · Tafsiran dibuat oleh AI",
    error: "Kesalahan",
  },
};

// ── Passage reference normaliser ──────────────────────────────────
// Fuzzy-corrects the book name so minor typos ("Jhon", "Genisis") still work.
const BOOKS = [
  ["Genesis","gen","ge","gn"],["Exodus","exo","ex","exod"],["Leviticus","lev","le","lv"],
  ["Numbers","num","nu","nm"],["Deuteronomy","deu","dt","deut"],["Joshua","jos","josh"],
  ["Judges","jdg","jg","judg"],["Ruth","rut","ru"],["1 Samuel","1sa","1sam"],
  ["2 Samuel","2sa","2sam"],["1 Kings","1ki","1kgs"],["2 Kings","2ki","2kgs"],
  ["1 Chronicles","1ch","1chr","1chron"],["2 Chronicles","2ch","2chr","2chron"],
  ["Ezra","ezr"],["Nehemiah","neh","ne"],["Esther","est","esth"],["Job","jb"],
  ["Psalms","ps","psa","psalm"],["Proverbs","pro","pr","prov"],
  ["Ecclesiastes","ecc","ec","eccl"],["Song of Solomon","sng","ss","song","sos"],
  ["Isaiah","isa","is"],["Jeremiah","jer","je","jr"],["Lamentations","lam","la"],
  ["Ezekiel","ezk","eze","ezek"],["Daniel","dan","da","dn"],["Hosea","hos","ho"],
  ["Joel","jol","joe","jl"],["Amos","amo","am"],["Obadiah","oba","ob","obad"],
  ["Jonah","jon","jnh"],["Micah","mic","mi"],["Nahum","nam","nah","na"],
  ["Habakkuk","hab"],["Zephaniah","zep","zeph"],["Haggai","hag","hg"],
  ["Zechariah","zec","zech"],["Malachi","mal","ml"],
  ["Matthew","mat","mt","matt"],["Mark","mrk","mk","mr"],["Luke","luk","lk"],
  ["John","jhn","jn"],["Acts","act"],["Romans","rom","ro","rm"],
  ["1 Corinthians","1co","1cor"],["2 Corinthians","2co","2cor"],
  ["Galatians","gal","ga"],["Ephesians","eph"],["Philippians","php","phil"],
  ["Colossians","col"],["1 Thessalonians","1th","1thes","1thess"],
  ["2 Thessalonians","2th","2thes","2thess"],["1 Timothy","1ti","1tim"],
  ["2 Timothy","2ti","2tim"],["Titus","tit"],["Philemon","phm","phlm"],
  ["Hebrews","heb"],["James","jas","jm"],["1 Peter","1pe","1pet"],
  ["2 Peter","2pe","2pet"],["1 John","1jn","1jo","1jhn"],
  ["2 John","2jn","2jo","2jhn"],["3 John","3jn","3jo","3jhn"],
  ["Jude","jud"],["Revelation","rev","re","rv"],
];

function levenshtein(a, b) {
  const m = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = a[i-1] === b[j-1] ? m[i-1][j-1]
        : 1 + Math.min(m[i-1][j], m[i][j-1], m[i-1][j-1]);
  return m[a.length][b.length];
}

function fuzzyBook(input) {
  const norm = input.toLowerCase().replace(/\s+/g, " ").trim();
  let best = null, bestDist = Infinity;
  for (const [canonical, ...aliases] of BOOKS) {
    for (const form of [canonical.toLowerCase(), ...aliases]) {
      if (form === norm) return canonical;
      if (norm.length >= 3 && form.startsWith(norm)) return canonical;
      const d = levenshtein(norm, form);
      if (d < bestDist) { bestDist = d; best = canonical; }
    }
  }
  const maxDist = norm.replace(/\s/g, "").length <= 4 ? 1 : 2;
  return bestDist <= maxDist ? best : input;
}

function normalizeRef(raw) {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d\s+)?([a-zA-Z][a-zA-Z\s]*?)\s+(\d[\d:,.\-–—]*)$/);
  if (!m) return trimmed;
  const prefix = (m[1] || "").trim();
  const bookInput = prefix ? `${prefix} ${m[2].trim()}` : m[2].trim();
  return `${fuzzyBook(bookInput)} ${m[3].trim()}`;
}

// ── Bible API ─────────────────────────────────────────────────────
// Source: https://bible-api.com (free, open, no API key required)
// Underlying Bible data: https://github.com/wldeh/bible-api
async function fetchPassage(reference, translation) {
  const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation.apiCode}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Passage not found. Try: John 3:16 or Romans 8:1-11");
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { reference: data.reference, text: data.text.trim(), verses: data.verses };
}

// ── Claude API ────────────────────────────────────────────────────
// Calls the Anthropic Claude API via the backend proxy.
// In development the proxy is at http://localhost:8000/api/chat.
// In production it hits /api/chat on the same origin.
// The API key is NEVER sent from the frontend — it lives server-side only.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function callClaude(messages, system) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}

// ── Build system prompt ───────────────────────────────────────────
function buildSystem({ theologianId, translation, uiLang, passageRef, passageText, priorCommentary }) {
  const langRule =
    uiLang === "id"
      ? "LANGUAGE RULE: Always respond in Bahasa Indonesia. Use clear, respectful, formal Indonesian throughout."
      : "LANGUAGE RULE: Always respond in English.";

  const guardrailMsg =
    uiLang === "id"
      ? "Pertanyaan ini di luar cakupan studi Alkitab. Silakan ajukan pertanyaan tentang perikop atau teologi Kristen."
      : "This question is outside the scope of Bible study. Please ask about the passage or Christian theology.";

  const guardrail = `
GUARDRAIL — ENFORCE STRICTLY:
You are a Bible study assistant. Only respond to questions about:
- The Bible passage currently being studied (${passageRef})
- Christian theology, doctrine, and biblical interpretation
- Reformed/Presbyterian confessional standards (Westminster, Heidelberg, Belgic, Canons of Dort, etc.)
- Church history, Christian life, prayer, and spiritual application
- Ethics, philosophy, or history IF meaningfully connected to Scripture or theology

If the question is clearly unrelated to the Bible, Christian theology, or faith
(e.g. sports, cooking, programming, entertainment, politics, general trivia),
do NOT answer it. Return this exact JSON and nothing else:
{"guardrail":true,"message":"${guardrailMsg}"}
`;

  const ctx = [
    `Current passage: ${passageRef}`,
    `Passage text:\n${passageText}`,
    priorCommentary ? `Your prior commentary on this passage:\n${priorCommentary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const lengthRule = "LENGTH RULE: You have a 5000-token output limit. Budget your response to finish naturally within it — always end with a complete sentence. Never trail off mid-thought. For commentary, aim for 600–900 words; for chat answers, 200–500 words.";

  return [THEOLOGIAN_PROMPTS[theologianId], REFORMED_KNOWLEDGE, langRule, lengthRule, guardrail, ctx]
    .filter(Boolean)
    .join("\n\n");
}

// ── Icons ─────────────────────────────────────────────────────────
const CrossIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
  </svg>
);
const ChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const Spin = ({ s = 15 }) => (
  <div
    style={{
      width: s, height: s, borderRadius: "50%",
      border: "2px solid #c4a882", borderTopColor: "transparent",
      animation: "spin .8s linear infinite", flexShrink: 0,
    }}
  />
);

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [uiLang, setUiLang]           = useState("en");
  const [translation, setTranslation] = useState(TRANSLATIONS[0]);
  const [theologian, setTheologian]   = useState(THEOLOGIANS[0]);
  const [passage, setPassage]         = useState("");
  const [passageData, setPassageData] = useState(null);
  const [commentary, setCommentary]   = useState("");
  const [chatMessages, setChat]       = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [loadingChat, setLoadingChat]   = useState(false);
  const [error, setError]             = useState("");
  const [openPicker, setOpenPicker]   = useState(null);
  const chatEndRef = useRef(null);
  const t = UI[uiLang];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function switchLang(lang) {
    setUiLang(lang);
  }

  async function handleStudy() {
    if (!passage.trim()) return;
    setError(""); setPassageData(null); setCommentary(""); setChat([]);
    setLoadingStudy(true);
    try {
      const data = await fetchPassage(normalizeRef(passage.trim()), translation);
      setPassageData(data);
      const system = buildSystem({ theologianId: theologian.id, translation, uiLang, passageRef: data.reference, passageText: data.text });
      const prompt =
        uiLang === "id"
          ? `Tolong tulis tafsiran mendalam tentang perikop ini untuk studi Alkitab yang serius.\n\nPerikop: ${data.reference}\n\n${data.text}`
          : `Write a rich, deep commentary on this passage for serious Bible study.\n\nPassage: ${data.reference}\n\n${data.text}`;
      setCommentary(await callClaude([{ role: "user", content: prompt }], system));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingStudy(false);
    }
  }

  async function handleChat() {
    if (!chatInput.trim() || loadingChat || !passageData) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMsgs = [...chatMessages, { role: "user", content: userMsg }];
    setChat(newMsgs);
    setLoadingChat(true);
    try {
      const system = buildSystem({
        theologianId: theologian.id, translation, uiLang,
        passageRef: passageData.reference, passageText: passageData.text,
        priorCommentary: commentary,
      });
      const raw = await callClaude(newMsgs.map(m => ({ role: m.role, content: m.content })), system);
      try {
        const parsed = JSON.parse(raw);
        if (parsed.guardrail) {
          setChat([...newMsgs, { role: "assistant", content: parsed.message, guardrail: true }]);
          return;
        }
      } catch (_) {}
      setChat([...newMsgs, { role: "assistant", content: raw }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingChat(false);
    }
  }

  const hasContent = passageData && commentary && !loadingStudy;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400;1,600&family=Cinzel:wght@400;500;600&family=Source+Code+Pro:wght@400;500&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#0b0906;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#2a2015;border-radius:2px}
        .app{min-height:100vh;background:#0b0906;color:#e2d6bc;font-family:'Crimson Pro',Georgia,serif}
        .grain{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.55;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.05'/%3E%3C/svg%3E")}
        .hdr{position:relative;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:26px 42px;border-bottom:1px solid #1c1610}
        .hdr-brand{display:flex;align-items:center;gap:14px}
        .hdr-icon{color:#c4a882;opacity:.75}
        .hdr-name{font-family:'Cinzel',serif;font-size:17px;letter-spacing:3px;text-transform:uppercase;color:#e2d6bc}
        .hdr-sub{font-size:13px;color:#8a7255;font-style:italic;margin-top:2px}
        .lang-sw{display:flex;border:1px solid #1c1610;border-radius:6px;overflow:hidden}
        .lang-opt{padding:7px 15px;font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border:none;background:transparent;color:#8a7255;transition:all .2s}
        .lang-opt.on{background:#c4a882;color:#0b0906;font-weight:600}
        .lang-opt:not(.on):hover{color:#c4a882;background:#17120b}
        .main{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:34px 42px}
        @media(max-width:840px){.main{padding:20px}.hdr{padding:18px 20px}.grid{grid-template-columns:1fr!important}}
        .ctrl{display:flex;gap:10px;margin-bottom:26px;flex-wrap:wrap;align-items:stretch}
        .pin{flex:1;min-width:190px;background:#17120b;border:1px solid #1c1610;border-radius:7px;padding:12px 18px;color:#e2d6bc;font-family:'Crimson Pro',serif;font-size:17px;outline:none;transition:border-color .2s}
        .pin:focus{border-color:#c4a882}
        .pin::placeholder{color:#342a1a;font-style:italic}
        .pkr{position:relative}
        .pkr-btn{background:#17120b;border:1px solid #1c1610;border-radius:7px;padding:12px 15px;color:#c4a882;font-family:'Cinzel',serif;font-size:11px;letter-spacing:.8px;cursor:pointer;display:flex;align-items:center;gap:8px;white-space:nowrap;height:100%;transition:border-color .2s}
        .pkr-btn:hover{border-color:#c4a882}
        .pkr-drop{position:absolute;top:calc(100% + 5px);left:0;background:#17120b;border:1px solid #1c1610;border-radius:8px;min-width:210px;z-index:200;box-shadow:0 20px 50px rgba(0,0,0,.75);overflow:hidden}
        .pkr-opt{padding:12px 18px;cursor:pointer;border-bottom:1px solid #141008;transition:background .15s}
        .pkr-opt:last-child{border-bottom:none}
        .pkr-opt:hover{background:#1c1610}
        .pkr-name{font-family:'Cinzel',serif;font-size:11px;color:#e2d6bc;letter-spacing:.4px}
        .pkr-meta{font-size:11px;color:#8a7255;font-style:italic;margin-top:1px}
        .go-btn{background:#c4a882;border:none;border-radius:7px;padding:12px 24px;color:#0b0906;font-family:'Cinzel',serif;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .2s;white-space:nowrap}
        .go-btn:hover:not(:disabled){background:#d4b890;transform:translateY(-1px)}
        .go-btn:disabled{opacity:.35;cursor:not-allowed}
        .err{background:#1c0808;border:1px solid #3c1212;border-radius:7px;padding:13px 18px;color:#cc8888;font-size:14px;margin-bottom:18px;font-style:italic}
        .notice{background:#18130a;border:1px solid #2e2410;border-radius:7px;padding:12px 18px;color:#8a7850;font-size:13px;line-height:1.65;margin-bottom:18px;display:flex;gap:8px;align-items:flex-start}
        .ld{padding:36px 0;display:flex;flex-direction:column;gap:13px}
        .ld-row{display:flex;align-items:center;gap:11px;color:#c4a882;font-style:italic;font-size:15px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:22px}
        .panel{background:#17120b;border:1px solid #1c1610;border-radius:10px;overflow:hidden;animation:fadeUp .4s ease both}
        .ph{padding:13px 20px;border-bottom:1px solid #1c1610;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
        .plabel{font-family:'Source Code Pro',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7a6245}
        .pref{font-family:'Cinzel',serif;font-size:12px;color:#c4a882}
        .pb{padding:20px;max-height:520px;overflow-y:auto}
        .verse{display:flex;gap:11px;margin-bottom:11px}
        .vn{font-family:'Source Code Pro',monospace;font-size:10px;color:#6a5535;min-width:20px;padding-top:3px}
        .vt{font-size:16px;line-height:1.85;color:#ddd0b0}
        .comm p{font-size:16px;line-height:1.9;color:#d8c8a8;margin-bottom:18px}
        .comm h1,.comm h2,.comm h3{font-family:'Cinzel',serif;color:#c4a882;letter-spacing:.5px;margin:24px 0 10px}
        .comm h1{font-size:17px}.comm h2{font-size:15px}.comm h3{font-size:13px}
        .comm strong{color:#e2d6bc;font-weight:600}
        .comm em{color:#c4a882;font-style:italic}
        .comm ul,.comm ol{padding-left:22px;margin-bottom:18px}
        .comm li{font-size:16px;line-height:1.85;color:#d8c8a8;margin-bottom:6px}
        .comm blockquote{border-left:2px solid #c4a882;margin:0 0 18px;padding:4px 0 4px 16px;color:#b8a888;font-style:italic}
        .ai-badge{display:inline-flex;align-items:center;gap:5px;background:#1c1610;border:1px solid #2a2015;border-radius:20px;padding:3px 11px;font-family:'Source Code Pro',monospace;font-size:9px;color:#8a7850;letter-spacing:.8px}
        .cite-bar{padding:8px 20px;border-top:1px solid #1c1610;font-family:'Source Code Pro',monospace;font-size:9px;color:#6a5535;letter-spacing:1px;text-align:right}
        .chat{background:#17120b;border:1px solid #1c1610;border-radius:10px;overflow:hidden;animation:fadeUp .4s .1s ease both}
        .ch{padding:18px 26px;border-bottom:1px solid #1c1610;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .ch-left{display:flex;flex-direction:column;gap:4px}
        .ct{font-family:'Cinzel',serif;font-size:15px;color:#c4a882;letter-spacing:.8px}
        .cs{font-size:12px;color:#7a6245;font-style:italic}
        .ch-badge{display:inline-flex;align-items:center;gap:5px;background:#1c1610;border:1px solid #2a2015;border-radius:20px;padding:4px 12px;font-family:'Source Code Pro',monospace;font-size:9px;color:#8a7255;letter-spacing:.8px;white-space:nowrap}
        .cms{padding:20px 26px;min-height:100px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
        .cempty{color:#6a5535;font-style:italic;font-size:15px;text-align:center;padding:20px 0}
        .msg{display:flex;gap:9px;animation:fadeUp .3s ease}
        .mu{flex-direction:row-reverse}
        .bbl{max-width:78%;padding:11px 15px;border-radius:8px;font-size:15px;line-height:1.75}
        .mu .bbl{background:#1c1610;color:#e2d6bc;border:1px solid #2a2015}
        .ma .bbl{background:#130f08;color:#d8c8a8;border:1px solid #1c1610}
        .ma .bbl p{margin:0 0 10px;line-height:1.75}.ma .bbl p:last-child{margin-bottom:0}
        .ma .bbl strong{color:#e2d6bc;font-weight:600}
        .ma .bbl em{color:#c4a882;font-style:italic}
        .ma .bbl ul,.ma .bbl ol{padding-left:18px;margin:0 0 10px}
        .ma .bbl li{margin-bottom:4px;line-height:1.7}
        .ma .bbl blockquote{border-left:2px solid #c4a882;margin:0 0 10px;padding:2px 0 2px 12px;color:#b8a888;font-style:italic}
        .mg .bbl{background:#1a0e06;color:#cc9955;border:1px solid #3a2010;font-style:italic;display:flex;align-items:flex-start;gap:8px}
        .av{width:25px;height:25px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:3px;font-family:'Cinzel',serif}
        .mu .av{background:#1c1610;color:#c4a882}
        .ma .av,.mg .av{background:#130f08;color:#c4a882}
        .cir{padding:13px 22px;border-top:1px solid #1c1610;display:flex;gap:9px}
        .ci{flex:1;background:#0b0906;border:1px solid #1c1610;border-radius:7px;padding:11px 15px;color:#e2d6bc;font-family:'Crimson Pro',serif;font-size:16px;outline:none;resize:none;height:44px;transition:border-color .2s}
        .ci:focus{border-color:#c4a882}
        .ci::placeholder{color:#2a2015;font-style:italic}
        .sb{background:#c4a882;border:none;border-radius:7px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:#0b0906;cursor:pointer;transition:all .2s;flex-shrink:0}
        .sb:hover:not(:disabled){background:#d4b890}
        .sb:disabled{opacity:.3;cursor:not-allowed}
        .empty{text-align:center;padding:68px 20px}
        .ec{font-size:34px;color:#4a3a22;margin-bottom:14px;animation:pulse 3s ease infinite}
        .et{font-family:'Cinzel',serif;font-size:15px;letter-spacing:2px;color:#7a6245;text-transform:uppercase}
        .es{font-size:13px;font-style:italic;color:#6a5535;margin-top:7px}
      `}</style>

      <div className="app">
        <div className="grain" />

        <header className="hdr">
          <div className="hdr-brand">
            <div className="hdr-icon"><CrossIcon /></div>
            <div>
              <div className="hdr-name">{t.appTitle}</div>
              <div className="hdr-sub">{t.appSub}</div>
            </div>
          </div>
          <div className="lang-sw">
            <button className={`lang-opt ${uiLang === "en" ? "on" : ""}`} onClick={() => switchLang("en")}>EN</button>
            <button className={`lang-opt ${uiLang === "id" ? "on" : ""}`} onClick={() => switchLang("id")}>ID</button>
          </div>
        </header>

        <main className="main">
          <div className="ctrl">
            <input className="pin" placeholder={t.passagePlaceholder} value={passage}
              onChange={e => setPassage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleStudy()} />

            <div className="pkr">
              <button className="pkr-btn" onClick={() => setOpenPicker(p => p === "trans" ? null : "trans")}>
                {translation.label} <ChevronDown />
              </button>
              {openPicker === "trans" && (
                <div className="pkr-drop">
                  {TRANSLATIONS.map(tr => (
                    <div key={tr.id} className="pkr-opt" onClick={() => { setTranslation(tr); setOpenPicker(null); }}>
                      <div className="pkr-name">{tr.label}</div>
                      <div className="pkr-meta">{tr.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pkr">
              <button className="pkr-btn" onClick={() => setOpenPicker(p => p === "theol" ? null : "theol")}>
                {theologian.name} <ChevronDown />
              </button>
              {openPicker === "theol" && (
                <div className="pkr-drop">
                  {THEOLOGIANS.map(th => (
                    <div key={th.id} className="pkr-opt" onClick={() => { setTheologian(th); setOpenPicker(null); }}>
                      <div className="pkr-name">{th.name} <span style={{ color: "#7a6245", fontSize: 10 }}>{th.era}</span></div>
                      <div className="pkr-meta">{th.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className="go-btn" onClick={handleStudy} disabled={loadingStudy || !passage.trim()}>
              {loadingStudy ? "..." : t.studyBtn}
            </button>
          </div>

          {error && <div className="err">⚠ {t.error}: {error}</div>}

          {loadingStudy && (
            <div className="ld">
              <div className="ld-row"><Spin />{t.loading1}</div>
              <div className="ld-row"><Spin />{t.loading2} {theologian.name}...</div>
            </div>
          )}

          {hasContent && (
            <>
              <div className="grid">
                <div className="panel">
                  <div className="ph">
                    <span className="plabel">{t.passageLabel} · {translation.label}</span>
                    <span className="pref">{passageData.reference}</span>
                  </div>
                  <div className="pb">
                    {passageData.verses?.map(v => (
                      <div key={v.verse} className="verse">
                        <span className="vn">{v.verse}</span>
                        <span className="vt">{v.text.trim()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="cite-bar">bible-api.com · {translation.name}</div>
                </div>

                <div className="panel" style={{ animationDelay: "0.07s" }}>
                  <div className="ph">
                    <span className="plabel">{t.commentaryLabel}</span>
                    <span className="ai-badge">
                      <CrossIcon />
                      {t.aiNotice} {theologian.name}
                    </span>
                  </div>
                  <div className="pb">
                    <div className="comm">
                      <ReactMarkdown>{commentary}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="cite-bar">AI-generated · Claude (Anthropic) · Not verbatim {theologian.name}</div>
                </div>
              </div>

              <div className="chat">
                <div className="ch">
                  <div className="ch-left">
                    <div className="ct">{t.chatTitle}</div>
                    <div className="cs">{t.chatSub}</div>
                  </div>
                  <div className="ch-badge"><CrossIcon />{theologian.name}</div>
                </div>
                <div className="cms">
                  {chatMessages.length === 0 && <div className="cempty">{t.chatEmpty}</div>}
                  {chatMessages.map((m, i) => {
                    const isUser = m.role === "user";
                    const isGuard = m.guardrail;
                    return (
                      <div key={i} className={`msg ${isUser ? "mu" : isGuard ? "mg" : "ma"}`}>
                        <div className="av">{isUser ? "D" : theologian.name[0]}</div>
                        <div className="bbl">
                          {isGuard && <span style={{ opacity: .7, flexShrink: 0 }}><ShieldIcon /></span>}
                          {isUser || isGuard
                            ? m.content
                            : <ReactMarkdown>{m.content}</ReactMarkdown>}
                        </div>
                      </div>
                    );
                  })}
                  {loadingChat && (
                    <div className="msg ma">
                      <div className="av">{theologian.name[0]}</div>
                      <div className="bbl"><Spin s={13} /></div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="cir">
                  <textarea className="ci" placeholder={t.chatPlaceholder} value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }} />
                  <button className="sb" onClick={handleChat} disabled={!chatInput.trim() || loadingChat}>
                    <SendIcon />
                  </button>
                </div>
              </div>
            </>
          )}

          {!hasContent && !loadingStudy && (
            <div className="empty">
              <div className="ec">✝</div>
              <div className="et">{t.emptyTitle}</div>
              <div className="es">{t.emptySub}</div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
