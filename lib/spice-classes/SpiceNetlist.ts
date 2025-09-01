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

  constructor(title = "Circuit Netlist") {
    this.title = title
    this.components = []
    this.nodes = new Set()
    this.controls = []
    this.subcircuits = []
    this.models = new Map()
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

  toSpiceString() {
    return convertSpiceNetlistToString(this)
  }
}
