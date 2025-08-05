const { expect } = require("chai");
const { ethers } = require("hardhat");

function hashLeaf(node, amount) {
  return ethers.solidityPackedKeccak256(["address", "uint256"], [node, amount]);
}

function hashPair(a, b) {
  return ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32"],
    BigInt(a) < BigInt(b) ? [a, b] : [b, a]
  );
}

async function registerNode(registry, resolver, nodeSigner, controllerSigner, nodeType = 1, uri = "ipfs://node") {
  // set nodeType resolution
  await resolver.set(nodeType, 8);

  const domain = {
    name: "NodeDIDRegistry",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: registry.target,
  };
  const nonce = await registry.nonces(nodeSigner.address);
  const types = {
    Register: [
      { name: "node", type: "address" },
      { name: "controller", type: "address" },
      { name: "nodeType", type: "uint8" },
      { name: "metadataURI", type: "string" },
      { name: "nonce", type: "uint256" }
    ]
  };
  const value = {
    node: nodeSigner.address,
    controller: controllerSigner.address,
    nodeType,
    metadataURI: uri,
    nonce: await registry.nonces(nodeSigner.address)
  };
  const signature = await nodeSigner.signTypedData(domain, types, value);
  await registry.registerNode(
    nodeSigner.address,
    nodeType,
    controllerSigner.address,
    uri,
    signature
  );
}

