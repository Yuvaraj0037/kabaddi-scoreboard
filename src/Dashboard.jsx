import { useEffect, useState } from "react";

const ACTIVE_MATCH_KEY = "kabaddi_active_match";
import Scoreboard from "./Scoreboard";

const defaultConfig = {
  teamA: "Chennai Warriors",
  teamB: "Madurai Kings",
  halfMinutes: 20,
  halves: 2,
  raidSeconds: 30,
  breakMinutes: 5,
  autoStartRaid: false,
  soundEnabled: true,
};

export default function Dashboard() {
  const [config, setConfig] = useState(defaultConfig);
  const [started, setStarted] = useState(false);
  const [savedMatch, setSavedMatch] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_MATCH_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (parsed?.config && parsed?.state) {
        setSavedMatch(parsed);
      }
    } catch (error) {
      console.error("Unable to restore saved match:", error);
    }
  }, []);

  const updateConfig = (key, value) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (started) {
    return (
      <Scoreboard
        config={config}
        onExit={() => {
          setStarted(false);
          setSavedMatch(null);
        }}
      />
    );
  }

  const resumeMatch = () => {
    if (!savedMatch?.config) return;
    setConfig(savedMatch.config);
    setStarted(true);
  };

  const startNewMatch = () => {
    if (savedMatch) {
      const confirmed = window.confirm(
        "A saved match is available. Starting a new match will replace it. Continue?"
      );
      if (!confirmed) return;
    }

    localStorage.removeItem(ACTIVE_MATCH_KEY);
    setSavedMatch(null);
    setConfig(defaultConfig);
    setStarted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}

      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              Kabaddi
            </p>

            <h1 className="text-xl font-black">
              Scoreboard
            </h1>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
            ⚙
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-10 pt-6">
        {savedMatch && (
          <section className="mb-5 rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 text-xl">
                ↻
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-yellow-300">
                  Match saved automatically
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {savedMatch.config.teamA} {savedMatch.state.scoreA} —{" "}
                  {savedMatch.state.scoreB} {savedMatch.config.teamB}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Your match can be resumed after a refresh or reopening the app.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={resumeMatch}
                className="rounded-xl bg-yellow-500 py-3 font-black text-slate-950 hover:bg-yellow-400"
              >
                RESUME MATCH
              </button>
              <button
                onClick={startNewMatch}
                className="rounded-xl bg-slate-800 py-3 font-black text-white hover:bg-slate-700"
              >
                NEW MATCH
              </button>
            </div>
          </section>
        )}

        {/* HERO */}

        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-blue-600/20 via-slate-900 to-slate-900 p-6">
          <div className="max-w-xl">
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
              MATCH CENTER
            </span>

            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
              Create your Kabaddi match
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Configure teams, match duration and raid timer
              before starting the live scoreboard.
            </p>

            <button
              onClick={() =>
                document
                  .getElementById("match-setup")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="mt-6 w-full rounded-2xl bg-blue-600 py-4 font-black transition hover:bg-blue-500 sm:w-auto sm:px-10"
            >
              Create Match →
            </button>
          </div>
        </section>

        {/* MATCH PREVIEW */}

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">
              Match Preview
            </h2>

            <span className="text-xs text-slate-500">
              Ready
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TeamPreview
              name={config.teamA}
              color="blue"
            />

            <TeamPreview
              name={config.teamB}
              color="orange"
            />
          </div>
        </section>

        {/* SETUP */}

        <section
          id="match-setup"
          className="mt-6 space-y-4"
        >
          {/* TEAM SETUP */}

          <SetupCard
            number="01"
            title="Team Setup"
            description="Enter both team names"
          >
            <div className="space-y-3">
              <TeamInput
                label="Team A"
                value={config.teamA}
                onChange={(value) =>
                  updateConfig("teamA", value)
                }
                accent="blue"
              />

              <TeamInput
                label="Team B"
                value={config.teamB}
                onChange={(value) =>
                  updateConfig("teamB", value)
                }
                accent="orange"
              />
            </div>
          </SetupCard>

          {/* MATCH SETTINGS */}

          <SetupCard
            number="02"
            title="Match Settings"
            description="Configure match duration"
          >
            <div className="grid grid-cols-2 gap-3">
              <SettingSelect
                label="Half Duration"
                value={config.halfMinutes}
                onChange={(value) =>
                  updateConfig(
                    "halfMinutes",
                    Number(value)
                  )
                }
              >
                <option value="5">5 min</option>
                <option value="10">10 min</option>
                <option value="15">15 min</option>
                <option value="20">20 min</option>
                <option value="25">25 min</option>
                <option value="30">30 min</option>
              </SettingSelect>

              <SettingSelect
                label="Number of Halves"
                value={config.halves}
                onChange={(value) =>
                  updateConfig(
                    "halves",
                    Number(value)
                  )
                }
              >
                <option value="1">1 Half</option>
                <option value="2">2 Halves</option>
              </SettingSelect>

              <SettingSelect
                label="Raid Timer"
                value={config.raidSeconds}
                onChange={(value) =>
                  updateConfig(
                    "raidSeconds",
                    Number(value)
                  )
                }
              >
                <option value="15">15 sec</option>
                <option value="20">20 sec</option>
                <option value="25">25 sec</option>
                <option value="30">30 sec</option>
                <option value="35">35 sec</option>
              </SettingSelect>

              <SettingSelect
                label="Half Break"
                value={config.breakMinutes}
                onChange={(value) =>
                  updateConfig(
                    "breakMinutes",
                    Number(value)
                  )
                }
              >
                <option value="1">1 min</option>
                <option value="2">2 min</option>
                <option value="3">3 min</option>
                <option value="5">5 min</option>
                <option value="10">10 min</option>
              </SettingSelect>
            </div>
          </SetupCard>

          {/* OPTIONS */}

          <SetupCard
            number="03"
            title="Match Options"
            description="Additional scoreboard controls"
          >
            <div className="space-y-3">
              <ToggleRow
                title="Auto start raid"
                description="Start raid timer after scoring"
                checked={config.autoStartRaid}
                onChange={(value) =>
                  updateConfig(
                    "autoStartRaid",
                    value
                  )
                }
              />

              <ToggleRow
                title="Sound alerts"
                description="Play sound when timers finish"
                checked={config.soundEnabled}
                onChange={(value) =>
                  updateConfig(
                    "soundEnabled",
                    value
                  )
                }
              />
            </div>
          </SetupCard>
        </section>

        {/* START MATCH */}

        <section className="mt-6 rounded-3xl border border-green-500/20 bg-green-500/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10 text-xl">
              ✓
            </div>

            <div>
              <h3 className="font-black">
                Ready to start
              </h3>

              <p className="text-xs text-slate-500">
                Check your teams and settings
              </p>
            </div>
          </div>

          <button
            onClick={startNewMatch}
            disabled={
              !config.teamA.trim() ||
              !config.teamB.trim()
            }
            className="mt-5 w-full rounded-2xl bg-green-600 py-4 font-black transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            START MATCH
          </button>
        </section>
      </main>
    </div>
  );
}

