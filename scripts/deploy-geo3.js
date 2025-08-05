// scripts/deploy-geo3.js
// SPDX-License-Identifier: MIT
// Deploy all GEO3 contracts to Polygon Amoy

const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

// ---------- Helpers ---------------------------------------------------------
// Deploys GeoCellIDLib library
async function deployGeoCellIDLib() {
  const lib = await ethers.deployContract("GeoCellIDLib");
  await lib.waitForDeployment();
  const address = await lib.getAddress();
  console.log(`GeoCellIDLib deployed at ${address}`);
  return address;
}

// Deploys GeoDataRegistry linking GeoCellIDLib
async function deployGeoDataRegistry(libAddress, admin) {
  const EPOCH_MIN = 3600; // 1 hour
  const factory = await ethers.getContractFactory("GeoDataRegistry", {
    libraries: { GeoCellIDLib: libAddress },
  });
  const registry = await factory.deploy(admin, admin, admin, EPOCH_MIN);
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`GeoDataRegistry deployed at ${address}`);
  return address;
}

// Deploys NodeDIDRegistry (sensor resolver = GeoDataRegistry)
async function deployNodeDIDRegistry(admin, resolver) {
  const factory = await ethers.getContractFactory("NodeDIDRegistry");
  const registry = await factory.deploy(admin, resolver);
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`NodeDIDRegistry deployed at ${address}`);
  return address;
}

// Deploys GeoToken
async function deployGeoToken(admin) {
  const CAP_SUPPLY = ethers.parseUnits("1000000000", 18); // 1B CGT cap
  const factory = await ethers.getContractFactory("GeoToken");
  const token = await factory.deploy(admin, CAP_SUPPLY);
  await token.waitForDeployment();
  const address = await token.getAddress();
  console.log(`GeoToken deployed at ${address}`);
  return token;
}

// Deploys GeoRewardManager
async function deployRewardManager(admin, oracle, tokenAddr, didAddr) {
  const EPOCH_WINDOW = 168; // 7 days * 24 epochs (1h each)
  const factory = await ethers.getContractFactory("GeoRewardManager");
  const rm = await factory.deploy(
    admin,
    oracle,
    tokenAddr,
    didAddr,
    EPOCH_WINDOW
  );
  await rm.waitForDeployment();
  const address = await rm.getAddress();
  console.log(`GeoRewardManager deployed at ${address}`);
  return address;
}

// ---------- Main orchestrator ----------------------------------------------
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with ${deployer.address}`);

  const libAddr = await deployGeoCellIDLib();
  const geoDataAddr = await deployGeoDataRegistry(libAddr, deployer.address);
  const didAddr = await deployNodeDIDRegistry(deployer.address, geoDataAddr);
  const token = await deployGeoToken(deployer.address);
  const tokenAddr = await token.getAddress();
  const rewardAddr = await deployRewardManager(
    deployer.address,
    deployer.address,
    tokenAddr,
    didAddr
  );

  // allow RewardManager to mint/burn CGT
  await (await token.setRewardManager(rewardAddr)).wait();
  console.log("Reward manager configured on GeoToken");

  // persist addresses
  const addresses = {
    GeoCellIDLib: libAddr,
    GeoDataRegistry: geoDataAddr,
    NodeDIDRegistry: didAddr,
    GeoToken: tokenAddr,
    GeoRewardManager: rewardAddr,
  };
  fs.writeFileSync(
    "deployedAddresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("Contract addresses saved to deployedAddresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
