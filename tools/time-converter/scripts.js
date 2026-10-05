const I32_MIN = -2147483648;
const I32_MAX = 2147483647;
const FALLBACK_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const els = {};
const state = {
  instantMs: Date.now(),
  bits: "64",
  syncing: false,
};

function listTimeZones() {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone").slice()
      : FALLBACK_ZONES.slice();
  if (!zones.includes("UTC")) {
    zones.unshift("UTC");
  }
  return zones;
}

function getLocalTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function getTzParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }
  return parts;
}

function tzOffsetMs(utcMs, timeZone) {
  const parts = getTzParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - utcMs;
}

function zonedWallToUtcMs(year, month, day, hour, minute, second, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = tzOffsetMs(utcGuess, timeZone);
  let utc = utcGuess - firstOffset;
  const secondOffset = tzOffsetMs(utc, timeZone);
  if (secondOffset !== firstOffset) {
    utc = utcGuess - secondOffset;
  }
  return utc;
}

function readWall(dateInput, timeInput) {
  if (!dateInput.value || !timeInput.value) {
    return null;
  }
  const [year, month, day] = dateInput.value.split("-").map(Number);
  const timeParts = timeInput.value.split(":").map(Number);
  const hour = timeParts[0] || 0;
  const minute = timeParts[1] || 0;
  const second = timeParts[2] || 0;
  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) {
    return null;
  }
  return { year, month, day, hour, minute, second };
}

function writeWall(dateInput, timeInput, parts) {
  dateInput.value = `${parts.year}-${parts.month}-${parts.day}`;
  timeInput.value = `${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatMeta(parts, timeZone) {
  const offset = (parts.timeZoneName || "").replace("GMT", "UTC");
  const label = timeZone.replace(/_/g, " ");
  return `${parts.weekday} · ${parts.hour}:${parts.minute}:${parts.second} · ${label} · ${offset}`;
}

function formatLong(ms, timeZone) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  const parts = getTzParts(date, timeZone);
  const offset = (parts.timeZoneName || "").replace("GMT", "UTC");
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${offset}`;
}

function secondsFromMs(ms) {
  return Math.trunc(ms / 1000);
}

function inI32Range(seconds) {
  return seconds >= I32_MIN && seconds <= I32_MAX;
}

function parseStamp(raw) {
  const cleaned = String(raw).trim().replace(/[,_\s]/g, "");
  if (!cleaned || !/^[+-]?\d+(\.\d+)?$/.test(cleaned)) {
    return { error: "Enter a numeric Unix timestamp." };
  }
  const value = Math.trunc(Number(cleaned));
  if (!Number.isFinite(value)) {
    return { error: "Enter a numeric Unix timestamp." };
  }
  return { value, digits: cleaned.replace(/^[+-]/, "").split(".")[0].length };
}

function stampFromInstant(ms, bits) {
  if (Number.isNaN(ms)) {
    return { error: "That date is outside the range this converter can represent." };
  }
  if (bits === "32") {
    const seconds = secondsFromMs(ms);
    if (!inI32Range(seconds)) {
      return {
        error: "32-bit Unix time only covers 13 Dec 1901 through 19 Jan 2038 03:14:07 UTC.",
        other: String(ms),
      };
    }
    return { value: String(seconds), other: `${ms} ms` };
  }
  return { value: String(ms), other: `${secondsFromMs(ms)} s` };
}

function instantFromStamp(value, bits) {
  if (bits === "32") {
    if (!inI32Range(value)) {
      return {
        error: "That value is outside the signed 32-bit range (−2,147,483,648 to 2,147,483,647).",
        looksLikeMillis: Math.abs(value) >= 1e12,
      };
    }
    return { ms: value * 1000 };
  }
  return { ms: value };
}

function zoneGroup(id) {
  if (id === "UTC" || id === "GMT" || id.startsWith("Etc/")) {
    return "Universal";
  }
  return id.split("/")[0];
}

function zoneSearchText(id, sampleMs) {
  const parts = getTzParts(new Date(sampleMs), id);
  const readable = id.replace(/_/g, " ");
  return `${id} ${readable} ${parts.timeZoneName || ""}`.toLowerCase();
}

