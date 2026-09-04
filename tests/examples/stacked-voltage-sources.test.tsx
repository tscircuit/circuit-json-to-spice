import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"

// Two voltage sources in series: V1 (5V) TOP -> MID, V2 (3V) MID -> GND.
// MID is a genuine internal node shared by both sources. Previously every
// voltage source's negative terminal was force-grounded, so MID collapsed into
// node 0 and V2 was emitted self-shorted as "V 0 0" (a SPICE singular matrix).
// The mid node must survive and only the real GND net becomes node 0.
const stackedSources: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "v1",
    name: "V1",
    ftype: "simple_voltage_source",
  },
  {
    type: "source_component",
    source_component_id: "v2",
    name: "V2",
    ftype: "simple_voltage_source",
  },
  {
    type: "source_port",
    source_port_id: "v1p",
    source_component_id: "v1",
    name: "pos",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "v1n",
    source_component_id: "v1",
    name: "neg",
    pin_number: 2,
  },
  {
    type: "source_port",
    source_port_id: "v2p",
    source_component_id: "v2",
    name: "pos",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "v2n",
    source_component_id: "v2",
    name: "neg",
    pin_number: 2,
  },
  {
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "sv1",
    positive_source_port_id: "v1p",
    negative_source_port_id: "v1n",
    voltage: 5,
  },
  {
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "sv2",
    positive_source_port_id: "v2p",
    negative_source_port_id: "v2n",
    voltage: 3,
  },
  {
    type: "source_trace",
    source_trace_id: "t1",
    connected_source_port_ids: ["v1n", "v2p"],
    connected_source_net_ids: [],
  },
  { type: "source_net", source_net_id: "gnd", name: "GND" },
  {
    type: "source_trace",
    source_trace_id: "t2",
    connected_source_port_ids: ["v2n"],
    connected_source_net_ids: ["gnd"],
  },
] as unknown as AnyCircuitElement[]

test("stacked voltage sources keep their shared mid node (no self-shorted source)", () => {
  const spiceString = circuitJsonToSpice(stackedSources).toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    Vsv1 N2 N1 DC 5
    Vsv2 N1 0 DC 3
    .END"
  `)

  // Neither source may have identical + and - nodes (a self-short).
  for (const line of spiceString.split("\n").filter((l) => l.startsWith("V"))) {
    const [, nodePlus, nodeMinus] = line.split(/\s+/)
    expect(nodePlus).not.toBe(nodeMinus)
  }
})
