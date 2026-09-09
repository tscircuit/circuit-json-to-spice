import { expect, test } from "bun:test"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import { Simulation } from "eecircuit-engine"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

test("core can emit repeated local references from separate subcircuits", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.schematicDisabled = true
  circuit.add(
    createElement(
      "board",
      { width: 20, height: 20 },
      ...["module_a", "module_b"].map((name, index) =>
        createElement(
          "group",
          { name, subcircuit: true },
          createElement("resistor", { name: "R1", resistance: "1k" }),
          createElement("resistor", {
            name: "R2",
            resistance: index === 0 ? "1k" : "3k",
          }),
          createElement("trace", { from: ".R1 > .pin2", to: ".R2 > .pin1" }),
        ),
      ),
    ),
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const resistors = circuitJson.filter(
    (element) =>
      element.type === "source_component" &&
      element.ftype === "simple_resistor",
  )
  expect(resistors.map((element) => element.name)).toEqual([
    "R1",
    "R2",
    "R1",
    "R2",
  ])
  const groups = new Set(resistors.map((element) => element.source_group_id))
  expect(groups.size).toBe(2)
  for (const groupId of groups) {
    const group = circuitJson.find(
      (element) =>
        element.type === "source_group" && element.source_group_id === groupId,
    )
    expect(group?.type === "source_group" && group.is_subcircuit).toBe(true)
  }
  const portId = (index: number, pin: number) => {
    const port = circuitJson.find(
      (element) =>
        element.type === "source_port" &&
        element.source_component_id === resistors[index].source_component_id &&
        element.pin_number === pin,
    )
    if (!port || port.type !== "source_port")
      throw new Error("Missing generated resistor port")
    return port.source_port_id
  }
  for (const [name, ports] of [
    ["VIN", [portId(0, 1), portId(2, 1)]],
    ["GND", [portId(1, 2), portId(3, 2)]],
  ] as const) {
    circuitJson.push({
      type: "source_net",
      source_net_id: name,
      name,
      member_source_group_ids: [],
    })
    circuitJson.push({
      type: "source_trace",
      source_trace_id: `supply_${name}`,
      connected_source_port_ids: [...ports],
      connected_source_net_ids: [name],
    })
  }
  circuitJson.push({
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "supply",
    voltage: 4,
    is_dc_source: true,
    positive_source_port_id: portId(0, 1),
    negative_source_port_id: portId(1, 2),
  })
  circuitJson.push({
    type: "simulation_experiment",
    simulation_experiment_id: "experiment",
    name: "Core-generated modules",
    experiment_type: "spice_dc_operating_point",
  })
  for (const [name, index] of [
    ["OUT_A", 0],
    ["OUT_B", 2],
  ] as const) {
    circuitJson.push({
      type: "simulation_voltage_probe",
      simulation_voltage_probe_id: `probe_${name}`,
      name,
      signal_input_source_port_id: portId(index, 2),
    })
  }
  const original = structuredClone(circuitJson)
  const spice = circuitJsonToSpice(circuitJson).toSpiceString()
  const names = spice
    .split("\n")
    .filter((line) => line.startsWith("R"))
    .map((line) => line.split(" ")[0].toLowerCase())
  expect(names).toHaveLength(4)
  expect(new Set(names).size).toBe(4)
  const simulation = new Simulation()
  await simulation.start()
  simulation.setNetList(spice)
  const result = await simulation.runSim()
  for (const [name, expected] of [
    ["v(out_a)", 2],
    ["v(out_b)", 3],
  ] as const) {
    expect(
      result.data.find((entry) => entry.name === name)?.values[0],
    ).toBeCloseTo(expected)
  }
  expect(circuitJson).toEqual(original)
})
