import type { SimulationCurrentSource } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { CurrentSourceCommand } from "lib/spice-commands"
import type { SourcePortOrNetIdToSpiceNodeNameMap } from "lib/spice-node-map"
import { formatNumberForSpice } from "./helpers"

export const processSimulationCurrentSources = ({
  netlist,
  simulationCurrentSources,
  nodeMap,
}: {
  netlist: SpiceNetlist
  simulationCurrentSources: SimulationCurrentSource[]
  nodeMap: SourcePortOrNetIdToSpiceNodeNameMap
}) => {
  for (const simulationCurrentSource of simulationCurrentSources) {
    if (simulationCurrentSource.type !== "simulation_current_source") continue

    if (simulationCurrentSource.is_dc_source === false) {
      // AC/PULSE Source
      const positiveSourceId =
        simulationCurrentSource.terminal1_source_port_id ??
        simulationCurrentSource.terminal1_source_net_id
      const negativeSourceId =
        simulationCurrentSource.terminal2_source_port_id ??
        simulationCurrentSource.terminal2_source_net_id

      if (positiveSourceId && negativeSourceId) {
        const positiveNode = nodeMap.get(positiveSourceId) || "0"
        const negativeNode = nodeMap.get(negativeSourceId) || "0"

        let sourceExpression = ""
        if (simulationCurrentSource.wave_shape === "sinewave") {
          const currentOffset = 0
          const peakCurrent =
            (simulationCurrentSource.peak_to_peak_current ?? 0) / 2
          const frequencyHz = simulationCurrentSource.frequency ?? 0
          const delaySeconds = 0
          const dampingFactor = 0
          const phaseDegrees = simulationCurrentSource.phase ?? 0
          if (frequencyHz > 0) {
            sourceExpression = `SIN(${currentOffset} ${peakCurrent} ${frequencyHz} ${delaySeconds} ${dampingFactor} ${phaseDegrees})`
          } else {
            sourceExpression = `DC ${peakCurrent}`
          }
        } else if (simulationCurrentSource.wave_shape === "square") {
          const initialCurrent = 0
          const pulsedCurrent =
            simulationCurrentSource.peak_to_peak_current ?? 0
          const frequencyHz = simulationCurrentSource.frequency ?? 0
          const periodSeconds = frequencyHz === 0 ? Infinity : 1 / frequencyHz
          const dutyCycle = simulationCurrentSource.duty_cycle ?? 0.5
          const pulseWidthSeconds = periodSeconds * dutyCycle
          const delaySeconds = 0
          const riseTime = "1n"
          const fallTime = "1n"
          sourceExpression = `PULSE(${initialCurrent} ${pulsedCurrent} ${delaySeconds} ${riseTime} ${fallTime} ${pulseWidthSeconds} ${periodSeconds})`
        }

        if (
          sourceExpression ||
          simulationCurrentSource.ac_magnitude !== undefined
        ) {
          const currentSourceCmd = new CurrentSourceCommand({
            name: simulationCurrentSource.simulation_current_source_id,
            positiveNode,
            negativeNode,
            value: sourceExpression,
            acMagnitude:
              simulationCurrentSource.ac_magnitude === undefined
                ? undefined
                : formatNumberForSpice(simulationCurrentSource.ac_magnitude),
            acPhase:
              simulationCurrentSource.ac_phase === undefined
                ? undefined
                : formatNumberForSpice(simulationCurrentSource.ac_phase),
          })

          const spiceComponent = new SpiceComponent(
            simulationCurrentSource.simulation_current_source_id,
            currentSourceCmd,
            [positiveNode, negativeNode],
          )
          netlist.addComponent(spiceComponent)
        }
      }
    } else {
      // DC Source
      const legacyPositiveSourceId =
        "terminal1_source_port_id" in simulationCurrentSource &&
        typeof simulationCurrentSource.terminal1_source_port_id === "string"
          ? simulationCurrentSource.terminal1_source_port_id
          : undefined
      const legacyNegativeSourceId =
        "terminal2_source_port_id" in simulationCurrentSource &&
        typeof simulationCurrentSource.terminal2_source_port_id === "string"
          ? simulationCurrentSource.terminal2_source_port_id
          : undefined
      const positiveSourceId =
        simulationCurrentSource.positive_source_port_id ??
        simulationCurrentSource.positive_source_net_id ??
        legacyPositiveSourceId
      const negativeSourceId =
        simulationCurrentSource.negative_source_port_id ??
        simulationCurrentSource.negative_source_net_id ??
        legacyNegativeSourceId

      if (positiveSourceId && negativeSourceId) {
        const positiveNode = nodeMap.get(positiveSourceId) || "0"
        const negativeNode = nodeMap.get(negativeSourceId) || "0"

        const currentSourceCmd = new CurrentSourceCommand({
          name: simulationCurrentSource.simulation_current_source_id,
          positiveNode,
          negativeNode,
          value: `DC ${simulationCurrentSource.current}`,
          acMagnitude:
            simulationCurrentSource.ac_magnitude === undefined
              ? undefined
              : formatNumberForSpice(simulationCurrentSource.ac_magnitude),
          acPhase:
            simulationCurrentSource.ac_phase === undefined
              ? undefined
              : formatNumberForSpice(simulationCurrentSource.ac_phase),
        })

        const spiceComponent = new SpiceComponent(
          simulationCurrentSource.simulation_current_source_id,
          currentSourceCmd,
          [positiveNode, negativeNode],
        )
        netlist.addComponent(spiceComponent)
      }
    }
  }
}
