import type {
  SimulationCurrentProbe,
  SimulationExperiment,
  SimulationVoltageProbe,
  SourceTrace,
} from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { VoltageSourceCommand } from "lib/spice-commands"
import type { SourcePortOrNetIdToSpiceNodeNameMap } from "lib/spice-node-map"
import { Ac, Dc, Op, Options, Print, Save, Tran } from "spicets"
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
  nodeMap: SourcePortOrNetIdToSpiceNodeNameMap
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

const getSpiceAnalysisName = (
  experimentType: SimulationExperiment["experiment_type"],
) => {
  switch (experimentType) {
    case "spice_transient_analysis":
      return "TRAN"
    case "spice_dc_operating_point":
      return "OP"
    case "spice_dc_sweep":
      return "DC"
    case "spice_ac_analysis":
      return "AC"
  }
}

const getSpiceAcSweepType = (
  acSweepType: NonNullable<SimulationExperiment["ac_sweep_type"]>,
) => {
  switch (acSweepType) {
    case "linear":
      return "lin"
    case "decade":
      return "dec"
    case "octave":
      return "oct"
  }
}

const buildAnalysisCommand = (simulationExperiment: SimulationExperiment) => {
  if (simulationExperiment.experiment_type === "spice_transient_analysis") {
    const timePerStepMs = simulationExperiment.time_per_step
    const endTimeMs = simulationExperiment.end_time_ms
    const startTimeMs = simulationExperiment.start_time_ms
    if (timePerStepMs === undefined || endTimeMs === undefined) return null

    const startTimeSeconds = (startTimeMs ?? 0) / 1000
    return new Tran({
      step: formatNumberForSpice(timePerStepMs / 1000),
      stop: formatNumberForSpice(endTimeMs / 1000),
      ...(startTimeSeconds > 0
        ? { start: formatNumberForSpice(startTimeSeconds) }
        : {}),
      uic: true,
    })
  }

  if (simulationExperiment.experiment_type === "spice_dc_operating_point") {
    return new Op()
  }

  if (simulationExperiment.experiment_type === "spice_dc_sweep") {
    const {
      dc_sweep_voltage_source_id,
      dc_sweep_current_source_id,
      dc_sweep_start,
      dc_sweep_stop,
      dc_sweep_step,
    } = simulationExperiment
    if (
      dc_sweep_start === undefined ||
      dc_sweep_stop === undefined ||
      dc_sweep_step === undefined
    ) {
      return null
    }
    let dcSweepSourceName: string
    if (dc_sweep_voltage_source_id !== undefined) {
      dcSweepSourceName = `V${dc_sweep_voltage_source_id}`
    } else if (dc_sweep_current_source_id !== undefined) {
      dcSweepSourceName = `I${dc_sweep_current_source_id}`
    } else {
      return null
    }
    return new Dc({
      source: dcSweepSourceName,
      start: formatNumberForSpice(dc_sweep_start),
      stop: formatNumberForSpice(dc_sweep_stop),
      step: formatNumberForSpice(dc_sweep_step),
    })
  }

  const {
    ac_sweep_type,
    ac_samples_per_interval,
    ac_sample_count,
    ac_start_frequency_hz,
    ac_stop_frequency_hz,
  } = simulationExperiment
  if (
    ac_sweep_type === undefined ||
    ac_start_frequency_hz === undefined ||
    ac_stop_frequency_hz === undefined
  ) {
    return null
  }
  const sampleSetting =
    ac_sweep_type === "linear" ? ac_sample_count : ac_samples_per_interval
  if (sampleSetting === undefined) return null
  const spiceSweepType = getSpiceAcSweepType(ac_sweep_type)
  return new Ac({
    sweep: spiceSweepType,
    points: sampleSetting,
    start: formatNumberForSpice(ac_start_frequency_hz),
    stop: formatNumberForSpice(ac_stop_frequency_hz),
  })
}

export const processSimulationExperiment = ({
  netlist,
  simulationExperiment,
  simulationVoltageProbes,
  simulationCurrentProbes,
  sourceTraces,
  nodeMap,
}: {
  netlist: SpiceNetlist
  simulationExperiment: SimulationExperiment
  simulationVoltageProbes: SimulationVoltageProbe[]
  simulationCurrentProbes: SimulationCurrentProbe[]
  sourceTraces: SourceTrace[]
  nodeMap: SourcePortOrNetIdToSpiceNodeNameMap
}) => {
  const spiceAnalysisName = getSpiceAnalysisName(
    simulationExperiment.experiment_type,
  )
  const probeVectors = new Set<string>()

  const spiceOptions = simulationExperiment.spice_options
  if (spiceOptions) {
    const optionValues: Record<string, string | number> = {}
    for (const key of spiceOptionOrder) {
      const spiceOption = spiceOptions[key]
      if (spiceOption !== undefined) {
        optionValues[key] = spiceOption
      }
    }

    if (Object.keys(optionValues).length > 0) {
      netlist.optionStatements.push(new Options(optionValues).getString())
    }
  }

  // Process simulation voltage probes
  if (simulationVoltageProbes.length > 0) {
    const probeVectorMappings: VoltageProbeVectorMapping[] = []

    for (const probe of simulationVoltageProbes) {
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
          probeVectors.add(spiceVector)
          probeVectorMappings.push({
            simulation_voltage_probe_id: probe.simulation_voltage_probe_id,
            name: probe.name,
            spice_vector: spiceVector,
            source_node_name: signalNodeName,
            reference_node_name: referenceNodeName,
          })
        } else if (signalNodeName !== "0") {
          const spiceVector = `V(${signalNodeName})`
          probeVectors.add(spiceVector)
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
          probeVectors.add(spiceVector)
          probeVectorMappings.push({
            simulation_voltage_probe_id: probe.simulation_voltage_probe_id,
            name: probe.name,
            spice_vector: spiceVector,
            source_node_name: signalNodeName,
          })
        }
      }
    }

    if (probeVectorMappings.length > 0) {
      for (const mapping of probeVectorMappings) {
        netlist.metadataComments.push(
          `* tscircuit_probe ${JSON.stringify(mapping)}`,
        )
      }
    }
  }

  // Current probes are inline ammeter elements, so the 0V sense source is part
  // of the simulated topology even when the experiment does not print current.
  if (simulationCurrentProbes.length > 0) {
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

      probeVectors.add(spiceVector)
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

  if (probeVectors.size > 0) {
    const spiceProbeVectors = [...probeVectors].join(" ")
    const print = new Print({
      analysis: spiceAnalysisName,
      expressions: [spiceProbeVectors],
    })
    print.command = ".PRINT"
    netlist.printStatements.push(print.getString())

    const save = new Save([spiceProbeVectors])
    save.command = ".SAVE"
    netlist.saveStatements.push(save.getString())
  }

  netlist.analysisCommand =
    buildAnalysisCommand(simulationExperiment)?.getString() ?? null
}
