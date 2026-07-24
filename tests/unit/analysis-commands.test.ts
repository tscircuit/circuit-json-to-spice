import { expect, test } from "bun:test"
import type { AnyCircuitElement, SimulationExperiment } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const createCircuit = (
  simulationExperiment: SimulationExperiment,
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
    source_port_id: "R1_p1",
    source_component_id: "R1",
    name: "p1",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "R1_p2",
    source_component_id: "R1",
    name: "p2",
    pin_number: 2,
  },
  {
    type: "simulation_voltage_source",
    simulation_voltage_source_id: "vin",
    is_dc_source: true,
    positive_source_port_id: "R1_p1",
    negative_source_port_id: "R1_p2",
    voltage: 5,
    ac_magnitude: 1,
    ac_phase: 45,
  },
  {
    type: "simulation_voltage_probe",
    simulation_voltage_probe_id: "vout",
    name: "OUT",
    signal_input_source_port_id: "R1_p1",
  },
  simulationExperiment,
]

test("DC operating point emits an OP command and probe output", () => {
  const spiceNetlist = circuitJsonToSpice(
    createCircuit({
      type: "simulation_experiment",
      simulation_experiment_id: "op1",
      name: "bias",
      experiment_type: "spice_dc_operating_point",
    }),
  ).toSpiceString()

  expect(spiceNetlist).toContain("Vvin OUT N1 DC 5 AC 1 45")
  expect(spiceNetlist).toContain(".PRINT OP V(OUT)")
  expect(spiceNetlist).toContain(".SAVE V(OUT)")
  expect(spiceNetlist).toContain("\n.op\n.END")
})

test("DC source sweep emits a typed source command", () => {
  const spiceNetlist = circuitJsonToSpice(
    createCircuit({
      type: "simulation_experiment",
      simulation_experiment_id: "dc1",
      name: "line regulation",
      experiment_type: "spice_dc_sweep",
      dc_sweep_voltage_source_id: "vin",
      dc_sweep_start: 2.5,
      dc_sweep_stop: 5.5,
      dc_sweep_step: 0.1,
      dc_sweep_unit: "V",
    }),
  ).toSpiceString()

  expect(spiceNetlist).toContain(".PRINT DC V(OUT)")
  expect(spiceNetlist).toContain(".dc Vvin 2.5 5.5 0.1")
})

test("logarithmic AC sweep emits complex-capable probe output", () => {
  const spiceNetlist = circuitJsonToSpice(
    createCircuit({
      type: "simulation_experiment",
      simulation_experiment_id: "ac1",
      name: "frequency response",
      experiment_type: "spice_ac_analysis",
      ac_sweep_type: "decade",
      ac_samples_per_interval: 20,
      ac_start_frequency_hz: 10,
      ac_stop_frequency_hz: 1e6,
    }),
  ).toSpiceString()

  expect(spiceNetlist).toContain(".PRINT AC V(OUT)")
  expect(spiceNetlist).toContain(".ac dec 20 10 1000000")
})

test("linear and octave AC sweeps select their SPICE spacing", () => {
  const linearNetlist = circuitJsonToSpice(
    createCircuit({
      type: "simulation_experiment",
      simulation_experiment_id: "ac_linear",
      name: "linear response",
      experiment_type: "spice_ac_analysis",
      ac_sweep_type: "linear",
      ac_sample_count: 100,
      ac_start_frequency_hz: 10,
      ac_stop_frequency_hz: 1000,
    }),
  ).toSpiceString()
  const octaveNetlist = circuitJsonToSpice(
    createCircuit({
      type: "simulation_experiment",
      simulation_experiment_id: "ac_octave",
      name: "octave response",
      experiment_type: "spice_ac_analysis",
      ac_sweep_type: "octave",
      ac_samples_per_interval: 12,
      ac_start_frequency_hz: 10,
      ac_stop_frequency_hz: 1000,
    }),
  ).toSpiceString()

  expect(linearNetlist).toContain(".ac lin 100 10 1000")
  expect(octaveNetlist).toContain(".ac oct 12 10 1000")
})

test("current sources preserve DC bias and small-signal AC settings", () => {
  const circuitJson = createCircuit({
    type: "simulation_experiment",
    simulation_experiment_id: "ac_current",
    name: "current response",
    experiment_type: "spice_ac_analysis",
    ac_sweep_type: "decade",
    ac_samples_per_interval: 10,
    ac_start_frequency_hz: 1,
    ac_stop_frequency_hz: 1000,
  }).filter((element) => element.type !== "simulation_voltage_source")
  circuitJson.push({
    type: "simulation_current_source",
    simulation_current_source_id: "iin",
    is_dc_source: true,
    positive_source_port_id: "R1_p1",
    negative_source_port_id: "R1_p2",
    current: 0.01,
    ac_magnitude: 0.002,
    ac_phase: 90,
  })

  const spiceNetlist = circuitJsonToSpice(circuitJson).toSpiceString()

  expect(spiceNetlist).toContain("Iiin OUT N1 DC 0.01 AC 0.002 90")
})
