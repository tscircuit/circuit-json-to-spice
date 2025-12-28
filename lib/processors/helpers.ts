import type { SimulationSwitch } from "circuit-json"

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

export function sanitizeIdentifier(value: string | undefined, prefix: string) {
  if (!value) return prefix
  const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_")
  if (!sanitized) return prefix
  if (/^[0-9]/.test(sanitized)) {
    return `${prefix}_${sanitized}`
  }
  return sanitized
}

export function buildSimulationSwitchControlValue(
  simulationSwitch: SimulationSwitch | undefined,
) {
  const highVoltage = 5
  const lowVoltage = 0
  const riseTime = "1n"
  const fallTime = "1n"

  if (!simulationSwitch) {
    return `DC ${lowVoltage}`
  }

  const startsClosed = simulationSwitch.starts_closed ?? false
  const closesAt = simulationSwitch.closes_at ?? 0
  const opensAt = simulationSwitch.opens_at
  const switchingFrequency = simulationSwitch.switching_frequency

  const [initialVoltage, pulsedVoltage] = startsClosed
    ? [highVoltage, lowVoltage]
    : [lowVoltage, highVoltage]

  if (switchingFrequency && switchingFrequency > 0) {
    const period = 1 / switchingFrequency
    const widthFromOpenClose =
      opensAt && opensAt > closesAt ? Math.min(opensAt - closesAt, period) : 0
    const pulseWidth =
      widthFromOpenClose > 0 ? widthFromOpenClose : Math.max(period / 2, 1e-9)

    return `PULSE(${formatNumberForSpice(initialVoltage)} ${formatNumberForSpice(pulsedVoltage)} ${formatNumberForSpice(closesAt)} ${riseTime} ${fallTime} ${formatNumberForSpice(pulseWidth)} ${formatNumberForSpice(period)})`
  }

  if (opensAt !== undefined && opensAt > closesAt) {
    const pulseWidth = Math.max(opensAt - closesAt, 1e-9)
    const period = closesAt + pulseWidth * 2

    return `PULSE(${formatNumberForSpice(initialVoltage)} ${formatNumberForSpice(pulsedVoltage)} ${formatNumberForSpice(closesAt)} ${riseTime} ${fallTime} ${formatNumberForSpice(pulseWidth)} ${formatNumberForSpice(period)})`
  }

  if (closesAt > 0) {
    const period = closesAt * 2
    const pulseWidth = Math.max(period / 2, 1e-9)
    return `PULSE(${formatNumberForSpice(initialVoltage)} ${formatNumberForSpice(pulsedVoltage)} ${formatNumberForSpice(closesAt)} ${riseTime} ${fallTime} ${formatNumberForSpice(pulseWidth)} ${formatNumberForSpice(period)})`
  }

  return `DC ${startsClosed ? highVoltage : lowVoltage}`
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
