import type { AnyCircuitElement } from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { su } from "@tscircuit/soup-util"

interface SourcePortLike {
  source_port_id: string
  name?: string | null
}

export function buildNodeMap(
  circuitJson: AnyCircuitElement[],
  sourcePorts: SourcePortLike[],
): Map<string, string> {
  const connMap = getSourcePortConnectivityMapFromCircuitJson(circuitJson)

  const nodeMap = new Map<string, string>()
  const netToNodeName = new Map<string, string>()
  let nodeCounter = 1

  const groundNets = new Set<string>()

  const gndSourceNetIds = new Set(
    su(circuitJson)
      .source_net.list()
      .filter((sn) => sn.name?.toLowerCase().includes("gnd"))
      .map((sn) => sn.source_net_id),
  )

  if (gndSourceNetIds.size > 0) {
    for (const trace of su(circuitJson).source_trace.list()) {
      if (trace.connected_source_port_ids.length > 0) {
        const isOnGndNet = trace.connected_source_net_ids.some((netId) =>
          gndSourceNetIds.has(netId),
        )
        if (isOnGndNet) {
          const aPortOnGnd = trace.connected_source_port_ids[0]
          const gndNet = connMap.getNetConnectedToId(aPortOnGnd)
          if (gndNet) {
            groundNets.add(gndNet)
          }
        }
      }
    }
  }

  const groundPorts = sourcePorts.filter((p) => p.name?.toLowerCase() === "gnd")
  for (const groundPort of groundPorts) {
    const groundNet = connMap.getNetConnectedToId(groundPort.source_port_id)
    if (groundNet) {
      groundNets.add(groundNet)
    }
  }

  for (const simSource of su(circuitJson).simulation_voltage_source.list()) {
    const neg_port_id =
      (simSource as any).negative_source_port_id ??
      (simSource as any).terminal2_source_port_id
    if (neg_port_id) {
      const gnd_net = connMap.getNetConnectedToId(neg_port_id)
      if (gnd_net) {
        groundNets.add(gnd_net)
      }
    }
  }

  for (const groundNet of groundNets) {
    netToNodeName.set(groundNet, "0")
  }

  for (const port of sourcePorts) {
    const portId = port.source_port_id
    const net = connMap.getNetConnectedToId(portId)
    if (net) {
      if (!netToNodeName.has(net)) {
        netToNodeName.set(net, `N${nodeCounter++}`)
      }
      nodeMap.set(portId, netToNodeName.get(net)!)
    }
  }

  for (const port of sourcePorts) {
    const portId = port.source_port_id
    if (!nodeMap.has(portId)) {
      nodeMap.set(portId, `N${nodeCounter++}`)
    }
  }

  return nodeMap
}
