import type {
  SimulationCurrentProbe,
  SimulationExperiment,
  SimulationVoltageProbe,
  SourceTrace,
} from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { VoltageSourceCommand } from "lib/spice-commands"
import { formatNumberForSpice, sanitizeIdentifier } from "./helpers"

const spiceOptionOrder = ["method", "reltol", "abstol", "vntol"] as const

interface VoltageProbeVectorMapping {
  simulation_voltage_probe_id: string
  name?: string
  spice_vector: string
  source_node_name: string
  reference_node_name?: string
}

interface CurrentProbeVectorMapping {
  simulation_current_probe_id: string
  name?: string
  spice_vector: string
  sense_voltage_source_name: string
  positive_node_name: string
  negative_node_name: string
}

const getPortIdFromNetId = (sourceTraces: SourceTrace[], netId: string) => {
  const trace = sourceTraces.find((t) =>
    t.connected_source_net_ids.includes(netId),
  )
  return trace?.connected_source_port_ids[0]
}

const resolveNodeNameFromSourcePortOrNet = ({
  sourcePortId,
  sourceNetId,
  sourceTraces,
  nodeMap,
}: {
  sourcePortId?: string
  sourceNetId?: string
  sourceTraces: SourceTrace[]
  nodeMap: Map<string, string>
}) => {
  if (sourcePortId) {
    return nodeMap.get(sourcePortId)
  }

  if (!sourceNetId) return undefined

  const sourcePortIdFromNet = getPortIdFromNetId(sourceTraces, sourceNetId)
  if (!sourcePortIdFromNet) return undefined

  return nodeMap.get(sourcePortIdFromNet)
}

const getSenseVoltageSourceName = (probe: SimulationCurrentProbe) =>
  sanitizeIdentifier(
    `sense_${probe.simulation_current_probe_id}`,
    "sense_current_probe",
  )

