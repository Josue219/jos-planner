import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "jos-planner-v6";
const SYNC_ROW_ID = "jos-main-planner";

// Add these in a .env.local file when deploying:
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-public-anon-key
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

const CLASS_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
];

function makeId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function todayISO() {
  return toISODate(new Date());
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function cloudSyncEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function getClassColor(name) {
  const total = String(name || "")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CLASS_COLORS[total % CLASS_COLORS.length];
}

function formatDate(dateString) {
  if (dateString === todayISO()) return "Today";
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDayName(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function getWeekDays(startDateString) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${startDateString}T12:00:00`);
    date.setDate(date.getDate() + index);
    return toISODate(date);
  });
}

function isReadingComplete(task) {
  return task.type === "Reading" && Number(task.currentPage) >= Number(task.endPage);
}

function displayPageValue(value) {
  return value === "" || value === null || value === undefined ? "" : String(value);
}

function getStarterData() {
  return {
    classes: ["Contracts", "Torts", "Civil Procedure"],
    tasks: [
      {
        id: makeId(),
        type: "Reading",
        title: "Read casebook",
        className: "Contracts",
        dueDate: todayISO(),
        startPage: 1,
        endPage: 18,
        currentPage: 6,
      },
      {
        id: makeId(),
        type: "Assignment",
        title: "Review syllabus",
        className: "Torts",
        dueDate: addDaysISO(1),
      },
    ],
  };
}

function isValidData(value) {
  return Boolean(value && Array.isArray(value.classes) && Array.isArray(value.tasks));
}

function loadData() {
  try {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidData(parsed)) return parsed;
      }
    }
  } catch {
    // Local storage can be unavailable in preview environments.
  }

  return getStarterData();
}

function saveData(data) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage errors in preview environments.
  }
}

async function loadCloudData() {
  if (!cloudSyncEnabled()) return null;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/jos_planner?id=eq.${SYNC_ROW_ID}&select=data`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) throw new Error("Could not load synced planner data.");

  const rows = await response.json();
  const syncedData = rows?.[0]?.data;
  return isValidData(syncedData) ? syncedData : null;
}

async function saveCloudData(data) {
  if (!cloudSyncEnabled() || !isValidData(data)) return;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/jos_planner`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: SYNC_ROW_ID,
      data,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) throw new Error("Could not save synced planner data.");
}

function filterTasks(tasks, filter, viewMode, currentDay, weekDays) {
  return tasks.filter((task) => {
    const classMatches = filter === "All" || task.className === filter;
    const dateMatches = viewMode === "Daily" ? task.dueDate === currentDay : weekDays.includes(task.dueDate);
    return classMatches && dateMatches;
  });
}

function sortTasks(tasks, sortBy) {
  return [...tasks].sort((a, b) => {
    if (sortBy === "Class") {
      return a.className.localeCompare(b.className) || a.dueDate.localeCompare(b.dueDate);
    }

    if (sortBy === "Done first") {
      return Number(isReadingComplete(b)) - Number(isReadingComplete(a));
    }

    if (sortBy === "Not done first") {
      return Number(isReadingComplete(a)) - Number(isReadingComplete(b));
    }

    return a.dueDate.localeCompare(b.dueDate);
  });
}

function runTests() {
  const testTasks = [
    {
      id: "1",
      type: "Reading",
      title: "A",
      className: "Contracts",
      dueDate: "2026-05-10",
      startPage: 1,
      endPage: 11,
      currentPage: 6,
    },
    {
      id: "2",
      type: "Assignment",
      title: "B",
      className: "Torts",
      dueDate: "2026-05-11",
    },
    {
      id: "3",
      type: "Reading",
      title: "C",
      className: "Contracts",
      dueDate: "2026-05-17",
      startPage: 10,
      endPage: 20,
      currentPage: 20,
    },
  ];

  const week = getWeekDays("2026-05-10");

  return [
    {
      name: "weekly view includes seven days",
      pass: week.length === 7 && week[0] === "2026-05-10" && week[6] === "2026-05-16",
    },
    {
      name: "daily filter only shows selected day",
      pass: filterTasks(testTasks, "All", "Daily", "2026-05-10", week).length === 1,
    },
    {
      name: "weekly filter excludes outside dates",
      pass: filterTasks(testTasks, "All", "Weekly", "2026-05-10", week).length === 2,
    },
    {
      name: "class filter works",
      pass: filterTasks(testTasks, "Contracts", "Weekly", "2026-05-10", week).length === 1,
    },
    {
      name: "reading completion detects incomplete",
      pass: isReadingComplete(testTasks[0]) === false,
    },
    {
      name: "reading completion detects done",
      pass: isReadingComplete(testTasks[2]) === true,
    },
    {
      name: "blank page input is allowed while editing",
      pass: displayPageValue("") === "",
    },
    {
      name: "sort by class works",
      pass: sortTasks(testTasks, "Class")[0].className === "Contracts",
    },
    {
      name: "done first sorting works",
      pass: sortTasks(testTasks, "Done first")[0].id === "3",
    },
    {
      name: "cloud sync detection is boolean",
      pass: typeof cloudSyncEnabled() === "boolean",
    },
  ];
}

const tests = runTests();

function ClassPill({ name, active = false, onClick, tiny = false }) {
  const color = getClassColor(name);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border font-medium ${tiny ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-xs"} ${
        active ? "ring-2 ring-slate-400" : ""
      } ${color.bg} ${color.text} ${color.border}`}
    >
      {name}
    </button>
  );
}