describe("GeoRewardManager", function () {
  let token, registry, resolver, manager;
  let admin, oracle, node, controller, other, outsider;
  const epochWindow = 168;

  beforeEach(async function () {
    [admin, oracle, node, controller, other, outsider] = await ethers.getSigners();

    const GeoToken = await ethers.getContractFactory("GeoToken");
    token = await GeoToken.deploy(admin.address, ethers.parseEther("1000000"));

    const MockSensorResolver = await ethers.getContractFactory("MockSensorResolver");
    resolver = await MockSensorResolver.deploy();

    const NodeRegistry = await ethers.getContractFactory("NodeDIDRegistry");
    registry = await NodeRegistry.deploy(admin.address, resolver.target);

    const RewardManager = await ethers.getContractFactory("GeoRewardManager");
    manager = await RewardManager.deploy(admin.address, oracle.address, token.target, registry.target, epochWindow);

    await token.connect(admin).setRewardManager(manager.target);
    await registerNode(registry.connect(admin), resolver, node, controller);
  });

  it("claims with valid Merkle proof and updates claimed state", async function () {
    const amount1 = 100n;
    const amount2 = 40n;
    const leaf1 = hashLeaf(node.address, amount1);
    const leaf2 = hashLeaf(other.address, amount2);
    const root = hashPair(leaf1, leaf2);

    await manager.connect(oracle).publishCycle(1, root, amount1 + amount2);

    const proof = [leaf2];
    expect(await manager.claimed(1, node.address)).to.be.false;

    await expect(manager.connect(controller).claim(1, node.address, amount1, proof))
      .to.emit(manager, "RewardClaimed")
      .withArgs(controller.address, node.address, 1, amount1);

    expect(await token.balanceOf(controller.address)).to.equal(amount1);
    expect(await manager.claimed(1, node.address)).to.be.true;
  });

  it("rejects claim with invalid Merkle proof", async function () {
    const amount1 = 80n;
    const amount2 = 20n;
    const leaf1 = hashLeaf(node.address, amount1);
    const leaf2 = hashLeaf(other.address, amount2);
    const root = hashPair(leaf1, leaf2);

    await manager.connect(oracle).publishCycle(1, root, amount1 + amount2);

    const badProof = [leaf2];
    await expect(
      manager.connect(controller).claim(1, node.address, amount1 + 1n, badProof)
    ).to.be.revertedWithCustomError(manager, "InvalidProof");
  });

  it("prevents double claim", async function () {
    const amount1 = 90n;
    const amount2 = 10n;
    const leaf1 = hashLeaf(node.address, amount1);
    const leaf2 = hashLeaf(other.address, amount2);
    const root = hashPair(leaf1, leaf2);

    await manager.connect(oracle).publishCycle(1, root, amount1 + amount2);

    const proof = [leaf2];
    await manager.connect(controller).claim(1, node.address, amount1, proof);
    await expect(
      manager.connect(controller).claim(1, node.address, amount1, proof)
    ).to.be.revertedWithCustomError(manager, "AlreadyClaimed");
  });

  it("rejects claim for node not included in batch", async function () {
    await registerNode(registry.connect(admin), resolver, other, outsider);
    const amount = 100n;
    const leaf = hashLeaf(node.address, amount);
    await manager.connect(oracle).publishCycle(1, leaf, amount);

    await expect(
      manager.connect(outsider).claim(1, other.address, amount, [])
    ).to.be.revertedWithCustomError(manager, "InvalidProof");
  });

  it("reverts claim for unpublished cycle", async function () {
    const amount = 70n;
    await expect(
      manager.connect(controller).claim(1, node.address, amount, [])
    ).to.be.revertedWithCustomError(manager, "CycleNotPublished");
  });

  it("reverts claim when caller is not controller", async function () {
    const amount = 100n;
    const leaf = hashLeaf(node.address, amount);
    await manager.connect(oracle).publishCycle(1, leaf, amount);

    await expect(
      manager.connect(outsider).claim(1, node.address, amount, [])
    ).to.be.revertedWithCustomError(manager, "NotController");
  });

  it("reverts claim when node is inactive", async function () {
    const amount = 100n;
    const leaf = hashLeaf(node.address, amount);
    await manager.connect(oracle).publishCycle(1, leaf, amount);

    await registry.connect(admin).setNodeActive(node.address, false);

    await expect(
      manager.connect(controller).claim(1, node.address, amount, [])
    ).to.be.revertedWithCustomError(manager, "NodeInactive");
  });

  it("reverts when non-oracle tries to publish cycle", async function () {
    const amount = 100n;
    const leaf = hashLeaf(node.address, amount);

    await expect(
      manager.connect(outsider).publishCycle(1, leaf, amount)
    )
      .to.be.revertedWithCustomError(
        manager,
        "AccessControlUnauthorizedAccount"
      )
      .withArgs(outsider.address, await manager.ORACLE_ROLE());
  });

  it("avoids publishing same cycle twice", async function () {
    const amount = 10n;
    const leaf = hashLeaf(node.address, amount);
    await manager.connect(oracle).publishCycle(1, leaf, amount);
    await expect(manager.connect(oracle).publishCycle(1, leaf, amount))
      .to.be.revertedWithCustomError(manager, "CycleAlreadyExists");
  });

  it("reverts when publishing with zero merkle root", async function () {
    await expect(
      manager.connect(oracle).publishCycle(1, ethers.ZeroHash, 100n)
    ).to.be.revertedWithCustomError(manager, "ZeroRootOrAmount");
  });

  it("reverts when publishing with zero amount", async function () {
    const root = hashLeaf(node.address, 100n);
    await expect(
      manager.connect(oracle).publishCycle(1, root, 0)
    ).to.be.revertedWithCustomError(manager, "ZeroRootOrAmount");
  });

  it("blocks reentrant claim", async function () {
    const ReentrantToken = await ethers.getContractFactory("ReentrantToken");
    const rToken = await ReentrantToken.deploy();

    const RewardManager = await ethers.getContractFactory("GeoRewardManager");
    const rManager = await RewardManager.deploy(
      admin.address,
      oracle.address,
      rToken.target,
      registry.target,
      epochWindow
    );

    await registerNode(registry.connect(admin), resolver, other, { address: rToken.target });

    const amount1 = 100n;
    const amount2 = 50n;
    const leaf1 = hashLeaf(node.address, amount1);
    const leaf2 = hashLeaf(other.address, amount2);
    const root = hashPair(leaf1, leaf2);

    await rManager.connect(oracle).publishCycle(1, root, amount1 + amount2);

    const proof1 = [leaf2];
    const proof2 = [leaf1];
    await rToken.setAttack(rManager.target, 1, other.address, amount2, proof2);

    await expect(
      rManager.connect(controller).claim(1, node.address, amount1, proof1)
    ).to.be.reverted;
  });
});