export const processSimulationExperiment = (
  netlist: SpiceNetlist,
  simExperiment: SimulationExperiment,
  simulationProbes: SimulationVoltageProbe[],
  simulationCurrentProbes: SimulationCurrentProbe[],
  sourceTraces: SourceTrace[],
  nodeMap: Map<string, string>,
) => {
  if (!simExperiment) return

  const isTransientExperiment =
    simExperiment.experiment_type?.includes("transient") ?? false
  const transientProbeVectors = new Set<string>()

  const spiceOptions = simExperiment.spice_options
  if (spiceOptions) {
    const optionParts = spiceOptionOrder
      .map((key) => {
        const value = spiceOptions[key]
        return value === undefined ? null : `${key}=${value}`
      })
      .filter((part): part is string => part !== null)

    if (optionParts.length > 0) {
      netlist.optionStatements.push(`.options ${optionParts.join(" ")}`)
    }
  }

  // Process simulation voltage probes
  if (simulationProbes.length > 0) {
    const probeVectorMappings: VoltageProbeVectorMapping[] = []

    for (const probe of simulationProbes) {
      const signalNodeName = resolveNodeNameFromSourcePortOrNet({
        sourcePortId: probe.signal_input_source_port_id,
        sourceNetId: probe.signal_input_source_net_id,
        sourceTraces,
        nodeMap,
      })
      if (!signalNodeName) continue

      const hasReference =
        probe.reference_input_source_port_id ||
        probe.reference_input_source_net_id

      if (hasReference) {
        const referenceNodeName = resolveNodeNameFromSourcePortOrNet({
          sourcePortId: probe.reference_input_source_port_id,
          sourceNetId: probe.reference_input_source_net_id,
          sourceTraces,
          nodeMap,
        })
        if (referenceNodeName && referenceNodeName !== "0") {
          const spiceVector = `V(${signalNodeName},${referenceNodeName})`
          transientProbeVectors.add(spiceVector)
          probeVectorMappings.push({
            simulation_voltage_probe_id: probe.simulation_voltage_probe_id,
            name: probe.name,
            spice_vector: spiceVector,
            source_node_name: signalNodeName,
            reference_node_name: referenceNodeName,
          })
        } else if (signalNodeName !== "0") {
          const spiceVector = `V(${signalNodeName})`
          transientProbeVectors.add(spiceVector)
          probeVectorMappings.push({
            simulation_voltage_probe_id: probe.simulation_voltage_probe_id,
            name: probe.name,
            spice_vector: spiceVector,
            source_node_name: signalNodeName,
            reference_node_name: referenceNodeName,
          })
        }
      } else {
        // Single-ended probe
        if (signalNodeName !== "0") {
          const spiceVector = `V(${signalNodeName})`
          transientProbeVectors.add(spiceVector)
          probeVectorMappings.push({
            simulation_voltage_probe_id: probe.simulation_voltage_probe_id,
            name: probe.name,
            spice_vector: spiceVector,
            source_node_name: signalNodeName,
          })
        }
      }
    }

    if (probeVectorMappings.length > 0 && isTransientExperiment) {
      for (const mapping of probeVectorMappings) {
        netlist.metadataComments.push(
          `* tscircuit_probe ${JSON.stringify(mapping)}`,
        )
      }
    }
  }

  // Process simulation current probes
  if (simulationCurrentProbes.length > 0 && isTransientExperiment) {
    const senseVoltageSourceNames = new Set<string>()
    const currentProbeVectorMappings: CurrentProbeVectorMapping[] = []

    for (const probe of simulationCurrentProbes) {
      const positiveNodeName = resolveNodeNameFromSourcePortOrNet({
        sourcePortId: probe.positive_source_port_id,
        sourceNetId: probe.positive_source_net_id,
        sourceTraces,
        nodeMap,
      })
      const negativeNodeName = resolveNodeNameFromSourcePortOrNet({
        sourcePortId: probe.negative_source_port_id,
        sourceNetId: probe.negative_source_net_id,
        sourceTraces,
        nodeMap,
      })

      if (!positiveNodeName || !negativeNodeName) continue

      const senseVoltageSourceBaseName = getSenseVoltageSourceName(probe)
      let senseVoltageSourceName = senseVoltageSourceBaseName
      let duplicateIndex = 2
      while (senseVoltageSourceNames.has(senseVoltageSourceName)) {
        senseVoltageSourceName = `${senseVoltageSourceBaseName}_${duplicateIndex++}`
      }
      senseVoltageSourceNames.add(senseVoltageSourceName)

      const spiceSenseVoltageSourceName = `V${senseVoltageSourceName}`
      const spiceVector = `I(${spiceSenseVoltageSourceName})`
      const voltageSourceCmd = new VoltageSourceCommand({
        name: senseVoltageSourceName,
        positiveNode: positiveNodeName,
        negativeNode: negativeNodeName,
        value: "DC 0",
      })

      netlist.addComponent(
        new SpiceComponent(senseVoltageSourceName, voltageSourceCmd, [
          positiveNodeName,
          negativeNodeName,
        ]),
      )

      transientProbeVectors.add(spiceVector)
      currentProbeVectorMappings.push({
        simulation_current_probe_id: probe.simulation_current_probe_id,
        name: probe.name,
        spice_vector: spiceVector,
        sense_voltage_source_name: spiceSenseVoltageSourceName,
        positive_node_name: positiveNodeName,
        negative_node_name: negativeNodeName,
      })
    }

    if (currentProbeVectorMappings.length > 0) {
      for (const mapping of currentProbeVectorMappings) {
        netlist.metadataComments.push(
          `* tscircuit_current_probe ${JSON.stringify(mapping)}`,
        )
      }
    }
  }

  if (transientProbeVectors.size > 0 && isTransientExperiment) {
    const probeVectors = [...transientProbeVectors].join(" ")
    netlist.printStatements.push(`.PRINT TRAN ${probeVectors}`)
    netlist.saveStatements.push(`.SAVE ${probeVectors}`)
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
