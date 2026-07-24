import type { SimulationVoltageSource } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { VoltageSourceCommand } from "lib/spice-commands"
import type { SourcePortOrNetIdToSpiceNodeNameMap } from "lib/spice-node-map"
import { formatNumberForSpice, formatSecondsForSpice } from "./helpers"

export const processSimulationVoltageSources = ({
  netlist,
  simulationVoltageSources,
  nodeMap,
}: {
  netlist: SpiceNetlist
  simulationVoltageSources: SimulationVoltageSource[]
  nodeMap: SourcePortOrNetIdToSpiceNodeNameMap
}) => {
  for (const simulationVoltageSource of simulationVoltageSources) {
    if (simulationVoltageSource.type !== "simulation_voltage_source") continue

    if (simulationVoltageSource.is_dc_source === false) {
      // AC Source
      const positiveSourceId =
        simulationVoltageSource.terminal1_source_port_id ??
        simulationVoltageSource.terminal1_source_net_id
      const negativeSourceId =
        simulationVoltageSource.terminal2_source_port_id ??
        simulationVoltageSource.terminal2_source_net_id
      if (positiveSourceId && negativeSourceId) {
        const positiveNode = nodeMap.get(positiveSourceId) || "0"
        const negativeNode = nodeMap.get(negativeSourceId) || "0"

        let sourceExpression = ""
        if (simulationVoltageSource.wave_shape === "sinewave") {
          const voltageOffset = 0
          const peakVoltage =
            simulationVoltageSource.voltage ??
            (simulationVoltageSource.peak_to_peak_voltage ?? 0) / 2
          const frequencyHz = simulationVoltageSource.frequency ?? 0
          const delaySeconds = 0
          const dampingFactor = 0
          const phaseDegrees = simulationVoltageSource.phase ?? 0
          if (frequencyHz > 0) {
            sourceExpression = `SIN(${voltageOffset} ${peakVoltage} ${frequencyHz} ${delaySeconds} ${dampingFactor} ${phaseDegrees})`
          } else {
            sourceExpression = `DC ${simulationVoltageSource.voltage ?? 0}`
          }
        } else if (simulationVoltageSource.wave_shape === "square") {
          const initialVoltage = 0
          const pulsedVoltage =
            simulationVoltageSource.voltage ??
            simulationVoltageSource.peak_to_peak_voltage ??
            0
          const frequencyHz = simulationVoltageSource.frequency ?? 0
          const periodFromFrequencySeconds =
            frequencyHz === 0 ? Infinity : 1 / frequencyHz
          const periodSeconds =
            simulationVoltageSource.period === undefined
              ? periodFromFrequencySeconds
              : simulationVoltageSource.period / 1000
          const dutyCycle = simulationVoltageSource.duty_cycle ?? 0.5
          const pulseWidthSeconds = periodSeconds * dutyCycle
          const delaySeconds =
            simulationVoltageSource.pulse_delay !== undefined
              ? simulationVoltageSource.pulse_delay / 1000
              : 0
          const riseTime =
            simulationVoltageSource.rise_time !== undefined
              ? formatSecondsForSpice(simulationVoltageSource.rise_time / 1000)
              : "1n"
          const fallTime =
            simulationVoltageSource.fall_time !== undefined
              ? formatSecondsForSpice(simulationVoltageSource.fall_time / 1000)
              : "1n"
          const pulseWidthText =
            simulationVoltageSource.pulse_width === undefined
              ? formatSecondsForSpice(pulseWidthSeconds)
              : formatSecondsForSpice(
                  simulationVoltageSource.pulse_width / 1000,
                )
          const periodText = formatSecondsForSpice(periodSeconds)
          sourceExpression = `PULSE(${initialVoltage} ${pulsedVoltage} ${formatSecondsForSpice(delaySeconds)} ${riseTime} ${fallTime} ${pulseWidthText} ${periodText})`
        } else if (simulationVoltageSource.voltage !== undefined) {
          sourceExpression = `DC ${simulationVoltageSource.voltage}`
        }

        if (
          sourceExpression ||
          simulationVoltageSource.ac_magnitude !== undefined
        ) {
          const voltageSourceCmd = new VoltageSourceCommand({
            name: simulationVoltageSource.simulation_voltage_source_id,
            positiveNode,
            negativeNode,
            value: sourceExpression,
            acMagnitude:
              simulationVoltageSource.ac_magnitude === undefined
                ? undefined
                : formatNumberForSpice(simulationVoltageSource.ac_magnitude),
            acPhase:
              simulationVoltageSource.ac_phase === undefined
                ? undefined
                : formatNumberForSpice(simulationVoltageSource.ac_phase),
          })

          const spiceComponent = new SpiceComponent(
            simulationVoltageSource.simulation_voltage_source_id,
            voltageSourceCmd,
            [positiveNode, negativeNode],
          )
          netlist.addComponent(spiceComponent)
        }
      }
    } else {
      // DC Source (is_dc_source is true or undefined)
      // Fall back to terminal1/terminal2 (the AC path already uses these) so a
      // DC source that only has terminal port ids isn't silently dropped.
      const legacyPositiveSourceId =
        "terminal1_source_port_id" in simulationVoltageSource &&
        typeof simulationVoltageSource.terminal1_source_port_id === "string"
          ? simulationVoltageSource.terminal1_source_port_id
          : undefined
      const legacyNegativeSourceId =
        "terminal2_source_port_id" in simulationVoltageSource &&
        typeof simulationVoltageSource.terminal2_source_port_id === "string"
          ? simulationVoltageSource.terminal2_source_port_id
          : undefined
      const positiveSourceId =
        simulationVoltageSource.positive_source_port_id ??
        simulationVoltageSource.positive_source_net_id ??
        legacyPositiveSourceId
      const negativeSourceId =
        simulationVoltageSource.negative_source_port_id ??
        simulationVoltageSource.negative_source_net_id ??
        legacyNegativeSourceId

      if (positiveSourceId && negativeSourceId) {
        const positiveNode = nodeMap.get(positiveSourceId) || "0"
        const negativeNode = nodeMap.get(negativeSourceId) || "0"

        const voltageSourceCmd = new VoltageSourceCommand({
          name: simulationVoltageSource.simulation_voltage_source_id,
          positiveNode,
          negativeNode,
          value: `DC ${simulationVoltageSource.voltage}`,
          acMagnitude:
            simulationVoltageSource.ac_magnitude === undefined
              ? undefined
              : formatNumberForSpice(simulationVoltageSource.ac_magnitude),
          acPhase:
            simulationVoltageSource.ac_phase === undefined
              ? undefined
              : formatNumberForSpice(simulationVoltageSource.ac_phase),
        })

        const spiceComponent = new SpiceComponent(
          simulationVoltageSource.simulation_voltage_source_id,
          voltageSourceCmd,
          [positiveNode, negativeNode],
        )
        netlist.addComponent(spiceComponent)
      }
    }
  }
}
