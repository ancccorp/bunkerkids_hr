"use client";

import { useState } from "react";
import { requestLeave } from "@/app/actions";

type Unit = "day" | "am" | "pm" | "hours";

export function LeaveRequestForm({
  types,
  defaultTypeId,
  today,
  approverName,
}: {
  types: { id: number; name: string; icon: string }[];
  defaultTypeId?: number;
  today: string;
  approverName: string | null;
}) {
  const [unit, setUnit] = useState<Unit>("day");
  const units: [Unit, string][] = [
    ["day", "종일"],
    ["am", "오전 반차"],
    ["pm", "오후 반차"],
    ["hours", "시간 단위"],
  ];
  return (
    <form action={requestLeave} className="space-y-3">
      <div>
        <label className="label">휴가 종류</label>
        <select name="leave_type_id" className="input" defaultValue={defaultTypeId}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">사용 단위</label>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1">
          {units.map(([u, label]) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`rounded-md py-1.5 text-xs font-medium ${unit === u ? "bg-white shadow-sm" : "text-gray-500"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="unit" value={unit} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{unit === "day" ? "시작일" : "날짜"}</label>
          <input type="date" name="start_date" className="input" defaultValue={today} required />
        </div>
        {unit === "day" && (
          <div>
            <label className="label">종료일</label>
            <input type="date" name="end_date" className="input" defaultValue={today} />
          </div>
        )}
      </div>
      {unit === "hours" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">시작 시간</label>
            <input type="time" name="start_time" className="input" defaultValue="10:00" step={1800} required />
          </div>
          <div>
            <label className="label">종료 시간</label>
            <input type="time" name="end_time" className="input" defaultValue="12:00" step={1800} required />
          </div>
        </div>
      )}
      {(unit === "am" || unit === "pm") && (
        <p className="text-xs text-gray-500">{unit === "am" ? "오전 10:00 – 오후 2:00" : "오후 3:00 – 오후 7:00"} (4시간)</p>
      )}
      <div>
        <label className="label">사유 (선택)</label>
        <textarea name="reason" className="input" rows={2} />
      </div>
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        결재자: <b>{approverName ?? "없음 (자동 승인)"}</b>
      </p>
      <button className="btn-primary w-full">신청하기</button>
    </form>
  );
}
