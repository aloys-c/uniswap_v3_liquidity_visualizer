import { ethers } from 'ethers';
import JSBI from 'jsbi';
import axios from 'axios';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const abi = require('./api.json');

const NON_FONGIBLE_FACTORY_MANAGER = 
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

let provider;

export function connect(provider_url){
    provider = new ethers.providers.JsonRpcProvider(provider_url);
    return provider;
}

async function  get_ids(poolAddress) {

  return axios.post(
    "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    {"query": `{
      pool(id: "${poolAddress}") {
        mints{
          origin
          transaction{
            id
          }
        }
      }
    }`
    },
    {
      headers: {
          "Content-Type": "application/json"
        }
    }).then(async function(result) {

    result = result.data.data.pool.mints;
    let ids = [];
    let logs = [];

    for(let i=0;i<result.length;i++){
      let tx_res = await provider.
        getTransactionReceipt(result[i].transaction.id);
      logs.push(tx_res.logs);
    }

    for(let i=0;i<logs.length;i++){
      for(let k =0;k<logs[i].length;k++){
        if(logs[i][k].address == NON_FONGIBLE_FACTORY_MANAGER){
          ids.push(Number(logs[i][k].topics[3]));
          break;
        }
      }
    }

    let ids_clean = [];
    for(let id of ids){
      if (!isNaN(id))
        ids_clean.push(id);
    }

    return ids_clean;
  })
}

export async function get_positions(poolAddress){

  let positionIds = await get_ids(poolAddress);
  
  let poolContract = new ethers.Contract(
    NON_FONGIBLE_FACTORY_MANAGER,
    abi,
    provider);

  const positionCalls = [];
  for (let id of positionIds) {
    positionCalls.push(
        poolContract.positions(id)
    )
  }


  const callResponses = await Promise.all(positionCalls)

  const positionInfos = callResponses.map((position) => {
    return {
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      liquidity: JSBI.toNumber(JSBI.divide(
        JSBI.BigInt(position.liquidity),
        JSBI.BigInt(10**14)))/10000
    }
  })


  return positionInfos;
}



function main(){
    connect("https://ethereum.publicnode.com");

    let liq_pool = "0x331399c614ca67dee86733e5a2fba40dbb16827c";
    get_positions(liq_pool);
}

