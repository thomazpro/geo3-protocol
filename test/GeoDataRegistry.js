const { expect } = require("chai");
const { ethers } = require("hardhat");

function buildGeoId(level, baseCell, digits = [], header = 0) {
  let id = BigInt(header) << 56n;
  id |= BigInt(level) << 8n;
  id |= BigInt(baseCell) << 12n;
  for (let i = 0; i < digits.length; i++) {
    id |= BigInt(digits[i]) << BigInt(19 + i * 3);
  }
  return id;
}

async function deployFixture() {
  const [admin, oracle, manager, other] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("GeoDataRegistry");
  const registry = await Registry.deploy(admin.address, oracle.address, manager.address, 60, 7);
  return { registry, admin, oracle, manager, other };
}

describe("GeoDataRegistry", function () {
  it("registers a new geoBatch and stores metadata", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root = ethers.keccak256(ethers.toUtf8Bytes("batch1"));
    const epoch = await registry.currentEpoch();
    await expect(registry.connect(oracle).registerGeoBatch(epoch, geoId, root, "cid1"))
      .to.emit(registry, "GeoBatchRegistered")
      .withArgs(epoch, geoId, root, "cid1", 6);

    const viewData = await registry.getGeoBatch(epoch, geoId);
    expect(viewData.merkleRoot).to.equal(root);
    expect(viewData.dataCID).to.equal("cid1");

    const mappingData = await registry.geoBatches(epoch, geoId);
    expect(mappingData.merkleRoot).to.equal(root);
    expect(mappingData.dataCID).to.equal("cid1");
  });

  it("reverts when merkle root is zero", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const epoch = await registry.currentEpoch();
    await expect(
      registry.connect(oracle).registerGeoBatch(epoch, geoId, ethers.ZeroHash, "cid")
    ).to.be.revertedWithCustomError(registry, "EmptyRoot");
  });

  it("reverts when data CID is empty", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root = ethers.keccak256(ethers.toUtf8Bytes("batch"));
    const epoch = await registry.currentEpoch();
    await expect(
      registry.connect(oracle).registerGeoBatch(epoch, geoId, root, "")
    ).to.be.revertedWithCustomError(registry, "EmptyCID");

    const stored = await registry.geoBatches(epoch, geoId);
    expect(stored.merkleRoot).to.equal(ethers.ZeroHash);
    expect(stored.dataCID).to.equal("");
  });

  it("prevents overwriting existing batches", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root1 = ethers.keccak256(ethers.toUtf8Bytes("batch1"));
    const epoch = await registry.currentEpoch();
    await registry.connect(oracle).registerGeoBatch(epoch, geoId, root1, "cid1");

    const root2 = ethers.keccak256(ethers.toUtf8Bytes("batch2"));
    await expect(registry.connect(oracle).registerGeoBatch(epoch, geoId, root2, "cid2"))
      .to.be.revertedWithCustomError(registry, "GeoBatchAlreadyRegistered");

    const stored = await registry.getGeoBatch(epoch, geoId);
    expect(stored.merkleRoot).to.equal(root1);
    expect(stored.dataCID).to.equal("cid1");
  });

  it("isolates nested mapping per epoch", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId1 = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root1 = ethers.keccak256(ethers.toUtf8Bytes("batch1"));
    let epoch = await registry.currentEpoch();
    await registry.connect(oracle).registerGeoBatch(epoch, geoId1, root1, "cid1");

    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine");

    const geoId2 = buildGeoId(6, 43, [1,2,3,4,5,6]);
    const root2 = ethers.keccak256(ethers.toUtf8Bytes("batch2"));
    epoch = await registry.currentEpoch();
    await registry.connect(oracle).registerGeoBatch(epoch, geoId2, root2, "cid2");

    const epoch0 = await registry.geoBatches(0, geoId1);
    const epoch1 = await registry.geoBatches(1, geoId1);
    const epoch1Batch2 = await registry.geoBatches(1, geoId2);
    expect(epoch0.merkleRoot).to.equal(root1);
    expect(epoch1.merkleRoot).to.equal(ethers.ZeroHash);
    expect(epoch1Batch2.merkleRoot).to.equal(root2);
  });

  it("restricts registration to oracles", async function () {
    const { registry, other } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root = ethers.keccak256(ethers.toUtf8Bytes("batch"));
    const epoch = await registry.currentEpoch();
    const ORACLE_ROLE = await registry.ORACLE_ROLE();
    await expect(
      registry.connect(other).registerGeoBatch(epoch, geoId, root, "cid")
    ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, ORACLE_ROLE);
  });

  it("allows admin to add an oracle", async function () {
    const { registry, admin, other } = await deployFixture();
    await expect(registry.connect(admin).addOracle(other.address))
      .to.emit(registry, "OracleAdded")
      .withArgs(other.address);
    const ORACLE_ROLE = await registry.ORACLE_ROLE();
    expect(await registry.hasRole(ORACLE_ROLE, other.address)).to.be.true;
  });

  it("reverts addOracle when called by non-admin", async function () {
    const { registry, other, manager } = await deployFixture();
    const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
    await expect(
      registry.connect(other).addOracle(manager.address)
    ).to.be.revertedWithCustomError(
      registry,
      "AccessControlUnauthorizedAccount"
    ).withArgs(other.address, DEFAULT_ADMIN_ROLE);
  });

  it("allows admin to remove an oracle", async function () {
    const { registry, admin, oracle } = await deployFixture();
    const ORACLE_ROLE = await registry.ORACLE_ROLE();
    expect(await registry.hasRole(ORACLE_ROLE, oracle.address)).to.be.true;
    await expect(registry.connect(admin).removeOracle(oracle.address))
      .to.emit(registry, "OracleRemoved")
      .withArgs(oracle.address);
    expect(await registry.hasRole(ORACLE_ROLE, oracle.address)).to.be.false;
  });

  it("reverts removeOracle when called by non-admin", async function () {
    const { registry, other, oracle } = await deployFixture();
    const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
    await expect(
      registry.connect(other).removeOracle(oracle.address)
    ).to.be.revertedWithCustomError(
      registry,
      "AccessControlUnauthorizedAccount"
    ).withArgs(other.address, DEFAULT_ADMIN_ROLE);
  });

  it("supports bulk registration", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId1 = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const geoId2 = buildGeoId(6, 43, [1,2,3,4,5,6]);
    const roots = [
      ethers.keccak256(ethers.toUtf8Bytes("batch1")),
      ethers.keccak256(ethers.toUtf8Bytes("batch2"))
    ];
    const cids = ["cid1", "cid2"];
    const epoch = await registry.currentEpoch();

    await expect(registry.connect(oracle).registerGeoBatchBulk(epoch, [geoId1, geoId2], roots, cids))
      .to.emit(registry, "GeoBatchRegistered")
        .withArgs(epoch, geoId1, roots[0], "cid1", 6)
      .to.emit(registry, "GeoBatchRegistered")
        .withArgs(epoch, geoId2, roots[1], "cid2", 6);
  });

  it("reverts when bulk arrays have different lengths", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId1 = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const roots = [
      ethers.keccak256(ethers.toUtf8Bytes("batch1")),
      ethers.keccak256(ethers.toUtf8Bytes("batch2"))
    ];
    const epoch = await registry.currentEpoch();
    await expect(
      registry
        .connect(oracle)
        .registerGeoBatchBulk(epoch, [geoId1], roots, ["cid1"])
    ).to.be.revertedWithCustomError(registry, "ArrayLengthMismatch");
  });

  it("sets sensor type and enforces resolution limits", async function () {
    const { registry, oracle, manager } = await deployFixture();
    await expect(registry.connect(manager).setSensorType(1, 6))
      .to.emit(registry, "SensorTypeSet")
      .withArgs(1, 6);

    const root = ethers.keccak256(ethers.toUtf8Bytes("batch"));
    const geoIdAllowed = buildGeoId(6, 42, [1,2,3,4,5,6], 1);
    const epoch = await registry.currentEpoch();
    await expect(
      registry.connect(oracle).registerGeoBatch(epoch, geoIdAllowed, root, "cid")
    )
      .to.emit(registry, "GeoBatchRegistered")
      .withArgs(epoch, geoIdAllowed, root, "cid", 6);

    const geoIdTooHigh = buildGeoId(7, 42, [1,2,3,4,5,6,7], 1);
    await expect(
      registry.connect(oracle).registerGeoBatch(epoch, geoIdTooHigh, root, "cid")
    ).to.be.revertedWithCustomError(registry, "SensorResolutionExceeded");
  });

  it("reverts registration when paused", async function () {
    const { registry, oracle, manager } = await deployFixture();
    await expect(registry.connect(manager).pause())
      .to.emit(registry, "Paused")
      .withArgs(manager.address);

    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root = ethers.keccak256(ethers.toUtf8Bytes("batch"));
    const epoch = await registry.currentEpoch();
    await expect(
      registry.connect(oracle).registerGeoBatch(epoch, geoId, root, "cid")
    ).to.be.revertedWithCustomError(registry, "EnforcedPause");
  });

  it("reverts when setting epoch interval to zero", async function () {
    const { registry, manager } = await deployFixture();
    await expect(
      registry.connect(manager).setEpochMinInterval(0)
    ).to.be.revertedWith("interval zero");
  });

  it("verifies a leaf in a registered batch", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);

    const leaf1 = ethers.keccak256(ethers.toUtf8Bytes("leaf1"));
    const leaf2 = ethers.keccak256(ethers.toUtf8Bytes("leaf2"));
    const root = ethers.keccak256(
      leaf1 < leaf2
        ? ethers.solidityPacked(["bytes32","bytes32"], [leaf1, leaf2])
        : ethers.solidityPacked(["bytes32","bytes32"], [leaf2, leaf1])
    );

    const epoch = await registry.currentEpoch();
    await registry.connect(oracle).registerGeoBatch(epoch, geoId, root, "cid");

    const proof = [leaf2];
    expect(await registry.verifyLeafInBatch(epoch, geoId, leaf1, proof)).to.be.true;
  });

  it("allows registering within tolerated delay", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root = ethers.keccak256(ethers.toUtf8Bytes("delayed"));

    // advance 5 epochs (interval 60s)
    await ethers.provider.send("evm_increaseTime", [60 * 5]);
    await ethers.provider.send("evm_mine");

    const epoch = 0; // register for epoch 0 after delay 5 < 7
    await expect(
      registry.connect(oracle).registerGeoBatch(epoch, geoId, root, "cid")
    ).to.emit(registry, "GeoBatchRegistered");
  });

  it("reverts when registering beyond tolerated delay", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root = ethers.keccak256(ethers.toUtf8Bytes("too-old"));

    // advance 8 epochs
    await ethers.provider.send("evm_increaseTime", [60 * 8]);
    await ethers.provider.send("evm_mine");

    await expect(
      registry.connect(oracle).registerGeoBatch(0, geoId, root, "cid")
    ).to.be.revertedWithCustomError(registry, "EpochTooOld");
  });

  it("reverts when registering for future epoch", async function () {
    const { registry, oracle } = await deployFixture();
    const geoId = buildGeoId(6, 42, [1,2,3,4,5,6]);
    const root = ethers.keccak256(ethers.toUtf8Bytes("future"));
    const futureEpoch = (await registry.currentEpoch()) + 1n; // BigInt
    await expect(
      registry.connect(oracle).registerGeoBatch(Number(futureEpoch), geoId, root, "cid")
    ).to.be.revertedWithCustomError(registry, "EpochInFuture");
  });
});

