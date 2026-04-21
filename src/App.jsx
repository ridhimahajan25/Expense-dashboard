import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CATEGORIES = ["🏠 Rent", "🍔 Food", "🚗 Transport", "💡 Utilities", "🎉 Entertainment", "🏥 Health", "📚 Education", "🛍️ Shopping", "✈️ Travel", "💼 Other"];
const COLORS = ["#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899","#14b8a6","#8b5cf6","#f97316","#06b6d4","#94a3b8"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Keyword map for rule-based auto-categorisation
const CAT_RULES = [
  { cat: "🍔 Food", keywords: ["swiggy","zomato","food","lunch","dinner","breakfast","cafe","restaurant","pizza","burger","groceries","dmart","bigbasket","blinkit","zepto","snack","chai","coffee","tea","eat","meal","dominos","kfc","mcdonalds","subway"] },
  { cat: "🏠 Rent", keywords: ["rent","pg","flat","apartment","housing","landlord","accommodation","home"] },
  { cat: "🚗 Transport", keywords: ["uber","ola","auto","bus","metro","train","petrol","fuel","cab","rapido","rickshaw","flight","airline","indigo","air india","irctc","ticket","toll","parking"] },
  { cat: "💡 Utilities", keywords: ["electricity","water","gas","wifi","internet","broadband","bill","recharge","mobile","phone","jio","airtel","bsnl","vi","vodafone","postpaid","prepaid","dth","tata sky"] },
  { cat: "🎉 Entertainment", keywords: ["netflix","amazon","hotstar","prime","disney","movie","film","theatre","pvr","inox","concert","event","game","spotify","youtube","subscription","bookmyshow"] },
  { cat: "🏥 Health", keywords: ["medicine","doctor","hospital","clinic","pharmacy","medical","health","apollo","pharmeasy","1mg","gym","yoga","fitness","insurance","dentist","chemist"] },
  { cat: "📚 Education", keywords: ["course","book","college","school","fee","tuition","udemy","coursera","class","workshop","certification","exam"] },
  { cat: "🛍️ Shopping", keywords: ["amazon","flipkart","myntra","ajio","nykaa","meesho","clothes","shirt","shoes","bag","watch","shopping","mall","lifestyle","h&m","zara","fashion"] },
  { cat: "✈️ Travel", keywords: ["hotel","resort","trip","travel","holiday","vacation","airbnb","oyo","makemytrip","goibibo","booking","tour","goa","mumbai","delhi","visa"] },
];

function autoDetect(note) {
  if (!note || note.trim().length < 2) return { cat: null, amount: null, confidence: 0 };
  const lower = note.toLowerCase();

  // Try to extract amount from note e.g. "Swiggy 380" or "380 swiggy"
  const amtMatch = lower.match(/\b(\d{2,6})\b/);
  const amount = amtMatch ? parseInt(amtMatch[1]) : null;

  // Score each category
  let best = { cat: null, score: 0 };
  for (const rule of CAT_RULES) {
    const score = rule.keywords.filter(k => lower.includes(k)).length;
    if (score > best.score) best = { cat: rule.cat, score };
  }

  const confidence = best.score > 0 ? Math.min(100, best.score * 40 + 60) : 0;
  return { cat: best.cat, amount, confidence };
}

const now = new Date();
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
function parseMonth(m) {
  const [y, mo] = m.split("-");
  return `${MONTHS[parseInt(mo)-1]} ${y}`;
}

// Confidence pill color
function confColor(c) {
  if (c >= 80) return { bg: "#14532d", text: "#86efac" };
  if (c >= 50) return { bg: "#713f12", text: "#fde68a" };
  return { bg: "#1e293b", text: "#94a3b8" };
}

export default function App() {
  const [expenses, setExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("expenses_v1") || "[]"); } catch { return []; }
  });
  const [form, setForm] = useState({ category: CATEGORIES[0], amount: "", note: "", month: defaultMonth });
  const [aiSuggestion, setAiSuggestion] = useState({ cat: null, amount: null, confidence: 0 });
  const [aiAccepted, setAiAccepted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgets, setBudgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("budgets_v1") || "{}"); } catch { return {}; }
  });
  const [tab, setTab] = useState("dashboard");
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < 500);
  const [error, setError] = useState("");

  // Metrics state
  const [totalEntries, setTotalEntries] = useState(0);
  const [aiAcceptedCount, setAiAcceptedCount] = useState(0);

  useEffect(() => {
    const fn = () => setIsSmall(window.innerWidth < 500);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  useEffect(() => { localStorage.setItem("expenses_v1", JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem("budgets_v1", JSON.stringify(budgets)); }, [budgets]);

  // AI runs whenever note changes
  function handleNoteChange(val) {
    setForm(f => ({ ...f, note: val }));
    const result = autoDetect(val);
    setAiSuggestion(result);
    setAiAccepted(false);
    // Auto-fill if confident
    if (result.cat && result.confidence >= 60) {
      setForm(f => ({
        ...f,
        note: val,
        category: result.cat,
        amount: result.amount ? String(result.amount) : f.amount,
      }));
      setAiAccepted(true);
    }
  }

  function acceptAiSuggestion() {
    if (aiSuggestion.cat) {
      setForm(f => ({
        ...f,
        category: aiSuggestion.cat,
        amount: aiSuggestion.amount ? String(aiSuggestion.amount) : f.amount,
      }));
      setAiAccepted(true);
    }
  }

  function addExpense() {
    if (!form.amount || isNaN(form.amount) || +form.amount <= 0) { setError("Enter a valid amount."); return; }
    setExpenses(prev => [...prev, { id: Date.now(), ...form, amount: +form.amount, aiAssisted: aiAccepted }]);
    setTotalEntries(t => t + 1);
    if (aiAccepted) setAiAcceptedCount(c => c + 1);
    setForm(f => ({ ...f, amount: "", note: "", category: CATEGORIES[0] }));
    setAiSuggestion({ cat: null, amount: null, confidence: 0 });
    setAiAccepted(false);
    setError("");
  }

  function deleteExpense(id) { setExpenses(prev => prev.filter(e => e.id !== id)); }

  function saveBudget() {
    if (!budgetInput || isNaN(budgetInput) || +budgetInput <= 0) return;
    setBudgets(prev => ({ ...prev, [selectedMonth]: +budgetInput }));
    setBudgetInput("");
  }

  const catColor = (cat) => COLORS[CATEGORIES.indexOf(cat) % COLORS.length];
  const monthExpenses = expenses.filter(e => e.month === selectedMonth);
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const allMonths = [...new Set(expenses.map(e => e.month))].sort().reverse();
  if (!allMonths.includes(selectedMonth)) allMonths.unshift(selectedMonth);
  const catMap = {};
  monthExpenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
  const last6 = [...new Set(expenses.map(e => e.month))].sort().slice(-6);
  const barData = last6.map(m => ({ month: parseMonth(m), total: expenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0) }));
  const topCat = [...pieData].sort((a,b)=>b.value-a.value)[0];
  const daysInMonth = new Date(selectedMonth.split("-")[0], selectedMonth.split("-")[1], 0).getDate();
  const avgPerDay = total / daysInMonth;
  const budget = budgets[selectedMonth];
  const streakMonths = (() => {
    let count = 0;
    const sorted = [...new Set(expenses.map(e => e.month))].sort().reverse();
    for (const m of sorted) {
      const b = budgets[m]; const t = expenses.filter(e => e.month === m).reduce((s,e) => s+e.amount, 0);
      if (b && t <= b) count++; else break;
    }
    return count;
  })();
  const aiRate = totalEntries > 0 ? Math.round((aiAcceptedCount / totalEntries) * 100) : 0;

  const inp = { background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 14, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", padding: "20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f8fafc" }}>💸 Expense Dashboard</h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 13 }}>Track, analyze, and stay on budget</p>
          </div>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 14 }}>
            {allMonths.map(m => <option key={m} value={m}>{parseMonth(m)}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["dashboard","add","list"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                background: tab===t ? "#6366f1" : "#1e293b", color: tab===t ? "#fff" : "#94a3b8" }}>
              {t === "dashboard" ? "📊 Dashboard" : t === "add" ? "➕ Add Expense" : "📋 All Expenses"}
            </button>
          ))}
        </div>

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Total Spent", value: `₹${total.toLocaleString()}`, sub: parseMonth(selectedMonth), color: "#6366f1" },
                { label: "Top Category", value: topCat?.name || "—", sub: topCat ? `₹${topCat.value.toLocaleString()}` : "No data", color: "#f59e0b" },
                { label: "Avg / Day", value: `₹${avgPerDay.toFixed(0)}`, sub: `over ${daysInMonth} days`, color: "#10b981" },
                { label: "Budget Status", value: budget ? (total > budget ? "⚠️ Over" : "✅ Under") : "Not set", sub: budget ? `₹${budget.toLocaleString()} budget` : "Set below", color: total > (budget||Infinity) ? "#ef4444" : "#14b8a6" },
                { label: "AI Acceptance", value: `${aiRate}%`, sub: `${aiAcceptedCount} of ${totalEntries} entries`, color: "#a78bfa" },
              ].map(c => (
                <div key={c.label} style={{ background: "#1e293b", borderRadius: 12, padding: "16px", borderLeft: `4px solid ${c.color}` }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {streakMonths > 0 && (
              <div style={{ background: "#14532d", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#86efac" }}>
                🔥 {streakMonths} month{streakMonths>1?"s":""} under budget in a row! Keep it up!
              </div>
            )}

            {budget > 0 && (
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: "#94a3b8" }}>Budget Usage</span>
                  <span style={{ color: total > budget ? "#ef4444" : "#10b981", fontWeight: 600 }}>₹{total.toLocaleString()} / ₹{budget.toLocaleString()}</span>
                </div>
                <div style={{ background: "#334155", borderRadius: 99, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100,(total/budget)*100)}%`, background: total > budget ? "#ef4444" : "#10b981", height: "100%", borderRadius: 99, transition: "width 0.4s" }} />
                </div>
              </div>
            )}

            <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Set Budget for {parseMonth(selectedMonth)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="e.g. 20000"
                  style={{ flex: 1, background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 14 }} />
                <button onClick={saveBudget} style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}>Save</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Category Breakdown</div>
                {pieData.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius="70%" labelLine={!isSmall}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          if (percent < 0.04) return null;
                          const R = Math.PI / 180;
                          if (isSmall) {
                            const r = innerRadius + (outerRadius - innerRadius) * 0.55;
                            return <text x={cx + r*Math.cos(-midAngle*R)} y={cy + r*Math.sin(-midAngle*R)} fill="#fff" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 700 }}>{`${(percent*100).toFixed(0)}%`}</text>;
                          }
                          const r = outerRadius + 22;
                          return <text x={cx + r*Math.cos(-midAngle*R)} y={cy + r*Math.sin(-midAngle*R)} fill="#cbd5e1" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fontWeight: 600 }}>{`${(percent*100).toFixed(0)}%`}</text>;
                        }}>
                        {pieData.map((e, i) => <Cell key={i} fill={catColor(e.name)} />)}
                      </Pie>
                      <Tooltip formatter={v => `₹${v.toLocaleString()}`} contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: "clamp(10px, 2vw, 12px)", paddingTop: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: "#475569", textAlign: "center", paddingTop: 60 }}>No data yet</p>}
              </div>
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>Monthly Trend</div>
                {barData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData}>
                      <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                      <Tooltip formatter={v => `₹${v.toLocaleString()}`} contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8 }} />
                      <Bar dataKey="total" fill="#6366f1" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: "#475569", textAlign: "center", paddingTop: 60 }}>No data yet</p>}
              </div>
            </div>
          </>
        )}

        {/* ADD TAB */}
        {tab === "add" && (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 24, maxWidth: 500 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Add New Expense</h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>Type a note and AI will auto-detect the category and amount.</p>
            {error && <div style={{ background: "#450a0a", color: "#fca5a5", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>{error}</div>}

            {/* Note first — triggers AI */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>Note / Description</label>
              <input value={form.note} onChange={e => handleNoteChange(e.target.value)}
                placeholder="e.g. Swiggy 380 or Rent 15000"
                style={{ ...inp }} />

              {/* AI suggestion banner */}
              {aiSuggestion.cat && !aiAccepted && (
                <div style={{ marginTop: 8, background: "#1e1b4b", border: "1px solid #4338ca", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: "#94a3b8" }}>AI suggests: </span>
                    <strong style={{ color: "#a5b4fc" }}>{aiSuggestion.cat}</strong>
                    {aiSuggestion.amount && <span style={{ color: "#94a3b8" }}> · ₹{aiSuggestion.amount}</span>}
                    {(() => { const c = confColor(aiSuggestion.confidence); return (
                      <span style={{ marginLeft: 8, background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                        {aiSuggestion.confidence}% confidence
                      </span>
                    ); })()}
                  </div>
                  <button onClick={acceptAiSuggestion}
                    style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Accept
                  </button>
                </div>
              )}
              {aiAccepted && (
                <div style={{ marginTop: 8, background: "#14532d", border: "1px solid #166534", borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#86efac", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>✅ AI auto-filled — review below and edit if needed</span>
                  <button onClick={() => { setAiAccepted(false); setAiSuggestion({ cat: null, amount: null, confidence: 0 }); }}
                    style={{ background: "none", border: "none", color: "#86efac", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                    Undo
                  </button>
                </div>
              )}
            </div>

            {/* Month */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>Month</label>
              <input type="month" value={form.month} onChange={e => setForm(f => ({...f, month: e.target.value}))} style={{ ...inp }} />
            </div>

            {/* Category — editable, AI pre-fills */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                Category {aiAccepted && <span style={{ color: "#a78bfa", fontSize: 11 }}>(AI suggested — you can change)</span>}
              </label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} style={{ ...inp }}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Amount — AI pre-fills */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
                Amount (₹) {aiAccepted && aiSuggestion.amount && <span style={{ color: "#a78bfa", fontSize: 11 }}>(AI suggested)</span>}
              </label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0" style={{ ...inp }} />
            </div>

            <button onClick={addExpense}
              style={{ width: "100%", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 4 }}>
              ➕ Add Expense
            </button>
          </div>
        )}

        {/* LIST TAB */}
        {tab === "list" && (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 16 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Expenses — {parseMonth(selectedMonth)}</h2>
            {monthExpenses.length === 0
              ? <p style={{ color: "#475569", textAlign: "center", padding: "40px 0" }}>No expenses for this month. Add some!</p>
              : [...monthExpenses].sort((a,b) => b.id-a.id).map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", borderRadius: 10, background: "#0f172a", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: catColor(e.category) }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
                        {e.category}
                        {e.aiAssisted && <span style={{ marginLeft: 6, fontSize: 10, background: "#1e1b4b", color: "#a5b4fc", padding: "1px 6px", borderRadius: 99, fontWeight: 600 }}>AI</span>}
                      </div>
                      {e.note && <div style={{ fontSize: 12, color: "#64748b" }}>{e.note}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontWeight: 700, color: "#a5b4fc" }}>₹{e.amount.toLocaleString()}</span>
                    <button onClick={() => deleteExpense(e.id)}
                      style={{ background: "#450a0a", color: "#fca5a5", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                </div>
              ))
            }
            {monthExpenses.length > 0 && (
              <div style={{ borderTop: "1px solid #334155", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span style={{ color: "#94a3b8" }}>Total</span>
                <span style={{ color: "#a5b4fc" }}>₹{total.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
