// scripts/deploy-geo3.js
// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const CAP_SUPPLY = ethers.parseUnits("1000000000", 18); // 1 B CGT
  const EPOCH_MIN  = 3600;   // 1 h
  const EPOCH_WIN  = 168;    // 7 d * 24 epochs

  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  /* 0. Biblioteca (opcional, não será linkada) */
  const GeoCellIDLib = await ethers.deployContract("GeoCellIDLib");
  await GeoCellIDLib.waitForDeployment();
  console.log("GeoCellIDLib:", await GeoCellIDLib.getAddress());

  /* 1. GeoToken */
  const GeoToken = await ethers.getContractFactory("GeoToken");
  const cgt = await GeoToken.deploy(deployer.address, CAP_SUPPLY);
  await cgt.waitForDeployment();
  console.log("GeoToken:", await cgt.getAddress());

  /* 2. NodeDIDRegistry */
  const NodeDID = await ethers.getContractFactory("NodeDIDRegistry");
  const did = await NodeDID.deploy(deployer.address, await cgt.getAddress());
  await did.waitForDeployment();
  console.log("NodeDIDRegistry:", await did.getAddress());

  /* 3. GeoDataRegistry (SEM objeto libraries) */
  const GeoData = await ethers.getContractFactory("GeoDataRegistry");
  const geoData = await GeoData.deploy(
    deployer.address,
    deployer.address,
    deployer.address,
    EPOCH_MIN
  );
  await geoData.waitForDeployment();
  console.log("GeoDataRegistry:", await geoData.getAddress());

  /* 4. GeoRewardManager */
  const Reward = await ethers.getContractFactory("GeoRewardManager");
  const reward = await Reward.deploy(
    deployer.address,
    deployer.address,
    await cgt.getAddress(),
    await did.getAddress(),
    EPOCH_WIN
  );
  await reward.waitForDeployment();
  console.log("GeoRewardManager:", await reward.getAddress());

  /* 5. Grant MINTER_ROLE ao RewardManager */
  const MINTER_ROLE = await cgt.MINTER_ROLE();
  await (await cgt.grantRole(MINTER_ROLE, await reward.getAddress())).wait();
  console.log("MINTER_ROLE granted to RewardManager ✅");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
