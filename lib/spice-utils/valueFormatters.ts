export function formatResistance(resistance: number): string {
  if (resistance >= 1e6) return `${resistance / 1e6}MEG`
  if (resistance >= 1e3) return `${resistance / 1e3}K`
  return resistance.toString()
}

export function formatCapacitance(capacitance: number): string {
  if (capacitance >= 1e-3) return `${capacitance * 1e3}M`
  if (capacitance >= 1e-6) return `${capacitance * 1e6}U`
  if (capacitance >= 1e-9) return `${capacitance * 1e9}N`
  if (capacitance >= 1e-12) return `${capacitance * 1e12}P`
  return capacitance.toString()
}

export function formatInductance(inductance: number): string {
  if (inductance >= 1) return inductance.toString()
  if (inductance >= 1e-3) return `${inductance * 1e3}m`
  if (inductance >= 1e-6) return `${inductance * 1e6}u`
  if (inductance >= 1e-9) return `${inductance * 1e9}n`
  if (inductance >= 1e-12) return `${inductance * 1e12}p`
  return inductance.toString()
}

export function formatNumberForSpice(value: number) {
  if (!Number.isFinite(value)) return `${value}`
  if (value === 0) return "0"

  const absValue = Math.abs(value)

  if (absValue >= 1e3 || absValue <= 1e-3) {
    return Number(value.toExponential(6)).toString()
  }

  return Number(value.toPrecision(6)).toString()
}
