import { expect, test } from "bun:test"
import { source_simple_resistor, type AnyCircuitElement } from "circuit-json"
import { Simulation } from "eecircuit-engine"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

// Two divider modules share a 4 V supply. Local component references may repeat
// across modules, while Circuit JSON identities and port identities are global.
const makeDividerModules = (repeatLocalNames: boolean): AnyCircuitElement[] => {
  const elements: AnyCircuitElement[] = []
  for (const [index, resistance] of [1000, 1000, 1000, 3000].entries()) {
    const id = `resistor_${index}`
    const component = {
      type: "source_component" as const,
      source_component_id: id,
      subcircuit_id: index < 2 ? "module_a" : "module_b",
      name: `R${repeatLocalNames ? (index % 2) + 1 : index + 1}`,
      ftype: "simple_resistor" as const,
      resistance,
    }
    expect(source_simple_resistor.safeParse(component).success).toBe(true)
    elements.push(component)
    for (const pin of [1, 2]) {
      elements.push({
        type: "source_port",
        source_port_id: `${id}_${pin}`,
        source_component_id: id,
        name: `pin${pin}`,
        pin_number: pin,
      })
    }
  }
  for (const [id, ports] of [
    ["VIN", ["resistor_0_1", "resistor_2_1"]],
    ["GND", ["resistor_1_2", "resistor_3_2"]],
    ["OUT_A", ["resistor_0_2", "resistor_1_1"]],
    ["OUT_B", ["resistor_2_2", "resistor_3_1"]],
  ] as const) {
    elements.push({
      type: "source_net",
      source_net_id: id,
      name: id,
      member_source_group_ids: [],
    })
    elements.push({
      type: "source_trace",
      source_trace_id: `trace_${id}`,
      connected_source_port_ids: [...ports],
      connected_source_net_ids: [id],
    })
  }
  elements.push({
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "supply",
    is_dc_source: true,
    voltage: 4,
    positive_source_port_id: "resistor_0_1",
    negative_source_port_id: "resistor_1_2",
  })
  elements.push({
    type: "simulation_experiment",
    simulation_experiment_id: "experiment",
    name: "Two divider modules",
    experiment_type: "spice_dc_operating_point",
  })
  for (const [name, port] of [
    ["OUT_A", "resistor_0_2"],
    ["OUT_B", "resistor_2_2"],
  ] as const) {
    elements.push({
      type: "simulation_voltage_probe",
      simulation_voltage_probe_id: `probe_${name}`,
      name,
      signal_input_source_port_id: port,
    })
  }
  return elements
}

test.each([false, true])(
  "independent divider modules retain 2 V / 3 V outputs (repeated local names: %s)",
  async (repeatLocalNames) => {
    const circuit = makeDividerModules(repeatLocalNames)
    const original = structuredClone(circuit)
    const netlist = circuitJsonToSpice(circuit).toSpiceString()
    const simulation = new Simulation()
    await simulation.start()
    simulation.setNetList(netlist)
    const result = await simulation.runSim()
    for (const [name, expected] of [
      ["v(out_a)", 2],
      ["v(out_b)", 3],
    ] as const) {
      expect(
        result.data.find((entry) => entry.name === name)?.values[0],
      ).toBeCloseTo(expected)
    }
    expect(circuit).toEqual(original)
  },
)

