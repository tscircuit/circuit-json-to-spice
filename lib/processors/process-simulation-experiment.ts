import type {
  SimulationExperiment,
  SimulationVoltageProbe,
  SourceTrace,
} from "circuit-json"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { formatNumberForSpice } from "./helpers"

export const processSimulationExperiment = (
  netlist: SpiceNetlist,
  simExperiment: SimulationExperiment,
  simulationProbes: SimulationVoltageProbe[],
  sourceTraces: SourceTrace[],
  nodeMap: Map<string, string>,
) => {
  if (!simExperiment) return

  // Process simulation voltage probes
  if (simulationProbes.length > 0) {
    const nodesToProbe = new Set<string>()

    const getPortIdFromNetId = (netId: string) => {
      const trace = sourceTraces.find((t) =>
        t.connected_source_net_ids.includes(netId),
      )
      return trace?.connected_source_port_ids[0]
    }

    for (const probe of simulationProbes) {
      let signalPortId = probe.signal_input_source_port_id
      if (!signalPortId) {
        const signalNetId = probe.signal_input_source_net_id
        if (signalNetId) {
          signalPortId = getPortIdFromNetId(signalNetId)
        }
      }

      if (!signalPortId) continue

      const signalNodeName = nodeMap.get(signalPortId)
      if (!signalNodeName) continue

      let referencePortId = probe.reference_input_source_port_id
      if (!referencePortId && probe.reference_input_source_net_id) {
        referencePortId = getPortIdFromNetId(
          probe.reference_input_source_net_id,
        )
      }

      if (referencePortId) {
        const referenceNodeName = nodeMap.get(referencePortId)
        if (referenceNodeName && referenceNodeName !== "0") {
          nodesToProbe.add(`V(${signalNodeName},${referenceNodeName})`)
        } else if (signalNodeName !== "0") {
          nodesToProbe.add(`V(${signalNodeName})`)
        }
      } else {
        // Single-ended probe
        if (signalNodeName !== "0") {
          nodesToProbe.add(`V(${signalNodeName})`)
        }
      }
    }

    if (
      nodesToProbe.size > 0 &&
      simExperiment.experiment_type?.includes("transient")
    ) {
      netlist.printStatements.push(`.PRINT TRAN ${[...nodesToProbe].join(" ")}`)
    }
  }

  const timePerStep = simExperiment.time_per_step
  const endTime = simExperiment.end_time_ms
  const startTimeMs = simExperiment.start_time_ms

  if (timePerStep && endTime) {
    // circuit-json values are in ms, SPICE requires seconds
    const startTime = (startTimeMs ?? 0) / 1000

    let tranCmd = `.tran ${formatNumberForSpice(
      timePerStep / 1000,
    )} ${formatNumberForSpice(endTime / 1000)}`
    if (startTime > 0) {
      tranCmd += ` ${formatNumberForSpice(startTime)}`
    }
    tranCmd += " UIC"
    netlist.tranCommand = tranCmd
  }
}
