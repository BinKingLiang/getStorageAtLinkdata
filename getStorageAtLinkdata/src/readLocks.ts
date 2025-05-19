import { createPublicClient, custom, keccak256, toBytes, decodeAbiParameters, Hex, toHex } from 'viem'
import { sepolia } from 'viem/chains'
import fetch from 'cross-fetch'
import { writeFileSync } from 'fs'

const CONTRACT_ADDRESS = '0x483742eCCDC6Bf81f534F09Db80bfb867e2AFCab'
const LOCKS_SLOT = 2n // _locks数组的存储slot

interface LockInfo {
  user: string
  startTime: bigint
  amount: bigint
}

// 计算数组元素存储位置
function getArrayElementSlot(arraySlot: bigint, index: bigint): bigint {
  return BigInt(keccak256(toBytes(arraySlot))) + index * 2n
}

export async function readLocks() {
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

  // 1. 读取数组长度
    const lengthHex = await client.getStorageAt({
      address: CONTRACT_ADDRESS,
      slot: toHex(LOCKS_SLOT)
    })
    const length: bigint = lengthHex ? decodeAbiParameters([{ type: 'uint256' }], lengthHex as Hex)[0] : 0n

  console.log(`Found ${length} locks in the array`)

  // 2. 读取每个元素
  const locks: LockInfo[] = []
  for (let i: bigint = 0n; i < length; i = i + 1n) {
    const slot1: bigint = getArrayElementSlot(LOCKS_SLOT, i)
    const slot2: bigint = slot1 + 1n

    const storageData = await Promise.all([
      client.getStorageAt({ address: CONTRACT_ADDRESS, slot: toHex(slot1) }),
      client.getStorageAt({ address: CONTRACT_ADDRESS, slot: toHex(slot2) })
    ])
    const [data1, data2] = storageData.map(d => d || '0x0') as [Hex, Hex]

    if (!data1 || !data2) continue

    // 解析slot1: 包含user(address)和startTime(uint64)
    const user = `0x${data1.slice(26)}` // address是最后20字节
    const startTime = decodeAbiParameters([{ type: 'uint64' }], `0x${data1.slice(2, 18).padStart(16, '0')}`)[0] // uint64是前8字节

    // 解析slot2: amount(uint256)
    const amount = data2 ? decodeAbiParameters([{ type: 'uint256' }], data2)[0] : 0n

    const logEntry = `locks[${i}]: user:${user}, startTime:${startTime}, amount:${amount}`
    locks.push({ user, startTime, amount })
    console.log(logEntry)
    writeFileSync('log.txt', logEntry + '\n', { flag: 'a' })
  }

  return locks
}

// 执行读取
readLocks().catch(err => {
  console.error(err)
  writeFileSync('log.txt', `Error: ${err.message}\n`, { flag: 'a' })
})
