import type { DivisionId, Pit, PitStatus } from "./types";

const VALID_DIVISIONS: DivisionId[] = [
  "archimedes",
  "curie",
  "daly",
  "galileo",
  "hopper",
  "johnson",
  "milstein",
  "newton",
];

const VALID_STATUSES: PitStatus[] = ["TEAM", "COL", "INSP", "EMT", "AISLE"];

export interface CsvParseResult {
  pits: Pit[];
  errors: string[];
}

/**
 * Parse a CSV string with header row containing:
 *   id, team, status, division, row, col
 * - team may be empty/blank for non-team statuses
 * - status defaults to TEAM if team is set, INSP otherwise
 * - row/col default to 0 if missing
 */
export function parseCsv(input: string): CsvParseResult {
  const errors: string[] = [];
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { pits: [], errors: ["CSV is empty"] };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (name: string) => header.indexOf(name);
  const iId = idx("id");
  const iTeam = idx("team");
  const iStatus = idx("status");
  const iDivision = idx("division");
  const iRow = idx("row");
  const iCol = idx("col");

  if (iId < 0 || iDivision < 0) {
    return {
      pits: [],
      errors: ["CSV header must include at least: id, division (and ideally team, status, row, col)"],
    };
  }

  const pits: Pit[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li]);
    const id = cells[iId]?.trim();
    const division = cells[iDivision]?.trim().toLowerCase() as DivisionId;
    if (!id || !division) {
      errors.push(`Line ${li + 1}: missing id or division`);
      continue;
    }
    if (!VALID_DIVISIONS.includes(division)) {
      errors.push(`Line ${li + 1}: invalid division "${division}"`);
      continue;
    }
    const teamRaw = iTeam >= 0 ? cells[iTeam]?.trim() : "";
    const team = teamRaw ? Number(teamRaw) : null;
    if (teamRaw && Number.isNaN(team)) {
      errors.push(`Line ${li + 1}: team "${teamRaw}" is not a number`);
      continue;
    }
    const statusRaw = iStatus >= 0 ? cells[iStatus]?.trim().toUpperCase() : "";
    const status: PitStatus =
      (VALID_STATUSES as string[]).includes(statusRaw)
        ? (statusRaw as PitStatus)
        : team !== null
        ? "TEAM"
        : "INSP";
    const row = iRow >= 0 ? Number(cells[iRow] ?? "0") || 0 : 0;
    const col = iCol >= 0 ? Number(cells[iCol] ?? "0") || 0 : 0;

    pits.push({ id, team, status, division, row, col });
  }

  return { pits, errors };
}

export function toCsv(pits: Pit[]): string {
  const header = "id,team,status,division,row,col";
  const rows = pits.map((p) =>
    [p.id, p.team ?? "", p.status, p.division, p.row, p.col].join(",")
  );
  return [header, ...rows].join("\n");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}
