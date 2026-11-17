import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"

test("a parameterized SPICE model connects only its three pins", async () => {
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

  const spice = circuitJsonToSpice(circuit.getCircuitJson()).toSpiceString()
  expect(
    convertCircuitJsonToSchematicSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(spice).toContain("PARAMS: GAIN=0.4")
  expect(spice).toMatch(/^X\S+ \S+ OUT 0 DIVIDER$/m)
})
