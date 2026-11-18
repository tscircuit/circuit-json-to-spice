import { expect, test } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { Circuit } from "tscircuit"
import { renderSpiceSimulation } from "tests/fixtures/render-spice-simulation"

test("cascaded model libraries retain their own helper subcircuits", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <voltagesource
        name="V1"
        voltage="12V"
        schX={-7}
        connections={{ pin1: "net.IN", pin2: "net.GND" }}
      />
      <chip
        name="U1"
        displayName="12 V to 6 V"
        schX={-2}
        pinLabels={{ pin1: "IN", pin2: "OUT", pin3: "GND" }}
        connections={{ IN: "net.IN", OUT: "net.MID", GND: "net.GND" }}
        spiceModel={
          <spicemodel
            source={`.subckt FIRST_STAGE IN OUT GND
X1 IN OUT GND BUFFER
.ends FIRST_STAGE
.subckt BUFFER IN OUT GND
E1 OUT GND IN GND 0.5
.ends BUFFER`}
          />
        }
      />
      <chip
        name="U2"
        displayName="6 V to 1.5 V"
        schX={4}
        pinLabels={{ pin1: "IN", pin2: "OUT", pin3: "GND" }}
        connections={{ IN: "net.MID", OUT: "net.OUT", GND: "net.GND" }}
        spiceModel={
          <spicemodel
            source={`.subckt SECOND_STAGE IN OUT GND
X1 IN OUT GND BUFFER
.ends SECOND_STAGE
.subckt BUFFER IN OUT GND
E1 OUT GND IN GND 0.25
.ends BUFFER`}
          />
        }
      />
      <voltageprobe name="MID" connectsTo="net.MID" />
      <voltageprobe name="OUT" connectsTo="net.OUT" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const netlist = circuitJsonToSpice(circuit.getCircuitJson())
  netlist.tranCommand = ".tran 1u 2u"
  netlist.printStatements.push(".PRINT TRAN V(MID) V(OUT)")
  expect(
    await renderSpiceSimulation({
      circuitJson: circuit.getCircuitJson(),
      spice: netlist.toSpiceString(),
      name: "Independent libraries: MID = 6 V, OUT should equal 1.5 V",
    }),
  ).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
