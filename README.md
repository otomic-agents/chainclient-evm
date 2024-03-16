# Otmoic Chainclient Evm

![License](https://img.shields.io/badge/License-Apache2-blue) [![GitHub](https://img.shields.io/badge/Follow-Discord-orange)](https://discord.com/invite/mPcNppqcAd) [![GitHub](https://img.shields.io/badge/Follow-X-orange)](https://twitter.com/otomic_org) ![ethers](https://img.shields.io/badge/ethers-v5.7.1-lightgrey) ![AppVeyor Build](https://img.shields.io/appveyor/build/otmoic/otmoic-chainclient-evm)


## Feature
### Core functions
 - Monitor contract events and send them to relay/lpnode/statistics program after changing your mind.
 - Replace relay/lpnode for contract operations

### Ease of use
 - The program will automatically search for available rpc addresses to avoid instability of a single rpc service and difficulty in operation and maintenance.

### Safe
 - Private keys are managed through secret vault, and the program only holds the private keys in memory, avoiding the risk of losing the private keys.

## Example
### Start local development server
#### 1. Configure environment variables
#### 2. 

    
    ts-node index.ts
    

## Use
### Environment Variables
|Name|Required|Description|
|-|-|-|
|EVM_CLIENT_PORT|✔|the listening port for this service|
|REDIS_HOST|✔|redis service host|
|REDIS_PORT|✔|redis service port|
|REDIS_PASSWORD|✔|redis service password|
|CLEAR_PADDING||if set to **true**, the unfinished transaction queue will be cleared every time it is started. It is recommended not to start this function during normal work and only use it when debugging specific contract methods.|
|RPC_URL||rpc service address. The program itself will obtain the usable rpc address from chainid.network and try to use it in sequence. If it cannot be called normally, the address set by this variable will be used.|
|CONTRACT_ADDRESS|✔|otmoic contract address|
|SYSTEM_CHAIN_ID|✔|the id of each chain in the otmoic system follows the chain code declared in BIP44|
|CHAIN_ID|✔|chain_id used in chains of type ethers|
|START_BLOCK|✔|blockchain height to start monitoring|
|STATUS_KEY||if this variable is set, the running status of the current program will be written to redis regularly, and the key value of the status uses this variable.|
|SERVER_URL_TRANSFER_OUT||the service address of the relay program to receive the TRANSFER_OUT event|
|SERVER_URL_TRANSFER_IN||the service address of the relay program to receive the TRANSFER_IN event|
|SERVER_URL_CONFIRM||the service address of the relay program to receive the CONFIRM event|
|SERVER_URL_REFUNDED||the service address of the relay program to receive the REFUNDED event|
|OS_API_KEY||authentication information when calling system services|
|OS_API_SECRET||authentication information when calling system services|
|OS_SYSTEM_SERVER||system service address|
|AUTO_START||whether to automatically start on-chain data monitoring. If it is false, monitoring will be started after the first monitoring interface registration.|
|RELAY_WALLET||if set to true, the wallet configured with RELAY_WALLET_ADDRESS and RELAY_WALLET_PRIVATE_KEY will be automatically loaded. This wallet is designed to serve as relay and send anti-cheating transactions.|
|RELAY_WALLET_ADDRESS||relay wallet address to send transactions|
|RELAY_WALLET_PRIVATE_KEY||relay wallet private key|
|START_TOP_HEIGHT||start monitoring at the current altitude. if true, START_BLOCK will be ignored|


## History
 - v2.0.0
    - Monitor contract events on the chain and push messages to relay/lpnode/data statistics program
    - Execute contract operations and assist lpnode to complete the swap process
 - v2.1.0
     - Assist relay to complete the anti-cheating function
     - Support re-querying a certain period of historical data
     - Use the **secret vault** provided by the system to store the wallet private key

## Contribution
Thank you for considering contributing to this project! By contributing, you can help this project become better. Here are some guidelines on how to contribute:

- If you find a problem, or want to suggest improvements, please first check to see if similar questions have been raised. If not, you can create a new issue describing the problem you encountered or your suggestion.
- If you want to commit code changes, please fork the repository and create a new branch. Make sure your code style and format adhere to our guidelines and pass unit tests.
- When submitting a pull request, please provide a clear description of what problem your code change solves or what feature it adds.

## License
Apache License Version 2.0

## Contract

- [Discord](https://discord.com/invite/mPcNppqcAd)

- [Otomic X](https://twitter.com/otomic_org)