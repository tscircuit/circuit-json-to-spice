import type { AnyCircuitElement } from "circuit-json"
import { su } from "@tscircuit/soup-util"
import { SpiceComponent } from "../spice-classes/SpiceComponent"
import { ResistorCommand } from "../spice-commands/ResistorCommand"
import { CapacitorCommand } from "../spice-commands/CapacitorCommand"
import { VoltageSourceCommand } from "../spice-commands/VoltageSourceCommand"
import { DiodeCommand } from "../spice-commands/DiodeCommand"
import { InductorCommand } from "../spice-commands/InductorCommand"
import { VoltageControlledSwitchCommand } from "../spice-commands/VoltageControlledSwitchCommand"
import {
  formatCapacitance,
  formatInductance,
  formatResistance,
} from "../spice-utils/valueFormatters"
import { sanitizeIdentifier } from "../spice-utils/identifier"
import { buildSimulationSwitchControlValue } from "../spice-utils/simulationSwitchControl"
import type { SpiceNetlist } from "../spice-classes/SpiceNetlist"
import type { SimulationSwitchLike } from "./types"

interface AddSourceComponentsArgs {
  circuitJson: AnyCircuitElement[]
  nodeMap: Map<string, string>
  netlist: SpiceNetlist
  simulationSwitchMap: Map<string, SimulationSwitchLike>
  sourceComponents: Array<
    {
      type?: string
      ftype?: string
      source_component_id: string
    } & Record<string, unknown>
  >
}

