"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { UDSCommandResult } from "@/types";
import { Terminal, Send, Trash, ChevronRight } from "lucide-react";

const QUICK_COMMANDS = [
  { label: '10 01', desc: 'Default Session' },
  { label: '10 03', desc: 'Extended Session' },
  { label: '22 F1 90', desc: 'Read Speed' },
  { label: '22 02 00', desc: 'ADAS Mode' },
  { label: '22 02 01', desc: 'AEB Status' },
  { label: '22 02 04', desc: 'Read TTC' },
  { label: '22 F1 8C', desc: 'ECU Serial' },
  { label: '27 01', desc: 'Request Seed' },
  { label: '19 02 FF', desc: 'Read DTCs' },
  { label: '19 0A', desc: 'All DTCs' },
  { label: '14 FF FF FF', desc: 'Clear All DTCs' },
  { label: '11 01', desc: 'Hard Reset' },
];

interface HistoryEntry extends UDSCommandResult {
  id: string;
}

export function UDSConsole() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, []);

  useEffect(scrollToBottom, [history, scrollToBottom]);

  const sendCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sim/uds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: trimmed }) });
      const result: UDSCommandResult = await res.json();
      setHistory(h => [...h, { ...result, id: Math.random().toString(36).slice(2) }]);
      setCmdHistory(h => [trimmed, ...h.slice(0, 49)]);
      setCmdIdx(-1);
    } catch (e) {
      setHistory(h => [...h, {
        id: Math.random().toString(36).slice(2),
        requestHex: trimmed,
        responseHex: '---',
        serviceName: 'Error',
        positive: false,
        interpretation: 'Network error — could not reach UDS server',
        timestamp: Date.now(),
      }]);
    }
    setLoading(false);
    setInput('');
  }, []);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { sendCommand(input); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(cmdIdx + 1, cmdHistory.length - 1);
      setCmdIdx(idx);
      setInput(cmdHistory[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(cmdIdx - 1, -1);
      setCmdIdx(idx);
      setInput(idx === -1 ? '' : cmdHistory[idx] ?? '');
    }
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Quick commands */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_COMMANDS.map(qc => (
          <button key={qc.label} onClick={() => sendCommand(qc.label)}
            className="text-xs font-mono px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-700 text-gray-300 hover:text-cyan-300 rounded transition-colors">
            <span className="text-cyan-500">{qc.label}</span>
            <span className="text-gray-500 ml-1.5">{qc.desc}</span>
          </button>
        ))}
      </div>

      {/* Terminal output */}
      <div ref={termRef}
        className="flex-1 min-h-0 bg-black/60 border border-gray-800 rounded-lg p-3 overflow-y-auto font-mono text-xs space-y-1.5"
        style={{ maxHeight: '280px' }}>
        {history.length === 0 && (
          <div className="text-gray-600">
            <div>╔══════════════════════════════════════════════════════╗</div>
            <div>║       ISO 14229 UDS Diagnostic Terminal v2.4.1      ║</div>
            <div>║    Connected: vcan0 → ADAS-ECU  (LUCID-2024-0042)   ║</div>
            <div>╚══════════════════════════════════════════════════════╝</div>
            <div className="mt-2 text-gray-700">Type a command or click a quick command above.</div>
            <div className="text-gray-700">Format: hex bytes separated by spaces (e.g., 22 F1 90)</div>
            <div className="text-gray-700">Tip: send 10 03 first to open an Extended session.</div>
          </div>
        )}

        {history.map(entry => (
          <div key={entry.id}>
            {/* Request line */}
            <div className="flex items-start gap-2">
              <span className="text-cyan-600 select-none">REQ →</span>
              <span className="text-cyan-300">{entry.requestHex}</span>
              <span className="text-gray-600 ml-auto">[{entry.serviceName}]</span>
            </div>
            {/* Response line */}
            <div className="flex items-start gap-2">
              <span className={cn("select-none", entry.positive ? "text-emerald-600" : "text-red-600")}>RES ←</span>
              <span className={cn("font-bold", entry.positive ? "text-emerald-400" : "text-red-400")}>
                {entry.responseHex}
              </span>
            </div>
            {/* Interpretation */}
            <div className="flex items-start gap-2 pl-0">
              <span className="text-gray-600 select-none">    </span>
              <span className={cn("text-xs", entry.positive ? "text-gray-400" : "text-red-400/80")}>
                ↳ {entry.interpretation}
              </span>
            </div>
            <div className="border-b border-gray-900 mt-1" />
          </div>
        ))}

        {loading && (
          <div className="text-cyan-600 animate-pulse">REQ → Processing...</div>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 bg-black/60 border border-gray-700 rounded-lg px-3 py-2 focus-within:border-cyan-700">
        <Terminal className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
        <span className="text-cyan-600 font-mono text-xs select-none">UDS&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          placeholder="22 F1 90"
          className="flex-1 bg-transparent font-mono text-xs text-cyan-300 placeholder-gray-700 outline-none"
          spellCheck={false}
        />
        <button onClick={() => sendCommand(input)} disabled={loading || !input.trim()}
          className="text-cyan-600 hover:text-cyan-400 disabled:text-gray-700 transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setHistory([])} className="text-gray-600 hover:text-gray-400 transition-colors">
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="text-xs text-gray-600 font-mono">
        ↑/↓ command history · Security flow: <span className="text-cyan-700">10 03</span> → <span className="text-cyan-700">27 01</span> → <span className="text-cyan-700">27 02 [seed XOR CAFEBABE]</span>
      </div>
    </div>
  );
}
