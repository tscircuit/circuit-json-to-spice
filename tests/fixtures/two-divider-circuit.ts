import type { AnyCircuitElement } from "circuit-json"

export function getTwoDividerCircuit(probeNames: [string, string]) {
  const circuit: AnyCircuitElement[] = []

  for (const [index, resistance] of [1000, 1000, 1000, 3000].entries()) {
    const id = `R${index + 1}`
    circuit.push({
      type: "source_component",
      source_component_id: id,
      name: id,
      ftype: "simple_resistor",
      resistance,
    })
    for (const pin of [1, 2]) {
      circuit.push({
        type: "source_port",
        source_component_id: id,
        source_port_id: `${id}_${pin}`,
        name: `pin${pin}`,
        pin_number: pin,
      })
    }
  }

  for (const [id, name, ports] of [
    ["vin", "VIN", ["R1_1", "R3_1"]],
    ["gnd", "GND", ["R2_2", "R4_2"]],
    ["out1", "OUT1", ["R1_2", "R2_1"]],
    ["out2", "OUT2", ["R3_2", "R4_1"]],
  ] as const) {
    circuit.push({
      type: "source_net",
      source_net_id: id,
      name,
      member_source_group_ids: [],
    })
    circuit.push({
      type: "source_trace",
      source_trace_id: `t_${id}`,
      connected_source_port_ids: [...ports],
      connected_source_net_ids: [id],
    })
  }

  circuit.push({
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "supply",
    is_dc_source: true,
    voltage: 4,
    positive_source_port_id: "R1_1",
    negative_source_port_id: "R2_2",
  })
  circuit.push({
    type: "simulation_experiment",
    simulation_experiment_id: "experiment",
    name: "Two independent divider outputs",
    experiment_type: "spice_dc_operating_point",
  })

  for (const [index, port] of ["R1_2", "R3_2"].entries()) {
    circuit.push({
      type: "simulation_voltage_probe",
      simulation_voltage_probe_id: `probe${index + 1}`,
      name: probeNames[index],
      signal_input_source_port_id: port,
      subcircuit_id: `subcircuit${index + 1}`,
    })
  }

  return circuit
}
