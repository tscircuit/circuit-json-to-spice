import { expect, test } from "bun:test"
import { type AnyCircuitElement, simulation_voltage_probe } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { getTwoDividerCircuit } from "tests/fixtures/two-divider-circuit"

function getProbeMappings(circuit: AnyCircuitElement[]) {
  const netlist = circuitJsonToSpice(circuit)
  const mappings: {
    simulation_voltage_probe_id: string
    name: string
    source_node_name: string
    spice_vector: string
  }[] = netlist.metadataComments.map((comment) =>
    JSON.parse(comment.slice("* tscircuit_probe ".length)),
  )
  return { netlist, mappings }
}

test.each([
  ["VOUT", "VOUT"],
  ["VOUT", "vout"],
  ["N1", "n1"],
  ["Output A", "Output_A"],
  ["OUT,A", "out_a"],
  ["V(out)", "OUT_B"],
  [" ", "OUT_B"],
  ["输出", "OUT_B"],
])(
  "probe names %s and %s preserve separate connected nets",
  (first, second) => {
    const circuit = getTwoDividerCircuit([first, second])
    const original = structuredClone(circuit)
    for (const probe of circuit.filter(
      (element) => element.type === "simulation_voltage_probe",
    )) {
      expect(simulation_voltage_probe.safeParse(probe).success).toBe(true)
    }
    const { netlist, mappings } = getProbeMappings(circuit)
    expect(circuit).toEqual(original)
    expect(mappings.map((mapping) => mapping.name)).toEqual([first, second])
    const [node1, node2] = mappings.map((mapping) => mapping.source_node_name)
    expect(node1).toMatch(/^[A-Za-z0-9_]+$/)
    expect(node2).toMatch(/^[A-Za-z0-9_]+$/)
    expect(node1.toLowerCase()).not.toBe(node2.toLowerCase())
    const spice = netlist.toSpiceString()
    expect(spice).toContain(`RR2 ${node1} 0 1K`)
    expect(spice).toContain(`RR4 ${node2} 0 3K`)
    expect(spice).toContain(`.PRINT OP V(${node1}) V(${node2})`)
    expect(spice).toContain(`.SAVE V(${node1}) V(${node2})`)
    expect(mappings.map((mapping) => mapping.spice_vector)).toEqual([
      `V(${node1})`,
      `V(${node2})`,
    ])
    const supplyNode = netlist.components.find(
      (component) => component.name === "supply",
    )!.nodes[0]
    expect(
      new Set([node1, node2, supplyNode].map((node) => node.toLowerCase()))
        .size,
    ).toBe(3)
  },
)

test("unique alphanumeric and underscore probe names stay unchanged", () => {
  const { mappings } = getProbeMappings(
    getTwoDividerCircuit(["OUT_A", "OUT_B"]),
  )
  expect(mappings.map((mapping) => mapping.source_node_name)).toEqual([
    "OUT_A",
    "OUT_B",
  ])
})

test("source-net probes with repeated names preserve separate nets", () => {
  const circuit = getTwoDividerCircuit(["OUT", "OUT"]).map((element) => {
    if (element.type !== "simulation_voltage_probe") return element
    const { signal_input_source_port_id, ...probe } = element
    return {
      ...probe,
      signal_input_source_net_id:
        signal_input_source_port_id === "R1_2" ? "out1" : "out2",
    }
  })
  const { mappings } = getProbeMappings(circuit)
  expect(mappings[0].source_node_name.toLowerCase()).not.toBe(
    mappings[1].source_node_name.toLowerCase(),
  )
})

test("a floating probed port does not alias a connected net with the same probe name", () => {
  const circuit = getTwoDividerCircuit(["OUT", "OUT"]).filter(
    (element) =>
      element.type !== "source_trace" || element.source_trace_id !== "t_out2",
  )
  const { netlist, mappings } = getProbeMappings(circuit)
  const [node1, node2] = mappings.map((mapping) => mapping.source_node_name)
  expect(node1.toLowerCase()).not.toBe(node2.toLowerCase())
  expect(
    netlist.components.find((component) => component.name === "R3")!.nodes[1],
  ).toBe(node2)
})

test.each(["0", "GND"])(
  "a probe named %s does not ground its signal",
  (name) => {
    const { netlist, mappings } = getProbeMappings(
      getTwoDividerCircuit([name, "OUT"]),
    )
    expect(mappings).toHaveLength(2)
    expect(["0", "gnd"]).not.toContain(
      mappings[0].source_node_name.toLowerCase(),
    )
    expect(netlist.toSpiceString()).toContain(
      `RR2 ${mappings[0].source_node_name} 0 1K`,
    )
  },
)

test.each([false, true])(
  "probes sharing a signal retain the same node (floating: %s)",
  (floating) => {
    const circuit = getTwoDividerCircuit(["FIRST", "SECOND"])
      .filter(
        (element) =>
          !floating ||
          element.type !== "source_trace" ||
          element.source_trace_id !== "t_out1",
      )
      .map((element) =>
        element.type === "simulation_voltage_probe"
          ? { ...element, signal_input_source_port_id: "R1_2" }
          : element,
      )
    const { mappings } = getProbeMappings(circuit)
    expect(mappings).toHaveLength(2)
    expect(mappings[0].source_node_name).toBe(mappings[1].source_node_name)
    expect(mappings.map((mapping) => mapping.name)).toEqual(["FIRST", "SECOND"])
  },
)

test("collision suffixes do not take a different probe's preferred name", () => {
  const circuit = getTwoDividerCircuit(["OUT", "OUT"])
  circuit.push({
    type: "simulation_voltage_probe",
    simulation_voltage_probe_id: "probe_supply",
    name: "OUT_2",
    signal_input_source_port_id: "R1_1",
  })
  const { mappings } = getProbeMappings(circuit)
  expect(mappings[2].source_node_name).toBe("OUT_2")
  expect(
    new Set(mappings.map((mapping) => mapping.source_node_name.toLowerCase()))
      .size,
  ).toBe(3)
})

test.each([
  ["OUT A", "OUT,A", "OUT A_2"],
  ["OUT A", "out,a", "out a_2"],
])(
  "collision suffixes reserve normalized names for %s, %s and %s",
  (first, second, third) => {
    const circuit = getTwoDividerCircuit([first, second])
    circuit.push({
      type: "simulation_voltage_probe",
      simulation_voltage_probe_id: "probe_supply",
      name: third,
      signal_input_source_port_id: "R1_1",
    })
    const { mappings } = getProbeMappings(circuit)
    expect(mappings.map((mapping) => mapping.name)).toEqual([
      first,
      second,
      third,
    ])
    expect(
      mappings.map((mapping) => mapping.source_node_name.toLowerCase()),
    ).toEqual(["out_a", "out_a_3", "out_a_2"])
  },
)
