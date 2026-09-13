import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { Simulation } from "eecircuit-engine"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const createLoadCircuit = (
  sourceNetId: string,
  sourceType: "voltage" | "current",
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "R1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  },
  {
    type: "source_port",
    source_port_id: "load_positive",
    source_component_id: "R1",
    name: "pin1",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "load_negative",
    source_component_id: "R1",
    name: "pin2",
    pin_number: 2,
  },
  ...["supply", "supply_alias", "supply_alias2", "gnd"].map(
    (source_net_id) => ({
      type: "source_net" as const,
      source_net_id,
      name: source_net_id.toUpperCase(),
      member_source_group_ids: [],
    }),
  ),
  {
    type: "source_trace",
    source_trace_id: "alias2_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: ["supply_alias", "supply_alias2"],
  },
  {
    type: "source_trace",
    source_trace_id: "load_positive_trace",
    connected_source_port_ids: ["load_positive"],
    connected_source_net_ids: ["supply"],
  },
  {
    type: "source_trace",
    source_trace_id: "alias_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: ["supply", "supply_alias"],
  },
  {
    type: "source_trace",
    source_trace_id: "load_negative_trace",
    connected_source_port_ids: ["load_negative"],
    connected_source_net_ids: ["gnd"],
  },
  sourceType === "voltage"
    ? {
        type: "simulation_voltage_source",
        simulation_voltage_source_id: "supply",
        is_dc_source: true,
        positive_source_net_id: sourceNetId,
        negative_source_net_id: "gnd",
        voltage: 5,
      }
    : {
        type: "simulation_current_source",
        simulation_current_source_id: "supply",
        is_dc_source: true,
        positive_source_net_id: "gnd",
        negative_source_net_id: sourceNetId,
        current: 0.005,
      },
  {
    type: "simulation_voltage_probe",
    simulation_voltage_probe_id: "load_voltage",
    name: "load",
    signal_input_source_port_id: "load_positive",
  },
  {
    type: "simulation_experiment",
    simulation_experiment_id: "op",
    name: "Load operating point",
    experiment_type: "spice_dc_operating_point",
  },
]

test.each(["supply", "supply_alias", "supply_alias2"])(
  "voltage source reaches its load through source net %s",
  (sourceNetId) => {
    const spice = circuitJsonToSpice(
      createLoadCircuit(sourceNetId, "voltage"),
    ).toSpiceString()

    expect(spice).toContain("RR1 load 0 1K")
    expect(spice).toContain("Vsupply load 0 DC 5")
  },
)

test.each(["supply", "supply_alias", "supply_alias2"])(
  "current source reaches its load through source net %s",
  (sourceNetId) => {
    const spice = circuitJsonToSpice(
      createLoadCircuit(sourceNetId, "current"),
    ).toSpiceString()

    expect(spice).toContain("RR1 load 0 1K")
    expect(spice).toContain("Isupply 0 load DC 0.005")
  },
)

test("5 mA through aliased supply nets produces 5 V across a 1 kohm load", async () => {
  const spice = circuitJsonToSpice(
    createLoadCircuit("supply_alias2", "current"),
  ).toSpiceString()

  const simulation = new Simulation()
  await simulation.start()
  simulation.setNetList(spice)
  const result = await simulation.runSim()
  const loadVoltage = result.data.find((entry) => entry.name === "v(load)")

  expect(loadVoltage).toBeDefined()
  expect(loadVoltage!.values[0]).toBeCloseTo(5, 6)
})
