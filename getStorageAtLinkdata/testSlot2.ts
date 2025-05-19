import { createPublicClient, custom, toHex } from 'viem'
import { sepolia } from 'viem/chains'
import fetch from 'cross-fetch'

async function checkSlot() {
  const client = createPublicClient({
    chain: sepolia,
    transport: custom({
      async request({ method, params }) {
        const response = await fetch('https://sepolia.era.zksync.dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
        })
        const json = await response.json()
        return json.result
      }
    })
  })

  const result = await client.getStorageAt({
    address: '0x483742eCCDC6Bf81f534F09Db80bfb867e2AFCab',
    slot: toHex(2n)
  })
  console.log('Slot 2 value:', result)
}

checkSlot().catch(console.error)