export function addSourceComponentsToNetlist({
  circuitJson,
  nodeMap,
  netlist,
  simulationSwitchMap,
  sourceComponents,
}: AddSourceComponentsArgs) {
  for (const component of sourceComponents) {
    if (component.type !== "source_component") continue

    const componentPorts = su(circuitJson)
      .source_port.list({
        source_component_id: component.source_component_id,
      })
      .sort((a, b) => (a.pin_number ?? 0) - (b.pin_number ?? 0))

    const nodes = componentPorts.map((port) => {
      return nodeMap.get(port.source_port_id) || "0"
    })

    if ("ftype" in component) {
      let spiceComponent: SpiceComponent | null = null

      switch (component.ftype) {
        case "simple_resistor": {
          if ("resistance" in component && "name" in component) {
            const resistorCmd = new ResistorCommand({
              name: component.name as string,
              positiveNode: nodes[0] || "0",
              negativeNode: nodes[1] || "0",
              value: formatResistance(component.resistance as number),
            })
            spiceComponent = new SpiceComponent(
              component.name as string,
              resistorCmd,
              nodes,
            )
          }
          break
        }
        case "simple_switch": {
          const sanitizedBase = sanitizeIdentifier(
            (component.name as string | undefined) ??
              (component.source_component_id as string),
            "SW",
          )
          const positiveNode = nodes[0] || "0"
          const negativeNode = nodes[1] || "0"
          const controlNode = `NCTRL_${sanitizedBase}`
          const modelName = `SW_${sanitizedBase}`

          const componentWithMaybeSwitchId = component as unknown as {
            simulation_switch_id?: string
            name?: string
          }

          const candidateSwitchIds = [
            componentWithMaybeSwitchId.simulation_switch_id,
            component.source_component_id,
            componentWithMaybeSwitchId.name,
          ].filter((id): id is string => Boolean(id))

          let associatedSimulationSwitch: SimulationSwitchLike | undefined
          for (const switchId of candidateSwitchIds) {
            associatedSimulationSwitch = simulationSwitchMap.get(switchId)
            if (associatedSimulationSwitch) break
          }

          const controlValue = buildSimulationSwitchControlValue(
            associatedSimulationSwitch,
          )

          const switchCmd = new VoltageControlledSwitchCommand({
            name: sanitizedBase,
            positiveNode,
            negativeNode,
            positiveControl: controlNode,
            negativeControl: "0",
            model: modelName,
          })

          spiceComponent = new SpiceComponent(sanitizedBase, switchCmd, [
            positiveNode,
            negativeNode,
            controlNode,
            "0",
          ])

          if (!netlist.models.has(modelName)) {
            netlist.models.set(
              modelName,
              `.MODEL ${modelName} SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)`,
            )
          }

          const controlSourceName = `CTRL_${sanitizedBase}`
          const controlSourceCmd = new VoltageSourceCommand({
            name: controlSourceName,
            positiveNode: controlNode,
            negativeNode: "0",
            value: controlValue,
          })

          const controlComponent = new SpiceComponent(
            controlSourceName,
            controlSourceCmd,
            [controlNode, "0"],
          )

          netlist.addComponent(controlComponent)
          break
        }

        case "simple_capacitor": {
          if ("capacitance" in component && "name" in component) {
            const capacitorCmd = new CapacitorCommand({
              name: component.name as string,
              positiveNode: nodes[0] || "0",
              negativeNode: nodes[1] || "0",
              value: formatCapacitance(component.capacitance as number),
            })
            spiceComponent = new SpiceComponent(
              component.name as string,
              capacitorCmd,
              nodes,
            )
          }
          break
        }
        case "simple_diode": {
          if ("name" in component) {
            const componentPortsByName = componentPorts as Array<{
              name?: string | null
              port_hints?: string[] | null
              source_port_id: string
            }>

            const anodePort = componentPortsByName.find(
              (p) =>
                p.name?.toLowerCase() === "anode" ||
                p.port_hints?.includes("anode"),
            )
            const cathodePort = componentPortsByName.find(
              (p) =>
                p.name?.toLowerCase() === "cathode" ||
                p.port_hints?.includes("cathode"),
            )
            const positiveNode =
              nodeMap.get(anodePort?.source_port_id ?? "") || "0"
            const negativeNode =
              nodeMap.get(cathodePort?.source_port_id ?? "") || "0"

            const modelName = "D"
            const diodeCmd = new DiodeCommand({
              name: component.name as string,
              positiveNode,
              negativeNode,
              model: modelName,
            })
            netlist.models.set(modelName, `.MODEL ${modelName} D`)
            spiceComponent = new SpiceComponent(
              component.name as string,
              diodeCmd,
              [positiveNode, negativeNode],
            )
          }
          break
        }
        case "simple_inductor": {
          if ("inductance" in component && "name" in component) {
            const inductorCmd = new InductorCommand({
              name: component.name as string,
              positiveNode: nodes[0] || "0",
              negativeNode: nodes[1] || "0",
              value: formatInductance(component.inductance as number),
            })
            spiceComponent = new SpiceComponent(
              component.name as string,
              inductorCmd,
              nodes,
            )
          }
          break
        }
        case "simple_mosfet": {
          if ("name" in component) {
            const componentPortsByName = componentPorts as Array<{
              name?: string | null
              port_hints?: string[] | null
              source_port_id: string
            }>

            const drainPort = componentPortsByName.find(
              (p) =>
                p.name?.toLowerCase() === "drain" ||
                p.port_hints?.includes("drain"),
            )
            const gatePort = componentPortsByName.find(
              (p) =>
                p.name?.toLowerCase() === "gate" ||
                p.port_hints?.includes("gate"),
            )
            const sourcePort = componentPortsByName.find(
              (p) =>
                p.name?.toLowerCase() === "source" ||
                p.port_hints?.includes("source"),
            )

            const drainNode =
              nodeMap.get(drainPort?.source_port_id ?? "") || "0"
            const gateNode = nodeMap.get(gatePort?.source_port_id ?? "") || "0"
            const sourceNode =
              nodeMap.get(sourcePort?.source_port_id ?? "") || "0"

            const modelName = "SWMOD"
            const switchCmd = new VoltageControlledSwitchCommand({
              name: component.name as string,
              positiveNode: drainNode,
              negativeNode: sourceNode,
              positiveControl: gateNode,
              negativeControl: sourceNode,
              model: modelName,
            })
            netlist.models.set(modelName, `.MODEL ${modelName} SW`)

            spiceComponent = new SpiceComponent(
              component.name as string,
              switchCmd,
              [drainNode, gateNode, sourceNode],
            )
          }
          break
        }
      }

      if (spiceComponent) {
        netlist.addComponent(spiceComponent)
      }
    }
  }
}
