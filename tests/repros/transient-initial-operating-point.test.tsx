import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { renderSpiceSimulation } from "tests/fixtures/render-spice-simulation"

test("an RC transient can request its 5-V initial DC operating point", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <voltagesource
        name="V1"
        voltage="5V"
        schX={-4}
        connections={{ pin1: "net.IN", pin2: "net.GND" }}
      />
      <resistor
        name="R1"
        resistance="1k"
        schX={0}
        connections={{ pin1: "net.IN", pin2: "net.OUT" }}
      />
      <capacitor
        name="C1"
        capacitance="1uF"
        schX={4}
        connections={{ pin1: "net.OUT", pin2: "net.GND" }}
      />
      <voltageprobe name="OUT" connectsTo="net.OUT" />
    </board>,
  )
  await circuit.renderUntilSettled()
  // Keep the requested option in the fixture before Circuit JSON supports it.
  const experiment = {
    type: "simulation_experiment",
    simulation_experiment_id: "simulation_experiment_0",
    name: "5-V RC steady state",
    experiment_type: "spice_transient_analysis",
    time_per_step: 0.01,
    end_time_ms: 1,
    calculate_initial_operating_point: true,
  } as const
  const spice = circuitJsonToSpice([
    ...circuit.getCircuitJson(),
    experiment,
  ]).toSpiceString()

  expect(
    await renderSpiceSimulation({
      circuitJson: circuit.getCircuitJson(),
      spice,
      name: "Requested initial DC operating point: OUT should start at 5 V",
    }),
  ).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
