import type { AnyCircuitElement } from "circuit-json"
import { su } from "@tscircuit/soup-util"
import { SpiceComponent } from "../spice-classes/SpiceComponent"
import { VoltageSourceCommand } from "../spice-commands/VoltageSourceCommand"
import type { SpiceNetlist } from "../spice-classes/SpiceNetlist"

interface AddSimulationVoltageSourcesArgs {
  circuitJson: AnyCircuitElement[]
  netlist: SpiceNetlist
  nodeMap: Map<string, string>
}

export function addSimulationVoltageSourcesToNetlist({
  circuitJson,
  netlist,
  nodeMap,
}: AddSimulationVoltageSourcesArgs) {
  const simulationVoltageSources =
    su(circuitJson).simulation_voltage_source.list()

  for (const simSource of simulationVoltageSources) {
    if (simSource.type !== "simulation_voltage_source") continue

    if ((simSource as any).is_dc_source === false) {
      if (
        "terminal1_source_port_id" in simSource &&
        "terminal2_source_port_id" in simSource &&
        (simSource as any).terminal1_source_port_id &&
        (simSource as any).terminal2_source_port_id
      ) {
        const positiveNode =
          nodeMap.get((simSource as any).terminal1_source_port_id) || "0"
        const negativeNode =
          nodeMap.get((simSource as any).terminal2_source_port_id) || "0"

        let value = ""
        const wave_shape = (simSource as any).wave_shape
        if (wave_shape === "sinewave") {
          const v_offset = 0
          const v_peak = (simSource as any).voltage ?? 0
          const freq = (simSource as any).frequency ?? 0
          const delay = 0
          const damping_factor = 0
          const phase = (simSource as any).phase ?? 0
          if (freq > 0) {
            value = `SIN(${v_offset} ${v_peak} ${freq} ${delay} ${damping_factor} ${phase})`
          } else {
            value = `DC ${(simSource as any).voltage ?? 0}`
          }
        } else if (wave_shape === "square") {
          const v_initial = 0
          const v_pulsed = (simSource as any).voltage ?? 0
          const freq = (simSource as any).frequency ?? 0
          const period_from_freq = freq === 0 ? Infinity : 1 / freq
          const period = (simSource as any).period ?? period_from_freq
          const duty_cycle = (simSource as any).duty_cycle ?? 0.5
          const pulse_width = period * duty_cycle
          const delay = 0
          const rise_time = "1n"
          const fall_time = "1n"
          value = `PULSE(${v_initial} ${v_pulsed} ${delay} ${rise_time} ${fall_time} ${pulse_width} ${period})`
        } else if ((simSource as any).voltage !== undefined) {
          value = `DC ${(simSource as any).voltage}`
        }

        if (value) {
          const voltageSourceCmd = new VoltageSourceCommand({
            name: simSource.simulation_voltage_source_id,
            positiveNode,
            negativeNode,
            value,
          })

          const spiceComponent = new SpiceComponent(
            simSource.simulation_voltage_source_id,
            voltageSourceCmd,
            [positiveNode, negativeNode],
          )
          netlist.addComponent(spiceComponent)
        }
      }
    } else {
      const positivePortId =
        (simSource as any).positive_source_port_id ??
        (simSource as any).terminal1_source_port_id
      const negativePortId =
        (simSource as any).negative_source_port_id ??
        (simSource as any).terminal2_source_port_id

      if (
        positivePortId &&
        negativePortId &&
        "voltage" in simSource &&
        (simSource as any).voltage !== undefined
      ) {
        const positiveNode = nodeMap.get(positivePortId) || "0"
        const negativeNode = nodeMap.get(negativePortId) || "0"

        const voltageSourceCmd = new VoltageSourceCommand({
          name: simSource.simulation_voltage_source_id,
          positiveNode,
          negativeNode,
          value: `DC ${(simSource as any).voltage}`,
        })

        const spiceComponent = new SpiceComponent(
          simSource.simulation_voltage_source_id,
          voltageSourceCmd,
          [positiveNode, negativeNode],
        )
        netlist.addComponent(spiceComponent)
      }
    }
  }
}
