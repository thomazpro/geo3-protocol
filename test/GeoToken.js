const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("GeoToken", function () {
  async function deployTokenFixture() {
    const [admin, rewardManager, newRewardManager] = await ethers.getSigners();
    const cap = ethers.parseEther("1000");
    const GeoToken = await ethers.getContractFactory("GeoToken");
    const token = await GeoToken.deploy(admin.address, cap);
    return { token, admin, rewardManager, newRewardManager };
  }

  describe("setRewardManager", function () {
    it("emits RewardManagerSet event", async function () {
      const { token, admin, rewardManager } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(admin).setRewardManager(rewardManager.address)
      )
        .to.emit(token, "RewardManagerSet")
        .withArgs(rewardManager.address);
    });

    it("reverts for zero address", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(admin).setRewardManager(ethers.ZeroAddress)
      ).to.be.revertedWith("reward manager zero");
    });

    it("reverts when caller lacks DEFAULT_ADMIN_ROLE", async function () {
      const { token, rewardManager } = await loadFixture(deployTokenFixture);
      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      await expect(
        token.connect(rewardManager).setRewardManager(rewardManager.address)
      )
        .to.be.revertedWithCustomError(
          token,
          "AccessControlUnauthorizedAccount"
        )
        .withArgs(rewardManager.address, DEFAULT_ADMIN_ROLE);
    });

    it("assigns and revokes roles", async function () {
      const { token, admin, rewardManager, newRewardManager } = await loadFixture(
        deployTokenFixture
      );

      const MINTER_ROLE = await token.MINTER_ROLE();
      const BURNER_ROLE = await token.BURNER_ROLE();

      await token.connect(admin).setRewardManager(rewardManager.address);

      expect(await token.hasRole(MINTER_ROLE, rewardManager.address)).to.equal(
        true
      );
      expect(await token.hasRole(BURNER_ROLE, rewardManager.address)).to.equal(
        false
      );

      await token.connect(admin).setRewardManager(newRewardManager.address);

      expect(await token.hasRole(MINTER_ROLE, rewardManager.address)).to.equal(
        false
      );
      expect(await token.hasRole(BURNER_ROLE, rewardManager.address)).to.equal(
        false
      );
      expect(
        await token.hasRole(MINTER_ROLE, newRewardManager.address)
      ).to.equal(true);
      expect(
        await token.hasRole(BURNER_ROLE, newRewardManager.address)
      ).to.equal(false);
    });
  });
});

async function deployToken() {
  const [admin, rewardManager, user1, user2, other] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("GeoToken");
  const cap = ethers.parseUnits("1000", 18);
  const token = await Token.deploy(admin.address, cap);
  return { token, admin, rewardManager, user1, user2, other, cap };
}

async function deployWithRewardManager() {
  const ctx = await deployToken();
  await ctx.token.connect(ctx.admin).setRewardManager(ctx.rewardManager.address);
  return ctx;
}

describe("GeoToken", function () {
  it("has correct name, symbol and decimals", async function () {
    const { token } = await deployToken();
    expect(await token.name()).to.equal("Carbon Guard Token");
    expect(await token.symbol()).to.equal("CGT");
    expect(await token.decimals()).to.equal(18);
  });

  it("allows only reward manager to mint and updates totalSupply", async function () {
    const { token, rewardManager, user1, other } = await deployWithRewardManager();
    const amount = 100n;
    await expect(token.connect(rewardManager).mint(user1.address, amount))
      .to.emit(token, "Transfer")
      .withArgs(ethers.ZeroAddress, user1.address, amount);
    expect(await token.totalSupply()).to.equal(amount);

    const MINTER_ROLE = await token.MINTER_ROLE();
    await expect(token.connect(other).mint(user1.address, amount))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
      .withArgs(other.address, MINTER_ROLE);
  });

  it("reverts when minting above cap", async function () {
    const { token, rewardManager, user1, cap } = await deployWithRewardManager();
    await expect(
      token.connect(rewardManager).mint(user1.address, cap + 1n)
    )
      .to.be.revertedWithCustomError(token, "ERC20ExceededCap")
      .withArgs(cap + 1n, cap);
  });

  it("reverts when burning without BURNER_ROLE", async function () {
    const { token, rewardManager, user1 } = await deployWithRewardManager();
    await token.connect(rewardManager).mint(user1.address, 100n);
    const BURNER_ROLE = await token.BURNER_ROLE();
    await expect(
      token.connect(rewardManager).burn(user1.address, 40n)
    )
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
      .withArgs(rewardManager.address, BURNER_ROLE);
  });

  it("burns tokens via burner role and updates supply", async function () {
    const { token, rewardManager, user1, admin } = await deployWithRewardManager();
    await token.connect(rewardManager).mint(user1.address, 100n);
    await expect(token.connect(admin).burn(user1.address, 40n))
      .to.emit(token, "Transfer")
      .withArgs(user1.address, ethers.ZeroAddress, 40n);
    expect(await token.totalSupply()).to.equal(60n);
  });

  it("supports transfers, approvals and transferFrom", async function () {
    const { token, rewardManager, user1, user2, other } = await deployWithRewardManager();
    await token.connect(rewardManager).mint(user1.address, 100n);
    expect(await token.totalSupply()).to.equal(100n);

    await expect(token.connect(user1).approve(user2.address, 60n))
      .to.emit(token, "Approval")
      .withArgs(user1.address, user2.address, 60n);

    await expect(token.connect(user2).transferFrom(user1.address, other.address, 40n))
      .to.emit(token, "Transfer")
      .withArgs(user1.address, other.address, 40n);

    expect(await token.allowance(user1.address, user2.address)).to.equal(20n);
    expect(await token.balanceOf(other.address)).to.equal(40n);
    expect(await token.totalSupply()).to.equal(100n);

    await expect(token.connect(user1).transfer(user2.address, 10n))
      .to.emit(token, "Transfer")
      .withArgs(user1.address, user2.address, 10n);
    expect(await token.totalSupply()).to.equal(100n);
  });
});