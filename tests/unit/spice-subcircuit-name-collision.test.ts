import { test, expect } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { renameSpiceSubckt } from "lib/processors/process-simulation-spice-subcircuits"

const switchModel = (selectedThrow: "A" | "B") =>
  `
.subckt SELECTOR c a b
RA c a ${selectedThrow === "A" ? "1m" : "1T"}
RB c b ${selectedThrow === "B" ? "1m" : "1T"}
.ends SELECTOR
`.trim()

const createSelectorElements = (params: {
  componentName: string
  subcircuitSource: string
}): AnyCircuitElement[] => {
  const { componentName, subcircuitSource } = params
  const sourceComponentId = `source_component_${componentName}`
  const pinNames = ["c", "a", "b"]
  return [
    {
      type: "source_component",
      source_component_id: sourceComponentId,
      name: componentName,
      ftype: "simple_chip",
    } as AnyCircuitElement,
    ...pinNames.map(
      (pinName, index) =>
        ({
          type: "source_port",
          source_port_id: `source_port_${componentName}_${pinName}`,
          source_component_id: sourceComponentId,
          name: pinName,
          pin_number: index + 1,
        }) as AnyCircuitElement,
    ),
    ...pinNames.map(
      (pinName) =>
        ({
          type: "source_net",
          source_net_id: `net_${componentName}_${pinName}`,
          name: `${componentName}_${pinName}`,
          member_source_group_ids: [],
        }) as AnyCircuitElement,
    ),
    ...pinNames.map(
      (pinName) =>
        ({
          type: "source_trace",
          source_trace_id: `trace_${componentName}_${pinName}`,
          connected_source_port_ids: [
            `source_port_${componentName}_${pinName}`,
          ],
          connected_source_net_ids: [`net_${componentName}_${pinName}`],
        }) as AnyCircuitElement,
    ),
    {
      type: "simulation_spice_subcircuit",
      simulation_spice_subcircuit_id: `simulation_spice_subcircuit_${componentName}`,
      source_component_id: sourceComponentId,
      spice_pin_to_source_port_map: Object.fromEntries(
        pinNames.map((pinName) => [
          pinName,
          `source_port_${componentName}_${pinName}`,
        ]),
      ),
      subcircuit_source: subcircuitSource,
    } as AnyCircuitElement,
  ]
}

test("different subcircuit sources that share a .subckt name are kept apart", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...createSelectorElements({
      componentName: "SW1",
      subcircuitSource: switchModel("A"),
    }),
    ...createSelectorElements({
      componentName: "SW2",
      subcircuitSource: switchModel("B"),
    }),
    // Same source as SW1: shares SW1's definition instead of adding another
    ...createSelectorElements({
      componentName: "SW3",
      subcircuitSource: switchModel("A"),
    }),
  ]

  const spiceString = circuitJsonToSpice(circuitJson).toSpiceString()

  expect(spiceString).toContain(".subckt SELECTOR c a b\nRA c a 1m\nRB c b 1T")
  expect(spiceString).toContain(
    ".subckt SELECTOR_1 c a b\nRA c a 1T\nRB c b 1m\n.ends SELECTOR_1",
  )
  expect(spiceString.match(/\.subckt /g)).toHaveLength(2)

  const callLines = spiceString
    .split("\n")
    .filter((line) => line.startsWith("Xsimulation_spice_subcircuit_"))
  expect(callLines).toHaveLength(3)
  expect(callLines[0]).toEndWith(" SELECTOR")
  expect(callLines[1]).toEndWith(" SELECTOR_1")
  expect(callLines[2]).toEndWith(" SELECTOR")
})

test("renameSpiceSubckt renames the header and matching .ends only", () => {
  const renamedSource = renameSpiceSubckt({
    subcircuitSource:
      ".SUBCKT AMP inp inn out\nXINNER inp inn out AMP_CORE\n.ENDS AMP",
    currentModelName: "AMP",
    newModelName: "AMP_1",
  })
  expect(renamedSource).toBe(
    ".SUBCKT AMP_1 inp inn out\nXINNER inp inn out AMP_CORE\n.ENDS AMP_1",
  )
})
