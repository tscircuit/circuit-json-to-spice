import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { renderSpiceSimulation } from "tests/fixtures/render-spice-simulation"

test("a 0.5 A to 1 A load step retains its DC offset", async () => {
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

  const netlist = circuitJsonToSpice(circuit.getCircuitJson())
  netlist.tranCommand = ".tran 10u 3m"
  netlist.printStatements.push(".PRINT TRAN V(OUT)")
  expect(
    await renderSpiceSimulation({
      circuitJson: circuit.getCircuitJson(),
      spice: netlist.toSpiceString(),
      name: "0.5 A to 1 A through 1 ohm: expected OUT = 0.5 V to 1 V",
    }),
  ).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