test.each(["SW1", "SW 1", "7", ""])(
  "same-named switches keep separate controls (%s)",
  async (switchName) => {
    const circuit = makeDividerModules(false).map((element) => {
      if (
        element.type === "source_component" &&
        ["resistor_0", "resistor_2"].includes(element.source_component_id)
      ) {
        return {
          type: "source_component" as const,
          source_component_id: element.source_component_id,
          name: switchName,
          ftype: "simple_switch" as const,
        }
      }
      return element
    })
    for (const [id, starts_closed] of [
      ["resistor_0", true],
      ["resistor_2", false],
    ] as const) {
      circuit.push({
        type: "simulation_switch",
        simulation_switch_id: `simulation_${id}`,
        source_component_id: id,
        starts_closed,
      })
    }
    const original = structuredClone(circuit)
    const netlist = circuitJsonToSpice(circuit)
    const text = netlist.toSpiceString()
    const instances = netlist.components.map((component) =>
      component.toSpiceString().split(" ")[0].toLowerCase(),
    )
    expect(new Set(instances).size).toBe(instances.length)
    expect(netlist.models.size).toBe(2)
    const simulation = new Simulation()
    await simulation.start()
    simulation.setNetList(text)
    const result = await simulation.runSim()
    expect(
      result.data.find((entry) => entry.name === "v(out_a)")?.values[0],
    ).toBeCloseTo(4, 3)
    expect(
      result.data.find((entry) => entry.name === "v(out_b)")?.values[0],
    ).toBeCloseTo(0, 3)
    expect(circuitJsonToSpice(circuit).toSpiceString()).toBe(text)
    expect(circuit).toEqual(original)
  },
)

test("switch allocation preserves a DC sweep, a current probe and reserved control names", async () => {
  const circuit = makeDividerModules(false)
    .filter(
      (element) =>
        element.type !== "source_trace" ||
        element.source_trace_id !== "trace_OUT_A",
    )
    .map((element): AnyCircuitElement => {
      if (
        element.type === "source_component" &&
        ["resistor_0", "resistor_2"].includes(element.source_component_id)
      ) {
        return {
          type: "source_component",
          source_component_id: element.source_component_id,
          name: "SW1",
          ftype: "simple_switch",
        }
      }
      if (element.type === "simulation_voltage_source")
        return { ...element, simulation_voltage_source_id: "CTRL_SW1_2" }
      if (
        element.type === "simulation_voltage_probe" &&
        element.name === "OUT_B"
      )
        return { ...element, name: "NCTRL_SW1_3" }
      if (element.type === "simulation_experiment")
        return {
          ...element,
          experiment_type: "spice_dc_sweep",
          dc_sweep_voltage_source_id: "CTRL_SW1_2",
          dc_sweep_start: 2,
          dc_sweep_stop: 4,
          dc_sweep_step: 1,
        }
      return element
    })
  circuit.push({
    type: "simulation_switch",
    simulation_switch_id: "control_a",
    source_component_id: "resistor_0",
    starts_closed: true,
  })
  circuit.push({
    type: "simulation_switch",
    simulation_switch_id: "control_b",
    source_component_id: "resistor_2",
    starts_closed: false,
  })
  circuit.push({
    type: "simulation_current_probe",
    simulation_current_probe_id: "ammeter",
    name: "Load current",
    positive_source_port_id: "resistor_0_2",
    negative_source_port_id: "resistor_1_1",
  })
  const original = structuredClone(circuit)
  const netlist = circuitJsonToSpice(circuit)
  const text = netlist.toSpiceString()
  expect(text).toContain(".dc VCTRL_SW1_2 2 4 1")
  expect(text).toContain("VCTRL_SW1_2 N1 0 DC 4")
  expect(text).toContain("VCTRL_SW1_4 NCTRL_SW1_4 0 DC 0")
  expect(text).toContain("SSW1_4 N1 NCTRL_SW1_3 NCTRL_SW1_4 0 SW_SW1_4")
  expect(text).toContain('"sense_voltage_source_name":"Vsense_ammeter"')
  expect(text).toContain("I(Vsense_ammeter)")
  const simulation = new Simulation()
  await simulation.start()
  simulation.setNetList(text)
  const result = await simulation.runSim()
  const currents = result.data.find(
    (entry) => entry.name === "i(vsense_ammeter)",
  )?.values
  expect(currents?.length).toBe(3)
  for (const [index, voltage] of [2, 3, 4].entries())
    expect(currents?.[index]).toBeCloseTo(voltage / 1000.1, 6)
  expect(circuit).toEqual(original)
})
