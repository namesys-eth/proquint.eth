import { createTestClient, http } from 'viem'
import { foundry } from 'viem/chains'

export const testClient = createTestClient({
  chain: foundry,
  mode: 'anvil',
  transport: http(), 
})

/*
async function rpcFetch(addr, data) {
	console.log(addr, data)
	return fetch("http://127.0.0.1:8545/", {
		body: JSON.stringify({
			"jsonrpc": "2.0",
			"method": "eth_call",
			"params": [{
				"to": addr,
				"data": data
			}, "latest"],
			"id": (Date.now() / 1000)|0
		}),
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		}
	}).then((res) => {
		if (res && res.ok) {
			let contentType = res.headers.get('content-type') || ''
			if (contentType.includes('application/json')) {
				return res.json()
			}
		}
		return {
			error: {
				code: res.status,
				message: res.statusText ? res.statusText : "Expected JSON Content"
			}
		}
	}).catch(console.error)
}

rpcFetch("0x5fbdb2315678afecb367f032d93f642f64180aa3", "0x8b9087d9"+"0".padEnd(56, "0")+"ffffffff"+"0".padEnd(62, "0")+"2d").then(console.log)
*/
//8b9087d9  =>  encode(bytes4,bytes1)
//49145c91  =>  decode(string)
//0x8b9087d9
//00000000000000000000000000000000
//000000000000000000000000ffffffff
//00000000000000000000000000000000
//0000000000000000000000000000002d