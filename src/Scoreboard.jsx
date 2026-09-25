import { useEffect, useMemo, useState } from "react";

const ACTIVE_MATCH_KEY = "kabaddi_active_match";

const readSavedMatch = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_MATCH_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.state ? parsed : null;
  } catch (error) {
    console.error("Unable to read saved match:", error);
    return null;
  }
};

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const formatTime = (seconds) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
};

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function Scoreboard({ config, onExit }) {
  const {
    teamA = "Team A",
    teamB = "Team B",
    halfMinutes = 20,
    halves = 2,
    raidSeconds = 30,
    breakMinutes = 5,
    soundEnabled = true,
  } = config || {};

  // --------------------------------------------------
  // MATCH STATE
  // --------------------------------------------------

  const halfDuration = halfMinutes * 60;
  const breakDuration = breakMinutes * 60;

  const savedMatch = readSavedMatch();
  const savedState = savedMatch?.state;

  const [scoreA, setScoreA] = useState(() => savedState?.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(() => savedState?.scoreB ?? 0);
  const [currentHalf, setCurrentHalf] = useState(
    () => savedState?.currentHalf ?? 1
  );
  const [matchTime, setMatchTime] = useState(
    () => savedState?.matchTime ?? halfDuration
  );
  const [raidTime, setRaidTime] = useState(
    () => savedState?.raidTime ?? raidSeconds
  );
  const [matchRunning, setMatchRunning] = useState(
    () => savedState?.matchRunning ?? false
  );
  const [raidRunning, setRaidRunning] = useState(
    () => savedState?.raidRunning ?? false
  );
  const [breakRunning, setBreakRunning] = useState(
    () => savedState?.breakRunning ?? false
  );
  const [breakTime, setBreakTime] = useState(
    () => savedState?.breakTime ?? breakDuration
  );
  const [matchFinished, setMatchFinished] = useState(
    () => savedState?.matchFinished ?? false
  );

  // A = Team A is raiding
  // B = Team B is raiding
  const [activeTeam, setActiveTeam] = useState(
    () => savedState?.activeTeam ?? "A"
  );

  // Consecutive empty raids for each team.
  const [emptyRaidsA, setEmptyRaidsA] = useState(
    () => savedState?.emptyRaidsA ?? 0
  );
  const [emptyRaidsB, setEmptyRaidsB] = useState(
    () => savedState?.emptyRaidsB ?? 0
  );

  const [history, setHistory] = useState(
    () => savedState?.history ?? []
  );

  // --------------------------------------------------
  // DERIVED STATE
  // --------------------------------------------------

  const activeTeamName = activeTeam === "A" ? teamA : teamB;

  const defendingTeam = activeTeam === "A" ? "B" : "A";

  const defendingTeamName =
    defendingTeam === "A" ? teamA : teamB;

  const activeEmptyRaids =
    activeTeam === "A" ? emptyRaidsA : emptyRaidsB;

  const isDoOrDie = activeEmptyRaids >= 2;

  const scoreDifference = Math.abs(scoreA - scoreB);

  const leader =
    scoreA > scoreB
      ? teamA
      : scoreB > scoreA
      ? teamB
      : "Draw";

  // --------------------------------------------------
  // AUTO-SAVE MATCH
  // --------------------------------------------------

  useEffect(() => {
    try {
      localStorage.setItem(
        ACTIVE_MATCH_KEY,
        JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          config: {
            teamA,
            teamB,
            halfMinutes,
            halves,
            raidSeconds,
            breakMinutes,
            soundEnabled,
          },
          state: {
            scoreA,
            scoreB,
            currentHalf,
            matchTime,
            raidTime,
            matchRunning,
            raidRunning,
            breakRunning,
            breakTime,
            matchFinished,
            activeTeam,
            emptyRaidsA,
            emptyRaidsB,
            history,
          },
        })
      );
    } catch (error) {
      console.error("Unable to save match:", error);
    }
  }, [
    teamA,
    teamB,
    halfMinutes,
    halves,
    raidSeconds,
    breakMinutes,
    soundEnabled,
    scoreA,
    scoreB,
    currentHalf,
    matchTime,
    raidTime,
    matchRunning,
    raidRunning,
    breakRunning,
    breakTime,
    matchFinished,
    activeTeam,
    emptyRaidsA,
    emptyRaidsB,
    history,
  ]);

  // --------------------------------------------------
  // SOUND
  // --------------------------------------------------

  const beep = (frequency = 700, duration = 100) => {
    if (!soundEnabled) return;

    try {
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) return;

      const audioContext = new AudioContext();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      gain.gain.setValueAtTime(0.05, audioContext.currentTime);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();

      oscillator.stop(
        audioContext.currentTime + duration / 1000
      );
    } catch {
      // Ignore browser audio restrictions.
    }
  };

  // --------------------------------------------------
  // TIMER
  // --------------------------------------------------

  useEffect(() => {
    if (!matchRunning || breakRunning || matchFinished) {
      return;
    }

    const interval = setInterval(() => {
      setMatchTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          setMatchRunning(false);
          setRaidRunning(false);

          handleHalfEnd();

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    matchRunning,
    breakRunning,
    matchFinished,
    currentHalf,
  ]);

  // --------------------------------------------------
  // RAID TIMER
  // --------------------------------------------------

  useEffect(() => {
    if (
      !raidRunning ||
      !matchRunning ||
      breakRunning ||
      matchFinished
    ) {
      return;
    }

    const interval = setInterval(() => {
      setRaidTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          handleRaidTimeout();

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    raidRunning,
    matchRunning,
    breakRunning,
    matchFinished,
  ]);

  // --------------------------------------------------
  // BREAK TIMER
  // --------------------------------------------------

  useEffect(() => {
    if (!breakRunning || matchFinished) {
      return;
    }

    const interval = setInterval(() => {
      setBreakTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          startNextHalf();

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breakRunning, matchFinished]);

  // --------------------------------------------------
  // MATCH TIMER HELPERS
  // --------------------------------------------------

  function handleHalfEnd() {
    beep(500, 250);

    if (currentHalf < halves) {
      setBreakRunning(true);
      setBreakTime(breakDuration);
      setRaidRunning(false);
    } else {
      finishMatch();
    }
  }

  function startNextHalf() {
    const nextHalf = currentHalf + 1;

    if (nextHalf > halves) {
      finishMatch();
      return;
    }

    setCurrentHalf(nextHalf);
    setMatchTime(halfDuration);

    setBreakRunning(false);
    setMatchRunning(false);
    setRaidRunning(false);

    setRaidTime(raidSeconds);

    setActiveTeam("A");

    setEmptyRaidsA(0);
    setEmptyRaidsB(0);

    beep(900, 150);
  }

  function finishMatch() {
    setMatchRunning(false);
    setRaidRunning(false);
    setBreakRunning(false);
    setMatchFinished(true);

    beep(1000, 400);
  }

  // --------------------------------------------------
  // START / PAUSE
  // --------------------------------------------------

  function toggleMatch() {
    if (matchFinished || breakRunning) return;

    setMatchRunning((prev) => {
      const next = !prev;

      if (next) {
        setRaidRunning(true);
      } else {
        setRaidRunning(false);
      }

      return next;
    });
  }

  // --------------------------------------------------
  // START NEW RAID
  // --------------------------------------------------

  function startRaid(team = activeTeam) {
    if (matchFinished || breakRunning) return;

    setActiveTeam(team);
    setRaidTime(raidSeconds);
    setRaidRunning(true);

    if (!matchRunning) {
      setMatchRunning(true);
    }
  }

  // --------------------------------------------------
  // SWITCH RAID
  // --------------------------------------------------

  function switchRaid() {
    const nextTeam = activeTeam === "A" ? "B" : "A";

    setActiveTeam(nextTeam);
    setRaidTime(raidSeconds);
    setRaidRunning(true);

    if (!matchRunning && !matchFinished) {
      setMatchRunning(true);
    }
  }

  // --------------------------------------------------
  // SCORE EVENT
  // --------------------------------------------------

  function addEvent({
    team,
    points,
    action,
    previousActiveTeam = activeTeam,
    previousEmptyA = emptyRaidsA,
    previousEmptyB = emptyRaidsB,
  }) {
    const event = {
      id: makeId(),
      team,
      points,
      action,
      half: currentHalf,
      time: formatTime(matchTime),
      previousActiveTeam,
      previousEmptyA,
      previousEmptyB,
    };

    setHistory((prev) => [event, ...prev]);
  }

  // --------------------------------------------------
  // NORMAL SCORE
  // --------------------------------------------------

  function addScore(team, points, action) {
    if (matchFinished || breakRunning) return;

    const previousActiveTeam = activeTeam;
    const previousEmptyA = emptyRaidsA;
    const previousEmptyB = emptyRaidsB;

    if (team === "A") {
      setScoreA((prev) => prev + points);
    } else {
      setScoreB((prev) => prev + points);
    }

    // Successful raid resets that team's empty-raid count.
    if (team === "A") {
      setEmptyRaidsA(0);
    } else {
      setEmptyRaidsB(0);
    }

    addEvent({
      team,
      points,
      action,
      previousActiveTeam,
      previousEmptyA,
      previousEmptyB,
    });

    beep(800, 80);

    switchRaid();
  }

  // --------------------------------------------------
  // BONUS
  // --------------------------------------------------

  function addBonus() {
    addScore(
      activeTeam,
      1,
      "Bonus +1"
    );
  }

  // --------------------------------------------------
  // TACKLE
  // --------------------------------------------------

  function addTackle() {
    if (matchFinished || breakRunning) return;

    const previousActiveTeam = activeTeam;
    const previousEmptyA = emptyRaidsA;
    const previousEmptyB = emptyRaidsB;

    setDefendingScore(1);

    addEvent({
      team: defendingTeam,
      points: 1,
      action: "Tackle +1",
      previousActiveTeam,
      previousEmptyA,
      previousEmptyB,
    });

    resetRaidingTeamAfterDefence();

    beep(750, 100);

    switchRaid();
  }

  // --------------------------------------------------
  // SUPER TACKLE
  // --------------------------------------------------

  function addSuperTackle() {
    if (matchFinished || breakRunning) return;

    const previousActiveTeam = activeTeam;
    const previousEmptyA = emptyRaidsA;
    const previousEmptyB = emptyRaidsB;

    setDefendingScore(2);

    addEvent({
      team: defendingTeam,
      points: 2,
      action: "Super Tackle +2",
      previousActiveTeam,
      previousEmptyA,
      previousEmptyB,
    });

    resetRaidingTeamAfterDefence();

    beep(850, 120);

    switchRaid();
  }

  function setDefendingScore(points) {
    if (defendingTeam === "A") {
      setScoreA((prev) => prev + points);
    } else {
      setScoreB((prev) => prev + points);
    }
  }

  function resetRaidingTeamAfterDefence() {
    if (activeTeam === "A") {
      setEmptyRaidsA(0);
    } else {
      setEmptyRaidsB(0);
    }
  }

  // --------------------------------------------------
  // ALL OUT
  // --------------------------------------------------

  function addAllOut() {
    if (matchFinished || breakRunning) return;

    const previousActiveTeam = activeTeam;
    const previousEmptyA = emptyRaidsA;
    const previousEmptyB = emptyRaidsB;

    // All-out points go to the raiding team.
    if (activeTeam === "A") {
      setScoreA((prev) => prev + 2);
      setEmptyRaidsA(0);
    } else {
      setScoreB((prev) => prev + 2);
      setEmptyRaidsB(0);
    }

    addEvent({
      team: activeTeam,
      points: 2,
      action: "All Out +2",
      previousActiveTeam,
      previousEmptyA,
      previousEmptyB,
    });

    beep(1000, 180);

    switchRaid();
  }

  // --------------------------------------------------
  // EMPTY RAID
  // --------------------------------------------------

  function emptyRaid() {
    if (matchFinished || breakRunning) return;

    const previousActiveTeam = activeTeam;
    const previousEmptyA = emptyRaidsA;
    const previousEmptyB = emptyRaidsB;

    // -----------------------------------------------
    // DO-OR-DIE FAILURE
    // -----------------------------------------------

    if (isDoOrDie) {
      // Defending team gets +1.
      if (defendingTeam === "A") {
        setScoreA((prev) => prev + 1);
      } else {
        setScoreB((prev) => prev + 1);
      }

      // Failed Do-or-Die raid resets empty count.
      if (activeTeam === "A") {
        setEmptyRaidsA(0);
      } else {
        setEmptyRaidsB(0);
      }

      addEvent({
        team: defendingTeam,
        points: 1,
        action: `Do-or-Die Failed — ${activeTeamName} Raider OUT`,
        previousActiveTeam,
        previousEmptyA,
        previousEmptyB,
      });

      beep(450, 300);

      switchRaid();

      return;
    }

    // -----------------------------------------------
    // NORMAL EMPTY RAID
    // -----------------------------------------------

    if (activeTeam === "A") {
      setEmptyRaidsA((prev) => Math.min(prev + 1, 2));
    } else {
      setEmptyRaidsB((prev) => Math.min(prev + 1, 2));
    }

    addEvent({
      team: activeTeam,
      points: 0,
      action:
        activeEmptyRaids + 1 >= 2
          ? "Empty Raid — Do-or-Die Next"
          : "Empty Raid",
      previousActiveTeam,
      previousEmptyA,
      previousEmptyB,
    });

    beep(600, 80);

    switchRaid();
  }

  // --------------------------------------------------
  // RAID TIMEOUT
  // --------------------------------------------------

  function handleRaidTimeout() {
    if (matchFinished || breakRunning) return;

    setRaidRunning(false);

    const previousActiveTeam = activeTeam;
    const previousEmptyA = emptyRaidsA;
    const previousEmptyB = emptyRaidsB;

    // A timeout is treated as an unsuccessful raid.
    if (isDoOrDie) {
      if (defendingTeam === "A") {
        setScoreA((prev) => prev + 1);
      } else {
        setScoreB((prev) => prev + 1);
      }

      if (activeTeam === "A") {
        setEmptyRaidsA(0);
      } else {
        setEmptyRaidsB(0);
      }

      addEvent({
        team: defendingTeam,
        points: 1,
        action: `Do-or-Die Timeout — ${activeTeamName} Raider OUT`,
        previousActiveTeam,
        previousEmptyA,
        previousEmptyB,
      });

      beep(400, 300);
    } else {
      if (activeTeam === "A") {
        setEmptyRaidsA((prev) =>
          Math.min(prev + 1, 2)
        );
      } else {
        setEmptyRaidsB((prev) =>
          Math.min(prev + 1, 2)
        );
      }

      addEvent({
        team: activeTeam,
        points: 0,
        action:
          activeEmptyRaids + 1 >= 2
            ? "Raid Timeout — Do-or-Die Next"
            : "Raid Timeout",
        previousActiveTeam,
        previousEmptyA,
        previousEmptyB,
      });

      beep(500, 180);
    }

    switchRaid();
  }

  // --------------------------------------------------
  // UNDO
  // --------------------------------------------------

  function undoLast() {
    if (history.length === 0 || matchFinished) return;

    const last = history[0];

    // Reverse score.
    if (last.team === "A") {
      setScoreA((prev) =>
        Math.max(0, prev - last.points)
      );
    } else if (last.team === "B") {
      setScoreB((prev) =>
        Math.max(0, prev - last.points)
      );
    }

    // Restore previous empty raid counts.
    setEmptyRaidsA(last.previousEmptyA);
    setEmptyRaidsB(last.previousEmptyB);

    // Restore previous raiding team.
    setActiveTeam(last.previousActiveTeam);

    setRaidTime(raidSeconds);
    setRaidRunning(matchRunning);

    setHistory((prev) => prev.slice(1));

    beep(350, 100);
  }

  // --------------------------------------------------
  // RESET MATCH
  // --------------------------------------------------

  function resetMatch() {
    const confirmed = window.confirm(
      "Reset this match? All scores and history will be lost."
    );

    if (!confirmed) return;

    setScoreA(0);
    setScoreB(0);

    setCurrentHalf(1);

    setMatchTime(halfDuration);
    setRaidTime(raidSeconds);

    setMatchRunning(false);
    setRaidRunning(false);

    setBreakRunning(false);
    setBreakTime(breakDuration);

    setMatchFinished(false);

    setActiveTeam("A");

    setEmptyRaidsA(0);
    setEmptyRaidsB(0);

    setHistory([]);

    beep(300, 100);
  }

  // --------------------------------------------------
  // EXIT
  // --------------------------------------------------

  function exitMatch() {
    const confirmed = window.confirm(
      "Exit this match? The saved match will be cleared."
    );

    if (confirmed) {
      localStorage.removeItem(ACTIVE_MATCH_KEY);

      if (onExit) {
        onExit();
      }
    }
  }

  // --------------------------------------------------
  // SCORE LABEL
  // --------------------------------------------------

  const resultText = useMemo(() => {
    if (scoreA === scoreB) {
      return "MATCH DRAW";
    }

    return scoreA > scoreB
      ? `${teamA} LEADS`
      : `${teamB} LEADS`;
  }, [scoreA, scoreB, teamA, teamB]);

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-28">
      {/* ==============================================
          HEADER
      =============================================== */}

      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-5">
          <button
            onClick={exitMatch}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            ← Exit
          </button>

          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Kabaddi
            </div>

            <div className="text-sm font-bold">
              Half {currentHalf}/{halves}
            </div>
          </div>

          <button
            onClick={resetMatch}
            className="rounded-lg border border-red-900/60 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/40"
          >
            Reset
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5">
        {/* ==============================================
            BREAK SCREEN
        =============================================== */}

        {breakRunning && !matchFinished && (
          <section className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-yellow-400">
              Half Break
            </div>

            <div className="mt-2 text-5xl font-black tabular-nums sm:text-6xl">
              {formatTime(breakTime)}
            </div>

            <p className="mt-2 text-sm text-slate-400">
              Next half will start automatically.
            </p>
          </section>
        )}

        {/* ==============================================
            MATCH FINISHED
        =============================================== */}

        {matchFinished && (
          <section className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-400">
              Match Finished
            </div>

            <div className="mt-4 grid grid-cols-3 items-center gap-3">
              <div>
                <div className="truncate text-sm font-bold text-slate-300">
                  {teamA}
                </div>

                <div className="mt-1 text-5xl font-black">
                  {scoreA}
                </div>
              </div>

              <div className="text-2xl font-black text-slate-500">
                -
              </div>

              <div>
                <div className="truncate text-sm font-bold text-slate-300">
                  {teamB}
                </div>

                <div className="mt-1 text-5xl font-black">
                  {scoreB}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-900 p-3 text-sm font-bold">
              {resultText}
            </div>
          </section>
        )}

        {/* ==============================================
            MATCH TIMER
        =============================================== */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Match Time
              </div>

              <div className="mt-1 text-4xl font-black tabular-nums sm:text-5xl">
                {formatTime(matchTime)}
              </div>
            </div>

            <div className="text-right">
              <div
                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                  matchRunning
                    ? "bg-green-500/15 text-green-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {breakRunning
                  ? "BREAK"
                  : matchRunning
                  ? "LIVE"
                  : matchFinished
                  ? "FINISHED"
                  : "PAUSED"}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Half {currentHalf} of {halves}
              </div>
            </div>
          </div>
        </section>

        {/* ==============================================
            SCORE
        =============================================== */}

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ScoreCard
            name={teamA}
            score={scoreA}
            active={activeTeam === "A"}
            emptyRaids={emptyRaidsA}
          />

          <ScoreCard
            name={teamB}
            score={scoreB}
            active={activeTeam === "B"}
            emptyRaids={emptyRaidsB}
          />
        </section>

        {/* ==============================================
            CURRENT RAID
        =============================================== */}

        {!matchFinished && !breakRunning && (
          <section className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-300">
              Current Raid
            </div>

            <div className="mt-1 truncate text-xl font-black sm:text-2xl">
              {activeTeamName}
            </div>

            {/* DO OR DIE */}
            {isDoOrDie && (
              <div className="mx-auto mt-3 inline-flex rounded-full bg-red-500 px-4 py-2 text-sm font-black uppercase tracking-wide text-white">
                ⚠ Do-or-Die Raid
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Raid Timer
              </div>

              <div
                className={`mt-1 text-5xl font-black tabular-nums ${
                  raidTime <= 5
                    ? "text-red-400"
                    : raidTime <= 10
                    ? "text-yellow-400"
                    : "text-white"
                }`}
              >
                {formatTime(raidTime)}
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              Consecutive empty raids:{" "}
              <span className="font-bold text-white">
                {activeEmptyRaids}
              </span>
            </div>
          </section>
        )}

        {/* ==============================================
            QUICK RAID SCORE
        =============================================== */}

        {!matchFinished && !breakRunning && (
          <>
            <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Raid Points
                </div>

                <div className="text-sm font-bold text-slate-300">
                  {activeTeamName}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((points) => (
                  <button
                    key={points}
                    onClick={() =>
                      addScore(
                        activeTeam,
                        points,
                        `Raid +${points}`
                      )
                    }
                    className="scoreBtn bg-slate-800 text-lg hover:bg-slate-700"
                  >
                    +{points}
                  </button>
                ))}
              </div>
            </section>

            {/* ==========================================
                BONUS
            =========================================== */}

            <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                Raid Bonus
              </div>

              <button
                onClick={addBonus}
                className="w-full rounded-xl bg-indigo-600 py-4 text-lg font-black hover:bg-indigo-500"
              >
                +1 BONUS
              </button>
            </section>

            {/* ==========================================
                DEFENCE
            =========================================== */}

            <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Defence
                </div>

                <div className="text-sm font-bold text-slate-300">
                  {defendingTeamName}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={addTackle}
                  className="scoreBtn bg-slate-800 text-base hover:bg-slate-700"
                >
                  +1 TACKLE
                </button>

                <button
                  onClick={addSuperTackle}
                  className="scoreBtn bg-slate-800 text-base hover:bg-slate-700"
                >
                  +2 SUPER
                </button>
              </div>

              <button
                onClick={addAllOut}
                className="mt-2 w-full rounded-xl bg-red-600 py-4 text-base font-black hover:bg-red-500"
              >
                ALL OUT +2
              </button>
            </section>

            {/* ==========================================
                EMPTY / DO OR DIE
            =========================================== */}

            <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                Raid Result
              </div>

              <button
                onClick={emptyRaid}
                className={`w-full rounded-xl py-4 text-base font-black ${
                  isDoOrDie
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {isDoOrDie
                  ? "DO-OR-DIE FAILED / RAIDER OUT"
                  : "EMPTY RAID — 0"}
              </button>
            </section>

            {/* ==========================================
                MATCH CONTROLS
            =========================================== */}

            <section className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={toggleMatch}
                className="controlBtn"
              >
                {matchRunning ? "⏸ PAUSE" : "▶ START"}
              </button>

              <button
                onClick={() => startRaid(activeTeam)}
                className="secondaryBtn"
              >
                NEW RAID
              </button>

              <button
                onClick={undoLast}
                disabled={history.length === 0}
                className="secondaryBtn disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↩ UNDO LAST
              </button>

              <button
                onClick={switchRaid}
                className="secondaryBtn"
              >
                ⇄ SWITCH RAID
              </button>
            </section>
          </>
        )}

        {/* ==============================================
            HISTORY
        =============================================== */}

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Match History
              </div>

              <div className="text-sm font-bold text-slate-300">
                Recent events
              </div>
            </div>

            <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-slate-500">
              {history.length} events
            </div>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
              No events yet.
            </div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">
                      {event.team === "A"
                        ? teamA
                        : teamB}
                    </div>

                    <div
                      className={`mt-0.5 text-xs ${
                        event.action.includes(
                          "Do-or-Die"
                        )
                          ? "font-bold text-red-400"
                          : "text-slate-500"
                      }`}
                    >
                      {event.action}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className={`text-lg font-black ${
                        event.points > 0
                          ? "text-green-400"
                          : "text-slate-500"
                      }`}
                    >
                      {event.points > 0
                        ? `+${event.points}`
                        : "0"}
                    </div>

                    <div className="text-[10px] text-slate-600">
                      H{event.half} · {event.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ==============================================
            CURRENT MATCH STATUS
        =============================================== */}

        <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Match Status
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatusItem
              label={`${teamA} Empty`}
              value={`${emptyRaidsA}/2`}
            />

            <StatusItem
              label={`${teamB} Empty`}
              value={`${emptyRaidsB}/2`}
            />

            <StatusItem
              label="Current Half"
              value={`${currentHalf}/${halves}`}
            />

            <StatusItem
              label="Score Difference"
              value={scoreDifference}
            />
          </div>
        </section>
      </main>

      {/* ==============================================
          MOBILE STICKY CONTROLS
      =============================================== */}

      {!matchFinished && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/95 p-2 backdrop-blur sm:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            <button
              onClick={toggleMatch}
              disabled={breakRunning}
              className="rounded-xl bg-blue-600 py-3 text-sm font-black disabled:opacity-40"
            >
              {matchRunning ? "PAUSE" : "START"}
            </button>

            <button
              onClick={() => startRaid(activeTeam)}
              disabled={breakRunning}
              className="rounded-xl bg-slate-800 py-3 text-sm font-black disabled:opacity-40"
            >
              RAID
            </button>

            <button
              onClick={undoLast}
              disabled={history.length === 0}
              className="rounded-xl bg-slate-800 py-3 text-sm font-black disabled:opacity-40"
            >
              UNDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================
// SCORE CARD
// ======================================================

function ScoreCard({
  name,
  score,
  active,
  emptyRaids,
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 text-center ${
        active
          ? "border-blue-500 bg-blue-500/10"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      {active && (
        <div className="absolute right-2 top-2 rounded-full bg-blue-500 px-2 py-1 text-[9px] font-black uppercase">
          Raid
        </div>
      )}

      <div className="truncate pr-8 text-xs font-bold uppercase tracking-wide text-slate-400">
        {name}
      </div>

      <div className="mt-2 text-5xl font-black tabular-nums sm:text-6xl">
        {score}
      </div>

      <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Empty raids: {emptyRaids}/2
      </div>
    </div>
  );
}

// ======================================================
// STATUS ITEM
// ======================================================

function StatusItem({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-950 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
        {label}
      </div>

      <div className="mt-1 text-lg font-black">
        {value}
      </div>
    </div>
  );
}