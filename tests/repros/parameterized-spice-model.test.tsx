import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { renderSpiceSimulation } from "tests/fixtures/render-spice-simulation"

test("a three-pin parameterized model driven by 5 V", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <voltagesource
        name="V1"
        voltage="5V"
        schX={-5}
        connections={{ pin1: "net.IN", pin2: "net.GND" }}
      />
      <chip
        name="U1"
        displayName="OUT = 0.4 x IN"
        schX={2}
        pinLabels={{ pin1: "IN", pin2: "OUT", pin3: "GND" }}
        schPinArrangement={{
          leftSide: ["IN"],
          rightSide: ["OUT"],
          bottomSide: ["GND"],
        }}
        connections={{ IN: "net.IN", OUT: "net.OUT", GND: "net.GND" }}
        spiceModel={
          <spicemodel
            source={`.subckt DIVIDER IN OUT GND PARAMS: GAIN=0.4
E1 OUT GND VALUE={GAIN*V(IN,GND)}
.ends DIVIDER`}
          />
        }
      />
      <voltageprobe name="OUT" connectsTo="net.OUT" />
    </board>,
  )
  await circuit.renderUntilSettled()

  const netlist = circuitJsonToSpice(circuit.getCircuitJson())
  netlist.tranCommand = ".tran 10u 1m"
  netlist.printStatements.push(".PRINT TRAN V(OUT)")
  expect(
    await renderSpiceSimulation({
      circuitJson: circuit.getCircuitJson(),
      spice: netlist.toSpiceString(),
      name: "Three pins plus GAIN=0.4: expected OUT = 2 V",
    }),
  ).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
