import { formatNumberForSpice } from "./valueFormatters"
import type { SimulationSwitchLike } from "../circuit-json-to-spice/types"

export function buildSimulationSwitchControlValue(
  simulationSwitch: SimulationSwitchLike | undefined,
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