function populateSelect(select, zones, selected, sampleMs) {
  const current = selected || select.value;
  select.replaceChildren();
  const groups = new Map();
  for (const id of zones) {
    const name = zoneGroup(id);
    if (!groups.has(name)) {
      groups.set(name, []);
    }
    groups.get(name).push(id);
  }

  const preferred = ["UTC", getLocalTimeZone()].filter(
    (id, index, list) => zones.includes(id) && list.indexOf(id) === index
  );
  if (preferred.length) {
    const top = document.createElement("optgroup");
    top.label = "Suggested";
    preferred.forEach((id) => top.append(makeOption(id, sampleMs)));
    select.append(top);
  }

  for (const [label, ids] of groups) {
    const group = document.createElement("optgroup");
    group.label = label;
    ids.forEach((id) => {
      if (preferred.includes(id) && label === "Universal" && id === "UTC") {
        return;
      }
      group.append(makeOption(id, sampleMs));
    });
    if (group.children.length) {
      select.append(group);
    }
  }

  if (current && zones.includes(current)) {
    select.value = current;
  }
}

function makeOption(id, sampleMs) {
  const option = document.createElement("option");
  const parts = getTzParts(new Date(sampleMs), id);
  const offset = (parts.timeZoneName || "").replace("GMT", "UTC");
  option.value = id;
  option.textContent = `${id.replace(/_/g, " ")} · ${offset}`;
  option.dataset.search = zoneSearchText(id, sampleMs);
  return option;
}

function filterSelect(select, query) {
  const needle = query.trim().toLowerCase();
  const options = [...select.querySelectorAll("option")];
  options.forEach((option) => {
    option.hidden = Boolean(needle) && !(option.dataset.search || option.value.toLowerCase()).includes(needle);
  });
  select.querySelectorAll("optgroup").forEach((group) => {
    group.hidden = [...group.children].every((child) => child.hidden);
  });
}

function updateSelectedOffset(select, timeZone, ms) {
  const option = select.selectedOptions[0];
  if (!option || option.value !== timeZone) {
    return;
  }
  const parts = getTzParts(new Date(ms), timeZone);
  const offset = (parts.timeZoneName || "").replace("GMT", "UTC");
  option.textContent = `${timeZone.replace(/_/g, " ")} · ${offset}`;
}

function setZoneResult(key, timeZone, ms) {
  const row = document.querySelector(`[data-result-row="${key}"]`);
  const labelEl = key === "from" ? els.resultFromLabel : els.resultToLabel;
  const valueEl = key === "from" ? els.resultFrom : els.resultTo;
  if (timeZone === "UTC") {
    row.hidden = true;
    return;
  }
  row.hidden = false;
  labelEl.textContent = timeZone.replace(/_/g, " ");
  valueEl.textContent = formatLong(ms, timeZone);
}

function setStatus(message, isError = false) {
  els.status.hidden = !message;
  els.status.textContent = message || "";
  els.status.classList.toggle("is-error", Boolean(message) && isError);
}

function setBits(bits) {
  state.bits = bits;
  els.bitButtons.forEach((button) => {
    button.setAttribute("aria-checked", button.dataset.bits === bits ? "true" : "false");
  });
  els.bitCaption.textContent =
    bits === "32"
      ? "32-bit seconds since 1 Jan 1970 UTC. Signed 32-bit time ends on 19 Jan 2038."
      : "64-bit milliseconds since 1 Jan 1970 UTC (Java / JavaScript).";
}

