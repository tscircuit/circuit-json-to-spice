import { convertSpiceNetlistToString } from "../spice-utils/convertSpiceNetlistToString"
import type { SpiceComponent } from "./SpiceComponent"
import type { SpiceSubcircuit } from "./SpiceSubcircuit"

export class SpiceNetlist {
  title: string
  components: SpiceComponent[]
  nodes: Set<string>
  controls: string[]
  subcircuits: SpiceSubcircuit[]
  models: Map<string, string>
  optionStatements: string[]
  metadataComments: string[]
  analysisCommand: string | null
  printStatements: string[]
  saveStatements: string[]

  constructor(title = "Circuit Netlist") {
    this.title = title
    this.components = []
    this.nodes = new Set()
    this.controls = []
    this.subcircuits = []
    this.models = new Map()
    this.optionStatements = []
    this.metadataComments = []
    this.analysisCommand = null
    this.printStatements = []
    this.saveStatements = []
  }

  addComponent(component: SpiceComponent) {
    this.components.push(component)
    // Add nodes to the set
    for (const node of component.nodes) {
      this.nodes.add(node)
    }
  }

  addSubcircuit(subcircuit: SpiceSubcircuit) {
    if (this.subcircuits.find((s) => s.name === subcircuit.name)) return
    this.subcircuits.push(subcircuit)
  }

  get tranCommand() {
    return this.analysisCommand?.trim().toLowerCase().startsWith(".tran")
      ? this.analysisCommand
      : null
  }

  set tranCommand(tranCommand: string | null) {
    this.analysisCommand = tranCommand
  }

  toSpiceString() {
    return convertSpiceNetlistToString(this)
  }
}
