import { convertSpiceNetlistToString } from "../spice-utils/convertSpiceNetlistToString"

export class SpiceNetlist {
  title?: string

  toString() {
    return convertSpiceNetlistToString(this)
  }
}