function applyInstant(ms, options = {}) {
  const { fillManual = false, fillInput = false, status = "", error = false } = options;
  if (!Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime())) {
    setStatus("That date is outside the range this converter can represent.", true);
    return;
  }

  state.instantMs = ms;
  state.syncing = true;

  const fromTz = els.fromTz.value;
  const toTz = els.toTz.value;
  const fromParts = getTzParts(new Date(ms), fromTz);
  const toParts = getTzParts(new Date(ms), toTz);

  writeWall(els.fromDate, els.fromTime, fromParts);
  writeWall(els.toDate, els.toTime, toParts);
  els.fromMeta.textContent = formatMeta(fromParts, fromTz);
  els.toMeta.textContent = formatMeta(toParts, toTz);
  updateSelectedOffset(els.fromTz, fromTz, ms);
  updateSelectedOffset(els.toTz, toTz, ms);
  updateSelectedOffset(els.manualTz, els.manualTz.value, ms);

  if (fillManual) {
    writeWall(els.manualDate, els.manualTime, getTzParts(new Date(ms), els.manualTz.value));
  }

  const stamp = stampFromInstant(ms, state.bits);
  if (stamp.error) {
    els.stampOutput.textContent = "Out of range";
    els.resultOther.textContent = stamp.other || "—";
    if (fillInput) {
      els.stampInput.value = "";
    }
    setStatus(stamp.error, true);
  } else {
    els.stampOutput.textContent = stamp.value;
    els.resultOther.textContent = stamp.other;
    if (fillInput) {
      els.stampInput.value = stamp.value;
    }
    setStatus(status, error);
  }

  els.resultUtc.textContent = formatLong(ms, "UTC");
  setZoneResult("from", fromTz, ms);
  setZoneResult("to", toTz, ms);
  els.resultIso.textContent = new Date(ms).toISOString();

  state.syncing = false;
}

function instantFromPanel(prefix) {
  const dateInput = prefix === "from" ? els.fromDate : els.toDate;
  const timeInput = prefix === "from" ? els.fromTime : els.toTime;
  const timeZone = prefix === "from" ? els.fromTz.value : els.toTz.value;
  const wall = readWall(dateInput, timeInput);
  if (!wall) {
    return null;
  }
  return zonedWallToUtcMs(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second, timeZone);
}

function convertPastedStamp() {
  const parsed = parseStamp(els.stampInput.value);
  if (parsed.error) {
    setStatus(parsed.error, true);
    return;
  }

  const converted = instantFromStamp(parsed.value, state.bits);
  if (converted.error) {
    const hint = converted.looksLikeMillis
      ? " This looks like a 64-bit millisecond stamp. Switch to 64-bit and convert again."
      : "";
    setStatus(converted.error + hint, true);
    return;
  }

  applyInstant(converted.ms, {
    fillManual: true,
    fillInput: true,
    status: `Converted as ${state.bits}-bit Unix time.`,
  });
}

function generateFromManual() {
  const wall = readWall(els.manualDate, els.manualTime);
  if (!wall) {
    setStatus("Choose a date, time, and timezone to generate a stamp.", true);
    return;
  }
  const ms = zonedWallToUtcMs(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    els.manualTz.value
  );
  applyInstant(ms, {
    fillInput: true,
    status: `Generated a ${state.bits}-bit Unix stamp.`,
  });
}

async function copyStamp() {
  const value = els.stampOutput.textContent.trim();
  if (!value || value === "—" || value === "Out of range") {
    setStatus("There is no stamp to copy.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    const original = els.copyStamp.textContent;
    els.copyStamp.textContent = "Copied";
    setStatus("Stamp copied to the clipboard.");
    window.setTimeout(() => {
      els.copyStamp.textContent = original;
    }, 1600);
  } catch {
    setStatus("Clipboard access was blocked. Select the stamp and copy it manually.", true);
  }
}

function bindZoneFilter(filter, select) {
  filter.addEventListener("input", () => filterSelect(select, filter.value));
  filter.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const first = [...select.options].find((option) => !option.hidden);
      if (first) {
        select.value = first.value;
        select.dispatchEvent(new Event("change"));
      }
    }
  });
}

