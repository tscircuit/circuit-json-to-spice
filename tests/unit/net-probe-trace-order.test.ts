import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const circuit: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "R1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  },
  {
    type: "source_port",
    source_port_id: "p1",
    name: "p1",
    source_component_id: "R1",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "p2",
    name: "p2",
    source_component_id: "R1",
    pin_number: 2,
  },
  {
    type: "source_net",
    source_net_id: "net1",
    name: "signal",
    member_source_group_ids: [],
  },
  {
    type: "source_net",
    source_net_id: "net2",
    name: "reference",
    member_source_group_ids: [],
  },
  {
    type: "simulation_experiment",
    simulation_experiment_id: "experiment",
    name: "test",
    experiment_type: "spice_dc_operating_point",
  },
]

const traces: AnyCircuitElement[] = [
  {
    type: "source_trace",
    source_trace_id: "empty1",
    connected_source_port_ids: [],
    connected_source_net_ids: ["net1"],
  },
  {
    type: "source_trace",
    source_trace_id: "empty2",
    connected_source_port_ids: [],
    connected_source_net_ids: ["net2"],
  },
  {
    type: "source_trace",
    source_trace_id: "connected1",
    connected_source_port_ids: ["p1"],
    connected_source_net_ids: ["net1"],
  },
  {
    type: "source_trace",
    source_trace_id: "connected2",
    connected_source_port_ids: ["p2"],
    connected_source_net_ids: ["net2"],
  },
]

const cases: { name: string; probe: AnyCircuitElement; expected: string[] }[] =
  [
    {
      name: "named single-ended voltage",
      probe: {
        type: "simulation_voltage_probe",
        simulation_voltage_probe_id: "vp",
        signal_input_source_net_id: "net1",
        name: "VOUT",
      },
      expected: ["RR1 VOUT N1 1K", ".PRINT OP V(VOUT)", ".SAVE V(VOUT)"],
    },
    {
      name: "differential voltage",
      probe: {
        type: "simulation_voltage_probe",
        simulation_voltage_probe_id: "vp",
        signal_input_source_net_id: "net1",
        reference_input_source_net_id: "net2",
      },
      expected: [
        ".PRINT OP V(N1,N2)",
        ".SAVE V(N1,N2)",
        '"reference_node_name":"N2"',
      ],
    },
    {
      name: "inline current",
      probe: {
        type: "simulation_current_probe",
        simulation_current_probe_id: "cp",
        positive_source_net_id: "net1",
        negative_source_net_id: "net2",
      },
      expected: [
        "Vsense_cp N1 N2 DC 0",
        ".PRINT OP I(Vsense_cp)",
        ".SAVE I(Vsense_cp)",
      ],
    },
  ]

for (const { name, probe, expected } of cases) {
  test(`${name} probe is independent of net-only trace ordering`, () => {
    const connectedFirst = circuitJsonToSpice([
      ...circuit,
      ...traces.slice(2),
      ...traces.slice(0, 2),
      probe,
    ]).toSpiceString()
    const netOnlyFirst = circuitJsonToSpice([
      ...circuit,
      ...traces,
      probe,
    ]).toSpiceString()
    for (const output of expected) {
      expect(connectedFirst).toContain(output)
      expect(netOnlyFirst).toContain(output)
    }
    expect(netOnlyFirst).toBe(connectedFirst)
  })
}