/* -------------------------------- */
/* Team Preview */
/* -------------------------------- */

function TeamPreview({ name, color }) {
  const isBlue = color === "blue";

  return (
    <div
      className={`rounded-3xl border p-5 ${
        isBlue
          ? "border-blue-500/20 bg-blue-500/5"
          : "border-orange-500/20 bg-orange-500/5"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {isBlue ? "Team A" : "Team B"}
      </p>

      <h3
        className={`mt-2 truncate text-lg font-black ${
          isBlue
            ? "text-blue-400"
            : "text-orange-400"
        }`}
      >
        {name}
      </h3>
    </div>
  );
}

/* -------------------------------- */
/* Setup Card */
/* -------------------------------- */

function SetupCard({
  number,
  title,
  description,
  children,
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-black text-blue-400">
          {number}
        </div>

        <div>
          <h2 className="font-black">{title}</h2>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}

/* -------------------------------- */
/* Team Input */
/* -------------------------------- */

function TeamInput({
  label,
  value,
  onChange,
  accent,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-400">
        {label}
      </span>

      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className={`w-full rounded-xl border bg-slate-950 px-4 py-3 outline-none transition ${
          accent === "blue"
            ? "border-slate-700 focus:border-blue-500"
            : "border-slate-700 focus:border-orange-500"
        }`}
        placeholder={`Enter ${label} name`}
      />
    </label>
  );
}

/* -------------------------------- */
/* Select */
/* -------------------------------- */

function SettingSelect({
  label,
  value,
  onChange,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500"
      >
        {children}
      </select>
    </label>
  );
}

/* -------------------------------- */
/* Toggle */
/* -------------------------------- */

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-950 p-4">
      <div>
        <h3 className="text-sm font-bold">
          {title}
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <button
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked
            ? "bg-blue-600"
            : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked
              ? "left-6"
              : "left-1"
          }`}
        />
      </button>
    </div>
  );
}