function TaskCard({ task, onDelete, onUpdateReading }) {
  const isComplete = isReadingComplete(task);

  return (
    <article className={`rounded-xl border px-2.5 py-1.5 shadow-sm transition hover:-translate-y-0.5 ${isComplete ? "border-[#86efac] bg-[#f0fdf4]" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <p className={`truncate text-[13px] font-semibold ${isComplete ? "text-[#15803d] line-through decoration-2" : ""}`}>
              {task.title}
              {task.type === "Reading" && (
                <span className="ml-1 text-[10px] font-medium text-slate-400">
                  · pp. {task.startPage}-{task.endPage}
                </span>
              )}
            </p>
            <ClassPill name={task.className} tiny />
          </div>

          {task.type === "Reading" ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2 py-1.5">
              <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">
                p. {task.currentPage}/{task.endPage}
              </span>

              <input
                type="number"
                value={displayPageValue(task.currentPage)}
                min={task.startPage}
                max={task.endPage}
                onChange={(event) => onUpdateReading(task.id, event.target.value, false)}
                onBlur={(event) => onUpdateReading(task.id, event.target.value, true)}
                className="h-7 w-16 rounded-md border border-slate-200 bg-white px-2 text-center text-[11px] text-slate-700 outline-none focus:border-[#22c55e]"
              />

              <button
                type="button"
                onClick={() => onUpdateReading(task.id, isComplete ? task.startPage : task.endPage, true)}
                className={`${isComplete ? "bg-[#22c55e] text-white ring-2 ring-[#bbf7d0]" : "bg-white text-slate-600 border border-slate-200"} flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium transition-all whitespace-nowrap`}
              >
                {isComplete ? "Completed" : "Mark Done"}
              </button>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">{formatDate(task.dueDate)}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="text-[10px] text-slate-300 hover:text-red-500"
          aria-label={`Delete ${task.title}`}
        >
          ✕
        </button>
      </div>
    </article>
  );
}

export default function SimpleStudyTracker() {
  const initialData = useMemo(() => loadData(), []);
  const [data, setData] = useState(initialData);
  const [taskType, setTaskType] = useState("Reading");
  const [title, setTitle] = useState("");
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [className, setClassName] = useState(initialData.classes[0] || "");
  const [dueDate, setDueDate] = useState(todayISO());
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Due date");
  const [viewMode, setViewMode] = useState("Daily");
  const [currentDay, setCurrentDay] = useState(todayISO());
  const [newClass, setNewClass] = useState("");
  const [showTests, setShowTests] = useState(false);
  const [syncStatus, setSyncStatus] = useState(cloudSyncEnabled() ? "Connecting..." : "Local preview");
  const [cloudReady, setCloudReady] = useState(!cloudSyncEnabled());

  useEffect(() => {
    let cancelled = false;

    async function loadSyncedPlanner() {
      if (!cloudSyncEnabled()) return;

      try {
        const synced = await loadCloudData();
        if (cancelled) return;

        if (synced) {
          setData(synced);
          saveData(synced);
          setSyncStatus("Synced");
        } else {
          await saveCloudData(data);
          if (!cancelled) setSyncStatus("Synced");
        }
      } catch {
        if (!cancelled) setSyncStatus(cloudSyncEnabled() ? "Sync issue" : "Local preview");
      } finally {
        if (!cancelled) setCloudReady(true);
      }
    }

    loadSyncedPlanner();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveData(data);

    if (!cloudReady || !cloudSyncEnabled()) return;

    const timeout = window.setTimeout(async () => {
      try {
        await saveCloudData(data);
        setSyncStatus("Synced");
      } catch {
        setSyncStatus("Sync issue");
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [data, cloudReady]);

  useEffect(() => {
    if (!data.classes.includes(className)) {
      setClassName(data.classes[0] || "");
    }
  }, [data.classes, className]);

  const weekDays = useMemo(() => getWeekDays(currentDay), [currentDay]);

  const visibleTasks = useMemo(() => {
    return sortTasks(filterTasks(data.tasks, filter, viewMode, currentDay, weekDays), sortBy);
  }, [data.tasks, filter, viewMode, currentDay, weekDays, sortBy]);

  function addTask() {
    const cleanedTitle = title.trim();
    if (!cleanedTitle || !className || !dueDate) return;

    if (taskType === "Reading") {
      const start = Number(startPage);
      const end = Number(endPage);

      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;

      setData((current) => ({
        ...current,
        tasks: [
          ...current.tasks,
          {
            id: makeId(),
            type: "Reading",
            title: cleanedTitle,
            className,
            dueDate,
            startPage: start,
            endPage: end,
            currentPage: start,
          },
        ],
      }));
    } else {
      setData((current) => ({
        ...current,
        tasks: [
          ...current.tasks,
          {
            id: makeId(),
            type: "Assignment",
            title: cleanedTitle,
            className,
            dueDate,
          },
        ],
      }));
    }

    setTitle("");
    setStartPage("");
    setEndPage("");
  }

  function addClass() {
    const cleaned = newClass.trim();
    if (!cleaned || data.classes.includes(cleaned)) return;

    setData((current) => ({
      ...current,
      classes: [...current.classes, cleaned],
    }));
    setClassName(cleaned);
    setNewClass("");
  }

  function deleteClass(name) {
    setData((current) => ({
      ...current,
      classes: current.classes.filter((item) => item !== name),
      tasks: current.tasks.filter((task) => task.className !== name),
    }));

    if (className === name) {
      const nextClass = data.classes.find((item) => item !== name) || "";
      setClassName(nextClass);
    }

    if (filter === name) setFilter("All");
  }

  function updateReadingProgress(id, page, shouldClamp = false) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== id || task.type !== "Reading") return task;

        if (page === "") return { ...task, currentPage: "" };

        const nextPage = Number(page);
        if (!Number.isFinite(nextPage)) return task;

        if (!shouldClamp) return { ...task, currentPage: nextPage };

        return {
          ...task,
          currentPage: Math.max(task.startPage, Math.min(task.endPage, nextPage)),
        };
      }),
    }));
  }

  function deleteTask(id) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }));
  }

  function moveCurrentDay(days) {
    const date = new Date(`${currentDay}T12:00:00`);
    date.setDate(date.getDate() + days);
    setCurrentDay(toISODate(date));
  }

  function resetApp() {
    const starter = getStarterData();

    setData(starter);
    setTaskType("Reading");
    setTitle("");
    setStartPage("");
    setEndPage("");
    setClassName(starter.classes[0] || "");
    setDueDate(todayISO());
    setFilter("All");
    setSortBy("Due date");
    setViewMode("Daily");
    setCurrentDay(todayISO());
    setNewClass("");
  }

  const allTestsPassed = tests.every((test) => test.pass);

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 text-slate-800">
      <div className="mx-auto max-w-2xl">
        <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-40">
          <div className="absolute left-6 top-10 text-4xl">☁️</div>
          <div className="absolute right-10 top-24 text-3xl">⭐</div>
        </div>

        <header className="relative mb-5 flex items-center justify-between rounded-[28px] border-2 border-slate-700 bg-white px-5 py-4 shadow-[4px_4px_0px_0px_rgba(51,65,85,0.45)]">
          <div className="flex items-center gap-3">
            <div className="h-14 w-3 rounded-full bg-gradient-to-b from-[#86efac] to-[#22c55e] opacity-70" />

            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-800">
                J<span className="text-[#16a34a] tracking-[-0.08em]">OS</span>
              </h1>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Study Planner</p>
              <p className="mt-1 text-[10px] font-medium text-slate-400">
                {syncStatus}
              </p>

              {!cloudSyncEnabled() && (
                <p className="mt-1 text-[9px] text-slate-300">
                  Add Supabase keys for website sync
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={resetApp}
            className="rounded-2xl border-2 border-slate-700 bg-white px-4 py-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(51,65,85,0.45)] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Reset
          </button>
        </header>

        <details className="mb-4 rounded-xl bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-medium text-slate-600">
            <span>Quick Add</span>
            <span className="text-xs text-slate-400">⌄</span>
          </summary>

          <div className="space-y-3 px-4 pb-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTaskType("Reading")}
                className={`${taskType === "Reading" ? "bg-slate-700 text-white" : "bg-slate-100"} flex-1 rounded-lg p-2 text-sm`}
              >
                Reading
              </button>

              <button
                type="button"
                onClick={() => setTaskType("Assignment")}
                className={`${taskType === "Assignment" ? "bg-slate-700 text-white" : "bg-slate-100"} flex-1 rounded-lg p-2 text-sm`}
              >
                Assignment
              </button>
            </div>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`${taskType} title`}
              className="w-full rounded border p-2"
            />

            {taskType === "Reading" && (
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={startPage}
                  onChange={(event) => setStartPage(event.target.value)}
                  placeholder="Start"
                  type="number"
                  className="rounded border p-2"
                />
                <input
                  value={endPage}
                  onChange={(event) => setEndPage(event.target.value)}
                  placeholder="End"
                  type="number"
                  className="rounded border p-2"
                />
                <div className="flex items-center justify-center rounded border bg-slate-50 text-sm text-slate-500">
                  {startPage && endPage ? `${Math.max(0, Number(endPage) - Number(startPage) + 1)} pages` : "Pages"}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <select
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                className="min-w-0 flex-1 rounded border bg-white p-2"
              >
                {data.classes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="rounded border p-2"
              />
            </div>

            <button type="button" onClick={addTask} className="w-full rounded bg-slate-700 p-2 text-white">
              Add
            </button>
          </div>
        </details>

        <section className="sticky top-0 z-10 mb-4 rounded-[24px] border-2 border-slate-700 bg-white p-2 shadow-[3px_3px_0px_0px_rgba(51,65,85,0.35)]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode("Daily")}
              className={`${viewMode === "Daily" ? "bg-slate-700 text-white" : "bg-slate-100"} flex-1 rounded-2xl border border-slate-500 p-2 font-bold`}
            >
              Daily
            </button>

            <button
              type="button"
              onClick={() => setViewMode("Weekly")}
              className={`${viewMode === "Weekly" ? "bg-slate-700 text-white" : "bg-slate-100"} flex-1 rounded-2xl border border-slate-500 p-2 font-bold`}
            >
              Weekly
            </button>
          </div>
        </section>

        {viewMode === "Daily" && (
          <section className="mb-4 rounded-[28px] border-2 border-slate-700 bg-white p-4 shadow-[4px_4px_0px_0px_rgba(51,65,85,0.45)]">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" onClick={() => moveCurrentDay(-1)} className="rounded-xl bg-slate-100 px-4 py-2">
                Prev
              </button>

              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Daily Focus</p>
                <p className="text-2xl font-bold">{formatDate(currentDay)}</p>
              </div>

              <button type="button" onClick={() => moveCurrentDay(1)} className="rounded-xl bg-slate-700 px-4 py-2 text-white">
                Next
              </button>
            </div>

            <div className="space-y-2">
              {visibleTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-slate-400">Nothing planned today</div>
              ) : (
                visibleTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onDelete={deleteTask} onUpdateReading={updateReadingProgress} />
                ))
              )}
            </div>
          </section>
        )}

        {viewMode === "Weekly" && (
          <section className="mb-4 rounded-xl bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => moveCurrentDay(-7)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
                Prev Week
              </button>

              <div className="text-center">
                <p className="text-[13px] font-semibold">Weekly View</p>
                <p className="text-xs text-slate-500">
                  {formatDate(weekDays[0])} – {formatDate(weekDays[6])}
                </p>
              </div>

              <button type="button" onClick={() => moveCurrentDay(7)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
                Next Week
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => {
                const count = data.tasks.filter((task) => task.dueDate === day && (filter === "All" || task.className === filter)).length;
                const isToday = day === todayISO();
                const isSelected = day === currentDay;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setCurrentDay(day)}
                    className={`${isSelected ? "bg-slate-700 text-white ring-2 ring-slate-300" : isToday ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-700"} rounded-xl p-2 text-center transition-all`}
                  >
                    <div className="text-[10px] font-semibold uppercase">{formatDayName(day)}</div>
                    <div className="text-sm font-bold">{new Date(`${day}T12:00:00`).getDate()}</div>
                    <div className="text-[10px] opacity-70">
                      {count} task{count === 1 ? "" : "s"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              {visibleTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-slate-400">Nothing planned this week</div>
              ) : (
                visibleTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onDelete={deleteTask} onUpdateReading={updateReadingProgress} />
                ))
              )}
            </div>
          </section>
        )}

        <section className="mb-4 rounded-xl bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-slate-600">Filter & Sort</h2>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded border bg-white p-1 text-sm">
              <option>Due date</option>
              <option>Class</option>
              <option>Done first</option>
              <option>Not done first</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("All")}
              className={`${filter === "All" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"} rounded-full px-2.5 py-1 text-xs font-medium`}
            >
              All
            </button>

            {data.classes.map((item) => (
              <ClassPill key={item} name={item} active={filter === item} onClick={() => setFilter(item)} />
            ))}
          </div>
        </section>

        <details className="mb-4 rounded-xl bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-medium text-slate-600">
            <span>Add Class</span>
            <span className="text-xs text-slate-400">⌄</span>
          </summary>

          <div className="space-y-3 px-4 pb-4">
            <div className="flex gap-2">
              <input
                value={newClass}
                onChange={(event) => setNewClass(event.target.value)}
                placeholder="New class"
                className="min-w-0 flex-1 rounded border p-2"
              />

              <button type="button" onClick={addClass} className="rounded bg-slate-700 px-4 py-2 text-white">
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {data.classes.map((item) => {
                const color = getClassColor(item);

                return (
                  <div
                    key={item}
                    className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${color.bg} ${color.text} ${color.border}`}
                  >
                    <span>{item}</span>

                    <button
                      type="button"
                      onClick={() => deleteClass(item)}
                      className="text-[10px] opacity-50 transition hover:opacity-100 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </details>

        <footer className="pb-6 text-center">
          <button type="button" onClick={() => setShowTests(!showTests)} className="text-xs text-slate-400 underline">
            {showTests ? "Hide tests" : "Show tests"}
          </button>

          {showTests && (
            <div className="mt-2 rounded-xl bg-white p-3 text-left text-xs shadow-sm">
              <div className={`mb-2 font-semibold ${allTestsPassed ? "text-green-700" : "text-red-700"}`}>
                {allTestsPassed ? "All tests passed" : "Some tests failed"}
              </div>

              {tests.map((test) => (
                <div key={test.name} className="flex justify-between py-1">
                  <span>{test.name}</span>
                  <span className={test.pass ? "text-green-700" : "text-red-700"}>{test.pass ? "PASS" : "FAIL"}</span>
                </div>
              ))}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
