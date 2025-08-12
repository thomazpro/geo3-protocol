const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deployFixture() {
  const [admin, controller1, controller2, other] = await ethers.getSigners();

  const MockResolver = await ethers.getContractFactory("MockSensorResolver");
  const resolver = await MockResolver.deploy();
  await resolver.set(1, 8);
  await resolver.set(2, 8);

  const Registry = await ethers.getContractFactory("NodeDIDRegistry");
  const registry = await Registry.deploy(admin.address, resolver.target);

  return { registry, resolver, admin, controller1, controller2, other };
}

describe("NodeDIDRegistry", function () {
  async function signRegister(nodeWallet, registry, controller, nodeType, metadataURI) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = {
      name: "NodeDIDRegistry",
      version: "1",
      chainId,
      verifyingContract: registry.target,
    };
    const nonce = await registry.nonces(nodeWallet.address);
    const types = {
      Register: [
        { name: "node", type: "address" },
        { name: "controller", type: "address" },
        { name: "nodeType", type: "uint8" },
        { name: "metadataURI", type: "string" },
        { name: "nonce", type: "uint256" },
      ],
    };
    const value = {
      node: nodeWallet.address,
      controller,
      nodeType,
      metadataURI,
      nonce,
    };
    return await nodeWallet.signTypedData(domain, types, value);
  }

  describe("registerNode", function () {
    it("registers node with valid signature", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const metadata = "ipfs://cid";
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, metadata);

      await expect(
        registry.registerNode(nodeWallet.address, 1, controller1.address, metadata, sig)
      ).to.emit(registry, "NodeRegistered").withArgs(nodeWallet.address, 1, controller1.address);
      expect(await registry.getController(nodeWallet.address)).to.equal(controller1.address);
      const [controller, active] = await registry.getControllerAndStatus(nodeWallet.address);
      expect(controller).to.equal(controller1.address);
      expect(active).to.equal(true);
      const data = await registry.getNodeData(nodeWallet.address);
      expect(data.nodeType).to.equal(1);
      expect(data.metadataURI).to.equal(metadata);
      expect(data.active).to.equal(true);
      expect(await registry.nonces(nodeWallet.address)).to.equal(1n);
    });

    it("reverts with invalid signature", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "meta");

      await expect(
        registry.registerNode(nodeWallet.address, 1, controller1.address, "different", sig)
      ).to.be.revertedWithCustomError(registry, "InvalidSignature");
    });

    it("reverts if node already registered", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "meta");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "meta", sig);

      await expect(
        registry.registerNode(nodeWallet.address, 1, controller1.address, "meta", sig)
      ).to.be.revertedWithCustomError(registry, "NodeAlreadyRegistered");
    });

    it("reverts when reusing a signature", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const metadata = "ipfs://cid";
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, metadata);

      await registry.registerNode(nodeWallet.address, 1, controller1.address, metadata, sig);

      // reset controllerOf storage to bypass NodeAlreadyRegistered check
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const slot = ethers.keccak256(
        abiCoder.encode(["address", "uint256"], [nodeWallet.address, 3n])
      );
      await ethers.provider.send("hardhat_setStorageAt", [
        registry.target,
        slot,
        "0x" + "00".repeat(32),
      ]);

      await expect(
        registry.registerNode(nodeWallet.address, 1, controller1.address, metadata, sig)
      ).to.be.revertedWithCustomError(registry, "InvalidSignature");
    });

    it("reverts when node address is zero", async function () {
      const { registry, controller1 } = await deployFixture();
      const metadata = "meta";

      await expect(
        registry.registerNode(ethers.ZeroAddress, 1, controller1.address, metadata, "0x")
      ).to.be.revertedWithCustomError(registry, "InvalidNodeAddress");
    });

    it("reverts when controller address is zero", async function () {
      const { registry } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const metadata = "meta";
      const sig = await signRegister(nodeWallet, registry, ethers.ZeroAddress, 1, metadata);

      await expect(
        registry.registerNode(nodeWallet.address, 1, ethers.ZeroAddress, metadata, sig)
      ).to.be.revertedWithCustomError(registry, "InvalidController");
    });

    it("reverts when called by non-manager", async function () {
      const { registry, controller1, other } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const metadata = "m1";
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, metadata);
      const MANAGER_ROLE = await registry.MANAGER_ROLE();
      await expect(
        registry.connect(other).registerNode(nodeWallet.address, 1, controller1.address, metadata, sig)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount").withArgs(other.address, MANAGER_ROLE);
    });

    it("reverts when node type not allowed", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const metadata = "meta";
      const sig = await signRegister(nodeWallet, registry, controller1.address, 3, metadata);

      await expect(
        registry.registerNode(nodeWallet.address, 3, controller1.address, metadata, sig)
      ).to.be.revertedWithCustomError(registry, "NodeTypeNotAllowed");
    });
  });

  describe("registerMultipleNodes", function () {
    it("registers multiple nodes emitting events", async function () {
      const { registry, controller1, controller2 } = await deployFixture();
      const nodeWallet1 = ethers.Wallet.createRandom();
      const nodeWallet2 = ethers.Wallet.createRandom();
      const nodes = [nodeWallet1.address, nodeWallet2.address];
      const types = [1, 2];
      const controllers = [controller1.address, controller2.address];
      const metadata = ["u1", "u2"];
      const sig1 = await signRegister(nodeWallet1, registry, controllers[0], types[0], metadata[0]);
      const sig2 = await signRegister(nodeWallet2, registry, controllers[1], types[1], metadata[1]);
      const signatures = [sig1, sig2];

      const tx = await registry.registerMultipleNodes(nodes, types, controllers, metadata, signatures);

      await expect(tx)
        .to.emit(registry, "NodeRegistered").withArgs(nodes[0], types[0], controllers[0])
        .to.emit(registry, "NodeRegistered").withArgs(nodes[1], types[1], controllers[1]);
      expect(await registry.getController(nodes[0])).to.equal(controllers[0]);
      expect(await registry.isRegistered(nodes[0])).to.equal(true);
      expect(await registry.isRegistered(nodes[1])).to.equal(true);
      expect((await registry.getNodeData(nodes[0])).metadataURI).to.equal(metadata[0]);
    });

    it("reverts when called by non-manager", async function () {
      const { registry, controller1, other } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const nodes = [nodeWallet.address];
      const types = [1];
      const controllers = [controller1.address];
      const metadata = ["u1"];
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, metadata[0]);

      const MANAGER_ROLE = await registry.MANAGER_ROLE();
      await expect(
        registry.connect(other).registerMultipleNodes(nodes, types, controllers, metadata, [sig])
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount").withArgs(other.address, MANAGER_ROLE);
    });

    it("reverts if arrays have different lengths", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const nodes = [nodeWallet.address];
      const types = [1, 2];
      const controllers = [controller1.address];
      const metadata = ["u1"];
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, metadata[0]);

      await expect(
        registry.registerMultipleNodes(nodes, types, controllers, metadata, [sig])
      ).to.be.revertedWithCustomError(registry, "ArrayLengthMismatch");
    });

    it("reverts if any node already registered", async function () {
      const { registry, controller1, controller2 } = await deployFixture();
      const node1 = ethers.Wallet.createRandom();
      const sig1 = await signRegister(node1, registry, controller1.address, 1, "m1");
      await registry.registerNode(node1.address, 1, controller1.address, "m1", sig1);

      const node2 = ethers.Wallet.createRandom();
      const nodes = [node1.address, node2.address];
      const types = [1, 2];
      const controllers = [controller1.address, controller2.address];
      const metadata = ["m1", "m2"];
      const sig2 = await signRegister(node2, registry, controllers[1], types[1], metadata[1]);
      const signatures = [sig1, sig2];

      await expect(
        registry.registerMultipleNodes(nodes, types, controllers, metadata, signatures)
      ).to.be.revertedWithCustomError(registry, "NodeAlreadyRegistered");
    });

    it("reverts if any node is the zero address", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const nodes = [ethers.ZeroAddress, nodeWallet.address];
      const types = [1, 1];
      const controllers = [controller1.address, controller1.address];
      const metadata = ["m0", "m1"];
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, metadata[1]);
      const signatures = ["0x", sig];

      await expect(
        registry.registerMultipleNodes(nodes, types, controllers, metadata, signatures)
      ).to.be.revertedWithCustomError(registry, "InvalidNodeAddress");
    });
  });

  describe("changeController", function () {
    it("allows current controller to change controller", async function () {
      const { registry, controller1, controller2 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "m1");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "m1", sig);

      await expect(
        registry
          .connect(controller1)
          .changeController(nodeWallet.address, controller2.address)
      )
        .to.emit(registry, "ControllerChanged")
        .withArgs(nodeWallet.address, controller2.address);

      expect(await registry.getController(nodeWallet.address)).to.equal(
        controller2.address
      );
    });

    it("allows manager to change controller", async function () {
      const { registry, controller1, controller2, admin } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "m1");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "m1", sig);

      await expect(
        registry
          .connect(admin)
          .changeController(nodeWallet.address, controller2.address)
      )
        .to.emit(registry, "ControllerChanged")
        .withArgs(nodeWallet.address, controller2.address);

      expect(await registry.getController(nodeWallet.address)).to.equal(
        controller2.address
      );
    });

    it("reverts when called by non-controller non-manager", async function () {
      const { registry, controller1, controller2, other } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "m1");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "m1", sig);

      await expect(
        registry
          .connect(other)
          .changeController(nodeWallet.address, controller2.address)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts when new controller is zero address", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "m1");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "m1", sig);

      await expect(
        registry
          .connect(controller1)
          .changeController(nodeWallet.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidController");
    });

    it("reverts when node is not registered", async function () {
      const { registry, controller1, admin } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();

      await expect(
        registry
          .connect(admin)
          .changeController(nodeWallet.address, controller1.address)
      ).to.be.revertedWithCustomError(registry, "NodeNotRegistered");
    });
  });

  describe("updateMetadataURI", function () {
    it("allows controller to update metadataURI", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const metadata = "m1";
      const sig = await signRegister(
        nodeWallet,
        registry,
        controller1.address,
        1,
        metadata
      );
      await registry.registerNode(
        nodeWallet.address,
        1,
        controller1.address,
        metadata,
        sig
      );

      const newURI = "m2";
      await expect(
        registry
          .connect(controller1)
          .updateMetadataURI(nodeWallet.address, newURI)
      )
        .to.emit(registry, "MetadataURIUpdated")
        .withArgs(nodeWallet.address, newURI);

      expect((await registry.getNodeData(nodeWallet.address)).metadataURI).to.equal(
        newURI
      );
    });

    it("allows manager to update metadataURI", async function () {
      const { registry, controller1, admin } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const metadata = "m1";
      const sig = await signRegister(
        nodeWallet,
        registry,
        controller1.address,
        1,
        metadata
      );
      await registry.registerNode(
        nodeWallet.address,
        1,
        controller1.address,
        metadata,
        sig
      );

      const newURI = "m2";
      await expect(
        registry.connect(admin).updateMetadataURI(nodeWallet.address, newURI)
      )
        .to.emit(registry, "MetadataURIUpdated")
        .withArgs(nodeWallet.address, newURI);

      expect((await registry.getNodeData(nodeWallet.address)).metadataURI).to.equal(
        newURI
      );
    });

    it("reverts when called by non-controller non-manager", async function () {
      const { registry, controller1, other } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "m1");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "m1", sig);

      await expect(
        registry.connect(other).updateMetadataURI(nodeWallet.address, "m2")
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts when node is not registered", async function () {
      const { registry, admin } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();

      await expect(
        registry.connect(admin).updateMetadataURI(nodeWallet.address, "m1")
      ).to.be.revertedWithCustomError(registry, "NodeNotRegistered");
    });
  });

  describe("setNodeActive", function () {
    it("allows manager to toggle node status", async function () {
      const { registry, controller1, admin } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "m1");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "m1", sig);

      await expect(
        registry.connect(admin).setNodeActive(nodeWallet.address, false)
      )
        .to.emit(registry, "NodeStatusChanged")
        .withArgs(nodeWallet.address, false);
      expect((await registry.getNodeData(nodeWallet.address)).active).to.equal(
        false
      );

      await expect(
        registry.connect(admin).setNodeActive(nodeWallet.address, true)
      )
        .to.emit(registry, "NodeStatusChanged")
        .withArgs(nodeWallet.address, true);
      expect((await registry.getNodeData(nodeWallet.address)).active).to.equal(true);
    });

    it("reverts when called by non-manager", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "m1");
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "m1", sig);

      const MANAGER_ROLE = await registry.MANAGER_ROLE();
      await expect(
        registry.connect(controller1).setNodeActive(nodeWallet.address, false)
      )
        .to.be.revertedWithCustomError(
          registry,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(controller1.address, MANAGER_ROLE);
    });

    it("reverts when node is not registered", async function () {
      const { registry, admin } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();

      await expect(
        registry.connect(admin).setNodeActive(nodeWallet.address, true)
      ).to.be.revertedWithCustomError(registry, "NodeNotRegistered");
    });
  });

  describe("isRegistered", function () {
    it("returns correct status for registered and unregistered nodes", async function () {
      const { registry, controller1 } = await deployFixture();
      const nodeWallet = ethers.Wallet.createRandom();
      const sig = await signRegister(nodeWallet, registry, controller1.address, 1, "meta");

      expect(await registry.isRegistered(nodeWallet.address)).to.equal(false);
      await registry.registerNode(nodeWallet.address, 1, controller1.address, "meta", sig);
      expect(await registry.isRegistered(nodeWallet.address)).to.equal(true);
      expect(await registry.isRegistered(controller1.address)).to.equal(false);
    });

    it("recognizes nodes registered via batch", async function () {
      const { registry, controller1, controller2 } = await deployFixture();
      const node1 = ethers.Wallet.createRandom();
      const node2 = ethers.Wallet.createRandom();
      const metadata = ["m1", "m2"];
      const sig1 = await signRegister(node1, registry, controller1.address, 1, metadata[0]);
      const sig2 = await signRegister(node2, registry, controller2.address, 2, metadata[1]);
      await registry.registerMultipleNodes(
        [node1.address, node2.address],
        [1, 2],
        [controller1.address, controller2.address],
        metadata,
        [sig1, sig2]
      );

      expect(await registry.isRegistered(node1.address)).to.equal(true);
      expect(await registry.isRegistered(node2.address)).to.equal(true);
    });
  });
});
