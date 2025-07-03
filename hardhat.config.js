require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    amoy: {
      url: process.env.RPC_URL_AMOY,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 80002
    }
  },
  etherscan: {
    apiKey: "YOUR_POLYGONSCAN_KEY" // opcional se for verificar contratos
  }
};
