import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { renderSpiceSimulation } from "tests/fixtures/render-spice-simulation"

test("a delayed load step preserves its edge times and pulse duration", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <currentsource
        name="I1"
        current="0.5A"
        peakToPeakCurrent="0.5A"
        frequency="1kHz"
        waveShape="square"
        schX={-4}
        connections={{ pin1: "net.GND", pin2: "net.OUT" }}
      />
      <resistor
        name="R1"
        resistance="1"
        schX={3}
        schRotation={90}
        connections={{ pin1: "net.OUT", pin2: "net.GND" }}
      />
      <voltageprobe name="OUT" connectsTo="net.OUT" />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const currentSource = circuitJson.find(
    (element) => element.type === "simulation_current_source",
  )!
  Object.assign(currentSource, {
    pulse_delay: 20,
    rise_time: 0.01,
    fall_time: 0.02,
    pulse_width: 10,
    period: 20,
  })
  const netlist = circuitJsonToSpice(circuitJson)
  netlist.tranCommand = ".tran 10u 60m"
  netlist.printStatements.push(".PRINT TRAN V(OUT)")
  expect(
    await renderSpiceSimulation({
      circuitJson,
      spice: netlist.toSpiceString(),
      name: "0.5 A to 1 A: 20 ms delay, 10 us rise, 20 us fall, 10 ms width, 20 ms period",
    }),
  ).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
