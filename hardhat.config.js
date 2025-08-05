require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { API_KEY, PRIVATE_KEY, POLYGONSCAN_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    // Polygon Amoy testnet
    amoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${API_KEY}`,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 80002,
    },
  },
  etherscan: {
    apiKey: POLYGONSCAN_KEY,
  },
};
