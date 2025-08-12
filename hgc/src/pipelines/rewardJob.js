// placeholder reward distribution script

export async function runReward(epoch) {
  console.log(`(stub) reward distribution for epoch ${epoch}`);
}

if (process.argv[1] && process.argv[1].includes('rewardJob.js')) {
  const epoch = parseInt(process.argv[2] || '1');
  runReward(epoch);
}
