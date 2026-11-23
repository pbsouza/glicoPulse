import React, { useMemo, useState } from 'react';
import { GlucoseEntry, PatientSettings, ScheduleSlot } from '../types/glucose';
import {
  classifyReading,
  formatDateBR,
  formatGlucoseValue,
  formatShortDateBR,
} from '../utils/glucoseUtils';

interface GlucoseChartProps {
  entries: GlucoseEntry[];
  schedules: ScheduleSlot[];
  settings: PatientSettings;
}

export const GlucoseChart: React.FC<GlucoseChartProps> = ({
  entries,
  schedules,
  settings,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const ordered = useMemo(() => {
    return [...entries].sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
    );
  }, [entries]);

  const slotMap = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  if (ordered.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <div>
          <p className="font-display text-sm font-semibold text-slate-700">
            Sem medições neste período
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Registre uma leitura de glicemia para visualizar a curva de tendência e a faixa alvo.
          </p>
        </div>
      </div>
    );
  }

  const width = 820;
  const height = 280;
  const padLeft = 52;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const rawValues = ordered.map((e) => e.value);
  const maxVal = Math.max(220, Math.ceil((Math.max(...rawValues) + 20) / 20) * 20);
  const minVal = Math.min(40, Math.floor((Math.min(...rawValues) - 15) / 20) * 20);

  const yFor = (val: number) =>
    padTop + plotH - ((val - minVal) / Math.max(1, maxVal - minVal)) * plotH;

  const xFor = (idx: number) =>
    ordered.length === 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (ordered.length - 1)) * plotW;

  const yHyper = yFor(settings.hyperThreshold);
  const yHypo = yFor(settings.hypoThreshold);

  const pathD = ordered
    .map((entry, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(idx).toFixed(1)} ${yFor(entry.value).toFixed(1)}`)
    .join(' ');

  const yTicks = Array.from(
    new Set([minVal, settings.hypoThreshold, 130, settings.hyperThreshold, maxVal])
  )
    .filter((v) => v >= minVal && v <= maxVal)
    .sort((a, b) => a - b);

  const labelCount = Math.min(6, ordered.length);
  const xLabels = Array.from({ length: labelCount }, (_, i) => {
    const idx = labelCount === 1 ? 0 : Math.round((i / (labelCount - 1)) * (ordered.length - 1));
    return { idx, label: formatShortDateBR(ordered[idx].date), x: xFor(idx) };
  });

  const activeEntry = hoveredIndex !== null ? ordered[hoveredIndex] : null;
  const activeStatus = activeEntry
    ? classifyReading(activeEntry.value, slotMap.get(activeEntry.slotId), settings)
    : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-teal-600/20 border border-teal-600/40" />
            Faixa alvo ({formatGlucoseValue(settings.hypoThreshold, settings.unit)}–
            {formatGlucoseValue(settings.hyperThreshold, settings.unit)} {settings.unit})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-700" />
            Na meta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-700" />
            Elevada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-700" />
            Baixa
          </span>
        </div>

        {activeEntry && activeStatus ? (
          <div className="font-mono tabular-nums text-xs text-slate-800">
            <span className="font-semibold">
              {formatGlucoseValue(activeEntry.value, settings.unit)} {settings.unit}
            </span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span>
              {formatDateBR(activeEntry.date)} {activeEntry.time}
            </span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className={activeStatus.textClass}>{activeStatus.label}</span>
          </div>
        ) : (
          <span className="text-slate-400">Passe ou toque em um ponto para ver detalhes</span>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Gráfico de tendência glicêmica"
        >
          {/* Target Range Band */}
          <rect
            x={padLeft}
            y={yHyper}
            width={plotW}
            height={Math.max(0, yHypo - yHyper)}
            fill="#0D9488"
            fillOpacity={0.07}
          />

          {/* Horizontal Grid & Threshold Lines */}
          {yTicks.map((tick) => {
            const y = yFor(tick);
            const isHypo = tick === settings.hypoThreshold;
            const isHyper = tick === settings.hyperThreshold;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotW}
                  y2={y}
                  stroke={isHypo ? '#FDA4AF' : isHyper ? '#FCD34D' : '#E2E8F0'}
                  strokeWidth={isHypo || isHyper ? 1.5 : 1}
                  strokeDasharray={isHypo || isHyper ? '5 4' : undefined}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 font-mono text-[11px] tabular-nums"
                >
                  {formatGlucoseValue(tick, settings.unit)}
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {xLabels.map((item) => (
            <text
              key={item.idx}
              x={item.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[11px] tabular-nums"
            >
              {item.label}
            </text>
          ))}

          {/* Trend Line */}
          {ordered.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="#0F766E"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Hovered Vertical Guide */}
          {hoveredIndex !== null && (
            <line
              x1={xFor(hoveredIndex)}
              y1={padTop}
              x2={xFor(hoveredIndex)}
              y2={padTop + plotH}
              stroke="#94A3B8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Data Points */}
          {ordered.map((entry, idx) => {
            const cx = xFor(idx);
            const cy = yFor(entry.value);
            const info = classifyReading(entry.value, slotMap.get(entry.slotId), settings);
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={entry.id}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(idx)}
                className="cursor-pointer"
              >
                {/* Invisible wider hit target */}
                <circle cx={cx} cy={cy} r={14} fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6.5 : 4.2}
                  fill={info.hexColor}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
