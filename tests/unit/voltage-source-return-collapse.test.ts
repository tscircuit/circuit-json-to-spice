import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

function sourceCircuit({
  stacked,
  explicitGround,
  singleSource = false,
}: {
  stacked: boolean
  explicitGround: boolean
  singleSource?: boolean
}): AnyCircuitElement[] {
  const sourceNames = singleSource ? ["supply"] : ["supply", "offset"]
  const circuitJson: AnyCircuitElement[] = sourceNames.flatMap(
    (name): AnyCircuitElement[] => [
      {
        type: "source_component",
        source_component_id: name,
        name,
        ftype: "simple_voltage_source",
        voltage: name === "supply" ? 5 : 3,
      },
      ...["pos", "neg"].map(
        (terminal, index): AnyCircuitElement => ({
          type: "source_port",
          source_port_id: `${name}_${terminal}`,
          source_component_id: name,
          name: terminal,
          pin_number: index + 1,
        }),
      ),
      {
        type: "simulation_voltage_source",
        simulation_voltage_source_id: name,
        is_dc_source: true,
        positive_source_port_id: `${name}_pos`,
        negative_source_port_id: `${name}_neg`,
        voltage: name === "supply" ? 5 : 3,
      },
    ],
  )
  if (stacked) {
    circuitJson.push({
      type: "source_trace",
      source_trace_id: "midpoint",
      connected_source_port_ids: ["supply_neg", "offset_pos"],
      connected_source_net_ids: [],
    })
  }
  // Even an unnamed return participates in connectivity, as it does in a board.
  for (const name of sourceNames) {
    if (stacked && name === "supply") continue
    circuitJson.push(
      {
        type: "source_net",
        source_net_id: `${name}_return`,
        name: explicitGround && name === "offset" ? "GND" : `${name}_return`,
        member_source_group_ids: [],
      },
      {
        type: "source_trace",
        source_trace_id: `${name}_return_trace`,
        connected_source_port_ids: [`${name}_neg`],
        connected_source_net_ids: [`${name}_return`],
      },
    )
  }
  return circuitJson
}

test.each([true, false])(
  "stacked sources preserve their midpoint (named ground: %s)",
  (explicitGround) => {
    const netlist = circuitJsonToSpice(
      sourceCircuit({ stacked: true, explicitGround }),
    ).toSpiceString()
    const sources = netlist
      .split("\n")
      .filter((line) => /^V/.test(line))
      .map((line) => line.split(/\s+/))
    expect(sources).toHaveLength(2)
    expect(sources[0][2]).toBe(sources[1][1])
    expect(sources[0][2]).not.toBe("0")
    expect(sources[1][2]).toBe("0")
    for (const [, positive, negative] of sources)
      expect(positive).not.toBe(negative)
  },
)

test("unrelated unnamed returns are never silently merged", () => {
  const netlist = circuitJsonToSpice(
    sourceCircuit({ stacked: false, explicitGround: false }),
  ).toSpiceString()
  const returns = netlist
    .split("\n")
    .filter((line) => /^V/.test(line))
    .map((line) => line.split(/\s+/)[2])
  expect(new Set(returns).size).toBe(2)
})

test("one unambiguous unnamed source return remains a usable reference", () => {
  const netlist = circuitJsonToSpice(
    sourceCircuit({
      stacked: false,
      explicitGround: false,
      singleSource: true,
    }),
  ).toSpiceString()
  expect(netlist).toMatch(/^Vsupply N\d+ 0 DC 5$/m)
})

test("snapshots the corrected supply topology", () => {
  expect({
    stackedWithGround: circuitJsonToSpice(
      sourceCircuit({ stacked: true, explicitGround: true }),
    ).toSpiceString(),
    stackedWithoutGround: circuitJsonToSpice(
      sourceCircuit({ stacked: true, explicitGround: false }),
    ).toSpiceString(),
    unrelatedReturns: circuitJsonToSpice(
      sourceCircuit({ stacked: false, explicitGround: false }),
    ).toSpiceString(),
    singleSource: circuitJsonToSpice(
      sourceCircuit({
        stacked: false,
        explicitGround: false,
        singleSource: true,
      }),
    ).toSpiceString(),
  }).toMatchInlineSnapshot(`
    {
      "singleSource": 
    "* Circuit JSON to SPICE Netlist
    Vsupply N1 0 DC 5
    .END"
    ,
      "stackedWithGround": 
    "* Circuit JSON to SPICE Netlist
    Vsupply N2 N1 DC 5
    Voffset N1 0 DC 3
    .END"
    ,
      "stackedWithoutGround": 
    "* Circuit JSON to SPICE Netlist
    Vsupply N2 N1 DC 5
    Voffset N1 0 DC 3
    .END"
    ,
      "unrelatedReturns": 
    "* Circuit JSON to SPICE Netlist
    Vsupply N3 N1 DC 5
    Voffset N4 N2 DC 3
    .END"
    ,
    }
  `)
})