function cacheElements() {
  els.status = document.getElementById("status");
  els.fromTz = document.getElementById("from-tz");
  els.toTz = document.getElementById("to-tz");
  els.manualTz = document.getElementById("manual-tz");
  els.fromTzFilter = document.getElementById("from-tz-filter");
  els.toTzFilter = document.getElementById("to-tz-filter");
  els.manualTzFilter = document.getElementById("manual-tz-filter");
  els.fromDate = document.getElementById("from-date");
  els.fromTime = document.getElementById("from-time");
  els.toDate = document.getElementById("to-date");
  els.toTime = document.getElementById("to-time");
  els.fromMeta = document.getElementById("from-meta");
  els.toMeta = document.getElementById("to-meta");
  els.swapZones = document.getElementById("swap-zones");
  els.bitButtons = [...document.querySelectorAll(".bit-toggle [data-bits]")];
  els.bitCaption = document.getElementById("bit-caption");
  els.stampInput = document.getElementById("stamp-input");
  els.convertStamp = document.getElementById("convert-stamp");
  els.currentStamp = document.getElementById("current-stamp");
  els.manualDate = document.getElementById("manual-date");
  els.manualTime = document.getElementById("manual-time");
  els.generateStamp = document.getElementById("generate-stamp");
  els.stampOutput = document.getElementById("stamp-output");
  els.copyStamp = document.getElementById("copy-stamp");
  els.resultUtc = document.getElementById("result-utc");
  els.resultFrom = document.getElementById("result-from");
  els.resultTo = document.getElementById("result-to");
  els.resultFromLabel = document.getElementById("result-from-label");
  els.resultToLabel = document.getElementById("result-to-label");
  els.resultIso = document.getElementById("result-iso");
  els.resultOther = document.getElementById("result-other");
}

function bindEvents() {
  const onFromChange = () => {
    if (state.syncing) {
      return;
    }
    const ms = instantFromPanel("from");
    if (ms !== null) {
      applyInstant(ms);
    }
  };
  const onToChange = () => {
    if (state.syncing) {
      return;
    }
    const ms = instantFromPanel("to");
    if (ms !== null) {
      applyInstant(ms);
    }
  };

  ["change", "input"].forEach((type) => {
    els.fromDate.addEventListener(type, onFromChange);
    els.fromTime.addEventListener(type, onFromChange);
    els.fromTz.addEventListener(type, onFromChange);
    els.toDate.addEventListener(type, onToChange);
    els.toTime.addEventListener(type, onToChange);
    els.toTz.addEventListener(type, onToChange);
  });

  els.swapZones.addEventListener("click", () => {
    const from = els.fromTz.value;
    els.fromTz.value = els.toTz.value;
    els.toTz.value = from;
    applyInstant(state.instantMs);
  });

  els.bitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setBits(button.dataset.bits);
      applyInstant(state.instantMs, { fillInput: els.stampInput.value.trim() !== "" });
    });
  });

  els.convertStamp.addEventListener("click", convertPastedStamp);
  els.stampInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      convertPastedStamp();
    }
  });

  els.currentStamp.addEventListener("click", () => {
    applyInstant(Date.now(), {
      fillManual: true,
      fillInput: true,
      status: `Captured the current ${state.bits}-bit Unix stamp.`,
    });
  });

  els.generateStamp.addEventListener("click", generateFromManual);
  els.copyStamp.addEventListener("click", copyStamp);
  els.manualTz.addEventListener("change", () => {
    if (state.syncing) {
      return;
    }
    writeWall(els.manualDate, els.manualTime, getTzParts(new Date(state.instantMs), els.manualTz.value));
  });

  bindZoneFilter(els.fromTzFilter, els.fromTz);
  bindZoneFilter(els.toTzFilter, els.toTz);
  bindZoneFilter(els.manualTzFilter, els.manualTz);
}

function init() {
  cacheElements();
  const zones = listTimeZones();
  const local = zones.includes(getLocalTimeZone()) ? getLocalTimeZone() : "UTC";
  const now = Date.now();

  populateSelect(els.fromTz, zones, local, now);
  populateSelect(els.toTz, zones, zones.includes("UTC") ? "UTC" : zones[0], now);
  populateSelect(els.manualTz, zones, local, now);
  els.fromTz.value = local;
  els.toTz.value = zones.includes("UTC") ? "UTC" : zones[0];
  els.manualTz.value = local;

  setBits("64");
  bindEvents();
  applyInstant(now, { fillManual: true });
}

document.addEventListener("DOMContentLoaded", init);
